import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, Fragment, type FormEvent } from "react";
import { Plus, Trash2, Package, Barcode, ScanLine, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  addStock,
  deleteItem,
  fetchItemsWithStock,
  formatCurrency,
} from "@/lib/inventory";
import { ExportButtons } from "@/components/ExportButtons";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export function InventoryTab() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["items-with-stock"],
    queryFn: fetchItemsWithStock,
  });

  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [sale, setSale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !quantity || !cost || !sale) {
      toast.error("الرجاء ملء جميع الحقول المطلوبة");
      return;
    }
    setSubmitting(true);
    try {
      await addStock({
        name: name.trim(),
        barcode: barcode.trim() || null,
        quantity: Number(quantity),
        cost_price: Number(cost),
        sale_price: Number(sale),
      });
      toast.success("تمت إضافة المخزون بنجاح");
      setName("");
      setBarcode("");
      setQuantity("");
      setCost("");
      setSale("");
      qc.invalidateQueries({ queryKey: ["items-with-stock"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    } catch (err) {
      toast.error("خطأ: " + (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBarcodeKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Most USB barcode scanners append Enter. Focus quantity on Enter.
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("qty-input")?.focus();
    }
  };

  const handleDelete = async (id: string, n: string) => {
    if (!confirm(`حذف "${n}" نهائياً؟`)) return;
    try {
      await deleteItem(id);
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["items-with-stock"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const totals = items.reduce(
    (a, it) => {
      a.qty += it.total_quantity;
      a.cost += it.total_cost_value;
      a.sale += it.total_sale_value;
      return a;
    },
    { qty: 0, cost: 0, sale: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Add stock form */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-bold">إضافة مخزون جديد</h3>
        </div>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Label htmlFor="name-input" className="mb-1.5 block">اسم الصنف *</Label>
            <Input
              id="name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: عبوة شامبو"
            />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="barcode-input" className="mb-1.5 flex items-center gap-1.5">
              <Barcode className="h-4 w-4" /> الباركود
            </Label>
            <div className="relative">
              <Input
                id="barcode-input"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleBarcodeKey}
                placeholder="امسح أو اكتب الباركود"
                className="pl-10"
              />
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md bg-primary/10 p-1.5 text-primary hover:bg-primary/20"
                title="مسح بالكاميرا"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="qty-input" className="mb-1.5 block">الكمية *</Label>
            <Input
              id="qty-input"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">سعر الشراء *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block">سعر البيع *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={sale}
              onChange={(e) => setSale(e.target.value)}
            />
          </div>
          <div className="lg:col-span-5" />
          <Button type="submit" disabled={submitting} className="h-11 font-semibold">
            {submitting ? "جارٍ الحفظ..." : "إضافة للمخزون"}
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          <ScanLine className="inline h-3.5 w-3.5" /> عند إضافة دفعة جديدة بسعر مختلف، يتم تحديث سعر البيع الحالي تلقائياً.
          الأرباح تُحسب على دفعات FIFO (تنتهي الكمية القديمة أولاً ثم تبدأ الجديدة).
        </p>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="إجمالي عدد القطع" value={totals.qty.toLocaleString("ar-EG")} />
        <StatCard label="قيمة الشراء الإجمالية" value={formatCurrency(totals.cost)} />
        <StatCard label="قيمة البيع المتوقعة" value={formatCurrency(totals.sale)} accent />
      </div>

      {/* Items list */}
      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <div className="border-b border-border p-4 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold">الأصناف في المخزن ({items.length})</h3>
          </div>
          <ExportButtons
            filename="تقرير-المخزن"
            title="تقرير المخزن"
            columns={[
              { header: "الصنف", key: "name" },
              { header: "الباركود", key: "barcode" },
              { header: "الكمية", key: "qty" },
              { header: "قيمة الشراء", key: "cost" },
              { header: "قيمة البيع", key: "sale" },
              { header: "سعر البيع الحالي", key: "price" },
            ]}
            rows={items.map((it) => ({
              name: it.name,
              barcode: it.barcode || "—",
              qty: it.total_quantity,
              cost: formatCurrency(it.total_cost_value),
              sale: formatCurrency(it.total_sale_value),
              price: formatCurrency(Number(it.current_sale_price)),
            }))}
          />
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Package className="mx-auto mb-3 h-12 w-12 opacity-40" />
            لا توجد أصناف بعد. ابدأ بإضافة مخزون.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-right">الصنف / الدفعة</th>
                  <th className="px-4 py-3 text-right">الباركود</th>
                  <th className="px-4 py-3 text-right">الكمية المتبقية</th>
                  <th className="px-4 py-3 text-right">سعر شراء الدفعة</th>
                  <th className="px-4 py-3 text-right">قيمة الشراء</th>
                  <th className="px-4 py-3 text-right">سعر البيع الحالي</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const activeBatches = it.batches.filter((b) => b.quantity_remaining > 0);
                  return (
                    <Fragment key={it.id}>
                      <tr className="border-t-2 border-border bg-muted/20">
                        <td className="px-4 py-3 font-bold">{it.name}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                          {it.barcode || "—"}
                        </td>
                        <td className="px-4 py-3 font-bold">{it.total_quantity}</td>
                        <td className="px-4 py-3 text-muted-foreground">—</td>
                        <td className="px-4 py-3 font-semibold">
                          {formatCurrency(it.total_cost_value)}
                        </td>
                        <td className="px-4 py-3 font-bold text-primary">
                          {formatCurrency(Number(it.current_sale_price))}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDelete(it.id, it.name)}
                            className="text-destructive/70 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                      {activeBatches.length === 0 ? (
                        <tr className="border-t border-border">
                          <td colSpan={7} className="px-8 py-2 text-xs text-muted-foreground">
                            لا توجد دفعات متبقية
                          </td>
                        </tr>
                      ) : (
                        activeBatches.map((b, idx) => (
                          <tr key={b.id} className="border-t border-border hover:bg-muted/30">
                            <td className="px-8 py-2 text-xs text-muted-foreground">
                              ↳ دفعة {idx + 1} —{" "}
                              {new Date(b.created_at).toLocaleDateString("ar-EG")}
                            </td>
                            <td className="px-4 py-2"></td>
                            <td className="px-4 py-2">
                              {b.quantity_remaining}{" "}
                              <span className="text-xs text-muted-foreground">
                                / {b.quantity_added}
                              </span>
                            </td>
                            <td className="px-4 py-2">{formatCurrency(Number(b.cost_price))}</td>
                            <td className="px-4 py-2">
                              {formatCurrency(b.quantity_remaining * Number(b.cost_price))}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground text-xs">
                              {formatCurrency(Number(b.sale_price))}{" "}
                              <span className="opacity-60">(سعر الدفعة الأصلي)</span>
                            </td>
                            <td className="px-4 py-2"></td>
                          </tr>
                        ))
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          setBarcode(code);
          toast.success("تم مسح الباركود: " + code);
        }}
      />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-[var(--shadow-card)] ${
        accent
          ? "border-primary/20 bg-[var(--gradient-primary)] text-primary-foreground"
          : "border-border bg-card"
      }`}
    >
      <p className={`text-sm ${accent ? "opacity-90" : "text-muted-foreground"}`}>{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}
