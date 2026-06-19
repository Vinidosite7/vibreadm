import { Suspense } from "react";
import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import {
  computeDRE, monthlySeries, expenseBreakdown, monthLabel, type Transaction,
} from "@/lib/dre";
import { getCompanySettings } from "@/app/actions/settings";
import FilterBar from "@/components/FilterBar";
import DreWaterfall from "@/components/DreWaterfall";
import AiAnalysisPanel from "@/components/AiAnalysisPanel";
import { ExpensePieChart, MonthlyBarChart, ResultTrendChart } from "@/components/DreCharts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompanyDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; account?: string; tipo?: string }>;
}) {
  noStore();
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data, error }, settings] = await Promise.all([
    supabase.from("transactions").select("*").eq("company_id", id).order("date", { ascending: true }),
    getCompanySettings(id),
  ]);

  if (error) notFound();

  const all = (data || []) as Transaction[];
  const months = Array.from(new Set(all.map((t) => t.date.slice(0, 7)))).sort();
  const accounts = Array.from(new Set(all.map((t) => t.account))).sort();

  const filtered = all.filter((t) => {
    if (sp.month && !t.date.startsWith(sp.month)) return false;
    if (sp.account && t.account !== sp.account) return false;
    if (sp.tipo && t.tipo !== sp.tipo) return false;
    return true;
  });

  const dreFiltered = filtered.filter((t) => {
    if (t.tipo === "cartao" && !settings.include_cartao) return false;
    if (t.tipo === "banco" && !settings.include_banco) return false;
    return true;
  });

  const cartaoFiltered = filtered.filter((t) => t.tipo === "cartao");
  const bancoFiltered = filtered.filter((t) => t.tipo === "banco");

  const dre = computeDRE(dreFiltered);
  const monthly = monthlySeries(dreFiltered);
  const expensesCartao = expenseBreakdown(cartaoFiltered);
  const expensesBanco = expenseBreakdown(bancoFiltered);

  const periodLabel = sp.month ? monthLabel(sp.month) : months.length > 0 ? "todo o período" : "—";

  if (all.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-extrabold">Dashboard DRE</h1>
        <p className="text-sm text-faint">
          Ainda não há transações. Importe primeiro em <strong>Cartão de Crédito/Débito</strong> e/ou{" "}
          <strong>Extrato Bancário</strong> — aqui o resultado aparece consolidado.
        </p>
      </div>
    );
  }

  const sourcesLabel = [
    settings.include_cartao && "Cartão",
    settings.include_banco && "Banco",
  ].filter(Boolean).join(" + ") || "Nenhuma fonte ativa";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold">Dashboard DRE</h1>
        <p className="text-sm text-muted mt-1">
          {sourcesLabel} — o resultado real da empresa.
          {(!settings.include_cartao || !settings.include_banco) && (
            <span className="ml-2 text-gold text-xs">(fonte desativada nas Configurações)</span>
          )}
        </p>
      </div>

      <Suspense>
        <FilterBar months={months} accounts={accounts} showTipo />
      </Suspense>

      <DreWaterfall dre={dre} periodLabel={periodLabel} />

      <AiAnalysisPanel companyId={id} />

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-1">Despesas — Cartão</h3>
          <p className="text-xs text-muted mb-3">Gastos do cartão de crédito/débito</p>
          <ExpensePieChart data={expensesCartao} />
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-1">Despesas — Banco</h3>
          <p className="text-xs text-muted mb-3">Saídas do extrato bancário</p>
          <ExpensePieChart data={expensesBanco} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-2">Receita vs Despesas por mês</h3>
          <MonthlyBarChart data={monthly} />
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold mb-2">Tendência do resultado</h3>
          <ResultTrendChart data={monthly} />
        </div>
      </div>
    </div>
  );
}
