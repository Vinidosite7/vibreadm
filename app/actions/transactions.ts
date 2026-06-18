"use server";

import { createClient } from "@/lib/supabase/server";
import { extractFromText, extractFromFile } from "@/lib/anthropic";
import { revalidatePath } from "next/cache";

export type ImportState = {
  error?: string;
  success?: string;
} | null;

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

export async function importStatement(
  companyId: string,
  tipo: "cartao" | "banco",
  _prevState: ImportState,
  formData: FormData
): Promise<ImportState> {
  try {
    const supabase = await assertCompanyOwnership(companyId);

    const account = String(formData.get("account") || "Conta sem nome").trim() || "Conta sem nome";
    const text = formData.get("text");
    const file = formData.get("file") as File | null;

    let result: { rows: { date: string; description: string; amount: number; category: string }[]; skipped: number };

    if (file && file.size > 0) {
      const buf = await file.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const mediaType = file.type || "application/octet-stream";
      if (
        mediaType !== "application/pdf" &&
        !mediaType.startsWith("image/")
      ) {
        return { error: "Envie PDF ou imagem (PNG/JPG/WEBP). Para CSV/Excel, abra o arquivo e cole o conteúdo como texto." };
      }
      result = await extractFromFile(base64, mediaType, account, tipo);
    } else if (text && String(text).trim()) {
      result = await extractFromText(String(text), account, tipo);
    } else {
      return { error: "Cole o texto do extrato ou envie um arquivo." };
    }

    if (result.rows.length === 0) {
      return { error: "Não consegui identificar transações nesse extrato. Tente colar o texto puro." };
    }

    const rowsToInsert = result.rows.map((r) => ({
      company_id: companyId,
      date: r.date,
      description: r.description,
      amount: r.amount,
      category: r.category,
      account,
      tipo,
    }));

    const { error: insertError } = await supabase.from("transactions").insert(rowsToInsert);
    if (insertError) return { error: "Erro ao salvar transações: " + insertError.message };

    revalidateCompany(companyId);

    return {
      success: `${result.rows.length} transações importadas${
        result.skipped ? ` — ${result.skipped} linha(s) ignorada(s)` : ""
      }.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao processar o extrato." };
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
