import { supabase } from "@/integrations/supabase/client";

export type Item = {
  id: string;
  name: string;
  barcode: string | null;
  current_sale_price: number;
  created_at: string;
};

export type Batch = {
  id: string;
  item_id: string;
  quantity_added: number;
  quantity_remaining: number;
  cost_price: number;
  sale_price: number;
  created_at: string;
};

export type Sale = {
  id: string;
  item_id: string | null;
  batch_id: string | null;
  item_name: string;
  quantity: number;
  sale_price: number;
  cost_price: number;
  profit: number;
  kind: "item" | "free" | "return";
  description: string | null;
  created_at: string;
};

export type Wallet = {
  id: string;
  name: string;
  balance: number;
  created_at: string;
};

export type WalletTx = {
  id: string;
  wallet_id: string;
  wallet_name: string;
  kind: "topup" | "sale";
  amount: number;
  commission: number;
  note: string | null;
  created_at: string;
};

export type ItemWithStock = Item & {
  total_quantity: number;
  total_cost_value: number;
  total_sale_value: number;
  batches: Batch[];
};

export async function fetchItemsWithStock(): Promise<ItemWithStock[]> {
  const [{ data: items, error: e1 }, { data: batches, error: e2 }] = await Promise.all([
    supabase.from("items").select("*").order("created_at", { ascending: false }),
    supabase.from("stock_batches").select("*").order("created_at", { ascending: true }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return (items ?? []).map((it) => {
    const itemBatches = (batches ?? []).filter((b) => b.item_id === it.id);
    const total_quantity = itemBatches.reduce((s, b) => s + b.quantity_remaining, 0);
    const total_cost_value = itemBatches.reduce(
      (s, b) => s + b.quantity_remaining * Number(b.cost_price),
      0,
    );
    const total_sale_value = itemBatches.reduce(
      (s, b) => s + b.quantity_remaining * Number(b.sale_price),
      0,
    );
    return { ...it, total_quantity, total_cost_value, total_sale_value, batches: itemBatches };
  });
}

export async function addStock(params: {
  name: string;
  barcode: string | null;
  quantity: number;
  cost_price: number;
  sale_price: number;
}) {
  let itemId: string;
  // Try to find existing item by barcode or name
  let existing = null as Item | null;
  if (params.barcode) {
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("barcode", params.barcode)
      .maybeSingle();
    existing = data as Item | null;
  }
  if (!existing) {
    const { data } = await supabase
      .from("items")
      .select("*")
      .eq("name", params.name)
      .maybeSingle();
    existing = data as Item | null;
  }

  if (existing) {
    itemId = existing.id;
    // Update current sale price to the new price
    await supabase
      .from("items")
      .update({ current_sale_price: params.sale_price, barcode: params.barcode ?? existing.barcode })
      .eq("id", itemId);
  } else {
    const { data, error } = await supabase
      .from("items")
      .insert({
        name: params.name,
        barcode: params.barcode,
        current_sale_price: params.sale_price,
      })
      .select()
      .single();
    if (error) throw error;
    itemId = data.id;
  }

  const { error: bErr } = await supabase.from("stock_batches").insert({
    item_id: itemId,
    quantity_added: params.quantity,
    quantity_remaining: params.quantity,
    cost_price: params.cost_price,
    sale_price: params.sale_price,
  });
  if (bErr) throw bErr;
}

export async function recordSale(itemId: string, quantity: number) {
  const { error } = await supabase.rpc("record_sale", {
    p_item_id: itemId,
    p_quantity: quantity,
  });
  if (error) throw error;
}

export async function findItemByBarcode(barcode: string): Promise<Item | null> {
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("barcode", barcode)
    .maybeSingle();
  return (data as Item | null) ?? null;
}

export async function fetchSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteItem(id: string) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 2,
  }).format(n);
}
