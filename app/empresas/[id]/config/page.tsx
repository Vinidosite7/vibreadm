import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getCompanySettings } from "@/app/actions/settings";
import ConfigPanel from "@/components/ConfigPanel";

export const dynamic = "force-dynamic";

export default async function ConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: company } = await supabase.from("companies").select("id, name").eq("id", id).single();
  if (!company) notFound();
  const settings = await getCompanySettings(id);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold">Configurações</h1>
        <p className="text-sm text-muted mt-1">Personalize o comportamento do Dashboard DRE para esta empresa.</p>
      </div>
      <ConfigPanel companyId={id} settings={settings} />
    </div>
  );
}
