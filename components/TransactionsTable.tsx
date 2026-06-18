"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateTransactionCategory,
  deleteTransactionAction,
  addManualTransaction,
  type ManualState,
} from "@/app/actions/transactions";
import { CATEGORIES, fmtBRL, formatDate, type Transaction } from "@/lib/dre";
import { Trash2, Plus, Loader2 } from "lucide-react";

export default function TransactionsTable({
  companyId,
  tipo,
  transactions,
  accounts,
}: {
  companyId: string;
  tipo: "cartao" | "banco";
  transactions: Transaction[];
  accounts: string[];
}) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);

  const boundAdd = addManualTransaction.bind(null, companyId, tipo);
  const [addState, addFormAction, addPending] = useActionState<ManualState, FormData>(boundAdd, null);
  const addFormRef = useRef<HTMLFormElement>(null);

  function markPending(id: string, on: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleCategoryChange(id: string, category: string) {
    markPending(id, true);
    try {
      await updateTransactionCategory(companyId, id, category);
    } finally {
      markPending(id, false);
      startTransition(() => router.refresh());
    }
  }

  async function handleDelete(id: string) {
    markPending(id, true);
    try {
      await deleteTransactionAction(companyId, id);
    } finally {
      startTransition(() => router.refresh());
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3">
        <h2 className="text-sm font-bold">Transações ({transactions.length})</h2>
        <button
          onClick={() => setAddOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground border border-border rounded-lg px-3 py-1.5"
        >
          <Plus size={13} /> Adicionar
        </button>
      </div>

      {addOpen && (
        <form
          ref={addFormRef}
          action={addFormAction}
          className="grid sm:grid-cols-5 gap-2 px-5 pb-4 items-end"
        >
          <input
            name="date"
            type="date"
            required
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gold"
          />
          <input
            name="description"
            placeholder="Descrição"
            required
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gold"
          />
          <input
            name="amount"
            placeholder="-450.00"
            required
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-gold"
          />
          <select
            name="category"
            defaultValue="Outras Despesas"
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gold"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            name="account"
            list="accounts-list-manual"
            placeholder="Conta"
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gold"
          />
          <datalist id="accounts-list-manual">
            {accounts.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={addPending}
            className="sm:col-span-5 mt-1 bg-gold text-[#1a1305] font-bold text-xs rounded-lg py-2 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {addPending && <Loader2 size={13} className="spin" />}
            Salvar transação
          </button>
          {addState?.error && <p className="sm:col-span-5 text-xs text-red">{addState.error}</p>}
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-faint border-y border-border">
              <th className="px-5 py-2 font-semibold">Data</th>
              <th className="px-2 py-2 font-semibold">Descrição</th>
              <th className="px-2 py-2 font-semibold">Conta</th>
              <th className="px-2 py-2 font-semibold">Categoria</th>
              <th className="px-2 py-2 font-semibold text-right">Valor</th>
              <th className="px-5 py-2 font-semibold w-8"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const isPending = pendingIds.has(t.id);
              return (
                <tr key={t.id} className={`border-b border-border ${isPending ? "opacity-40" : ""}`}>
                  <td className="px-5 py-2 whitespace-nowrap text-muted">{formatDate(t.date)}</td>
                  <td className="px-2 py-2 max-w-[220px] truncate" title={t.description}>
                    {t.description}
                  </td>
                  <td className="px-2 py-2 text-muted whitespace-nowrap">{t.account}</td>
                  <td className="px-2 py-2">
                    <select
                      key={t.id + t.category}
                      defaultValue={t.category}
                      disabled={isPending}
                      onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                      className="bg-background border border-border rounded-md px-2 py-1 text-xs outline-none focus:border-gold"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className={`px-2 py-2 text-right font-mono whitespace-nowrap ${
                      t.amount < 0 ? "text-red" : "text-green"
                    }`}
                  >
                    {fmtBRL(t.amount)}
                  </td>
                  <td className="px-5 py-2">
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={isPending}
                      className="text-faint hover:text-red transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-faint text-sm">
                  Nenhuma transação ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
