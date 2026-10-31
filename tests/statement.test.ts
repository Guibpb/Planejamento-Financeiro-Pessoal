import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categorize,
  importedEntries,
  parseStatement,
} from "../shared/statement.ts";
import { planSchema, totals } from "../shared/finance.ts";

const pages = [
  "Resumo da fatura\nLimite de crédito total\nTotal da sua fatura\nR$ 2.000,00\nR$ 120,00 Data de Vencimento\n18/01/2027",
  "5555****1234 18/01/2027 R$ 120,00\nDespesas da fatura\nCARTÃO 5555****1234\n30 de dez. 2026 CARREFOUR - R$ 100,00\n30 de dez. 2026 CARREFOUR - R$ 100,00\n14 de jan. 2026 PRIME (Parcela 12 de 12) - R$ 10,00\n01 de jan. 2027 IOF - R$ 2,00\n02 de jan. 2027 P AGAMENTO ON LINE - + R$ 80,00\n03 de jan. 2027 ESTORNO LOJA - + R$ 12,00\nPrincipal (R$ 8,00) + Juros (R$ 2,00)\nTotal CARTÃO 5555****1234 R$ 200,00",
  "Próxima fatura\nPRIME (Parcela 01 de 12) R$ 10,00",
];
test("fatura: duas colunas, virada de ano, parcelas, pagamentos, estornos e duplicatas legítimas", () => {
  const s = parseStatement(pages);
  assert.equal(s.total, 12000);
  assert.equal(s.dueDate, "2027-01-18");
  assert.equal(s.rows.length, 6);
  assert.notEqual(s.rows[0].key, s.rows[1].key);
  assert.equal(s.rows[2].installment, 12);
  assert.equal(s.rows[4].kind, "payment");
  let i = 0;
  const entries = importedEntries(s, s.rows, "a", "purchase", [], () =>
    String(++i),
  );
  assert.equal(entries.length, 5);
  assert.equal(entries[4].type, "income");
  const plan = planSchema.parse({
    accounts: [{ id: "a", name: "Cartão", opening: {} }],
    entries,
  });
  assert.equal(totals(plan, "2026-12").expense, 20000);
  assert.equal(totals(plan, "2027-01").income, 1200);
  assert.equal(
    importedEntries(s, s.rows, "a", "statement", entries, () => "x").length,
    0,
  );
  const byStatement = importedEntries(s, s.rows, "a", "statement", [], () =>
    String(++i),
  );
  assert.ok(
    byStatement.every((e) => e.date === s.dueDate && e.status === "pending"),
  );
  assert.equal(byStatement[0].statement?.purchaseDate, "2026-12-30");
  assert.deepEqual(planSchema.parse(plan), plan);
});
test("categorias e arquivos não reconhecidos", () => {
  assert.equal(categorize("DL*UberRides"), "Transporte");
  assert.equal(categorize("AUTO POSTO"), "Combustível");
  assert.equal(categorize("SPOTIFY"), "Assinaturas");
  assert.equal(categorize("Estabelecimento desconhecido"), "Outros");
  assert.throws(() => parseStatement(["imagem sem texto"]));
  assert.throws(() => parseStatement([pages[0]]));
  const s = parseStatement([
    pages[0],
    pages[1].replace("30 de dez. 2026", "31 de fev. 2026"),
  ]);
  assert.ok(s.warnings.some((w) => w.startsWith("Data inválida")));
});
