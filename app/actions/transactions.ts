"use server";

import { createClient } from "@/lib/supabase/server";
import { extractFromText, extractFromFiles } from "@/lib/anthropic";
import { revalidatePath } from "next/cache";

async function assertCompanyOwnership(companyId: string) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Sessão expirada. Faça login novamente.");

  const { data: company, error } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .single();

  if (error || !company) throw new Error("Empresa não encontrada ou sem permissão.");
  return supabase;
}

function revalidateCompany(companyId: string) {
  revalidatePath(`/empresas/${companyId}/cartao`);
  revalidatePath(`/empresas/${companyId}/banco`);
  revalidatePath(`/empresas/${companyId}/dashboard`);
}

export type ExtractRow = {
  date: string;
  description: string;
  amount: number;
  category: string;
  isDuplicate: boolean;
};

export type ExtractResult = { rows?: ExtractRow[]; skipped?: number; error?: string };

export async function extractStatement(
  companyId: string,
  tipo: "cartao" | "banco",
  formData: FormData
): Promise<ExtractResult> {
  try {
    const supabase = await assertCompanyOwnership(companyId);

    const { data: customCats } = await supabase
      .from("categories")
      .select("name")
      .eq("company_id", companyId);
    const customCategories = (customCats || []).map((c) => c.name as string);

    const account = String(formData.get("account") || "Conta sem nome").trim() || "Conta sem nome";
    const text = formData.get("text");
    const allFiles = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);

    let result: { rows: { date: string; description: string; amount: number; category: string }[]; skipped: number };

    if (allFiles.length > 0) {
      const converted: { base64: string; mediaType: string }[] = [];
      for (const file of allFiles) {
        const mediaType = file.type || "application/octet-stream";
        if (mediaType !== "application/pdf" && !mediaType.startsWith("image/")) {
          return { error: `"${file.name}" não é PDF nem imagem (PNG/JPG/WEBP). Para CSV/Excel, cole o conteúdo como texto.` };
        }
        const buf = await file.arrayBuffer();
        converted.push({ base64: Buffer.from(buf).toString("base64"), mediaType });
      }
      result = await extractFromFiles(converted, account, tipo, customCategories);
    } else if (text && String(text).trim()) {
      result = await extractFromText(String(text), account, tipo, customCategories);
    } else {
      return { error: "Cole o texto do extrato ou envie um ou mais arquivos." };
    }

    if (result.rows.length === 0) {
      return { error: "Não consegui identificar transações nesse extrato. Tente colar o texto puro." };
    }

    const { data: existing } = await supabase
      .from("transactions")
      .select("date, amount")
      .eq("company_id", companyId)
      .eq("tipo", tipo);
    const existingKeys = new Set((existing || []).map((e) => `${e.date}|${Number(e.amount).toFixed(2)}`));

    const rows: ExtractRow[] = result.rows.map((r) => ({
      ...r,
      isDuplicate: existingKeys.has(`${r.date}|${r.amount.toFixed(2)}`),
    }));

    return { rows, skipped: result.skipped };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao processar o extrato." };
  }
}

export type ConfirmImportResult = { success?: string; error?: string };

export async function confirmImport(
  companyId: string,
  tipo: "cartao" | "banco",
  account: string,
  rows: { date: string; description: string; amount: number; category: string }[]
): Promise<ConfirmImportResult> {
  try {
    if (!rows || rows.length === 0) return { error: "Nenhuma transação selecionada." };
    const supabase = await assertCompanyOwnership(companyId);

    const rowsToInsert = rows.map((r) => ({
      company_id: companyId,
      date: r.date,
      description: String(r.description || "").slice(0, 60),
      amount: r.amount,
      category: r.category,
      account: account || "Conta sem nome",
      tipo,
    }));

    const { error } = await supabase.from("transactions").insert(rowsToInsert);
    if (error) return { error: "Erro ao salvar: " + error.message };

    revalidateCompany(companyId);
    return { success: `${rows.length} transação(ões) importada(s).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao confirmar importação." };
  }
}

export async function updateTransactionCategory(
  companyId: string,
  transactionId: string,
  category: string
) {
  const supabase = await assertCompanyOwnership(companyId);
  const { error } = await supabase
    .from("transactions")
    .update({ category })
    .eq("id", transactionId)
    .eq("company_id", companyId);
  if (error) throw new Error(error.message);
  revalidateCompany(companyId);
}

export async function deleteTransactionAction(companyId: string, transactionId: string) {
  const supabase = await assertCompanyOwnership(companyId);
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", transactionId)
    .eq("company_id", companyId);
  if (error) throw new Error(error.message);
  revalidateCompany(companyId);
}

export type ManualState = { error?: string } | null;

export type BulkDeleteState = { error?: string; success?: string } | null;

export async function bulkDeleteTransactions(
  companyId: string,
  tipo: "cartao" | "banco",
  mode: "all" | "month" | "last7days",
  month?: string
): Promise<BulkDeleteState> {
  try {
    const supabase = await assertCompanyOwnership(companyId);

    let query = supabase
      .from("transactions")
      .delete({ count: "exact" })
      .eq("company_id", companyId)
      .eq("tipo", tipo);

    if (mode === "month") {
      if (!month || !/^\d{4}-\d{2}$/.test(month)) return { error: "Selecione um mês válido." };
      const [y, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      const nextDate = new Date(y, m, 1);
      const end = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-01`;
      query = query.gte("date", start).lt("date", end);
    } else if (mode === "last7days") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const cutoff = d.toISOString().slice(0, 10);
      query = query.gte("date", cutoff);
    }
    // mode === "all": sem filtro extra, apaga tudo desse tipo nessa empresa.

    const { error, count } = await query;
    if (error) return { error: error.message };

    revalidateCompany(companyId);
    return { success: `${count ?? 0} transação(ões) apagada(s).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao apagar transações." };
  }
}

export async function addManualTransaction(
  companyId: string,
  tipo: "cartao" | "banco",
  _prevState: ManualState,
  formData: FormData
): Promise<ManualState> {
  const date = String(formData.get("date") || "");
  const description = String(formData.get("description") || "").trim();
  const amountRaw = String(formData.get("amount") || "").replace(",", ".");
  const category = String(formData.get("category") || "Outras Despesas");
  const account = String(formData.get("account") || "Conta sem nome").trim() || "Conta sem nome";
  const amount = parseFloat(amountRaw);

  if (!date || !description || Number.isNaN(amount)) {
    return { error: "Preencha data, descrição e valor." };
  }

  const supabase = await assertCompanyOwnership(companyId);
  const { error } = await supabase.from("transactions").insert({
    company_id: companyId,
    date,
    description: description.slice(0, 60),
    amount,
    category,
    account,
    tipo,
  });
  if (error) return { error: error.message };

  revalidateCompany(companyId);
  return null;
}
