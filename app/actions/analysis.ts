"use server";

import { createClient } from "@/lib/supabase/server";
import { analyzeFinances } from "@/lib/anthropic";
import {
  computeDRE,
  expenseBreakdown,
  fmtBRL,
  monthLabel,
  CATEGORY_LABEL,
  type Transaction,
  type DREResult,
} from "@/lib/dre";

export type AnalysisResult = { text?: string; error?: string };

function pct(part: number, base: number): string {
  if (base <= 0) return "—";
  return `${((part / base) * 100).toFixed(0)}%`;
}

function dreLines(dre: DREResult): string {
  return [
    `Receita Bruta: ${fmtBRL(dre.receita)}`,
    `Custos com Gateway/Taxas: ${fmtBRL(dre.custos)} (${pct(dre.custos, dre.receita)} da receita)`,
    `Lucro Bruto: ${fmtBRL(dre.lucroBruto)}`,
    `Tráfego Pago: ${fmtBRL(dre.opex["Trafego Pago"])} (${pct(dre.opex["Trafego Pago"], dre.receita)} da receita)`,
    `Equipe/Prestadores: ${fmtBRL(dre.opex["Equipe Prestadores"])} (${pct(dre.opex["Equipe Prestadores"], dre.receita)} da receita)`,
    `Software/Ferramentas: ${fmtBRL(dre.opex["Software Ferramentas"])}`,
    `Outras Despesas: ${fmtBRL(dre.opex["Outras Despesas"])}`,
    `Resultado Operacional: ${fmtBRL(dre.resultadoOperacional)}`,
    `Despesas Financeiras: ${fmtBRL(dre.despesasFinanceiras)}`,
    `Impostos: ${fmtBRL(dre.impostos)}`,
    `Pró-labore: ${fmtBRL(dre.proLabore)}`,
    `Resultado Líquido: ${fmtBRL(dre.resultadoLiquido)} (margem líquida: ${pct(dre.resultadoLiquido, dre.receita)})`,
  ].join("\n");
}

export async function analyzeCompany(companyId: string): Promise<AnalysisResult> {
  try {
    const supabase = await createClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { error: "Sessão expirada. Faça login novamente." };

    const { data: company } = await supabase.from("companies").select("id").eq("id", companyId).single();
    if (!company) return { error: "Empresa não encontrada." };

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("company_id", companyId)
      .order("date", { ascending: true });
    if (error) return { error: error.message };

    const all = (data || []) as Transaction[];
    if (all.length === 0) {
      return { error: "Ainda não tem transação importada nessa empresa pra eu analisar." };
    }

    const months = Array.from(new Set(all.map((t) => t.date.slice(0, 7)))).sort();
    const lastMonth = months[months.length - 1];
    const prevMonth = months.length > 1 ? months[months.length - 2] : null;

    const currentRows = all.filter((t) => t.date.startsWith(lastMonth));
    const currentDre = computeDRE(currentRows);
    const currentExpenses = expenseBreakdown(currentRows).slice(0, 6);

    let comparisonBlock = "Só tem dado de um mês ainda, então não dá pra comparar com mês anterior — analisa só esse mês mesmo.";
    if (prevMonth) {
      const prevRows = all.filter((t) => t.date.startsWith(prevMonth));
      const prevDre = computeDRE(prevRows);
      comparisonBlock = `Comparando ${monthLabel(prevMonth)} -> ${monthLabel(lastMonth)}:
Receita: ${fmtBRL(prevDre.receita)} -> ${fmtBRL(currentDre.receita)}
Tráfego Pago: ${fmtBRL(prevDre.opex["Trafego Pago"])} -> ${fmtBRL(currentDre.opex["Trafego Pago"])}
Resultado Operacional: ${fmtBRL(prevDre.resultadoOperacional)} -> ${fmtBRL(currentDre.resultadoOperacional)}
Resultado Líquido: ${fmtBRL(prevDre.resultadoLiquido)} -> ${fmtBRL(currentDre.resultadoLiquido)}`;
    }

    const topExpensesText = [...currentRows]
      .filter((t) => t.amount < 0 && t.category !== "Transferencia Interna")
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 8)
      .map((t) => `${t.date.slice(8, 10)}/${t.date.slice(5, 7)} ${t.description}: ${fmtBRL(t.amount)} (${CATEGORY_LABEL[t.category] || t.category})`)
      .join("\n");

    const expensesByCategoryText = currentExpenses.map((e) => `${e.name}: ${fmtBRL(e.value)}`).join("\n");

    const dataSummary = `Mês analisado: ${monthLabel(lastMonth)}

DRE do mês:
${dreLines(currentDre)}

${comparisonBlock}

Despesas por categoria nesse mês:
${expensesByCategoryText || "Sem despesas categorizadas."}

Maiores gastos individuais do mês:
${topExpensesText || "Nenhum gasto relevante registrado."}`;

    const text = await analyzeFinances(dataSummary);
    return { text };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao gerar análise." };
  }
}
