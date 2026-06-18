"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { monthLabel } from "@/lib/dre";

export default function FilterBar({
  months,
  accounts,
  showTipo = false,
}: {
  months: string[];
  accounts: string[];
  showTipo?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMonth = searchParams.get("month") || "all";
  const currentAccount = searchParams.get("account") || "all";
  const currentTipo = searchParams.get("tipo") || "all";

  function update(key: "month" | "account" | "tipo", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  if (months.length === 0) return null;

  return (
    <div className="flex gap-3 flex-wrap mb-5">
      {showTipo && (
        <select
          value={currentTipo}
          onChange={(e) => update("tipo", e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-gold"
        >
          <option value="all">Cartão + Banco</option>
          <option value="cartao">Só Cartão</option>
          <option value="banco">Só Banco</option>
        </select>
      )}
      <select
        value={currentMonth}
        onChange={(e) => update("month", e.target.value)}
        className="bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-gold"
      >
        <option value="all">Todos os meses</option>
        {months.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m)}
          </option>
        ))}
      </select>
      <select
        value={currentAccount}
        onChange={(e) => update("account", e.target.value)}
        className="bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-gold"
      >
        <option value="all">Todas as contas</option>
        {accounts.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}
