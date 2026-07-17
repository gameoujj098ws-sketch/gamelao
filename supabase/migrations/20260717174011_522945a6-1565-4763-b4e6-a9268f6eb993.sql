
-- purchase general product: pick 1 unsold stock atomically
CREATE OR REPLACE FUNCTION public.purchase_product(_product_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _prod public.products%ROWTYPE;
  _stock public.product_stock%ROWTYPE;
  _bal bigint;
  _order_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _prod FROM public.products WHERE id = _product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'product_not_found'; END IF;
  IF _prod.is_service THEN RAISE EXCEPTION 'wrong_product_type'; END IF;
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
REVOKE EXECUTE ON FUNCTION public.purchase_product(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_product(uuid) TO authenticated;

-- purchase service product
CREATE OR REPLACE FUNCTION public.purchase_service(_product_id uuid, _note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _prod public.products%ROWTYPE;
  _bal bigint;
  _oid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _prod FROM public.products WHERE id = _product_id;
  IF NOT FOUND OR NOT _prod.is_service THEN RAISE EXCEPTION 'product_not_found'; END IF;
  SELECT wallet_balance INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal < _prod.price THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE public.profiles SET wallet_balance = wallet_balance - _prod.price WHERE id = _uid;
  INSERT INTO public.service_orders(user_id, product_id, product_name, price, customer_note, status)
    VALUES(_uid, _product_id, _prod.name, _prod.price, _note, 'pending')
    RETURNING id INTO _oid;
  RETURN jsonb_build_object('order_id', _oid);
END $$;
REVOKE EXECUTE ON FUNCTION public.purchase_service(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_service(uuid, text) TO authenticated;

-- redeem code
CREATE OR REPLACE FUNCTION public.redeem_code(_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _c public.redeem_codes%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _c FROM public.redeem_codes WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF _c.used_by IS NOT NULL THEN RAISE EXCEPTION 'code_used'; END IF;
  UPDATE public.redeem_codes SET used_by=_uid, used_at=now() WHERE id=_c.id;
  UPDATE public.profiles SET wallet_balance = wallet_balance + _c.amount WHERE id=_uid;
  INSERT INTO public.topups(user_id, amount, status, method) VALUES(_uid, _c.amount, 'approved', 'code');
  RETURN jsonb_build_object('amount', _c.amount);
END $$;
REVOKE EXECUTE ON FUNCTION public.redeem_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_code(text) TO authenticated;

-- admin approve topup
CREATE OR REPLACE FUNCTION public.approve_topup(_topup_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _t public.topups%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO _t FROM public.topups WHERE id = _topup_id FOR UPDATE;
  IF NOT FOUND OR _t.status <> 'pending' THEN RAISE EXCEPTION 'invalid'; END IF;
  UPDATE public.topups SET status='approved' WHERE id=_topup_id;
  UPDATE public.profiles SET wallet_balance = wallet_balance + _t.amount WHERE id = _t.user_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.approve_topup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_topup(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_topup(_topup_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE public.topups SET status='rejected' WHERE id=_topup_id AND status='pending';
END $$;
REVOKE EXECUTE ON FUNCTION public.reject_topup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_topup(uuid) TO authenticated;

-- admin resolve service order
CREATE OR REPLACE FUNCTION public.resolve_service_order(_order_id uuid, _success boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _o public.service_orders%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO _o FROM public.service_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND OR _o.status <> 'pending' THEN RAISE EXCEPTION 'invalid'; END IF;
  IF _success THEN
    UPDATE public.service_orders SET status='success' WHERE id=_order_id;
  ELSE
    UPDATE public.service_orders SET status='rejected' WHERE id=_order_id;
    UPDATE public.profiles SET wallet_balance = wallet_balance + _o.price WHERE id = _o.user_id;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.resolve_service_order(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_service_order(uuid, boolean) TO authenticated;

-- admin set wallet
CREATE OR REPLACE FUNCTION public.admin_set_wallet(_user_id uuid, _new_balance bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE public.profiles SET wallet_balance = _new_balance WHERE id = _user_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_wallet(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_wallet(uuid, bigint) TO authenticated;

-- admin stats
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  RETURN jsonb_build_object(
    'members', (SELECT COUNT(*) FROM public.profiles),
    'visits', (SELECT COUNT(*) FROM public.page_views),
    'visits_month', (SELECT COUNT(*) FROM public.page_views WHERE created_at > date_trunc('month', now())),
    'revenue_month', COALESCE((SELECT SUM(amount) FROM public.topups WHERE status='approved' AND created_at > date_trunc('month', now())),0),
    'revenue_total', COALESCE((SELECT SUM(amount) FROM public.topups WHERE status='approved'),0),
    'orders_pending_topups', (SELECT COUNT(*) FROM public.topups WHERE status='pending'),
    'orders_pending_services', (SELECT COUNT(*) FROM public.service_orders WHERE status='pending')
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;

-- top spenders (public)
CREATE OR REPLACE FUNCTION public.top_spenders()
RETURNS TABLE(username text, total bigint, times bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.username, COALESCE(SUM(t.amount),0)::bigint AS total, COUNT(t.id)::bigint AS times
  FROM public.profiles p
  JOIN public.topups t ON t.user_id = p.id AND t.status='approved'
  GROUP BY p.id, p.username
  ORDER BY total DESC
  LIMIT 3
$$;
REVOKE EXECUTE ON FUNCTION public.top_spenders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.top_spenders() TO anon, authenticated;
