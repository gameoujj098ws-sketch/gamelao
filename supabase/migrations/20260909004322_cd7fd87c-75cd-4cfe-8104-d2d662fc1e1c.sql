CREATE TABLE public.payment_config (
  id integer PRIMARY KEY DEFAULT 1,
  api_url text,
  api_key text,
  merchant_name text NOT NULL DEFAULT 'SOMYONE KHAMKHEUNG MR.',
  timeout_minutes integer NOT NULL DEFAULT 15,
  webhook_secret text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.payment_config TO authenticated;
GRANT ALL ON public.payment_config TO service_role;
ALTER TABLE public.payment_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin payment config" ON public.payment_config FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
INSERT INTO public.payment_config (id) VALUES (1);

CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  qr_payload text,
  provider_txn_id text,
  bank_ref text,
  bank_payload jsonb,
  fail_reason text,
  expires_at timestamptz NOT NULL,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payment_intents_bank_ref_uniq ON public.payment_intents (bank_ref) WHERE bank_ref IS NOT NULL;
CREATE INDEX payment_intents_user_idx ON public.payment_intents (user_id, created_at DESC);
GRANT SELECT ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payment intents" ON public.payment_intents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.expire_payment_intents()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.payment_intents SET status='expired'
   WHERE status='pending' AND expires_at < now();
$$;

CREATE OR REPLACE FUNCTION public.create_payment_intent(_amount bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  cfg public.payment_config%ROWTYPE;
  is_banned boolean;
  existing public.payment_intents%ROWTYPE;
  row public.payment_intents%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _amount IS NULL OR _amount < 1000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  SELECT banned INTO is_banned FROM public.profiles WHERE id = uid;
  IF COALESCE(is_banned,false) THEN RAISE EXCEPTION 'user_banned'; END IF;
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
END $$;

CREATE OR REPLACE FUNCTION public.cancel_payment_intent(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.payment_intents SET status='cancelled'
   WHERE id = _id AND status='pending'
     AND (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
END $$;

CREATE OR REPLACE FUNCTION public.settle_payment_intent(_id uuid, _ok boolean, _bank_ref text, _payload jsonb, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE row public.payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO row FROM public.payment_intents WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'intent_not_found'; END IF;
  IF row.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'already', row.status); END IF;
  IF NOT _ok THEN
    UPDATE public.payment_intents
       SET status='failed', bank_ref=_bank_ref, bank_payload=_payload,
           fail_reason=_reason, settled_at=now()
     WHERE id=_id;
    RETURN jsonb_build_object('ok', false);
  END IF;
  UPDATE public.payment_intents
     SET status='success', bank_ref=_bank_ref, bank_payload=_payload, settled_at=now()
   WHERE id=_id;
  UPDATE public.profiles SET wallet_balance = wallet_balance + row.amount WHERE id = row.user_id;
  INSERT INTO public.topups(user_id, amount, status, method, note)
    VALUES (row.user_id, row.amount, 'approved', 'laoqr', COALESCE(_bank_ref,''));
  RETURN jsonb_build_object('ok', true, 'user_id', row.user_id, 'amount', row.amount);
END $$;

REVOKE ALL ON FUNCTION public.settle_payment_intent(uuid, boolean, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payment_intent(uuid, boolean, text, jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END $fn$;

CREATE TRIGGER payment_config_updated_at BEFORE UPDATE ON public.payment_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();