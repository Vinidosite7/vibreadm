import { fmtBRL, type DREResult } from "@/lib/dre";
import { ArrowLeftRight } from "lucide-react";

function Row({
  label,
  value,
  pct,
  variant = "line",
  positiveTone,
}: {
  label: string;
  value: number;
  pct?: string | null;
  variant?: "line" | "subtotal" | "final";
  positiveTone?: boolean;
}) {
  const isFinal = variant === "final";
  const isSubtotal = variant === "subtotal";
  const negative = value < 0;

  let valueColor = "text-muted";
  if (isFinal) valueColor = positiveTone ? "text-green" : "text-red";
  else if (negative) valueColor = "text-red";
  else if (value > 0) valueColor = "text-green";

  return (
    <div
      className={`flex justify-between items-baseline py-2 border-b ${
        isFinal
          ? "border-none mt-2.5 px-4 py-3.5 rounded-xl"
          : isSubtotal
          ? "border-faint font-bold"
          : "border-border"
      }`}
      style={isFinal ? { background: positiveTone ? "var(--green-soft)" : "var(--red-soft)" } : undefined}
    >
      <span className={isSubtotal || isFinal ? "text-foreground" : "text-muted"}>{label}</span>
      <span className="flex items-baseline gap-2.5">
        {pct && <span className="text-xs text-faint">{pct}</span>}
        <span className={`font-mono font-medium ${isFinal ? "text-lg font-extrabold" : ""} ${valueColor}`}>
          {fmtBRL(value)}
        </span>
      </span>
    </div>
  );
}

export default function DreWaterfall({ dre, periodLabel }: { dre: DREResult; periodLabel: string }) {
  const pct = (v: number) => (dre.receita > 0 ? `${((v / dre.receita) * 100).toFixed(0)}% da receita` : null);

  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <h2 className="text-sm font-bold mb-3">DRE — {periodLabel}</h2>
      <Row label="Receita Bruta" value={dre.receita} />
      <Row label="(–) Custos com Gateway / Taxas" value={-dre.custos} pct={pct(dre.custos)} />
      <Row label="= Lucro Bruto" value={dre.lucroBruto} variant="subtotal" />
      <Row label="(–) Tráfego Pago" value={-dre.opex["Trafego Pago"]} pct={pct(dre.opex["Trafego Pago"])} />
      <Row
        label="(–) Equipe / Prestadores"
        value={-dre.opex["Equipe Prestadores"]}
        pct={pct(dre.opex["Equipe Prestadores"])}
      />
      <Row
        label="(–) Software / Ferramentas"
        value={-dre.opex["Software Ferramentas"]}
        pct={pct(dre.opex["Software Ferramentas"])}
      />
      <Row label="(–) Outras Despesas" value={-dre.opex["Outras Despesas"]} pct={pct(dre.opex["Outras Despesas"])} />
      <Row label="= Resultado Operacional" value={dre.resultadoOperacional} variant="subtotal" />
      <Row label="(–) Despesas Financeiras" value={-dre.despesasFinanceiras} pct={pct(dre.despesasFinanceiras)} />
      <Row label="(–) Impostos" value={-dre.impostos} pct={pct(dre.impostos)} />
      <Row label="(–) Pró-labore" value={-dre.proLabore} pct={pct(dre.proLabore)} />
      <Row
        label="= Resultado Líquido"
        value={dre.resultadoLiquido}
        variant="final"
        positiveTone={dre.resultadoLiquido >= 0}
      />
      {dre.internalCount > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-faint mt-3">
          <ArrowLeftRight size={12} />
          {dre.internalCount} transferência(s) interna(s) de {fmtBRL(dre.internalTotal)} excluída(s) do cálculo.
        </div>
      )}
    </div>
  );
}
