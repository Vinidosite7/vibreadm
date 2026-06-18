"use client";

import { useState, useTransition } from "react";
import { analyzeCompany } from "@/app/actions/analysis";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";

export default function AiAnalysisPanel({ companyId }: { companyId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await analyzeCompany(companyId);
      if (res.error) setError(res.error);
      else setText(res.text || null);
    });
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Sparkles size={15} className="text-gold" /> Analista IA
        </h3>
        <button
          onClick={run}
          disabled={isPending}
          className="text-xs font-semibold text-muted hover:text-foreground border border-border rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60 shrink-0"
        >
          {isPending ? (
            <Loader2 size={12} className="spin" />
          ) : text ? (
            <RotateCcw size={12} />
          ) : (
            <Sparkles size={12} />
          )}
          {isPending ? "Analisando..." : text ? "Analisar de novo" : "Analisar com IA"}
        </button>
      </div>

      {!text && !isPending && !error && (
        <p className="text-sm text-faint mt-3">Clica aí que eu te dou minha opinião sincera sobre esses números.</p>
      )}
      {error && <p className="text-sm text-red mt-3">{error}</p>}
      {text && (
        <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line mt-3">{text}</div>
      )}
    </div>
  );
}
