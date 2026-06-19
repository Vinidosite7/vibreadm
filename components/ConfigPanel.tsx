"use client";

import { useState, useTransition } from "react";
import { updateCompanySettings, type CompanySettings } from "@/app/actions/settings";
import { CheckCircle2 } from "lucide-react";

function Toggle({ label, description, checked, disabled, onChange }: {
  label: string; description: string; checked: boolean; disabled: boolean; onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border border-border rounded-xl px-4 py-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted mt-0.5">{description}</p>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        aria-checked={checked}
        role="switch"
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-gold" : "bg-border"} disabled:opacity-50`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-[#131922] transition-all ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

export default function ConfigPanel({ companyId, settings }: { companyId: string; settings: CompanySettings }) {
  const [values, setValues] = useState(settings);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof CompanySettings) {
    const updated = { ...values, [key]: !values[key] };
    setValues(updated);
    setSaved(false);
    startTransition(async () => {
      await updateCompanySettings(companyId, updated);
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Dashboard DRE — fontes de dados</h2>
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green">
              <CheckCircle2 size={13} /> Salvo
            </span>
          )}
        </div>
        <p className="text-xs text-muted">Controle quais fontes entram no cálculo do DRE. Desativar uma fonte não apaga os dados, só para de contar.</p>
        <Toggle
          label="Cartão de Crédito/Débito"
          description="Incluir lançamentos do cartão no DRE e nos gráficos"
          checked={values.include_cartao}
          disabled={pending}
          onChange={() => toggle("include_cartao")}
        />
        <Toggle
          label="Extrato Bancário"
          description="Incluir lançamentos do banco no DRE e nos gráficos"
          checked={values.include_banco}
          disabled={pending}
          onChange={() => toggle("include_banco")}
        />
      </div>
    </div>
  );
}
