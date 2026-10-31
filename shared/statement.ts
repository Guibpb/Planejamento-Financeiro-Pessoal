import type { Entry } from "./finance.ts";

export const expenseCategories = [
  "Supermercado",
  "Alimentação",
  "Transporte",
  "Combustível",
  "Assinaturas",
  "Telefonia e internet",
  "Saúde",
  "Educação",
  "Compras",
  "Moradia",
  "Lazer",
  "Pix no crédito",
  "Juros e impostos",
  "Outros",
];
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
export function categorize(description: string) {
  const s = normalize(description);
  const rules: [string, RegExp][] = [
    ["Juros e impostos", /\b(IOF|JUROS|ENCARGO|ANUIDADE|MULTA)\b/],
    ["Pix no crédito", /PIX CRED/],
    ["Supermercado", /CARREFOUR|SUPERMERC|ATACAD|ASSAI|RAIZES DA FAZENDA/],
    ["Assinaturas", /PRIME|SPOTIFY|NETFLIX|IFOOD CLUB|DISNEY|HBO|YOUTUBE/],
    ["Telefonia e internet", /CLARO|VIVO|TIM\b|TELEFON|INTERNET/],
    ["Combustível", /POSTO|COMBUST|SHELL|IPIRANGA/],
    ["Transporte", /UBER|99APP|99\*|MOBILITY|ESTACION|METRO|ONIBUS/],
    ["Alimentação", /IFOOD|IFD\*|RESTAUR|CHURRASC|PADARIA|LANCH|PIZZA|BURGER/],
    ["Saúde", /ACADEMIA|FARMAC|DROGA|HOSPITAL|CLINICA|MEDIC/],
    ["Educação", /ESCOLA|CURSO|FACUL|LIVRARIA/],
    ["Compras", /AMAZON|MERCADOLIVRE|SHOPEE|MAGALU|LOJAS/],
    ["Lazer", /CINEMA|TEATRO|INGRESSO/],
  ];
  return rules.find(([, re]) => re.test(s))?.[0] ?? "Outros";
}
export type StatementRow = {
  key: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  kind: "purchase" | "fee" | "credit" | "payment";
  card: string;
  installment?: number;
  installments?: number;
};
export type Statement = {
  dueDate: string;
  month: string;
  total?: number;
  rows: StatementRow[];
  warnings: string[];
};
const months: Record<string, string> = {
  jan: "01",
  fev: "02",
  mar: "03",
  abr: "04",
  mai: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  set: "09",
  out: "10",
  nov: "11",
  dez: "12",
};
const cents = (s: string) =>
  Number(s.replace(/\./g, "").replace(",", ".")) * 100;
const validDate = (s: string) => {
  const d = new Date(s + "T12:00:00Z");
  return !isNaN(+d) && d.toISOString().slice(0, 10) === s;
};

