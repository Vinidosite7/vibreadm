"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/empresas/${companyId}`, label: "Início" },
    { href: `/empresas/${companyId}/cartao`, label: "Cartão" },
    { href: `/empresas/${companyId}/banco`, label: "Banco" },
    { href: `/empresas/${companyId}/dashboard`, label: "Dashboard DRE" },
    { href: `/empresas/${companyId}/config`, label: "Config" },
  ];
  return (
    <nav className="max-w-5xl mx-auto px-6 flex gap-1 overflow-x-auto">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`text-sm font-semibold px-3 py-2 border-b-2 whitespace-nowrap transition-colors ${
              active ? "border-gold text-foreground" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
