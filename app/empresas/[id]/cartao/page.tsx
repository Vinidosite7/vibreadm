import { unstable_noStore as noStore } from "next/cache";
import SourceTransactionsView from "@/components/SourceTransactionsView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CartaoPage({ params }: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await params;
  return (
    <SourceTransactionsView
      companyId={id}
      tipo="cartao"
      title="Cartão de Crédito/Débito"
      helpText="Importe as faturas/extratos do cartão aqui. Cada compra é categorizada individualmente."
    />
  );
}
