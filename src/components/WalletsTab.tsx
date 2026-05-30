import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { Wallet as WalletIcon, Plus, ArrowUpCircle, ArrowDownCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  createWallet,
  deleteWallet,
  fetchWallets,
  fetchWalletTransactions,
  formatCurrency,
  walletSale,
  walletTopup,
} from "@/lib/inventory";
import { ExportButtons } from "@/components/ExportButtons";

type Mode = "topup" | "sale";

export function WalletsTab() {
  const qc = useQueryClient();
  const { data: wallets = [] } = useQuery({
    queryKey: ["wallets"],
    queryFn: fetchWallets,
  });
  const { data: txs = [] } = useQuery({
    queryKey: ["wallet-tx"],
    queryFn: fetchWalletTransactions,
  });

  const [newName, setNewName] = useState("");
  const [dialog, setDialog] = useState<{ mode: Mode; walletId: string; walletName: string } | null>(
    null,
  );
  const [amount, setAmount] = useState("");
  const [commission, setCommission] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [dateFilter, setDateFilter] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [showAll, setShowAll] = useState(false);

  const filteredTx = useMemo(() => {
    if (showAll) return txs;
    return txs.filter((t) => {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return key === dateFilter;
    });
  }, [txs, dateFilter, showAll]);

  const totals = useMemo(() => {
    let totalBalance = 0;
    for (const w of wallets) totalBalance += Number(w.balance);
    let dayCash = 0;
    let dayCommission = 0;
    for (const t of filteredTx) {
      if (t.kind === "sale") {
        dayCash += Number(t.amount);
        dayCommission += Number(t.commission);
      }
    }
    return { totalBalance, dayCash, dayCommission };
  }, [wallets, filteredTx]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createWallet(newName.trim());
      setNewName("");
      qc.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("تم إضافة المحفظة");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف هذه المحفظة وكل سجلاتها؟")) return;
    try {
      await deleteWallet(id);
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet-tx"] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const openDialog = (mode: Mode, walletId: string, walletName: string) => {
    setDialog({ mode, walletId, walletName });
    setAmount("");
    setCommission("");
    setNote("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dialog) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("أدخل مبلغ صحيح");
    setBusy(true);
    try {
      if (dialog.mode === "topup") {
        await walletTopup(dialog.walletId, amt, note.trim() || undefined);
        toast.success("تم إضافة الرصيد");
      } else {
        const com = Number(commission) || 0;
        await walletSale(dialog.walletId, amt, com, note.trim() || undefined);
        toast.success("تم تسجيل عملية البيع");
      }
      setDialog(null);
      qc.invalidateQueries({ queryKey: ["wallets"] });
      qc.invalidateQueries({ queryKey: ["wallet-tx"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-primary/20 bg-[var(--gradient-primary)] p-5 text-primary-foreground shadow-[var(--shadow-card)]">
          <p className="text-sm opacity-90">إجمالي الرصيد المتاح</p>
          <p className="mt-2 text-2xl font-extrabold">{formatCurrency(totals.totalBalance)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">
            مبيعات الكاش ({showAll ? "الكل" : dateFilter})
          </p>
          <p className="mt-2 text-2xl font-extrabold">{formatCurrency(totals.dayCash)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">
            العمولات ({showAll ? "الكل" : dateFilter})
          </p>
          <p className="mt-2 text-2xl font-extrabold text-[color:var(--success)]">
            {formatCurrency(totals.dayCommission)}
          </p>
        </div>
      </div>

      {/* Add wallet */}
      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
      >
        <Label className="mb-1.5 block">إضافة محفظة جديدة</Label>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="مثال: فودافون كاش، إنستا باي..."
            className="h-11"
          />
          <Button type="submit" disabled={busy} className="h-11 shrink-0">
            <Plus className="h-4 w-4 ml-1" /> إضافة
          </Button>
        </div>
      </form>

      {/* Wallets list */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {wallets.map((w) => (
          <div
            key={w.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <WalletIcon className="h-5 w-5" />
                </div>
                <h4 className="text-base font-bold">{w.name}</h4>
              </div>
              <button
                onClick={() => handleDelete(w.id)}
                className="text-muted-foreground hover:text-destructive"
                title="حذف"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">الرصيد المتاح</p>
            <p className="text-2xl font-extrabold text-primary">
              {formatCurrency(Number(w.balance))}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 h-10"
                onClick={() => openDialog("topup", w.id, w.name)}
              >
                <ArrowUpCircle className="h-4 w-4 ml-1" /> شحن رصيد
              </Button>
              <Button
                size="sm"
                className="flex-1 h-10"
                onClick={() => openDialog("sale", w.id, w.name)}
              >
                <ArrowDownCircle className="h-4 w-4 ml-1" /> بيع كاش
              </Button>
            </div>
          </div>
        ))}
        {wallets.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center text-muted-foreground">
            لا توجد محافظ بعد. أضف أول محفظة بالأعلى.
          </div>
        )}
      </div>

      {/* Transactions log */}
      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] overflow-hidden">
        <div className="border-b border-border p-4 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-lg font-bold">
            سجل حركات المحافظ ({filteredTx.length})
          </h3>
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
              filename={showAll ? "سجل-المحافظ-الكامل" : `سجل-المحافظ-${dateFilter}`}
              title={showAll ? "سجل حركات المحافظ" : `سجل حركات المحافظ - ${dateFilter}`}
              columns={[
                { header: "النوع", key: "type" },
                { header: "المحفظة", key: "wallet" },
                { header: "المبلغ", key: "amount" },
                { header: "العمولة", key: "commission" },
                { header: "ملاحظات", key: "note" },
                { header: "التاريخ", key: "date" },
              ]}
              rows={filteredTx.map((t) => ({
                type: t.kind === "topup" ? "شحن رصيد" : "بيع كاش",
                wallet: t.wallet_name,
                amount: formatCurrency(Number(t.amount)),
                commission: formatCurrency(Number(t.commission)),
                note: t.note ?? "",
                date: new Date(t.created_at).toLocaleString("ar-EG"),
              }))}
            />
          </div>
        </div>
        {filteredTx.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">لا توجد حركات</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-right">النوع</th>
                  <th className="px-4 py-3 text-right">المحفظة</th>
                  <th className="px-4 py-3 text-right">المبلغ</th>
                  <th className="px-4 py-3 text-right">العمولة</th>
                  <th className="px-4 py-3 text-right">ملاحظات</th>
                  <th className="px-4 py-3 text-right">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filteredTx.slice(0, 300).map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {t.kind === "topup" ? (
                        <span className="rounded-full bg-[color:var(--success)]/15 px-2 py-0.5 text-xs font-bold text-[color:var(--success)]">
                          شحن
                        </span>
                      ) : (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                          بيع كاش
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">{t.wallet_name}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatCurrency(Number(t.amount))}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--success)]">
                      {Number(t.commission) > 0 ? formatCurrency(Number(t.commission)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.note ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(t.created_at).toLocaleString("ar-EG")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "topup" ? "شحن رصيد" : "بيع كاش"} — {dialog?.walletName}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="mb-1.5 block">
                {dialog?.mode === "topup" ? "المبلغ المضاف" : "مبلغ الكاش المباع"}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            {dialog?.mode === "sale" && (
              <div>
                <Label className="mb-1.5 block">العمولة (يدوي)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  placeholder="0"
                />
              </div>
            )}
            <div>
              <Label className="mb-1.5 block">ملاحظات (اختياري)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full h-11">
              تأكيد
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
