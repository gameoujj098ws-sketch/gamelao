ALTER TABLE public.topups ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.card_topups ADD COLUMN IF NOT EXISTS note text;