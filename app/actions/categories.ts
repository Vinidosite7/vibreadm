"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { KNOWN_BUCKETS } from "@/lib/dre";

export type CategoryState = { error?: string } | null;

export async function listCustomCategories(companyId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("name")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  return (data || []).map((c) => c.name as string);
}

export async function createCategory(
  companyId: string,
  _prevState: CategoryState,
  formData: FormData
): Promise<CategoryState> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Dê um nome para a categoria." };
  if (name.length > 40) return { error: "Nome muito longo (máx 40 caracteres)." };
  if (KNOWN_BUCKETS.has(name)) return { error: "Já existe uma categoria padrão com esse nome." };
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Sessão expirada. Faça login novamente." };
  const { data: company } = await supabase.from("companies").select("id").eq("id", companyId).single();
  if (!company) return { error: "Empresa não encontrada." };
  const { error } = await supabase.from("categories").insert({ company_id: companyId, name });
  if (error) {
    if (error.code === "23505") return { error: "Você já tem uma categoria com esse nome." };
    return { error: error.message };
  }
  revalidatePath(`/empresas/${companyId}/cartao`);
  revalidatePath(`/empresas/${companyId}/banco`);
  return null;
}

export async function deleteCategory(companyId: string, name: string): Promise<CategoryState> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Sessão expirada. Faça login novamente." };
  const { data: company } = await supabase.from("companies").select("id").eq("id", companyId).single();
  if (!company) return { error: "Empresa não encontrada." };
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("company_id", companyId)
    .eq("name", name);
  if (error) return { error: error.message };
  revalidatePath(`/empresas/${companyId}/cartao`);
  revalidatePath(`/empresas/${companyId}/banco`);
  return null;
}
