CREATE OR REPLACE FUNCTION public.record_sale(p_item_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_remaining integer := p_quantity;
  v_batch record;
  v_take integer;
  v_item_name text;
  v_current_price numeric;
BEGIN
  SELECT name, current_sale_price INTO v_item_name, v_current_price FROM public.items WHERE id = p_item_id;
  IF v_item_name IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;

  FOR v_batch IN
    SELECT * FROM public.stock_batches
    WHERE item_id = p_item_id AND quantity_remaining > 0
    ORDER BY created_at ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(v_remaining, v_batch.quantity_remaining);

    UPDATE public.stock_batches
      SET quantity_remaining = quantity_remaining - v_take
      WHERE id = v_batch.id;

    INSERT INTO public.sales (item_id, batch_id, item_name, quantity, sale_price, cost_price, profit)
    VALUES (
      p_item_id, v_batch.id, v_item_name, v_take,
      v_current_price, v_batch.cost_price,
      (v_current_price - v_batch.cost_price) * v_take
    );

    v_remaining := v_remaining - v_take;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient stock: short by %', v_remaining;
  END IF;
END;
$function$;