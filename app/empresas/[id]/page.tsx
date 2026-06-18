import Link from "next/link";
import { CreditCard, Landmark, LayoutDashboard, ChevronRight } from "lucide-react";

export default async function CompanyHomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const tiles = [
    {
      href: `/empresas/${id}/cartao`,
      icon: CreditCard,
      title: "Cartão de Crédito/Débito",
      desc: "Importe faturas e extratos de cartão. Cada compra é categorizada individualmente.",
    },
    {
      href: `/empresas/${id}/banco`,
      icon: Landmark,
      title: "Extrato Bancário",
      desc: "Importe o extrato da conta. Entradas, PIX, taxas, impostos e transferências.",
    },
    {
      href: `/empresas/${id}/dashboard`,
      icon: LayoutDashboard,
      title: "Dashboard DRE",
      desc: "Cartão + Banco combinados — o resultado real: receita, custo, lucro e tudo mais.",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-extrabold">O que você quer ver?</h1>
        <p className="text-sm text-muted mt-1">Escolha uma fonte de dados ou veja o resultado consolidado.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 hover:border-gold transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center">
                <t.icon size={18} className="text-gold" />
              </div>
              <ChevronRight size={18} className="text-faint group-hover:text-gold transition-colors" />
            </div>
            <p className="font-bold text-sm">{t.title}</p>
            <p className="text-xs text-faint leading-relaxed">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
