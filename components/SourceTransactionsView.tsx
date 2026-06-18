import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ImportPanel from "@/components/ImportPanel";
import TransactionsTable from "@/components/TransactionsTable";
import type { Transaction } from "@/lib/dre";

export default async function SourceTransactionsView({
  companyId,
  tipo,
  title,
  helpText,
}: {
  companyId: string;
  tipo: "cartao" | "banco";
  title: string;
  helpText: string;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("company_id", companyId)
    .eq("tipo", tipo)
    .order("date", { ascending: false });

  if (error) notFound();

  const transactions = (data || []) as Transaction[];
  const accounts = Array.from(new Set(transactions.map((t) => t.account))).sort();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold">{title}</h1>
        <p className="text-sm text-muted mt-1">{helpText}</p>
      </div>
      <ImportPanel companyId={companyId} tipo={tipo} accounts={accounts} />
      <TransactionsTable companyId={companyId} tipo={tipo} transactions={transactions} accounts={accounts} />
    </div>
  );
}
