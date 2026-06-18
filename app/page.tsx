import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CompanyCard from "@/components/CompanyCard";
import NewCompanyForm from "@/components/NewCompanyForm";
import LogoutButton from "@/components/LogoutButton";
import { LayoutDashboard } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen px-6 py-8 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center">
            <LayoutDashboard size={18} className="text-gold" />
          </div>
          <span className="text-lg font-extrabold tracking-tight">Painel DRE</span>
        </div>
        <LogoutButton />
      </header>

      <div className="mb-6">
        <h1 className="text-xl font-extrabold">Suas empresas</h1>
        <p className="text-sm text-muted mt-1">
          Cada empresa tem seu próprio extrato, categorias e DRE — nada se mistura.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(companies || []).map((c) => (
          <CompanyCard key={c.id} id={c.id} name={c.name} createdAt={c.created_at} />
        ))}
        <NewCompanyForm />
      </div>
    </main>
  );
}
