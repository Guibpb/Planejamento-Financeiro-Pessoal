import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
type User = { id: string; username: string };
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [mode, setMode] = useState<"login" | "register">("login"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) return;
        if (!r.ok) throw Error();
        const data = await r.json();
        setUser(data.user);
      })
      .catch(() =>
        setError(
          "Não foi possível conectar ao aplicativo. Verifique se ele está aberto no computador.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/" + mode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setUser(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/logout", { method: "POST" });
      if (!r.ok) throw Error();
      setUser(null);
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  if (user)
    return (
      <>
        <Dashboard name={user.username} onLogout={() => void logout()} />
        {error && (
          <div className="global-error" role="alert">
            {error}
          </div>
        )}
      </>
    );
  return (
    <main className="auth-page">
      <section className="panel">
        <div className="brand auth-brand">
          ◒ clareza<span>FINANÇAS PESSOAIS</span>
        </div>
        <h1>Seu dinheiro, com direção.</h1>
        <p>
          Seu planejamento fica salvo neste computador. Acesse com seu usuário
          local.
        </p>
        {loading ? (
          <p role="status">Conectando…</p>
        ) : (
          <>
            <div className="auth-tabs">
              <button
                className={mode === "login" ? "" : "quiet"}
                disabled={busy}
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Entrar
              </button>
              <button
                className={mode === "register" ? "" : "quiet"}
                disabled={busy}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Criar conta local
              </button>
            </div>
            <form onSubmit={submit}>
              <label>
                Usuário
                <input
                  name="username"
                  autoComplete="username"
                  pattern="[a-zA-Z0-9_.-]{3,40}"
                  minLength={3}
                  maxLength={40}
                  required
                  placeholder="Ex.: meu.usuario"
                  title="3 a 40 letras, números, pontos, traços ou sublinhados"
                />
              </label>
              <label>
                Senha
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={8}
                  maxLength={128}
                  required
                />
              </label>
              {mode === "register" && (
                <p>
                  Use pelo menos 8 caracteres. Cada conta tem seu próprio
                  planejamento.
                </p>
              )}
              {error && (
                <div className="error" role="alert">
                  {error}
                </div>
              )}
              <button className="full" disabled={busy}>
                {busy
                  ? "Aguarde…"
                  : mode === "login"
                    ? "Entrar"
                    : "Criar minha conta"}
              </button>
            </form>
            <small className="auth-note">
              Sem cadastro externo. Sem envio de dados para a nuvem.
            </small>
          </>
        )}
      </section>
    </main>
  );
}
