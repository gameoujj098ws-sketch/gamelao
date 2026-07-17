
-- slips: user upload own, read own; admin read all
CREATE POLICY "slips upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='slips' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "slips read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='slips' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));

-- product-images: read anyone, admin write
CREATE POLICY "product-images read" ON storage.objects FOR SELECT
  USING (bucket_id='product-images');
CREATE POLICY "product-images admin" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='product-images' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id='product-images' AND public.has_role(auth.uid(),'admin'));

-- site-assets: read anyone, admin write
CREATE POLICY "site-assets read" ON storage.objects FOR SELECT
  USING (bucket_id='site-assets');
CREATE POLICY "site-assets admin" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='site-assets' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id='site-assets' AND public.has_role(auth.uid(),'admin'));
