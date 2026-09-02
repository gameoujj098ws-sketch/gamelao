-- 1. Ban fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_set_ban(_user_id uuid, _banned boolean, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  UPDATE public.profiles
     SET banned = _banned,
         ban_reason = CASE WHEN _banned THEN _reason ELSE NULL END,
         banned_at = CASE WHEN _banned THEN now() ELSE NULL END
   WHERE id = _user_id;
END;
$$;

-- 2. Per-user summary for the admin user detail view
CREATE OR REPLACE FUNCTION public.admin_user_summary(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = _user_id),
    'topup_count', (SELECT count(*) FROM public.topups t WHERE t.user_id = _user_id AND t.status = 'approved'),
    'topup_total', (SELECT COALESCE(sum(t.amount),0) FROM public.topups t WHERE t.user_id = _user_id AND t.status = 'approved'),
    'card_count', (SELECT count(*) FROM public.card_topups c WHERE c.user_id = _user_id AND c.status = 'approved'),
    'card_total', (SELECT COALESCE(sum(c.net_amount),0) FROM public.card_topups c WHERE c.user_id = _user_id AND c.status = 'approved'),
    'order_count', (SELECT count(*) FROM public.orders o WHERE o.user_id = _user_id),
    'order_total', (SELECT COALESCE(sum(o.price),0) FROM public.orders o WHERE o.user_id = _user_id),
    'service_count', (SELECT count(*) FROM public.service_orders s WHERE s.user_id = _user_id),
    'service_total', (SELECT COALESCE(sum(s.price),0) FROM public.service_orders s WHERE s.user_id = _user_id),
    'is_admin', public.has_role(_user_id, 'admin')
  ) INTO res;
  RETURN res;
END;
$$;

-- 3. Mini game settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS spin_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spin_cost bigint NOT NULL DEFAULT 5000;

-- 4. Prizes
CREATE TABLE IF NOT EXISTS public.spin_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  amount bigint NOT NULL DEFAULT 0,
  weight integer NOT NULL DEFAULT 1,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spin_prizes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spin_prizes TO authenticated;
GRANT ALL ON public.spin_prizes TO service_role;
ALTER TABLE public.spin_prizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read spin prizes" ON public.spin_prizes FOR SELECT USING (true);
CREATE POLICY "admin manage spin prizes" ON public.spin_prizes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 5. History
CREATE TABLE IF NOT EXISTS public.spin_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prize_label text NOT NULL,
  amount bigint NOT NULL DEFAULT 0,
  cost bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spin_history TO authenticated;
GRANT ALL ON public.spin_history TO service_role;
ALTER TABLE public.spin_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spin history" ON public.spin_history FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- 6. Spin RPC
CREATE OR REPLACE FUNCTION public.spin_wheel()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cost bigint;
  enabled boolean;
  bal bigint;
  is_banned boolean;
  total_weight bigint;
  pick bigint;
  acc bigint := 0;
  chosen public.spin_prizes;
  r public.spin_prizes;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT spin_cost, spin_enabled INTO cost, enabled FROM public.site_settings WHERE id = 1;
  IF NOT COALESCE(enabled, false) THEN RAISE EXCEPTION 'minigame_disabled'; END IF;
  SELECT wallet_balance, banned INTO bal, is_banned FROM public.profiles WHERE id = uid;
  IF COALESCE(is_banned, false) THEN RAISE EXCEPTION 'user_banned'; END IF;
  IF bal IS NULL OR bal < COALESCE(cost,0) THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT COALESCE(sum(weight),0) INTO total_weight FROM public.spin_prizes WHERE weight > 0;
  IF total_weight <= 0 THEN RAISE EXCEPTION 'no_prizes'; END IF;

  pick := floor(random() * total_weight)::bigint;
  FOR r IN SELECT * FROM public.spin_prizes WHERE weight > 0 ORDER BY sort, created_at LOOP
    acc := acc + r.weight;
    IF pick < acc THEN chosen := r; EXIT; END IF;
  END LOOP;

  UPDATE public.profiles
     SET wallet_balance = wallet_balance - COALESCE(cost,0) + chosen.amount
   WHERE id = uid;

  INSERT INTO public.spin_history (user_id, prize_label, amount, cost)
  VALUES (uid, chosen.label, chosen.amount, COALESCE(cost,0));

  RETURN jsonb_build_object('prize_id', chosen.id, 'label', chosen.label, 'amount', chosen.amount, 'cost', COALESCE(cost,0));
END;
$$;