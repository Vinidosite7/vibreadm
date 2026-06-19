"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CompanySettings = {
  include_cartao: boolean;
  include_banco: boolean;
};

const DEFAULT: CompanySettings = { include_cartao: true, include_banco: true };

export async function getCompanySettings(companyId: string): Promise<CompanySettings> {
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("settings").eq("id", companyId).single();
  return { ...DEFAULT, ...(data?.settings || {}) };
}

export async function updateCompanySettings(
  companyId: string,
  patch: Partial<CompanySettings>
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: "Sessão expirada." };
  const current = await getCompanySettings(companyId);
  const { error } = await supabase
    .from("companies")
    .update({ settings: { ...current, ...patch } })
    .eq("id", companyId);
  if (error) return { error: error.message };
  revalidatePath(`/empresas/${companyId}/dashboard`);
  revalidatePath(`/empresas/${companyId}/config`);
  return {};
}
