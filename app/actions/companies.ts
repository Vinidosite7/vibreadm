"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type CompanyState = { error?: string } | null;

export async function createCompany(
  _prevState: CompanyState,
  formData: FormData
): Promise<CompanyState> {
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Dê um nome para a empresa." };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Sessão expirada. Faça login novamente." };

  const { error } = await supabase
    .from("companies")
    .insert({ name, user_id: userData.user.id });

  if (error) return { error: "Não foi possível criar a empresa: " + error.message };

  revalidatePath("/");
  return null;
}

export async function deleteCompany(companyId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("companies").delete().eq("id", companyId);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/");
}

export async function renameCompany(companyId: string, name: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ name })
    .eq("id", companyId);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath(`/empresas/${companyId}`);
}
