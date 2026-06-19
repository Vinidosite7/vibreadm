import { unstable_noStore as noStore } from "next/cache";
import SourceTransactionsView from "@/components/SourceTransactionsView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BancoPage({ params }: { params: Promise<{ id: string }> }) {
  noStore();
  const { id } = await params;
  return (
    <SourceTransactionsView
      companyId={id}
      tipo="banco"
      title="Extrato Bancário"
      helpText="Importe o extrato da conta aqui. Se aparecer o pagamento da fatura do cartão, deixe como Transferência Interna — o detalhe das compras já vem do Cartão."
    />
  );
}
