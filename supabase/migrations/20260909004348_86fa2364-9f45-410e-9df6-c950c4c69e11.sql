REVOKE ALL ON FUNCTION public.expire_payment_intents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_payment_intents() TO service_role;
REVOKE ALL ON FUNCTION public.create_payment_intent(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_payment_intent(bigint) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancel_payment_intent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_payment_intent(uuid) TO authenticated, service_role;