import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";

export default function CompanyCard({
  id,
  name,
  createdAt,
}: {
  id: string;
  name: string;
  createdAt: string;
}) {
  const date = new Date(createdAt).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });

  return (
    <Link
      href={`/empresas/${id}`}
      className="group flex items-center gap-3 h-full min-h-[120px] rounded-2xl border border-border bg-surface p-4 hover:border-gold transition-colors"
    >
      <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0">
        <Building2 size={18} className="text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{name}</p>
        <p className="text-xs text-faint mt-0.5">desde {date}</p>
      </div>
      <ChevronRight size={18} className="text-faint group-hover:text-gold transition-colors shrink-0" />
    </Link>
  );
}
