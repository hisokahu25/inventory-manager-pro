import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Warehouse, Receipt, TrendingUp, Store, Wallet } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { InventoryTab } from "@/components/InventoryTab";
import { SalesLogTab } from "@/components/SalesLogTab";
import { ProfitsTab } from "@/components/ProfitsTab";
import { WalletsTab } from "@/components/WalletsTab";
import { PasswordGate } from "@/components/PasswordGate";

export const Route = createFileRoute("/")({
  component: Index,
});

type TabId = "inventory" | "sales" | "profits" | "wallets";

const TABS: { id: TabId; label: string; icon: React.ReactNode; locked: boolean }[] = [
  { id: "sales", label: "سجل المبيعات", icon: <Receipt className="h-4 w-4" />, locked: false },
  { id: "wallets", label: "المحافظ الإلكترونية", icon: <Wallet className="h-4 w-4" />, locked: true },
  { id: "inventory", label: "المخزن", icon: <Warehouse className="h-4 w-4" />, locked: true },
  { id: "profits", label: "صافي الأرباح", icon: <TrendingUp className="h-4 w-4" />, locked: true },
];

function Index() {
  const [tab, setTab] = useState<TabId>("sales");

  return (
    <div className="min-h-screen">
      <Toaster position="top-center" richColors />

      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-card)]">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight sm:text-xl">سجل المخزن</h1>
              <p className="text-xs text-muted-foreground">إدارة المخزون والمبيعات والأرباح</p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
              {t.locked && <span className="text-xs">🔒</span>}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {tab === "sales" && <SalesLogTab />}
        {tab === "inventory" && (
          <PasswordGate title="المخزن">
            <InventoryTab />
          </PasswordGate>
        )}
        {tab === "profits" && (
          <PasswordGate title="صافي الأرباح">
            <ProfitsTab />
          </PasswordGate>
        )}
      </main>
    </div>
  );
}
