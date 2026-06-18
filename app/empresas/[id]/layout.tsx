import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import CompanyTabs from "@/components/CompanyTabs";
import { ArrowLeft, LayoutDashboard } from "lucide-react";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { data: company, error } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", id)
    .single();

  if (error || !company) notFound();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground shrink-0"
              title="Minhas empresas"
            >
              <ArrowLeft size={15} />
            </Link>
            <div className="w-8 h-8 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
              <LayoutDashboard size={15} className="text-gold" />
            </div>
            <span className="font-extrabold truncate">{company.name}</span>
          </div>
          <LogoutButton />
        </div>
        <CompanyTabs companyId={id} />
      </header>
      <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
