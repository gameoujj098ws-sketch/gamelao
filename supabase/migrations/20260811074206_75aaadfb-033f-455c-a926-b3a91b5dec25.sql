CREATE TABLE public.service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  price bigint NOT NULL,
  image_url text,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_packages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_packages TO authenticated;
GRANT ALL ON public.service_packages TO service_role;
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read service packages" ON public.service_packages FOR SELECT USING (true);
CREATE POLICY "admin manage service packages" ON public.service_packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.service_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.service_fields TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_fields TO authenticated;
GRANT ALL ON public.service_fields TO service_role;
ALTER TABLE public.service_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read service fields" ON public.service_fields FOR SELECT USING (true);
CREATE POLICY "admin manage service fields" ON public.service_fields FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.service_orders
  ADD COLUMN package_id uuid REFERENCES public.service_packages(id) ON DELETE SET NULL,
  ADD COLUMN package_name text,
  ADD COLUMN answers jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.site_settings
  ADD COLUMN qr_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN card_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.purchase_service_package(_product_id uuid, _package_id uuid, _answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _prod public.products%ROWTYPE;
  _pack public.service_packages%ROWTYPE;
  _price bigint;
  _bal bigint;
  _oid uuid;
  _note text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _prod FROM public.products WHERE id = _product_id;
  IF NOT FOUND OR NOT _prod.is_service THEN RAISE EXCEPTION 'product_not_found'; END IF;
  IF _package_id IS NOT NULL THEN
    SELECT * INTO _pack FROM public.service_packages WHERE id = _package_id AND product_id = _product_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'package_not_found'; END IF;
    _price := _pack.price;
  ELSE
    _price := _prod.price;
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