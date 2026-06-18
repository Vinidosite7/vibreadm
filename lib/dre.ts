export type Category =
  | "Receita"
  | "Trafego Pago"
  | "Taxas Gateway"
  | "Equipe Prestadores"
  | "Pro Labore"
  | "Software Ferramentas"
  | "Despesas Bancarias"
  | "Impostos"
  | "Outras Despesas"
  | "Transferencia Interna"
  | "Nao Identificado";

export type SourceType = "cartao" | "banco";

export type Transaction = {
  id: string;
  company_id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  category: string; // categoria fixa (Category) ou nome de categoria customizada da empresa
  account: string;
  tipo: SourceType;
  created_at?: string;
};

export const CATEGORIES: { key: Category; label: string }[] = [
  { key: "Receita", label: "Receita" },
  { key: "Trafego Pago", label: "Tráfego Pago" },
  { key: "Taxas Gateway", label: "Taxas / Gateway" },
  { key: "Equipe Prestadores", label: "Equipe / Prestadores" },
  { key: "Pro Labore", label: "Pró-labore" },
  { key: "Software Ferramentas", label: "Software / Ferramentas" },
  { key: "Despesas Bancarias", label: "Despesas Bancárias" },
  { key: "Impostos", label: "Impostos" },
  { key: "Outras Despesas", label: "Outras Despesas" },
  { key: "Transferencia Interna", label: "Transferência Interna" },
  { key: "Nao Identificado", label: "Não Identificado" },
];

// Categorias que têm linha própria no cálculo do DRE. Qualquer categoria
// customizada criada pela empresa (fora dessa lista) entra automaticamente
// no balaio de "Outras Despesas" para fins de cálculo, mas mantém o nome
// próprio nos gráficos de detalhamento (expenseBreakdown).
export const KNOWN_BUCKETS = new Set<string>(CATEGORIES.map((c) => c.key));

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label])
);

export const CATEGORY_COLORS: Record<string, string> = {
  "Trafego Pago": "#E5615E",
  "Taxas Gateway": "#D98B4A",
  "Equipe Prestadores": "#C9A227",
  "Pro Labore": "#6E8FD9",
  "Software Ferramentas": "#8C7AE0",
  "Despesas Bancarias": "#5FB3C9",
  Impostos: "#B3654F",
  "Outras Despesas": "#5B6573",
  "Nao Identificado": "#E5615E",
};

export const MONTH_NAMES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export function monthLabel(m: string | null | undefined): string {
  if (!m) return "—";
  const [y, mo] = m.split("-");
  const idx = parseInt(mo, 10) - 1;
  return `${MONTH_NAMES[idx] || mo}/${y}`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, mo, day] = d.split("-");
  return `${day}/${mo}/${y}`;
}

export function fmtBRL(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type DREResult = {
  receita: number;
  custos: number;
  lucroBruto: number;
  opex: Record<string, number>;
  opexTotal: number;
  resultadoOperacional: number;
  despesasFinanceiras: number;
  impostos: number;
  proLabore: number;
  naoIdentificado: number;
  resultadoLiquido: number;
  internalTotal: number;
  internalCount: number;
};

export function computeDRE(rows: Transaction[]): DREResult {
  const sums: Record<string, number> = {};
  CATEGORIES.forEach((c) => (sums[c.key] = 0));
  let internalTotal = 0;
  let internalCount = 0;
  rows.forEach((t) => {
    if (t.category === "Transferencia Interna") {
      internalTotal += t.amount;
      internalCount++;
      return;
    }
    // Categorias customizadas (criadas pela empresa) não têm linha própria
    // no DRE — entram no balaio de "Outras Despesas" pra não sumir do cálculo.
    const bucket = KNOWN_BUCKETS.has(t.category) ? t.category : "Outras Despesas";
    sums[bucket] = (sums[bucket] || 0) + t.amount;
  });

  const receita = sums["Receita"] || 0;
  const custos = Math.abs(sums["Taxas Gateway"] || 0);
  const lucroBruto = receita - custos;

  const opex: Record<string, number> = {
    "Trafego Pago": Math.abs(sums["Trafego Pago"] || 0),
    "Equipe Prestadores": Math.abs(sums["Equipe Prestadores"] || 0),
    "Software Ferramentas": Math.abs(sums["Software Ferramentas"] || 0),
    "Outras Despesas": Math.abs(sums["Outras Despesas"] || 0),
  };
  const opexTotal = Object.values(opex).reduce((a, b) => a + b, 0);
  const resultadoOperacional = lucroBruto - opexTotal;

  const despesasFinanceiras = Math.abs(sums["Despesas Bancarias"] || 0);
  const impostos = Math.abs(sums["Impostos"] || 0);
  const proLabore = Math.abs(sums["Pro Labore"] || 0);
  const naoIdentificado = Math.abs(sums["Nao Identificado"] || 0);
  const resultadoLiquido =
    resultadoOperacional - despesasFinanceiras - impostos - proLabore - naoIdentificado;

  return {
    receita,
    custos,
    lucroBruto,
    opex,
    opexTotal,
    resultadoOperacional,
    despesasFinanceiras,
    impostos,
    proLabore,
    naoIdentificado,
    resultadoLiquido,
    internalTotal,
    internalCount,
  };
}

export function monthlySeries(rows: Transaction[]) {
  const map: Record<string, { month: string; receita: number; despesas: number }> = {};
  rows.forEach((t) => {
    if (t.category === "Transferencia Interna") return;
    const month = t.date.slice(0, 7);
    if (!map[month]) map[month] = { month, receita: 0, despesas: 0 };
    if (t.amount > 0) map[month].receita += t.amount;
    else map[month].despesas += Math.abs(t.amount);
  });
  return Object.values(map)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({ ...m, label: monthLabel(m.month), resultado: m.receita - m.despesas }));
}

export function expenseBreakdown(rows: Transaction[]) {
  const map: Record<string, number> = {};
  rows.forEach((t) => {
    if (t.amount >= 0 || t.category === "Transferencia Interna") return;
    map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
  });
  return Object.entries(map)
    .map(([k, v]) => ({ name: CATEGORY_LABEL[k] || k, value: v, key: k }))
    .sort((a, b) => b.value - a.value);
}
