import { useState } from "react";
import { money, type Plan } from "../shared/finance";
import {
  expenseCategories,
  importedEntries,
  parseStatement,
  type Statement,
  type StatementRow,
} from "../shared/statement";
import { newId } from "./id";

export default function StatementImport({
  plan,
  busy,
  persist,
}: {
  plan: Plan;
  busy: boolean;
  persist: (p: Plan) => Promise<boolean>;
}) {
  const [statement, setStatement] = useState<Statement | null>(null),
    [selected, setSelected] = useState<Set<string>>(new Set()),
    [account, setAccount] = useState(""),
    [basis, setBasis] = useState<"purchase" | "statement">("purchase"),
    [reading, setReading] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const duplicates = new Set(plan.entries.map((e) => e.statement?.key));
  const chosen =
    statement?.rows.filter(
      (r) =>
        selected.has(r.key) && r.kind !== "payment" && !duplicates.has(r.key),
    ) ?? [];
  const groups: Record<string, number> = {};
  chosen.forEach((r) => {
    const key = `${basis === "purchase" ? r.date.slice(0, 7) : statement!.month} · ${r.category}`;
    groups[key] =
      (groups[key] ?? 0) + (r.kind === "credit" ? -r.amount : r.amount);
  });
  function update(key: string, changes: Partial<StatementRow>) {
    setStatement(
      (s) =>
        s && {
          ...s,
          rows: s.rows.map((r) => (r.key === key ? { ...r, ...changes } : r)),
        },
    );
  }
  return (
    <section className="panel statement-import">
      <h2>Importar fatura do cartão</h2>
      <p>
        PDF do Inter com texto selecionável. Leitura no seu navegador, sem
        enviar o arquivo para serviços externos.
      </p>
      <label>
        Selecionar fatura PDF
        <input
          type="file"
          accept=".pdf,application/pdf"
          disabled={reading || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setReading(true);
            setStatement(null);
            setError("");
            setMessage("");
            try {
              const { readStatement } = await import("./readStatement");
              const result = parseStatement(await readStatement(file));
              // Reaproveita categorias revisadas anteriormente pelo usuário para o mesmo estabelecimento.
              result.rows.forEach((r) => {
                const previous = plan.entries.find(
                  (e) =>
                    e.statement &&
                    e.description === r.description.slice(0, 100),
                );
                if (previous) r.category = previous.category;
              });
              setStatement(result);
              setSelected(
                new Set(
                  result.rows
                    .filter(
                      (r) => r.kind !== "payment" && !duplicates.has(r.key),
                    )
                    .map((r) => r.key),
                ),
              );
              setAccount(plan.accounts[0]?.id ?? "");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Não foi possível ler o PDF.",
              );
            } finally {
              setReading(false);
            }
          }}
        />
      </label>
      {reading && <p role="status">Lendo as páginas da fatura…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {statement && (
        <>
          <div className="notice">
            Fatura de {statement.month} · Vencimento:{" "}
            {statement.dueDate.split("-").reverse().join("/")}
            {statement.total !== undefined && (
              <> · Total a pagar: {money(statement.total)}</>
            )}
            <br />
            Gastos e encargos identificados:{" "}
            {money(
              statement.rows
                .filter((r) => r.kind === "purchase" || r.kind === "fee")
                .reduce((s, r) => s + r.amount, 0),
            )}
            . Pagamentos identificados:{" "}
            {money(
              statement.rows
                .filter((r) => r.kind === "payment")
                .reduce((s, r) => s + r.amount, 0),
            )}
            .
            <p>
              O total a pagar pode diferir das compras por antecipações e
              ajustes. Pagamentos não serão importados como receita ou despesa.
              Confira os valores com o PDF.
            </p>
          </div>
          {statement.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
          <div className="form-grid">
            <label>
              Conta para registrar os gastos
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                <option value="">Escolha uma conta</option>
                {plan.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Separar os meses por
              <select
                value={basis}
                onChange={(e) => setBasis(e.target.value as typeof basis)}
              >
                <option value="purchase">Data original da compra</option>
                <option value="statement">Mês da fatura (vencimento)</option>
              </select>
            </label>
          </div>
          {!plan.accounts.length && (
            <p>
              Adicione uma conta em “Suas contas” para concluir a importação.
            </p>
          )}
          <p>
            Os lançamentos entram como previstos. Marque como realizados quando
            fizer sentido no seu controle. Ao registrar as compras, evite lançar
            o pagamento da fatura novamente como despesa.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Importar</th>
                  <th>Compra / cartão</th>
                  <th>Data original</th>
                  <th>Categoria sugerida</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {statement.rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      {r.kind === "payment" ? (
                        "Pagamento ignorado"
                      ) : duplicates.has(r.key) ? (
                        "Já importado"
                      ) : (
                        <input
                          type="checkbox"
                          aria-label={`Importar ${r.description}`}
                          checked={selected.has(r.key)}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(r.key);
                            else next.delete(r.key);
                            setSelected(next);
                          }}
                        />
                      )}
                    </td>
                    <td>
                      {r.description}
                      <small className="statement-detail">
                        {r.card} ·{" "}
                        {r.kind === "fee"
                          ? "Encargo"
                          : r.kind === "credit"
                            ? "Crédito / estorno"
                            : r.installment
                              ? `Parcela ${r.installment}/${r.installments}`
                              : "À vista"}
                      </small>
                    </td>
                    <td>{r.date.split("-").reverse().join("/")}</td>
                    <td>
                      {r.kind !== "payment" && (
                        <select
                          aria-label={`Categoria de ${r.description}`}
                          value={r.category}
                          onChange={(e) =>
                            update(r.key, { category: e.target.value })
                          }
                        >
                          {Array.from(
                            new Set([...expenseCategories, r.category]),
                          ).map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      )}
                      {r.category === "Outros" && (
                        <small className="statement-detail">
                          Revisar categoria
                        </small>
                      )}
                    </td>
                    <td>
                      {r.kind === "credit" || r.kind === "payment" ? "+ " : ""}
                      {money(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Resumo da seleção por mês e categoria</h3>
          <div className="statement-summary">
            {Object.entries(groups)
              .sort()
              .map(([key, value]) => (
                <div key={key}>
                  <span>{key}</span>
                  <strong>{money(value)}</strong>
                </div>
              ))}
          </div>
          <p>
            {chosen.length} lançamentos selecionados · Líquido:{" "}
            {money(
              chosen.reduce(
                (s, r) => s + (r.kind === "credit" ? -r.amount : r.amount),
                0,
              ),
            )}
          </p>
          <button
            disabled={busy || !chosen.length || !account}
            onClick={async () => {
              const entries = importedEntries(
                statement,
                chosen,
                account,
                basis,
                plan.entries,
                newId,
              );
              if (
                await persist({
                  ...plan,
                  entries: [...plan.entries, ...entries],
                })
              ) {
                setStatement(null);
                setMessage(
                  `${entries.length} lançamentos importados. Selecione o mês correspondente no planejamento para consultá-los.`,
                );
              }
            }}
          >
            {busy ? "Salvando…" : "Importar seleção para o planejamento"}
          </button>{" "}
          <button
            className="quiet"
            disabled={busy}
            onClick={() => setStatement(null)}
          >
            Cancelar
          </button>
        </>
      )}
    </section>
  );
}
