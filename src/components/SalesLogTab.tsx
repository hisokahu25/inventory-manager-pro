import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Mic, MicOff, Search, ShoppingCart, Barcode, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  fetchItemsWithStock,
  fetchSales,
  findItemByBarcode,
  formatCurrency,
  recordSale,
} from "@/lib/inventory";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { ExportButtons } from "@/components/ExportButtons";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export function SalesLogTab() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["items-with-stock"],
    queryFn: fetchItemsWithStock,
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: fetchSales,
  });

  const [search, setSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [sellingId, setSellingId] = useState<string | null>(null);
  const [sellQty, setSellQty] = useState("1");
  const [recording, setRecording] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [showAll, setShowAll] = useState(false);

  const filteredSales = useMemo(() => {
    if (showAll) return sales;
    if (!dateFilter) return sales;
    return sales.filter((s) => {
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return key === dateFilter;
    });
  }, [sales, dateFilter, showAll]);

  const dayTotal = useMemo(
    () =>
      filteredSales.reduce((s, x) => s + Number(x.sale_price) * x.quantity, 0),
    [filteredSales],
  );

  const handleBarcodeDetected = async (code: string) => {
    setBarcodeInput("");
    const item = await findItemByBarcode(code);
    if (item) {
      setSearch(item.name);
      toast.success(`تم العثور على: ${item.name}`);
    } else {
      toast.error(`الباركود ${code} غير موجود في المخزن`);
    }
  };

  const { listening, supported, start, stop } = useVoiceSearch((text) => {
    setSearch(text);
    toast.success(`بحث صوتي: ${text}`);
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (it) => it.name.toLowerCase().includes(q) || (it.barcode || "").includes(q),
    );
  }, [items, search]);

  const handleBarcodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const item = await findItemByBarcode(barcodeInput.trim());
    if (item) {
      setSearch(item.name);
      setBarcodeInput("");
      toast.success(`تم العثور على: ${item.name}`);
    } else {
      toast.error("الباركود غير موجود في المخزن");
    }
  };

  const handleSell = async (itemId: string) => {
    const qty = Number(sellQty);
    if (!qty || qty < 1) {
      toast.error("أدخل كمية صحيحة");
      return;
    }
    setRecording(true);
    try {
      await recordSale(itemId, qty);
      toast.success(`تم تسجيل بيع ${qty} قطعة`);
      setSellingId(null);
      setSellQty("1");
      qc.invalidateQueries({ queryKey: ["items-with-stock"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRecording(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search + barcode */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">البحث عن صنف</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو بالكود..."
                className="h-11 pr-10 pl-12"
              />
              {supported && (
                <button
                  type="button"
                  onClick={listening ? stop : start}
                  className={`absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-2 transition-colors ${
                    listening
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                  title="البحث الصوتي"
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              )}
            </div>
            {!supported && (
              <p className="mt-1 text-xs text-muted-foreground">
                المتصفح لا يدعم البحث الصوتي
              </p>
            )}
          </div>
          <form onSubmit={handleBarcodeSubmit}>
            <Label className="mb-1.5 flex items-center gap-1.5">
              <Barcode className="h-4 w-4" /> مسح الباركود
            </Label>
            <div className="flex gap-2">
              <Input
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="امسح الباركود ثم اضغط Enter"
                className="h-11"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setScanOpen(true)}
                className="h-11 shrink-0"
                title="مسح بكاميرا الموبايل"
              >
                <Camera className="h-4 w-4 ml-1" /> كاميرا
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Items grid for sale */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((it) => (
          <div
            key={it.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-base font-bold leading-tight">{it.name}</h4>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  it.total_quantity > 0
                    ? "bg-success/15 text-[color:var(--success)]"
                    : "bg-destructive/15 text-destructive"
                }`}
              >
                {it.total_quantity > 0 ? `${it.total_quantity} متاح` : "نفد"}
              </span>
            </div>
            {it.barcode && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">{it.barcode}</p>
            )}
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-primary">
                {formatCurrency(Number(it.current_sale_price))}
              </span>
              <span className="text-xs text-muted-foreground">/ قطعة</span>
            </div>

            {sellingId === it.id ? (
              <div className="mt-4 flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max={it.total_quantity}
                  value={sellQty}
                  onChange={(e) => setSellQty(e.target.value)}
                  className="h-10"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => handleSell(it.id)}
                  disabled={recording}
                  className="h-10 shrink-0"
                >
                  بيع
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSellingId(null)}
                  className="h-10"
                >
                  إلغاء
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setSellingId(it.id)}
                disabled={it.total_quantity === 0}
                className="mt-4 h-10 w-full font-semibold"
                variant={it.total_quantity > 0 ? "default" : "outline"}
              >
                <ShoppingCart className="ml-2 h-4 w-4" /> تسجيل بيع
              </Button>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
            لا توجد نتائج مطابقة
          </div>
        )}
      </div>

      {/* Recent sales */}
      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <div className="border-b border-border p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-bold">
              {showAll ? "كل المبيعات" : "مبيعات اليوم"}
            </h3>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {filteredSales.length} عملية · {formatCurrency(dayTotal)}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setShowAll(false);
              }}
              className="h-9 w-auto"
              disabled={showAll}
            />
            <Button
              type="button"
              size="sm"
              variant={showAll ? "default" : "outline"}
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "عرض يوم محدد" : "عرض الكل"}
            </Button>
            <ExportButtons
              filename={
                showAll
                  ? "سجل-المبيعات-الكامل"
                  : `سجل-المبيعات-${dateFilter}`
              }
              title={
                showAll ? "سجل المبيعات الكامل" : `سجل المبيعات - ${dateFilter}`
              }
              columns={[
                { header: "الصنف", key: "name" },
                { header: "الكمية", key: "qty" },
                { header: "سعر البيع", key: "price" },
                { header: "الإجمالي", key: "total" },
                { header: "التاريخ", key: "date" },
              ]}
              rows={filteredSales.map((s) => ({
                name: s.item_name,
                qty: s.quantity,
                price: formatCurrency(Number(s.sale_price)),
                total: formatCurrency(Number(s.sale_price) * s.quantity),
                date: new Date(s.created_at).toLocaleString("ar-EG"),
              }))}
            />
          </div>
        </div>
        {filteredSales.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {showAll ? "لا توجد مبيعات بعد" : "لا توجد مبيعات في هذا اليوم"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-right">الصنف</th>
                  <th className="px-4 py-3 text-right">الكمية</th>
                  <th className="px-4 py-3 text-right">سعر البيع</th>
                  <th className="px-4 py-3 text-right">الإجمالي</th>
                  <th className="px-4 py-3 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.slice(0, showAll ? 100 : 200).map((s) => (
                  <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{s.item_name}</td>
                    <td className="px-4 py-3">{s.quantity}</td>
                    <td className="px-4 py-3">{formatCurrency(Number(s.sale_price))}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatCurrency(Number(s.sale_price) * s.quantity)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(s.created_at).toLocaleString("ar-EG")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={handleBarcodeDetected}
      />
    </div>
  );
}
