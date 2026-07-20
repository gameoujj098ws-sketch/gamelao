
-- 1) Public stats view: visible to everyone (fixes 0-count when not signed in / cross-browser)
CREATE OR REPLACE VIEW public.public_stats
WITH (security_invoker = false) AS
SELECT
  (SELECT count(*) FROM public.profiles)::bigint AS members,
  (SELECT count(*) FROM public.page_views)::bigint AS visits,
  (SELECT count(*) FROM public.product_stock WHERE sold = false)::bigint AS available,
  (SELECT count(*) FROM public.product_stock WHERE sold = true)::bigint AS sold;

GRANT SELECT ON public.public_stats TO anon, authenticated;

-- Also expose top_spenders to anon (currently only shows for admin)
GRANT EXECUTE ON FUNCTION public.top_spenders() TO anon, authenticated;

-- 2) Card top-up feature: 14-digit cards, 10,000₭ face → 6,000₭ net (40% fee)
CREATE TABLE IF NOT EXISTS public.card_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_code text NOT NULL,
  gross_amount bigint NOT NULL DEFAULT 10000,
  net_amount bigint NOT NULL DEFAULT 6000,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.card_topups TO authenticated;
GRANT ALL ON public.card_topups TO service_role;

ALTER TABLE public.card_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own card topups"
  ON public.card_topups FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "insert own card topup"
  ON public.card_topups FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin update card topup"
  ON public.card_topups FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Submit card: client passes _card (must be 14 digits)
CREATE OR REPLACE FUNCTION public.submit_card_topup(_card text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _card IS NULL OR _card !~ '^\d{14}$' THEN RAISE EXCEPTION 'invalid_card'; END IF;
  INSERT INTO public.card_topups(user_id, card_code, gross_amount, net_amount, status)
    VALUES(_uid, _card, 10000, 6000, 'pending')
    RETURNING id INTO _id;
  RETURN jsonb_build_object('id', _id);
END $$;

GRANT EXECUTE ON FUNCTION public.submit_card_topup(text) TO authenticated;

-- Admin approve/reject a card top-up
CREATE OR REPLACE FUNCTION public.approve_card_topup(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _c public.card_topups%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO _c FROM public.card_topups WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR _c.status <> 'pending' THEN RAISE EXCEPTION 'invalid'; END IF;
  UPDATE public.card_topups SET status='approved' WHERE id=_id;
  UPDATE public.profiles SET wallet_balance = wallet_balance + _c.net_amount WHERE id = _c.user_id;
  INSERT INTO public.topups(user_id, amount, status, method) VALUES(_c.user_id, _c.net_amount, 'approved', 'card');
END $$;

CREATE OR REPLACE FUNCTION public.reject_card_topup(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE public.card_topups SET status='rejected' WHERE id=_id AND status='pending';
END $$;

GRANT EXECUTE ON FUNCTION public.approve_card_topup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_card_topup(uuid) TO authenticated;
