-- 1. Cap top-up intent amounts + per-day rate limit
CREATE OR REPLACE FUNCTION public.create_payment_intent(_amount bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  cfg public.payment_config%ROWTYPE;
  is_banned boolean;
  existing public.payment_intents%ROWTYPE;
  row public.payment_intents%ROWTYPE;
  today_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _amount IS NULL OR _amount < 1000 OR _amount > 20000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  SELECT banned INTO is_banned FROM public.profiles WHERE id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;
  IF COALESCE(is_banned,false) THEN RAISE EXCEPTION 'user_banned'; END IF;
  SELECT count(*) INTO today_count FROM public.payment_intents
    WHERE user_id = uid AND created_at > now() - interval '1 day';
  IF today_count >= 20 THEN RAISE EXCEPTION 'too_many_requests'; END IF;
  SELECT * INTO cfg FROM public.payment_config WHERE id = 1;
  PERFORM public.expire_payment_intents();
  SELECT * INTO existing FROM public.payment_intents
    WHERE user_id = uid AND status='pending' ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('id', existing.id, 'amount', existing.amount,
      'expires_at', existing.expires_at, 'created_at', existing.created_at, 'reused', true);
  END IF;
  INSERT INTO public.payment_intents(user_id, amount, expires_at)
    VALUES (uid, _amount, now() + make_interval(mins => COALESCE(cfg.timeout_minutes,15)))
    RETURNING * INTO row;
  RETURN jsonb_build_object('id', row.id, 'amount', row.amount,
    'expires_at', row.expires_at, 'created_at', row.created_at, 'reused', false);
END $function$;

-- 2. Service purchase must answer every configured field and use a real package
CREATE OR REPLACE FUNCTION public.purchase_service_package(_product_id uuid, _package_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _prod public.products%ROWTYPE;
  _pack public.service_packages%ROWTYPE;
  _price bigint; _bal bigint; _oid uuid; _note text;
  _pack_count int; _missing int;
BEGIN
  PERFORM public.assert_active_user(_uid);
  SELECT * INTO _prod FROM public.products WHERE id = _product_id;
  IF NOT FOUND OR NOT _prod.is_service THEN RAISE EXCEPTION 'product_not_found'; END IF;

  SELECT count(*) INTO _pack_count FROM public.service_packages WHERE product_id = _product_id;
  IF _pack_count > 0 AND _package_id IS NULL THEN RAISE EXCEPTION 'package_required'; END IF;

  IF _package_id IS NOT NULL THEN
    SELECT * INTO _pack FROM public.service_packages WHERE id = _package_id AND product_id = _product_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'package_not_found'; END IF;
    _price := _pack.price;
  ELSE
    _price := _prod.price;
  END IF;
  IF _price IS NULL OR _price <= 0 THEN RAISE EXCEPTION 'invalid_price'; END IF;

  IF _answers IS NOT NULL AND (jsonb_typeof(_answers) <> 'array' OR jsonb_array_length(_answers) > 30 OR length(_answers::text) > 8000) THEN
    RAISE EXCEPTION 'invalid_answers';
  END IF;

  -- every field the shop configured must arrive with a non-empty value
  SELECT count(*) INTO _missing
  FROM public.service_fields f
  WHERE f.product_id = _product_id
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(_answers,'[]'::jsonb)) e
      WHERE btrim(COALESCE(e->>'label','')) = btrim(f.label)
        AND btrim(COALESCE(e->>'value','')) <> ''
    );
  IF _missing > 0 THEN RAISE EXCEPTION 'missing_required_fields'; END IF;

  SELECT wallet_balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal IS NULL OR _bal < _price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  SELECT string_agg(COALESCE(e->>'label','') || ': ' || COALESCE(e->>'value',''), E'\n')
    INTO _note FROM jsonb_array_elements(COALESCE(_answers,'[]'::jsonb)) e;
  UPDATE public.profiles SET wallet_balance = wallet_balance - _price WHERE id = _uid;
  INSERT INTO public.service_orders(user_id, product_id, product_name, price, customer_note, status, package_id, package_name, answers)
    VALUES(_uid, _product_id, _prod.name, _price, COALESCE(_note,''), 'pending', _package_id,
           CASE WHEN _package_id IS NULL THEN NULL ELSE _pack.name END, COALESCE(_answers,'[]'::jsonb))
    RETURNING id INTO _oid;
  RETURN jsonb_build_object('order_id', _oid);
END $function$;

-- 3. Legacy plain service purchase: block when the product needs fields/packages
CREATE OR REPLACE FUNCTION public.purchase_service(_product_id uuid, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _prod public.products%ROWTYPE; _bal bigint; _oid uuid;
BEGIN
  PERFORM public.assert_active_user(_uid);
  SELECT * INTO _prod FROM public.products WHERE id = _product_id;
  IF NOT FOUND OR NOT _prod.is_service THEN RAISE EXCEPTION 'product_not_found'; END IF;
  IF _prod.price IS NULL OR _prod.price <= 0 THEN RAISE EXCEPTION 'invalid_price'; END IF;
  IF EXISTS (SELECT 1 FROM public.service_packages WHERE product_id = _product_id) THEN
    RAISE EXCEPTION 'package_required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.service_fields WHERE product_id = _product_id) THEN
    RAISE EXCEPTION 'missing_required_fields';
  END IF;
  SELECT wallet_balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal IS NULL OR _bal < _prod.price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE public.profiles SET wallet_balance = wallet_balance - _prod.price WHERE id = _uid;
  INSERT INTO public.service_orders(user_id, product_id, product_name, price, customer_note, status)
    VALUES(_uid, _product_id, _prod.name, _prod.price, left(COALESCE(_note,''), 2000), 'pending')
    RETURNING id INTO _oid;
  RETURN jsonb_build_object('order_id', _oid);
END $function$;

-- 4. Hard ceiling on wallet balances (blocks absurd fake amounts)
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _direct boolean := current_user IN ('authenticated','anon');
BEGIN
  IF _direct AND NOT public.has_role(auth.uid(),'admin') THEN
    IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
       OR NEW.banned IS DISTINCT FROM OLD.banned
       OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason
       OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'forbidden_field_change';
    END IF;
  END IF;
  IF NEW.wallet_balance < 0 THEN RAISE EXCEPTION 'negative_balance'; END IF;
  IF NEW.wallet_balance > 500000000 THEN RAISE EXCEPTION 'balance_limit_exceeded'; END IF;
  NEW.username := btrim(regexp_replace(COALESCE(NEW.username,''), '[[:cntrl:]]', '', 'g'));
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    IF char_length(NEW.username) < 3 OR char_length(NEW.username) > 24 THEN
      RAISE EXCEPTION 'invalid_username';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = lower(NEW.username) AND p.id <> NEW.id) THEN
      RAISE EXCEPTION 'username_taken';
    END IF;
  END IF;
  RETURN NEW;
END $function$;

-- 5. Remove execute rights from anonymous visitors / PUBLIC on sensitive RPCs
REVOKE ALL ON FUNCTION public.approve_card_topup(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_card_topup(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_ban(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_user_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.purchase_service_package(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spin_wheel() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_card_topup(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_pending_topup(bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.top_spenders() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.protect_profile_fields() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.approve_card_topup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_card_topup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ban(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_service_package(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spin_wheel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_card_topup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_pending_topup(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_intent(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_service(uuid, text) TO authenticated;