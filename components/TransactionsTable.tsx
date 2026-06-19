"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateTransactionCategory,
  deleteTransactionAction,
  addManualTransaction,
  bulkDeleteByIds,
  bulkUpdateCategory,
  type ManualState,
} from "@/app/actions/transactions";
import { createCategory, deleteCategory, type CategoryState } from "@/app/actions/categories";
import { CATEGORIES, fmtBRL, formatDate, type Transaction } from "@/lib/dre";
import { Trash2, Plus, Loader2, AlertTriangle, Tag, CheckSquare, Square, X } from "lucide-react";
import BulkDeletePanel from "@/components/BulkDeletePanel";

export default function TransactionsTable({
  companyId, tipo, transactions, accounts, customCategories,
}: {
  companyId: string; tipo: "cartao" | "banco"; transactions: Transaction[]; accounts: string[]; customCategories: string[];
}) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const months = Array.from(new Set(transactions.map((t) => t.date.slice(0, 7)))).sort();

  const [filterAccount, setFilterAccount] = useState("");
  const [filterDirection, setFilterDirection] = useState<"all" | "entrada" | "saida">("all");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState("Outras Despesas");
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkPending, startBulkTransition] = useTransition();
  const [bulkMsg, setBulkMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [deletingCat, setDeletingCat] = useState<string | null>(null);
  const [, startCatDeleteTransition] = useTransition();

  const allCategoryOptions = [
    ...CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
    ...customCategories.map((name) => ({ key: name, label: name })),
  ];

  const boundAdd = addManualTransaction.bind(null, companyId, tipo);
  const [addState, addFormAction, addPending] = useActionState<ManualState, FormData>(boundAdd, null);
  const addFormRef = useRef<HTMLFormElement>(null);

  const boundCreateCategory = createCategory.bind(null, companyId);
  const [catState, catFormAction, catPending] = useActionState<CategoryState, FormData>(boundCreateCategory, null);
  const catFormRef = useRef<HTMLFormElement>(null);
  const catWasPending = useRef(false);

  useEffect(() => {
    if (catWasPending.current && !catPending && !catState?.error) {
      catFormRef.current?.reset();
      router.refresh();
    }
    catWasPending.current = catPending;
  }, [catPending, catState, router]);

  const filtered = transactions.filter((t) => {
    if (filterAccount && t.account !== filterAccount) return false;
    if (filterDirection === "entrada" && t.amount <= 0) return false;
    if (filterDirection === "saida" && t.amount >= 0) return false;
    return true;
  });

  const naoIdentificadoCount = filtered.filter((t) => t.category === "Nao Identificado").length;

  function markPending(id: string, on: boolean) {
    setPendingIds((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });
  }

  async function handleCategoryChange(id: string, category: string) {
    markPending(id, true);
    try { await updateTransactionCategory(companyId, id, category); }
    finally { markPending(id, false); startTransition(() => router.refresh()); }
  }

  async function handleDelete(id: string) {
    markPending(id, true);
    try { await deleteTransactionAction(companyId, id); }
    finally { startTransition(() => router.refresh()); }
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    setBulkConfirm(false);
  }

  function selectAllFiltered() { setSelectedIds(new Set(filtered.map((t) => t.id))); setBulkConfirm(false); }
  function clearSelection() { setSelectedIds(new Set()); setBulkConfirm(false); setBulkMsg(null); }
  function exitSelection() { setSelectionMode(false); clearSelection(); }

  function handleBulkDelete() {
    if (!bulkConfirm) { setBulkConfirm(true); return; }
    const ids = Array.from(selectedIds);
    startBulkTransition(async () => {
      const res = await bulkDeleteByIds(companyId, ids);
      setBulkMsg(res?.error ? { type: "err", text: res.error } : { type: "ok", text: res?.success || "Apagado." });
      clearSelection();
      router.refresh();
    });
  }

  function handleBulkCategory() {
    const ids = Array.from(selectedIds);
    startBulkTransition(async () => {
      const res = await bulkUpdateCategory(companyId, ids, bulkCat);
      setBulkMsg(res?.error ? { type: "err", text: res.error } : { type: "ok", text: `Categoria atualizada em ${ids.length} transação(ões).` });
      clearSelection();
      router.refresh();
    });
  }

  function handleDeleteCategory(name: string) {
    setDeletingCat(name);
    startCatDeleteTransition(async () => {
      await deleteCategory(companyId, name);
      setDeletingCat(null);
      router.refresh();
    });
  }

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-5 pb-3 flex-wrap gap-2">
        <h2 className="text-sm font-bold">Transações ({filtered.length}{filtered.length !== transactions.length ? ` de ${transactions.length}` : ""})</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <BulkDeletePanel companyId={companyId} tipo={tipo} months={months} accounts={accounts} />
          <button
            onClick={() => { setCatOpen((o) => !o); setAddOpen(false); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground border border-border rounded-lg px-3 py-1.5"
          >
            <Tag size={13} /> Categoria
          </button>
          <button
            onClick={() => { setSelectionMode((o) => { if (o) { clearSelection(); } return !o; }); }}
            className={`flex items-center gap-1.5 text-xs font-semibold border rounded-lg px-3 py-1.5 transition-colors ${selectionMode ? "border-gold text-gold" : "text-muted hover:text-foreground border-border"}`}
          >
            <CheckSquare size={13} /> Selecionar
          </button>
          <button
            onClick={() => { setAddOpen((o) => !o); setCatOpen(false); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground border border-border rounded-lg px-3 py-1.5"
          >
            <Plus size={13} /> Adicionar
          </button>
        </div>
      </div>

      <div className="flex gap-2 px-5 pb-3 flex-wrap">
        <select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
          className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gold"
        >
          <option value="">Todas as contas</option>
          {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select
          value={filterDirection}
          onChange={(e) => setFilterDirection(e.target.value as "all" | "entrada" | "saida")}
          className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gold"
        >
          <option value="all">Entradas e saídas</option>
          <option value="entrada">Só entradas</option>
          <option value="saida">Só saídas</option>
        </select>
        {(filterAccount || filterDirection !== "all") && (
          <button
            onClick={() => { setFilterAccount(""); setFilterDirection("all"); }}
            className="flex items-center gap-1 text-xs text-faint hover:text-red"
          >
            <X size={12} /> Limpar filtro
          </button>
        )}
      </div>

      {naoIdentificadoCount > 0 && (
        <div className="mx-5 mb-3 flex items-center gap-2 text-xs text-red bg-red-soft rounded-lg px-3 py-2">
          <AlertTriangle size={13} />
          {naoIdentificadoCount} transação(ões) sem categoria definida — revise abaixo.
        </div>
      )}

      {selectionMode && (
        <div className="mx-5 mb-3 bg-surface-2 border border-border rounded-xl px-3 py-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold">{selectedIds.size} selecionado(s)</span>
          <button onClick={selectAllFiltered} className="text-xs text-muted hover:text-foreground border border-border rounded px-2 py-1">
            Todos visíveis ({filtered.length})
          </button>
          <button onClick={clearSelection} className="text-xs text-faint hover:text-foreground">Limpar</button>
          <div className="flex-1" />
          {selectedIds.size > 0 && (
            <>
              <select
                value={bulkCat}
                onChange={(e) => setBulkCat(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1 text-xs outline-none focus:border-gold"
              >
                {allCategoryOptions.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <button
                onClick={handleBulkCategory}
                disabled={bulkPending}
                className="text-xs font-semibold bg-gold text-[#1a1305] rounded-lg px-3 py-1 disabled:opacity-60"
              >
                {bulkPending ? <Loader2 size={12} className="spin" /> : "Aplicar categoria"}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkPending}
                className={`text-xs font-semibold rounded-lg px-3 py-1 border disabled:opacity-60 transition-colors ${bulkConfirm ? "border-red text-red bg-red-soft" : "border-red/50 text-red/80 hover:text-red"}`}
              >
                {bulkConfirm ? `Confirma apagar ${selectedIds.size}?` : `Apagar (${selectedIds.size})`}
              </button>
              <button onClick={exitSelection} className="text-xs text-faint hover:text-foreground"><X size={13} /></button>
            </>
          )}
          {bulkMsg && (
            <p className={`w-full text-xs ${bulkMsg.type === "err" ? "text-red" : "text-green"}`}>{bulkMsg.text}</p>
          )}
        </div>
      )}

      {catOpen && (
        <div className="px-5 pb-4 flex flex-col gap-3">
          {customCategories.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted mb-1">Suas categorias</p>
              {customCategories.map((name) => (
                <div key={name} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
                  <span className="text-xs">{name}</span>
                  <button
                    onClick={() => handleDeleteCategory(name)}
                    disabled={deletingCat === name}
                    className="text-faint hover:text-red disabled:opacity-40"
                  >
                    {deletingCat === name ? <Loader2 size={12} className="spin" /> : <Trash2 size={12} />}
                  </button>
                </div>
              ))}
            </div>
          )}
          <form ref={catFormRef} action={catFormAction} className="flex gap-2 items-start">
            <input
              name="name" placeholder="Nova categoria (ex: Hospedagem)" required maxLength={40}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-gold"
            />
            <button type="submit" disabled={catPending} className="bg-gold text-[#1a1305] font-bold text-xs rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-60">
              {catPending && <Loader2 size={13} className="spin" />} Criar
            </button>
          </form>
          {catState?.error && <p className="text-xs text-red">{catState.error}</p>}
        </div>
      )}

      {addOpen && (
        <form ref={addFormRef} action={addFormAction} className="grid sm:grid-cols-5 gap-2 px-5 pb-4 items-end">
          <input name="date" type="date" required className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gold" />
          <input name="description" placeholder="Descrição" required className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gold" />
          <input name="amount" placeholder="-450.00" required className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-gold" />
          <select name="category" defaultValue="Outras Despesas" className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gold">
            {allCategoryOptions.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input name="account" list="accounts-list-manual" placeholder="Conta" className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-gold" />
          <datalist id="accounts-list-manual">{accounts.map((a) => <option key={a} value={a} />)}</datalist>
          <button type="submit" disabled={addPending} className="sm:col-span-5 mt-1 bg-gold text-[#1a1305] font-bold text-xs rounded-lg py-2 flex items-center justify-center gap-2 disabled:opacity-60">
            {addPending && <Loader2 size={13} className="spin" />} Salvar transação
          </button>
          {addState?.error && <p className="sm:col-span-5 text-xs text-red">{addState.error}</p>}
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-faint border-y border-border">
              {selectionMode && <th className="px-3 py-2 w-8"></th>}
              <th className="px-5 py-2 font-semibold">Data</th>
              <th className="px-2 py-2 font-semibold">Descrição</th>
              <th className="px-2 py-2 font-semibold">Conta</th>
              <th className="px-2 py-2 font-semibold">Categoria</th>
              <th className="px-2 py-2 font-semibold text-right">Valor</th>
              <th className="px-5 py-2 font-semibold w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const isPending = pendingIds.has(t.id);
              const naoId = t.category === "Nao Identificado";
              const isSelected = selectedIds.has(t.id);
              return (
                <tr key={t.id} className={`border-b border-border ${isPending ? "opacity-40" : ""} ${naoId ? "bg-red-soft" : ""} ${isSelected ? "bg-gold/5" : ""}`}>
                  {selectionMode && (
                    <td className="px-3 py-2">
                      <button onClick={() => toggleId(t.id)} className="text-muted hover:text-gold">
                        {isSelected ? <CheckSquare size={14} className="text-gold" /> : <Square size={14} />}
                      </button>
                    </td>
                  )}
                  <td className="px-5 py-2 whitespace-nowrap text-muted">{formatDate(t.date)}</td>
                  <td className="px-2 py-2 max-w-[220px] truncate" title={t.description}>{t.description}</td>
                  <td className="px-2 py-2 text-muted whitespace-nowrap">{t.account}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      {naoId && <AlertTriangle size={13} className="text-red shrink-0" />}
                      <select
                        key={t.id + t.category}
                        defaultValue={t.category}
                        disabled={isPending}
                        onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                        className={`bg-background border rounded-md px-2 py-1 text-xs outline-none focus:border-gold ${naoId ? "border-red text-red" : "border-border"}`}
                      >
                        {allCategoryOptions.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className={`px-2 py-2 text-right font-mono whitespace-nowrap ${t.amount < 0 ? "text-red" : "text-green"}`}>
                    {fmtBRL(t.amount)}
                  </td>
                  <td className="px-5 py-2">
                    <button onClick={() => handleDelete(t.id)} disabled={isPending} className="text-faint hover:text-red transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={selectionMode ? 7 : 6} className="px-5 py-6 text-center text-faint text-sm">
                {transactions.length === 0 ? "Nenhuma transação ainda." : "Nenhuma transação com esses filtros."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
