import "server-only";

export type ExtractedRow = {
  date: string;
  description: string;
  amount: number;
  category: string;
};

const VALID_CATEGORIES = [
  "Receita",
  "Trafego Pago",
  "Taxas Gateway",
  "Equipe Prestadores",
  "Pro Labore",
  "Software Ferramentas",
  "Despesas Bancarias",
  "Impostos",
  "Transferencia Interna",
  "Outras Despesas",
];

function buildPrompt(accountLabel: string, yearHint: number, tipo: "cartao" | "banco") {
  const regraDuplicidade =
    tipo === "banco"
      ? `- ATENÇÃO: se uma transação for o pagamento da fatura de um cartão de crédito (ex: "PGTO CARTAO", "PAGAMENTO FATURA", valor de fechamento de fatura), categorize como Transferencia Interna — o detalhamento dessas compras já é importado separadamente pelo extrato do cartão, então classificá-la como despesa aqui contaria a mesma coisa duas vezes.`
      : `- Este é um extrato de CARTÃO DE CRÉDITO/DÉBITO: categorize cada compra normalmente pela categoria real (Trafego Pago, Software Ferramentas, etc). NÃO existe "pagamento de fatura" aqui — isso fica no extrato bancário.`;

  return `Você é um motor de extração de dados financeiros para um sistema de DRE empresarial brasileiro.
Extraia TODAS as transações reais do extrato/fatura abaixo (conta: "${accountLabel}", tipo: ${
    tipo === "cartao" ? "cartão de crédito/débito" : "extrato bancário"
  }).
Responda APENAS com linhas no formato exato, uma transação por linha, sem cabeçalho, sem markdown, sem texto antes ou depois:
DATA|DESCRICAO|VALOR|CATEGORIA

Regras:
- DATA no formato AAAA-MM-DD. Se o extrato não trouxer o ano, use ${yearHint}.
- DESCRICAO: até 40 caracteres, nunca use o caractere "|".
- VALOR: número com ponto decimal (ex: -450.00 ou 1200.50). Negativo = saída/débito. Positivo = entrada/crédito.
- CATEGORIA: escolha exatamente uma destas: ${VALID_CATEGORIES.join(", ")}.
- ByteDance, TikTok Ads, Meta Ads, Facebook Ads = Trafego Pago.
- Gateways de pagamento/checkout (Safe2Pay, GGMAX, PartnerBank, UTMify, WiinPay, Credinex e similares) cobrando taxa = Taxas Gateway.
- DAS, Simples Nacional, INSS, GPS = Impostos.
- Juros, IOF, multa, anuidade, manutenção de conta = Despesas Bancarias.
- PIX recorrente para a mesma pessoa física ligada aos sócios, ou entre contas da própria empresa = Transferencia Interna.
- Recebimentos de clientes, vendas, repasses de gateway de venda = Receita.
${regraDuplicidade}
- Ignore linhas que não são transações reais (saldo anterior, saldo do dia, cabeçalho, total).
- Seja extremamente direto e conciso para não estourar o limite de saída. Não invente dados que não estão no extrato.

Extrato:
`;
}

function parseOutput(text: string): { rows: ExtractedRow[]; skipped: number } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: ExtractedRow[] = [];
  let skipped = 0;
  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length !== 4) {
      skipped++;
      continue;
    }
    const [date, desc, valueStr, catRaw] = parts.map((p) => p.trim());
    const value = parseFloat(valueStr.replace(",", "."));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(value)) {
      skipped++;
      continue;
    }
    const category =
      VALID_CATEGORIES.find((c) => c.toLowerCase() === catRaw.toLowerCase()) ||
      "Outras Despesas";
    rows.push({ date, description: desc.slice(0, 60), amount: value, category });
  }
  return { rows, skipped };
}

async function callClaude(content: unknown): Promise<{ rows: ExtractedRow[]; skipped: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não está configurada no servidor. Adicione essa variável de ambiente na Vercel."
    );
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Falha na API da Anthropic (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n");

  if (!text.trim()) throw new Error("A IA não retornou nenhum dado. Tente novamente.");
  return parseOutput(text);
}

export async function extractFromText(rawText: string, accountLabel: string, tipo: "cartao" | "banco") {
  const yearHint = new Date().getFullYear();
  const prompt = buildPrompt(accountLabel, yearHint, tipo) + rawText;
  return callClaude(prompt);
}

export async function extractFromFile(
  base64: string,
  mediaType: string,
  accountLabel: string,
  tipo: "cartao" | "banco"
) {
  const yearHint = new Date().getFullYear();
  const promptText = buildPrompt(accountLabel, yearHint, tipo) + "(arquivo em anexo)";
  const fileBlock =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: mediaType, data: base64 } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
  return callClaude([fileBlock, { type: "text", text: promptText }]);
}