// O leitor recebe apenas texto; nenhum conteúdo do documento é executado.
export function parseStatement(pages: string[]): Statement {
  const text = pages.join("\n"),
    warnings: string[] = [];
  const due = text.match(
    /(?:Data de Vencimento[\s\S]{0,100}?|\*{4}\d{4}\s+)(\d{2})\/(\d{2})\/(\d{4})/i,
  );
  if (!due)
    throw Error(
      "Não foi possível identificar o vencimento. Use uma fatura PDF do Inter com texto selecionável.",
    );
  const dueDate = `${due[3]}-${due[2]}-${due[1]}`;
  if (!validDate(dueDate)) throw Error("Vencimento inválido no arquivo.");
  // O resumo tem duas colunas: o limite pode aparecer logo após o título do total.
  const totalMatch =
    text.match(/\*{4}\d{4}\s+\d{2}\/\d{2}\/\d{4}\s+R\$\s*([\d.]+,\d{2})/i) ??
    text.match(/Fatura atual[^\S\n\r]+R\$\s*([\d.]+,\d{2})/i);
  const rows: StatementRow[] = [],
    occurrences = new Map<string, number>();
  for (const page of pages) {
    if (!/Despesas da fatura/i.test(page)) continue;
    let card = "",
      active = false;
    for (const raw of page.split("\n")) {
      const line = raw.trim();
      const cardMatch = line.match(/CART[AÃ]O\s+(\d{4}\*{4}\d{4})/i);
      if (cardMatch) {
        card = cardMatch[1];
        active = true;
        continue;
      }
      if (!active) continue;
      if (/^Total CART/i.test(line)) {
        active = false;
        continue;
      }
      const m = line.match(
        /^(\d{2}) de ([a-zç]+)\.? (\d{4})\s+(.+?)\s+(\+\s*)?R\$\s*([\d.]+,\d{2})\s*$/i,
      );
      if (!m) {
        if (/^\d{2} de /i.test(line))
          warnings.push("Linha não reconhecida: " + line);
        continue;
      }
      const date = `${m[3]}-${months[normalize(m[2]).toLowerCase()]}-${m[1]}`;
      if (!validDate(date)) {
        warnings.push("Data inválida: " + line);
        continue;
      }
      const description = m[4].replace(/\s+-\s*$/, "").trim();
      const s = normalize(description);
      const kind = /P\s*AGAMENTO/.test(s)
        ? "payment"
        : m[5] || /ESTORNO|CREDITO DE AJUSTE/.test(s)
          ? "credit"
          : /\b(IOF|JUROS|ENCARGO|ANUIDADE|MULTA)\b/.test(s)
            ? "fee"
            : "purchase";
      const amount = Math.round(cents(m[6]));
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        warnings.push("Valor inválido: " + line);
        continue;
      }
      const parcel = description.match(/Parcela\s+(\d+)\s+de\s+(\d+)/i);
      const base = `${dueDate.slice(0, 7)}|${card}|${date}|${normalize(description)}|${amount}|${kind}`;
      const count = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, count);
      rows.push({
        key: `${base}|${count}`,
        date,
        description,
        amount,
        kind,
        card,
        category:
          kind === "credit" ? "Estornos e créditos" : categorize(description),
        ...(parcel
          ? { installment: Number(parcel[1]), installments: Number(parcel[2]) }
          : {}),
      });
    }
  }
  if (!rows.length)
    throw Error(
      "Nenhum lançamento reconhecido. Este leitor aceita o modelo de fatura do Inter com texto selecionável; PDFs escaneados precisam de OCR.",
    );
  if (rows.some((r) => r.category === "Outros"))
    warnings.push(
      "Alguns estabelecimentos não têm categoria conhecida. Revise os itens marcados como Outros.",
    );
  warnings.push(
    "Parcelas usam a data original exibida na fatura. Apenas as parcelas desta fatura são importadas; a previsão da próxima fatura não é adicionada.",
  );
  return {
    dueDate,
    month: dueDate.slice(0, 7),
    total: totalMatch ? Math.round(cents(totalMatch[1])) : undefined,
    rows,
    warnings,
  };
}
export function importedEntries(
  statement: Statement,
  rows: StatementRow[],
  account: string,
  basis: "purchase" | "statement",
  existing: Entry[],
  id: () => string,
): Entry[] {
  const keys = new Set(existing.map((e) => e.statement?.key));
  return rows
    .filter((r) => r.kind !== "payment" && !keys.has(r.key))
    .map((r) => ({
      id: id(),
      description: r.description.slice(0, 100),
      amount: r.amount,
      type: r.kind === "credit" ? "income" : "expense",
      date: basis === "purchase" ? r.date : statement.dueDate,
      account,
      category: r.category,
      status: "pending",
      statement: {
        key: r.key,
        month: statement.month,
        purchaseDate: r.date,
        dueDate: statement.dueDate,
        card: r.card,
        kind: r.kind as "purchase" | "fee" | "credit",
        installment: r.installment,
        installments: r.installments,
      },
    }));
}
