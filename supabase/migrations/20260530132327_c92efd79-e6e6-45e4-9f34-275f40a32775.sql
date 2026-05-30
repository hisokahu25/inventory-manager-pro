
-- Add kind & description to sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'item';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS description text;

-- Record a return: returns qty to most recent active batch (or creates one), inserts negative sale
CREATE OR REPLACE FUNCTION public.record_return(p_item_id uuid, p_quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_name text;
  v_current_price numeric;
  v_batch record;
  v_cost numeric;
  v_batch_id uuid;
BEGIN
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
  SELECT name, current_sale_price INTO v_item_name, v_current_price FROM public.items WHERE id = p_item_id;
  IF v_item_name IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;

  SELECT * INTO v_batch FROM public.stock_batches
    WHERE item_id = p_item_id ORDER BY created_at DESC LIMIT 1;

  IF v_batch.id IS NULL THEN
    INSERT INTO public.stock_batches(item_id, quantity_added, quantity_remaining, cost_price, sale_price)
    VALUES (p_item_id, p_quantity, p_quantity, 0, v_current_price)
    RETURNING id, cost_price INTO v_batch_id, v_cost;
  ELSE
    UPDATE public.stock_batches SET quantity_remaining = quantity_remaining + p_quantity WHERE id = v_batch.id;
    v_batch_id := v_batch.id;
    v_cost := v_batch.cost_price;
  END IF;

  INSERT INTO public.sales(item_id, batch_id, item_name, quantity, sale_price, cost_price, profit, kind)
  VALUES (p_item_id, v_batch_id, v_item_name, -p_quantity, v_current_price, v_cost, -(v_current_price - v_cost) * p_quantity, 'return');
END;
$$;

-- Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallets TO anon, authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_wallets" ON public.wallets FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  wallet_name text NOT NULL,
  kind text NOT NULL, -- 'topup' | 'sale'
  amount numeric NOT NULL,         -- topup: added balance; sale: cash sold
  commission numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_transactions TO anon, authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all_wallet_tx" ON public.wallet_transactions FOR ALL USING (true) WITH CHECK (true);

-- RPC for wallet operations (atomic balance update)
CREATE OR REPLACE FUNCTION public.wallet_topup(p_wallet_id uuid, p_amount numeric, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  UPDATE public.wallets SET balance = balance + p_amount WHERE id = p_wallet_id RETURNING name INTO v_name;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  INSERT INTO public.wallet_transactions(wallet_id, wallet_name, kind, amount, commission, note)
  VALUES (p_wallet_id, v_name, 'topup', p_amount, 0, p_note);
END; $$;

CREATE OR REPLACE FUNCTION public.wallet_sale(p_wallet_id uuid, p_amount numeric, p_commission numeric, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_balance numeric;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT name, balance INTO v_name, v_balance FROM public.wallets WHERE id = p_wallet_id;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;
  UPDATE public.wallets SET balance = balance - p_amount WHERE id = p_wallet_id;
  INSERT INTO public.wallet_transactions(wallet_id, wallet_name, kind, amount, commission, note)
  VALUES (p_wallet_id, v_name, 'sale', p_amount, COALESCE(p_commission, 0), p_note);
END; $$;
