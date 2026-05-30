import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { TrendingUp, DollarSign, Package, BarChart3 } from "lucide-react";
import { fetchSales, formatCurrency } from "@/lib/inventory";
import { ExportButtons } from "@/components/ExportButtons";

export function ProfitsTab() {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: fetchSales,
  });

  const { byItem, totalRevenue, totalProfit, totalQty } = useMemo(() => {
    const map = new Map<
      string,
      { name: string; qty: number; revenue: number; profit: number; avgSale: number }
    >();
    let rev = 0;
    let prof = 0;
    let qty = 0;
    for (const s of sales) {
      const sp = Number(s.sale_price);
      const r = sp * s.quantity;
      const p = Number(s.profit);
      rev += r;
      prof += p;
      qty += s.quantity;
      const key = s.item_id ?? `free:${s.item_name}`;
      const cur = map.get(key) ?? {
        name: s.item_name,
        qty: 0,
        revenue: 0,
        profit: 0,
        avgSale: 0,
      };
      cur.qty += s.quantity;
      cur.revenue += r;
      cur.profit += p;
      map.set(key, cur);
    }
    const byItem = Array.from(map.values())
      .map((v) => ({ ...v, avgSale: v.qty ? v.revenue / v.qty : 0 }))
      .sort((a, b) => b.profit - a.profit);
    return { byItem, totalRevenue: rev, totalProfit: prof, totalQty: qty };
  }, [sales]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="إجمالي القطع المبيعة"
          value={totalQty.toLocaleString("ar-EG")}
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5" />}
          label="عدد عمليات البيع"
          value={sales.length.toLocaleString("ar-EG")}
        />
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="إجمالي المبيعات"
          value={formatCurrency(totalRevenue)}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="صافي الأرباح"
          value={formatCurrency(totalProfit)}
          accent
        />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <div className="border-b border-border p-4 flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-lg font-bold">تفاصيل الأرباح حسب الصنف</h3>
          <ExportButtons
            filename="تقرير-صافي-الأرباح"
            title="تقرير صافي الأرباح"
            columns={[
              { header: "الصنف", key: "name" },
              { header: "القطع المبيعة", key: "qty" },
              { header: "متوسط سعر البيع", key: "avg" },
              { header: "إجمالي المبيعات", key: "rev" },
              { header: "صافي الربح", key: "prof" },
              { header: "هامش الربح", key: "margin" },
            ]}
            rows={[
              ...byItem.map((it) => ({
                name: it.name,
                qty: it.qty,
                avg: formatCurrency(it.avgSale),
                rev: formatCurrency(it.revenue),
                prof: formatCurrency(it.profit),
                margin:
                  it.revenue > 0
                    ? ((it.profit / it.revenue) * 100).toFixed(1) + "%"
                    : "—",
              })),
              {
                name: "الإجمالي",
                qty: totalQty,
                avg: "—",
                rev: formatCurrency(totalRevenue),
                prof: formatCurrency(totalProfit),
                margin:
                  totalRevenue > 0
                    ? ((totalProfit / totalRevenue) * 100).toFixed(1) + "%"
                    : "—",
              },
            ]}
          />
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div>
        ) : byItem.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            لا توجد مبيعات لعرض الأرباح
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-right">الصنف</th>
                  <th className="px-4 py-3 text-right">القطع المبيعة</th>
                  <th className="px-4 py-3 text-right">متوسط سعر البيع</th>
                  <th className="px-4 py-3 text-right">إجمالي المبيعات</th>
                  <th className="px-4 py-3 text-right">صافي الربح</th>
                  <th className="px-4 py-3 text-right">هامش الربح</th>
                </tr>
              </thead>
              <tbody>
                {byItem.map((it) => (
                  <tr key={it.name} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{it.name}</td>
                    <td className="px-4 py-3">{it.qty}</td>
                    <td className="px-4 py-3">{formatCurrency(it.avgSale)}</td>
                    <td className="px-4 py-3">{formatCurrency(it.revenue)}</td>
                    <td className="px-4 py-3 font-bold text-[color:var(--success)]">
                      {formatCurrency(it.profit)}
                    </td>
                    <td className="px-4 py-3">
                      {it.revenue > 0
                        ? ((it.profit / it.revenue) * 100).toFixed(1) + "%"
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-bold">
                <tr className="border-t-2 border-border">
                  <td className="px-4 py-3">الإجمالي</td>
                  <td className="px-4 py-3">{totalQty}</td>
                  <td className="px-4 py-3">—</td>
                  <td className="px-4 py-3">{formatCurrency(totalRevenue)}</td>
                  <td className="px-4 py-3 text-[color:var(--success)]">
                    {formatCurrency(totalProfit)}
                  </td>
                  <td className="px-4 py-3">
                    {totalRevenue > 0
                      ? ((totalProfit / totalRevenue) * 100).toFixed(1) + "%"
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-[var(--shadow-card)] ${
        accent
          ? "border-primary/20 bg-[var(--gradient-primary)] text-primary-foreground"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-sm ${accent ? "opacity-90" : "text-muted-foreground"}`}>{label}</p>
        <div className={accent ? "opacity-90" : "text-primary"}>{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}
