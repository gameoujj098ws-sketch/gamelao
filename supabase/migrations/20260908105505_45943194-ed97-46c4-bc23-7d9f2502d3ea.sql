CREATE TABLE public.slip_refs (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  amount bigint,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.slip_refs TO authenticated;
GRANT ALL ON public.slip_refs TO service_role;
ALTER TABLE public.slip_refs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read slip refs" ON public.slip_refs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.claim_slip_ref(_ref text, _amount bigint DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _norm text := upper(regexp_replace(coalesce(_ref,''), '[^A-Za-z0-9]', '', 'g'));
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(_norm) < 6 THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.slip_refs WHERE ref = _norm) THEN RETURN false; END IF;
  INSERT INTO public.slip_refs(ref, user_id, amount) VALUES (_norm, _uid, _amount);
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.claim_slip_ref(text, bigint) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_slip_ref(text, bigint) TO authenticated;