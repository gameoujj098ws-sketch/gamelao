-- ===== profiles: block self-service balance edits =====
DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;

CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = id OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END $$;

DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username));

-- sanitize username at signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text; _base text;
BEGIN
  _name := btrim(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'username',''), '[[:cntrl:]]', '', 'g'));
  IF char_length(_name) < 3 OR char_length(_name) > 24 THEN
    _name := left(regexp_replace(split_part(NEW.email,'@',1), '[^A-Za-z0-9_]', '', 'g'), 20);
    IF char_length(_name) < 3 THEN _name := 'user'; END IF;
  END IF;
  _base := _name;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(_name)) LOOP
    _name := left(_base, 18) || floor(random()*100000)::int::text;
  END LOOP;
  INSERT INTO public.profiles (id, username, email, wallet_balance) VALUES (NEW.id, _name, NEW.email, 0);
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  IF lower(NEW.email) = 'glaos4993@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- ===== remove direct inserts that bypassed the purchase / top-up functions =====
DROP POLICY IF EXISTS "insert own order" ON public.orders;
DROP POLICY IF EXISTS "insert own service order" ON public.service_orders;
DROP POLICY IF EXISTS "insert own topup" ON public.topups;
DROP POLICY IF EXISTS "insert own card topup" ON public.card_topups;

-- ===== redeem codes: never readable / writable by customers =====
DROP POLICY IF EXISTS "read code for redeem" ON public.redeem_codes;
DROP POLICY IF EXISTS "redeem update" ON public.redeem_codes;

