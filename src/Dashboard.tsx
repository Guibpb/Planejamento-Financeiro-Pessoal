import { newId } from "./id";
import StatementImport from "./StatementImport";
import { useEffect, useRef, useState } from "react";
import {
  emptyPlan,
  money,
  planSchema,
  totals,
  type Plan,
  type Entry,
} from "../shared/finance";
export default function Dashboard({
  name,
  onLogout,
}: {
  name: string;
  onLogout: () => void;
}) {
  const [plan, setPlan] = useState<Plan>(emptyPlan),
    [version, setVersion] = useState(0),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Carregando dados…"),
    [month, setMonth] = useState(""),
    [filter, setFilter] = useState("all"),
    [local, setLocal] = useState(false);
  const entryDialog = useRef<HTMLDialogElement>(null),
    accountDialog = useRef<HTMLDialogElement>(null),
    lock = useRef(false);
  useEffect(() => {
    setMonth(new Date().toLocaleDateString("sv-SE").slice(0, 7));
    try {
      setLocal(!!localStorage.getItem("clareza-v1"));
    } catch {}
    fetch("/api/plan", { cache: "no-store" })
      .then(async (r) => {
        const d = (await r.json()) as {
          error?: string;
          plan: unknown;
          version: number;
        };
        if (!r.ok) throw Error(d.error);
        setPlan(planSchema.parse(d.plan));
        setVersion(d.version);
        setLoaded(true);
        setStatus("Dados sincronizados");
      })
      .catch(() => {
        setError(
          "Não foi possível carregar seus dados. Recarregue a página para tentar novamente.",
        );
        setStatus("Sem conexão com o banco");
      });
  }, []);
  async function persist(next: Plan) {
    if (lock.current || !loaded) return false;
    const parsed = planSchema.safeParse(next);
    if (!parsed.success) {
      setError("Confira os valores, datas e contas informados.");
      return false;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setStatus("Salvando…");
    try {
      const r = await fetch("/api/plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: parsed.data, version }),
        }),
        d = (await r.json()) as { error?: string; version: number };
      if (!r.ok) throw Error(d.error);
      setPlan(parsed.data);
      setVersion(d.version);
      setStatus("Dados sincronizados");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      setStatus("Alteração não salva");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const t = totals(plan, month),
    categories: Record<string, number> = {};
  t.entries
    .filter((e) => e.type === "expense")
    .forEach(
      (e) =>
        (categories[e.category] = (categories[e.category] || 0) + e.amount),
    );
  async function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      f = new FormData(form);
    const entry: Entry = {
      id: newId(),
      description: String(f.get("description")),
      amount: Math.round(Number(f.get("amount")) * 100),
      type: f.get("type") as Entry["type"],
      date: String(f.get("date")),
      account: String(f.get("account")),
      category: String(f.get("category")),
      status: f.get("status") as Entry["status"],
    };
    if (await persist({ ...plan, entries: [...plan.entries, entry] })) {
      entryDialog.current?.close();
      form.reset();
    }
  }
  async function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      f = new FormData(form),
      id = String(f.get("id") || "");
    const account = {
      id: id || newId(),
      name: String(f.get("name")),
      opening: {
        ...(plan.accounts.find((a) => a.id === id)?.opening ?? {}),
        [month]: Math.round(Number(f.get("balance")) * 100),
      },
    };
    if (
      await persist({
        ...plan,
        accounts: id
          ? plan.accounts.map((a) => (a.id === id ? account : a))
          : [...plan.accounts, account],
      })
    ) {
      accountDialog.current?.close();
      form.reset();
    }
  }
  function openAccount(id = "") {
    const form = accountDialog.current?.querySelector("form");
    if (!form) return;
    form.reset();
    const a = plan.accounts.find((a) => a.id === id);
    (form.elements.namedItem("id") as HTMLInputElement).value = id;
    (form.elements.namedItem("name") as HTMLInputElement).value = a?.name ?? "";
    (form.elements.namedItem("balance") as HTMLInputElement).value = String(
      (a?.opening[month] ?? 0) / 100,
    );
    accountDialog.current?.showModal();
  }
  function download() {
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "clareza-dados.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importData(value: unknown) {
    if (plan.accounts.length || plan.entries.length) {
      setError(
        "Para evitar substituir seu planejamento, a importação está disponível apenas em uma conta sem dados.",
      );
      return;
    }
    const parsed = planSchema.safeParse(value);
    if (!parsed.success) {
      setError("Arquivo inválido. Use uma exportação do Clareza.");
      return;
    }
    if (
      confirm("Importar estas contas e lançamentos para sua conta conectada?")
    ) {
      if (await persist(parsed.data)) setLocal(false);
    }
  }
  return (
    <>
      <aside>
        <a className="brand" href="/">
          ◒ clareza<span>FINANÇAS PESSOAIS</span>
        </a>
        <div className="nav active">◫ &nbsp; Meu planejamento</div>
        <p className="aside-note">
          Um pouco de organização.
          <br />
          Mais espaço para seus planos.
        </p>
        <small>{name}</small>
        <button className="signout" onClick={onLogout}>
          Sair da conta ↗
        </button>
      </aside>
      <main>
        <header>
          <span>SEU DINHEIRO, COM DIREÇÃO</span>
          <button className="quiet mobile-logout" onClick={onLogout}>
            Sair
          </button>
          <button className="quiet" disabled={!loaded} onClick={download}>
            ↓ Exportar dados
          </button>
        </header>
        <section className="heading">
          <div>
            <h1>Seu mês, com clareza.</h1>
            <p>Seu planejamento, salvo na sua conta.</p>
          </div>
          <button
            disabled={!loaded || busy}
            onClick={() =>
              plan.accounts.length
                ? entryDialog.current?.showModal()
                : openAccount()
            }
          >
            + Novo lançamento
          </button>
        </section>
        <div className="toolbar">
          <label>
            Mês do planejamento{" "}
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              required
            />
          </label>
          <span role="status">{status}</span>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {local && loaded && !plan.accounts.length && (
          <div className="notice">
            Encontramos dados da versão anterior neste navegador.{" "}
            <button
              className="quiet"
              disabled={busy}
              onClick={() => {
                try {
                  const data = JSON.parse(
                    localStorage.getItem("clareza-v1") || "null",
                  );
                  if (data?.demo) {
                    setError(
                      "Os dados locais são exemplos. Cadastre suas próprias contas para começar.",
                    );
                    setLocal(false);
                    return;
                  }
                  void importData(data);
                } catch {
                  setError("Não foi possível ler os dados locais.");
                }
              }}
            >
              Importar para minha conta →
            </button>
          </div>
        )}
        <fieldset disabled={!loaded || busy} className="workspace">
          <StatementImport plan={plan} busy={busy} persist={persist} />
          <section className="cards">
            {[
              [
                "Saldo realizado no mês",
                t.balance,
                "Inclui apenas movimentações realizadas",
              ],
              ["Entradas do mês", t.income, "Receitas realizadas e previstas"],
              ["Saídas do mês", t.expense, "Despesas realizadas e previstas"],
              [
                "Saldo previsto ao fim do mês",
                t.forecast,
                "Inclui os compromissos pendentes",
              ],
            ].map(([label, value, sub], i) => (
              <article key={String(label)} className={i === 3 ? "accent" : ""}>
                <span>{label}</span>
                <strong>{loaded ? money(Number(value)) : "—"}</strong>
                <small>{sub}</small>
              </article>
            ))}
          </section>
          <section className="grid">
            <article className="panel">
              <div className="panel-title">
                <div>
                  <h2>Movimentações</h2>
                  <p>O que entrou, saiu e ainda está por vir.</p>
                </div>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  aria-label="Filtrar movimentações"
                >
                  <option value="all">Todas</option>
                  <option value="pending">Pendentes</option>
                  <option value="done">Realizadas</option>
                </select>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Descrição / conta</th>
                      <th>Data</th>
                      <th>Valor</th>
                      <th>Situação</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {t.entries
                      .filter((e) => filter === "all" || e.status === filter)
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((e) => (
                        <tr key={e.id}>
                          <td>
                            {e.description}
                            <small>
                              {e.category} ·{" "}
                              {
                                plan.accounts.find((a) => a.id === e.account)
                                  ?.name
                              }
                            </small>
                            {e.statement && (
                              <small>
                                Cartão {e.statement.card} · Fatura{" "}
                                {e.statement.month}
                                {" · Compra: "}
                                {e.statement.purchaseDate
                                  .split("-")
                                  .reverse()
                                  .join("/")}
                                {e.statement.installment &&
                                  ` · Parcela ${e.statement.installment}/${e.statement.installments}`}
                              </small>
                            )}
                          </td>
                          <td>
                            {e.date.slice(8)}/{e.date.slice(5, 7)}
                          </td>
                          <td className={e.type === "income" ? "positive" : ""}>
                            {e.type === "income" ? "+" : "−"} {money(e.amount)}
                          </td>
                          <td>
                            <button
                              className={"badge " + e.status}
                              title="Alterar situação"
                              onClick={() =>
                                void persist({
                                  ...plan,
                                  entries: plan.entries.map((x) =>
                                    x.id === e.id
                                      ? {
                                          ...x,
                                          status:
                                            x.status === "done"
                                              ? "pending"
                                              : "done",
                                        }
                                      : x,
                                  ),
                                })
                              }
                            >
                              {e.status === "done" ? "Realizado" : "Previsto"}
                            </button>
                          </td>
                          <td>
                            <button
                              className="quiet delete"
                              aria-label={"Excluir " + e.description}
                              onClick={() => {
                                if (confirm("Excluir este lançamento?"))
                                  void persist({
                                    ...plan,
                                    entries: plan.entries.filter(
                                      (x) => x.id !== e.id,
                                    ),
                                  });
                              }}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!t.entries.filter((e) => filter === "all" || e.status === filter)
                .length && (
                <p>
                  Nenhum lançamento por aqui. Adicione uma conta e registre sua
                  próxima receita ou despesa.
                </p>
              )}
            </article>
            <div>
              <article className="panel">
                <div className="panel-title">
                  <div>
                    <h2>Suas contas</h2>
                    <p>Defina o saldo no início de cada mês.</p>
                  </div>
                  <button className="quiet" onClick={() => openAccount()}>
                    + Adicionar
                  </button>
                </div>
                {plan.accounts.map((a) => (
                  <div className="account" key={a.id}>
                    <div>
                      {a.name}
                      <small>
                        {a.opening[month] === undefined
                          ? "Informe o saldo inicial deste mês"
                          : "Inicial: " + money(a.opening[month])}
                      </small>
                      <button
                        className="quiet"
                        onClick={() => openAccount(a.id)}
                      >
                        Editar saldo inicial
                      </button>
                    </div>
                    <strong>
                      {money(
                        (a.opening[month] ?? 0) +
                          t.entries
                            .filter(
                              (e) => e.account === a.id && e.status === "done",
                            )
                            .reduce(
                              (s, e) =>
                                s +
                                (e.type === "income" ? e.amount : -e.amount),
                              0,
                            ),
                      )}
                    </strong>
                  </div>
                ))}
                {!plan.accounts.length && (
                  <p>Adicione sua primeira conta para começar.</p>
                )}
              </article>
              <article className="panel">
                <h2>Para onde vai o dinheiro</h2>
                <p>Despesas previstas e realizadas do mês.</p>
                {Object.entries(categories)
                  .sort((a, b) => b[1] - a[1])
                  .map(([c, v]) => (
                    <div className="category" key={c}>
                      <div>
                        <span>{c}</span>
                        <span>{money(v)}</span>
                      </div>
                      <div className="track">
                        <div
                          className="bar"
                          style={{ width: `${(v / t.expense) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                {!t.expense && (
                  <p>Suas categorias aparecerão ao registrar despesas.</p>
                )}
              </article>
            </div>
          </section>
          <label className="import-label">
            Importar backup do Clareza{" "}
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > 2000000) {
                  setError("O arquivo deve ter até 2 MB.");
                  return;
                }
                try {
                  await importData(JSON.parse(await file.text()));
                } catch {
                  setError("Não foi possível importar este arquivo.");
                }
              }}
            />
          </label>
        </fieldset>
        <footer>
          Conta local · dados salvos no computador após cada alteração.
          <br />O saldo inicial é informado por mês; não há transferência
          automática de saldo entre meses.
        </footer>
      </main>
      <dialog ref={entryDialog}>
        <form onSubmit={submitEntry}>
          <div className="panel-title">
            <h2>Novo lançamento</h2>
            <button
              type="button"
              className="quiet"
              disabled={busy}
              onClick={() => entryDialog.current?.close()}
            >
              ✕
            </button>
          </div>
          <label>
            Descrição
            <input name="description" required maxLength={100} />
          </label>
          <div className="form-grid">
            <label>
              Tipo
              <select name="type">
                <option value="expense">Despesa</option>
                <option value="income">Receita</option>
              </select>
            </label>
            <label>
              Valor (R$)
              <input
                name="amount"
                type="number"
                min="0.01"
                max="999999999"
                step="0.01"
                required
              />
            </label>
            <label>
              Data
              <input
                key={month}
                name="date"
                type="date"
                defaultValue={month + "-01"}
                required
              />
            </label>
            <label>
              Conta
              <select name="account" required>
                {plan.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoria
              <select name="category">
                {[
                  "Alimentação",
                  "Moradia",
                  "Transporte",
                  "Lazer",
                  "Saúde",
                  "Trabalho",
                  "Outros",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Situação
              <select name="status">
                <option value="pending">Previsto</option>
                <option value="done">Realizado</option>
              </select>
            </label>
          </div>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button disabled={busy} className="full">
            {busy ? "Salvando…" : "Salvar lançamento"}
          </button>
        </form>
      </dialog>
      <dialog ref={accountDialog}>
        <form onSubmit={submitAccount}>
          <div className="panel-title">
            <h2>Conta e saldo inicial</h2>
            <button
              type="button"
              className="quiet"
              disabled={busy}
              onClick={() => accountDialog.current?.close()}
            >
              ✕
            </button>
          </div>
          <input type="hidden" name="id" />
          <label>
            Nome da conta
            <input name="name" required maxLength={50} />
          </label>
          <label>
            Saldo inicial em {month} (R$)
            <input
              name="balance"
              type="number"
              step="0.01"
              min="-999999999"
              max="999999999"
              required
              defaultValue="0"
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="full" disabled={busy}>
            {busy ? "Salvando…" : "Salvar conta"}
          </button>
        </form>
      </dialog>
    </>
  );
}
