"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkDeleteTransactions } from "@/app/actions/transactions";
import { monthLabel } from "@/lib/dre";
import { Trash2, AlertTriangle } from "lucide-react";

export default function BulkDeletePanel({
  companyId,
  tipo,
  months,
}: {
  companyId: string;
  tipo: "cartao" | "banco";
  months: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(months[months.length - 1] || "");
  const [confirming, setConfirming] = useState<"all" | "month" | "last7" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(mode: "all" | "month" | "last7days", month?: string) {
    setMessage(null);
    startTransition(async () => {
      const res = await bulkDeleteTransactions(companyId, tipo, mode, month);
      setMessage(res?.error || res?.success || null);
      setConfirming(null);
      router.refresh();
    });
  }

  if (months.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-red border border-border rounded-lg px-3 py-1.5"
      >
        <Trash2 size={13} /> Apagar
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-surface-2 border border-border rounded-xl p-3 z-10 flex flex-col gap-2 shadow-xl">
          <button
            onClick={() => (confirming === "last7" ? run("last7days") : setConfirming("last7"))}
            disabled={isPending}
            className={`text-left text-xs rounded-lg px-3 py-2 border transition-colors ${
              confirming === "last7"
                ? "border-red text-red bg-red-soft"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {confirming === "last7" ? "Confirma apagar os últimos 7 dias?" : "Apagar últimos 7 dias"}
          </button>

          <div className="flex flex-col gap-1.5 border border-border rounded-lg p-2">
            <select
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setConfirming(null);
              }}
              className="bg-background border border-border rounded-md px-2 py-1.5 text-xs outline-none focus:border-gold"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
            <button
              onClick={() => (confirming === "month" ? run("month", selectedMonth) : setConfirming("month"))}
              disabled={isPending || !selectedMonth}
              className={`text-left text-xs rounded-lg px-3 py-2 border transition-colors ${
                confirming === "month"
                  ? "border-red text-red bg-red-soft"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {confirming === "month" ? `Confirma apagar ${monthLabel(selectedMonth)}?` : "Apagar esse mês"}
            </button>
          </div>

          <button
            onClick={() => (confirming === "all" ? run("all") : setConfirming("all"))}
            disabled={isPending}
            className={`text-left text-xs rounded-lg px-3 py-2 border flex items-center gap-1.5 transition-colors ${
              confirming === "all"
                ? "border-red text-red bg-red-soft"
                : "border-border text-red/80 hover:text-red"
            }`}
          >
            <AlertTriangle size={12} />
            {confirming === "all" ? "Tem certeza? Isso apaga tudo!" : "Apagar tudo"}
          </button>

          {isPending && <p className="text-xs text-faint">Apagando...</p>}
          {message && <p className="text-xs text-muted">{message}</p>}
        </div>
      )}
    </div>
  );
}
