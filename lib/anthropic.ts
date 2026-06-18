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
  "Nao Identificado",
];

function buildPrompt(
  accountLabel: string,
  yearHint: number,
  tipo: "cartao" | "banco",
  customCategories: string[] = []
) {
  const regraCartaoReceita =
    tipo === "cartao"
      ? `- Esse é um extrato de CARTÃO: qualquer valor POSITIVO aqui (pagamento da fatura recebido, crédito, estorno) NÃO é Receita — é só o pagamento da própria fatura, que já sai como despesa no extrato bancário. Categorize esses valores positivos como Transferencia Interna, nunca como Receita.`
      : "";
  const regraDuplicidade =
    tipo === "banco"
      ? `- ATENÇÃO: se uma transação for o pagamento da fatura de um cartão de crédito (ex: "PGTO CARTAO", "PAGAMENTO FATURA", valor de fechamento de fatura), categorize como Transferencia Interna — o detalhamento dessas compras já é importado separadamente pelo extrato do cartão, então classificá-la como despesa aqui contaria a mesma coisa duas vezes.`
      : `- Este é um extrato de CARTÃO DE CRÉDITO/DÉBITO: categorize cada compra normalmente pela categoria real (Trafego Pago, Software Ferramentas, etc). NÃO existe "pagamento de fatura" aqui — isso fica no extrato bancário.`;

  const todasCategorias = [...VALID_CATEGORIES, ...customCategories];
  const categoriasCustomTexto =
    customCategories.length > 0
      ? `\n- Essa empresa também tem categorias próprias criadas por ela: ${customCategories.join(
          ", "
        )}. Se uma transação combinar claramente com uma dessas, use ela em vez de "Outras Despesas".`
      : "";

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
- CATEGORIA: escolha exatamente uma destas: ${todasCategorias.join(", ")}.
- ByteDance, TikTok Ads, Meta Ads, Facebook Ads = Trafego Pago.
- Gateways de pagamento/checkout (Safe2Pay, GGMAX, PartnerBank, UTMify, WiinPay, Credinex e similares) cobrando taxa = Taxas Gateway.
- DAS, Simples Nacional, INSS, GPS = Impostos.
- Juros, IOF, multa, anuidade, manutenção de conta = Despesas Bancarias.
- PIX recorrente para a mesma pessoa física ligada aos sócios, ou entre contas da própria empresa = Transferencia Interna.
- Recebimentos de clientes, vendas, repasses de gateway de venda = Receita.
${regraCartaoReceita}
${regraDuplicidade}${categoriasCustomTexto}
- Se a transação for ambígua e você não tiver confiança real em nenhuma categoria, use Nao Identificado em vez de forçar uma categoria errada ou chutar "Outras Despesas". É melhor marcar como Nao Identificado do que categorizar errado.
- Ignore linhas que não são transações reais (saldo anterior, saldo do dia, cabeçalho, total).
- Seja extremamente direto e conciso para não estourar o limite de saída. Não invente dados que não estão no extrato.

Extrato:
`;
}

function parseOutput(text: string, customCategories: string[] = []): { rows: ExtractedRow[]; skipped: number } {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: ExtractedRow[] = [];
  let skipped = 0;
  const allCategories = [...VALID_CATEGORIES, ...customCategories];
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
      allCategories.find((c) => c.toLowerCase() === catRaw.toLowerCase()) || "Nao Identificado";
    rows.push({ date, description: desc.slice(0, 60), amount: value, category });
  }
  return { rows, skipped };
}

async function callClaude(
  content: unknown,
  customCategories: string[] = []
): Promise<{ rows: ExtractedRow[]; skipped: number; truncated: boolean }> {
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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 16000,
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
  const { rows, skipped } = parseOutput(text, customCategories);
  return { rows, skipped, truncated: data.stop_reason === "max_tokens" };
}

export async function extractFromText(
  rawText: string,
  accountLabel: string,
  tipo: "cartao" | "banco",
  customCategories: string[] = []
) {
  const yearHint = new Date().getFullYear();
  const prompt = buildPrompt(accountLabel, yearHint, tipo, customCategories) + rawText;
  return callClaude(prompt, customCategories);
}

export async function extractFromFiles(
  files: { base64: string; mediaType: string }[],
  accountLabel: string,
  tipo: "cartao" | "banco",
  customCategories: string[] = []
) {
  const yearHint = new Date().getFullYear();
  const countHint =
    files.length > 1
      ? ` As ${files.length} fotos/arquivos a seguir são PARTES DO MESMO extrato — trate como um único documento contínuo (ex: várias fotos de páginas diferentes da mesma fatura). Não repita uma transação que apareça em mais de uma foto por sobreposição.`
      : "";
  const promptText =
    buildPrompt(accountLabel, yearHint, tipo, customCategories) +
    `(${files.length} arquivo(s) em anexo).${countHint}`;

  const fileBlocks = files.map((f) =>
    f.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: f.mediaType, data: f.base64 } }
      : { type: "image", source: { type: "base64", media_type: f.mediaType, data: f.base64 } }
  );

  return callClaude([...fileBlocks, { type: "text", text: promptText }], customCategories);
}

const ANALYST_PERSONA = `Você é um analista financeiro/CFO brasileiro fodão — entende muito de número, de DRE e de negócio digital (tráfego pago, gateway, taxa, imposto, margem), mas fala igual gente normal, sem economês forçado e sem ser robótico.

Fala reto, sem rodeio, do jeito que um amigo que entende muito de dinheiro falaria numa ligação informal contigo. Pode usar gíria natural brasileira quando fizer sentido (tipo "tá pesando", "isso aí tá comendo sua margem", "bora cortar isso", "tá voando", "segura essa"), sem forçar a mão e sem virar caricatura — é uma pessoa de verdade falando, não um personagem.

Regras de formato:
- Texto corrido, em parágrafos curtos, como se estivesse falando numa call rápida. Sem markdown, sem "**negrito**", sem listas numeradas tipo "1)", "2)", sem títulos de seção.
- Pode usar "—" ou quebra de parágrafo pra separar ideias, mas nada de estrutura de relatório formal.
- Seja direto e específico: sempre cite os números reais (valores em R$ e percentuais) que foram passados, nunca generalize tipo "suas despesas estão altas" sem dizer qual e quanto.
- NUNCA invente número, categoria ou transação que não esteja nos dados passados. Se faltar dado pra comparar (ex: só tem um mês), fala isso direto e trabalha com o que tem.
- Estrutura do conteúdo (sem rotular as partes, só fala natural nessa ordem): primeiro dá um resumo rápido de como tá a saúde financeira do período; depois aponta o que mais tá pesando ou chamando atenção, com número; depois sugere de 3 a 5 ações concretas e práticas pra reduzir custo ou melhorar margem — quando der pra estimar, chuta quanto cada ação pode liberar por mês.
- Não precisa ser longo. Foca no que realmente importa, sem enrolar.`;

export async function analyzeFinances(dataSummary: string): Promise<string> {
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
      max_tokens: 1200,
      messages: [{ role: "user", content: `${ANALYST_PERSONA}\n\nDados reais do negócio nesse período:\n\n${dataSummary}` }],
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

  if (!text.trim()) throw new Error("A IA não respondeu nada. Tenta de novo.");
  return text.trim();
}
