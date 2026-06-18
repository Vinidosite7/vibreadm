"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { importStatement, type ImportState } from "@/app/actions/transactions";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ImportPanel({
  companyId,
  tipo,
  accounts,
}: {
  companyId: string;
  tipo: "cartao" | "banco";
  accounts: string[];
}) {
  const boundAction = importStatement.bind(null, companyId, tipo);
  const [state, formAction, pending] = useActionState<ImportState, FormData>(boundAction, null);
  const [open, setOpen] = useState(accounts.length === 0);
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      formRef.current?.reset();
      setFileName(null);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-bold w-full"
      >
        <Upload size={15} /> {open ? "Fechar importação" : "Importar extrato"}
      </button>

      {open && (
        <form ref={formRef} action={formAction} className="mt-4 grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">
              {tipo === "cartao" ? "Nome do cartão (ex: Nubank, Itaú Black)" : "Conta bancária (ex: Inter PJ, Bradesco PJ)"}
            </label>
            <input
              name="account"
              list="accounts-list"
              placeholder="Nome da conta"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-gold"
            />
            <datalist id="accounts-list">
              {accounts.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>

            <div className="h-3" />
            <label className="block text-xs font-semibold text-muted mb-1.5">Arquivo (PDF ou imagem)</label>
            <label className="flex items-center justify-center text-center text-sm text-muted border border-dashed border-border rounded-lg px-4 py-5 cursor-pointer hover:border-gold hover:text-foreground transition-colors">
              <input
                type="file"
                name="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name || null)}
              />
              {fileName || "Clique para enviar um arquivo"}
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">Ou cole o texto do extrato</label>
            <textarea
              name="text"
              rows={5}
              placeholder={"12/05 PIX RECEBIDO ... 1.200,00\n13/05 TIKTOK ADS ... 450,00 D\n..."}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-gold resize-y"
            />
            <button
              type="submit"
              disabled={pending}
              className="mt-2 bg-gold text-[#1a1305] font-bold text-sm rounded-lg py-2 px-4 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {pending ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
              {pending ? "Processando..." : "Processar com IA"}
            </button>
          </div>

          <p className="sm:col-span-2 text-xs text-faint leading-relaxed">
            A IA lê o extrato e categoriza automaticamente. Você pode corrigir qualquer categoria depois na aba
            Transações. Extratos muito longos podem ser cortados — nesse caso, importe em partes menores.
          </p>

          {state?.error && (
            <div className="sm:col-span-2 flex items-start gap-2 text-sm text-red bg-red-soft rounded-lg px-3 py-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" /> {state.error}
            </div>
          )}
          {state?.success && (
            <div className="sm:col-span-2 flex items-start gap-2 text-sm text-green bg-green-soft rounded-lg px-3 py-2">
              <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> {state.success}
            </div>
          )}
        </form>
      )}

      {!open && accounts.length === 0 && (
        <p className="text-sm text-faint mt-3 flex items-center gap-2">
          <FileText size={14} /> Nenhuma transação importada ainda.
        </p>
      )}
    </div>
  );
}