-- ===== banned-user + validation checks inside purchase functions =====
CREATE OR REPLACE FUNCTION public.assert_active_user(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT banned INTO _b FROM public.profiles WHERE id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;
  IF COALESCE(_b,false) THEN RAISE EXCEPTION 'user_banned'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.assert_active_user(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.purchase_product(_product_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _prod public.products%ROWTYPE;
  _stock public.product_stock%ROWTYPE;
  _bal bigint;
  _order_id uuid;
BEGIN
  PERFORM public.assert_active_user(_uid);
  SELECT * INTO _prod FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;
  IF _prod.is_service THEN RAISE EXCEPTION 'wrong_product_type'; END IF;
  IF _prod.price < 0 THEN RAISE EXCEPTION 'invalid_price'; END IF;
  SELECT wallet_balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal < _prod.price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  SELECT * INTO _stock FROM public.product_stock
    WHERE product_id = _product_id AND sold = false
    ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RAISE EXCEPTION 'out_of_stock'; END IF;
  UPDATE public.product_stock SET sold=true, sold_to=_uid, sold_at=now() WHERE id=_stock.id;
  UPDATE public.profiles SET wallet_balance = wallet_balance - _prod.price WHERE id = _uid;
  INSERT INTO public.orders(user_id, product_id, product_name, price, game_data)
    VALUES(_uid, _product_id, _prod.name, _prod.price, _stock.game_data)
    RETURNING id INTO _order_id;
  RETURN jsonb_build_object('order_id', _order_id, 'game_data', _stock.game_data);
END $$;

CREATE OR REPLACE FUNCTION public.purchase_service(_product_id uuid, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _prod public.products%ROWTYPE; _bal bigint; _oid uuid;
BEGIN
  PERFORM public.assert_active_user(_uid);
  SELECT * INTO _prod FROM public.products WHERE id = _product_id;
  IF NOT FOUND OR NOT _prod.is_service THEN RAISE EXCEPTION 'product_not_found'; END IF;
  SELECT wallet_balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal < _prod.price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE public.profiles SET wallet_balance = wallet_balance - _prod.price WHERE id = _uid;
  INSERT INTO public.service_orders(user_id, product_id, product_name, price, customer_note, status)
    VALUES(_uid, _product_id, _prod.name, _prod.price, left(COALESCE(_note,''), 2000), 'pending')
    RETURNING id INTO _oid;
  RETURN jsonb_build_object('order_id', _oid);
END $$;

CREATE OR REPLACE FUNCTION public.purchase_service_package(_product_id uuid, _package_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _prod public.products%ROWTYPE;
  _pack public.service_packages%ROWTYPE;
  _price bigint; _bal bigint; _oid uuid; _note text;
BEGIN
  PERFORM public.assert_active_user(_uid);
  SELECT * INTO _prod FROM public.products WHERE id = _product_id;
  IF NOT FOUND OR NOT _prod.is_service THEN RAISE EXCEPTION 'product_not_found'; END IF;
  IF _package_id IS NOT NULL THEN
    SELECT * INTO _pack FROM public.service_packages WHERE id = _package_id AND product_id = _product_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'package_not_found'; END IF;
    _price := _pack.price;
  ELSE
    _price := _prod.price;
  END IF;
  IF _answers IS NOT NULL AND (jsonb_typeof(_answers) <> 'array' OR jsonb_array_length(_answers) > 30 OR length(_answers::text) > 8000) THEN
    RAISE EXCEPTION 'invalid_answers';
  END IF;
  SELECT wallet_balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal < _price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  SELECT string_agg(COALESCE(e->>'label','') || ': ' || COALESCE(e->>'value',''), E'\n')
    INTO _note FROM jsonb_array_elements(COALESCE(_answers,'[]'::jsonb)) e;
  UPDATE public.profiles SET wallet_balance = wallet_balance - _price WHERE id = _uid;
  INSERT INTO public.service_orders(user_id, product_id, product_name, price, customer_note, status, package_id, package_name, answers)
    VALUES(_uid, _product_id, _prod.name, _price, COALESCE(_note,''), 'pending', _package_id,
           CASE WHEN _package_id IS NULL THEN NULL ELSE _pack.name END, COALESCE(_answers,'[]'::jsonb))
    RETURNING id INTO _oid;
  RETURN jsonb_build_object('order_id', _oid);
END $$;

CREATE OR REPLACE FUNCTION public.redeem_code(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c public.redeem_codes%ROWTYPE;
BEGIN
  PERFORM public.assert_active_user(_uid);
  IF _code IS NULL OR length(_code) > 64 THEN RAISE EXCEPTION 'invalid_code'; END IF;
  SELECT * INTO _c FROM public.redeem_codes WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF _c.used_by IS NOT NULL THEN RAISE EXCEPTION 'code_used'; END IF;
  UPDATE public.redeem_codes SET used_by=_uid, used_at=now() WHERE id=_c.id;
  UPDATE public.profiles SET wallet_balance = wallet_balance + _c.amount WHERE id=_uid;
  INSERT INTO public.topups(user_id, amount, status, method) VALUES(_uid, _c.amount, 'approved', 'code');
  RETURN jsonb_build_object('amount', _c.amount);
END $$;

CREATE OR REPLACE FUNCTION public.submit_card_topup(_card text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _pending int;
BEGIN
  PERFORM public.assert_active_user(_uid);
  IF _card IS NULL OR _card !~ '^\d{14}$' THEN RAISE EXCEPTION 'invalid_card'; END IF;
  IF EXISTS (SELECT 1 FROM public.card_topups WHERE card_code = _card) THEN RAISE EXCEPTION 'card_already_submitted'; END IF;
  SELECT count(*) INTO _pending FROM public.card_topups WHERE user_id=_uid AND status='pending';
  IF _pending >= 10 THEN RAISE EXCEPTION 'too_many_pending'; END IF;
  INSERT INTO public.card_topups(user_id, card_code, gross_amount, net_amount, status)
    VALUES(_uid, _card, 10000, 6000, 'pending') RETURNING id INTO _id;
  RETURN jsonb_build_object('id', _id);
END $$;

-- pending slip top-up (never credits the wallet)
CREATE OR REPLACE FUNCTION public.submit_pending_topup(_amount bigint, _slip_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  PERFORM public.assert_active_user(_uid);
  IF _amount IS NULL OR _amount < 1000 OR _amount > 50000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF _slip_url IS NULL OR _slip_url NOT LIKE (_uid::text || '/%') THEN RAISE EXCEPTION 'invalid_slip'; END IF;
  INSERT INTO public.topups(user_id, amount, slip_url, method, status)
    VALUES(_uid, _amount, _slip_url, 'qr', 'pending') RETURNING id INTO _id;
  RETURN jsonb_build_object('id', _id);
END $$;

-- server-only: record verified QR slip result and credit wallet
CREATE OR REPLACE FUNCTION public.finalize_slip_topup(_user_id uuid, _amount bigint, _slip_url text, _ref text, _ok boolean, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _norm text := upper(regexp_replace(coalesce(_ref,''), '[^A-Za-z0-9]', '', 'g'));
        _ok2 boolean := _ok; _note2 text := _note; _b boolean;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'invalid_user'; END IF;
  IF _amount IS NULL OR _amount < 1000 OR _amount > 50000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  SELECT banned INTO _b FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile_not_found'; END IF;
  IF COALESCE(_b,false) THEN _ok2 := false; _note2 := 'user_banned'; END IF;
  IF _ok2 THEN
    IF length(_norm) < 6 THEN
      _ok2 := false; _note2 := 'ອ່ານເລກອ້າງອີງໃນສະລິບບໍ່ໄດ້';
    ELSIF EXISTS (SELECT 1 FROM public.slip_refs WHERE ref = _norm) THEN
      _ok2 := false; _note2 := 'ສະລິບນີ້ຖືກໃຊ້ໄປແລ້ວ (ເລກອ້າງອີງ ' || _norm || ')';
    ELSE
      INSERT INTO public.slip_refs(ref, user_id, amount) VALUES (_norm, _user_id, _amount);
    END IF;
  END IF;
  INSERT INTO public.topups(user_id, amount, slip_url, method, status, note)
    VALUES(_user_id, _amount, _slip_url, 'qr', CASE WHEN _ok2 THEN 'approved' ELSE 'rejected' END, left(COALESCE(_note2,''), 500));
  IF _ok2 THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + _amount WHERE id = _user_id;
  END IF;
  RETURN jsonb_build_object('ok', _ok2, 'reason', _note2);
END $$;
REVOKE ALL ON FUNCTION public.finalize_slip_topup(uuid,bigint,text,text,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_slip_topup(uuid,bigint,text,text,boolean,text) TO service_role;

-- claim_slip_ref is now handled server-side only
REVOKE ALL ON FUNCTION public.claim_slip_ref(text,bigint) FROM PUBLIC, anon, authenticated;

-- keep anon away from all purchase / top-up RPCs
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid), public.purchase_service(uuid,text),
  public.purchase_service_package(uuid,uuid,jsonb), public.redeem_code(text), public.submit_card_topup(text),
  public.submit_pending_topup(bigint,text), public.spin_wheel(), public.create_payment_intent(bigint) FROM anon;