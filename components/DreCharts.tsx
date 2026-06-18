"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { CATEGORY_COLORS, fmtBRL } from "@/lib/dre";

const tooltipStyle = {
  background: "#151B23",
  border: "1px solid #232C39",
  borderRadius: 8,
  fontSize: 12,
};

export function ExpensePieChart({
  data,
}: {
  data: { name: string; value: number; key: string }[];
}) {
  if (data.length === 0) {
    return <p className="text-sm text-faint">Sem despesas no período selecionado.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.key} fill={CATEGORY_COLORS[entry.key] || "#5B6573"} stroke="none" />
          ))}
        </Pie>
        <Tooltip formatter={(v) => fmtBRL(Number(v) || 0)} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBarChart({
  data,
}: {
  data: { label: string; receita: number; despesas: number }[];
}) {
  if (data.length < 1) {
    return <p className="text-sm text-faint">Importe transações para ver a comparação mensal.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#232C39" />
        <XAxis dataKey="label" stroke="#5B6573" fontSize={11} />
        <YAxis stroke="#5B6573" fontSize={11} />
        <Tooltip formatter={(v) => fmtBRL(Number(v) || 0)} contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="receita" name="Receita" fill="#34B27B" radius={[4, 4, 0, 0]} />
        <Bar dataKey="despesas" name="Despesas" fill="#E5615E" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ResultTrendChart({
  data,
}: {
  data: { label: string; resultado: number }[];
}) {
  if (data.length < 1) {
    return <p className="text-sm text-faint">Importe mais de um mês para ver a tendência.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#232C39" />
        <XAxis dataKey="label" stroke="#5B6573" fontSize={11} />
        <YAxis stroke="#5B6573" fontSize={11} />
        <Tooltip formatter={(v) => fmtBRL(Number(v) || 0)} contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="resultado" name="Resultado" stroke="#C9A227" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
