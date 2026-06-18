"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createCompany, type CompanyState } from "@/app/actions/companies";
import { Plus, Loader2 } from "lucide-react";

export default function NewCompanyForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CompanyState, FormData>(
    createCompany,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      formRef.current?.reset();
      setOpen(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-2 h-full min-h-[120px] rounded-2xl border border-dashed border-border text-muted hover:text-foreground hover:border-gold transition-colors"
      >
        <Plus size={20} />
        <span className="text-sm font-semibold">Nova empresa</span>
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 h-full min-h-[120px] rounded-2xl border border-border bg-surface p-4 justify-center"
    >
      <label className="text-xs font-semibold text-muted">Nome da empresa</label>
      <input
        name="name"
        autoFocus
        required
        placeholder="ex: BossFlow, Falei Né., Saffira Oliveira"
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-gold transition-colors"
      />
      {state?.error && <p className="text-xs text-red">{state.error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 bg-gold text-[#1a1305] font-bold text-sm rounded-lg py-2 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {pending && <Loader2 size={14} className="spin" />}
          Criar
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-2 text-sm text-muted rounded-lg border border-border"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
