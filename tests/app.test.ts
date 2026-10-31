import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/app.ts";
import { planSchema, totals } from "../shared/finance.ts";

const plan = {
  accounts: [{ id: "a", name: "Principal", opening: { "2026-10": 10000 } }],
  entries: [
    {
      id: "1",
      description: "Receita",
      type: "income" as const,
      amount: 5000,
      date: "2026-10-01",
      account: "a",
      category: "Trabalho",
      status: "done" as const,
    },
    {
      id: "2",
      description: "Conta",
      type: "expense" as const,
      amount: 2000,
      date: "2026-10-31",
      account: "a",
      category: "Moradia",
      status: "pending" as const,
    },
  ],
};
test("saldo previsto, realizado e isolamento entre meses", () => {
  assert.equal(totals(plan, "2026-10").balance, 15000);
  assert.equal(totals(plan, "2026-10").forecast, 13000);
  assert.equal(totals(plan, "2026-11").forecast, 0);
  for (const change of [
    { amount: 1.5 },
    { amount: -10 },
    { date: "2026-02-30" },
    { account: "inexistente" },
  ])
    assert.equal(
      planSchema.safeParse({
        ...plan,
        entries: [{ ...plan.entries[0], ...change }],
      }).success,
      false,
    );
  assert.equal(
    planSchema.safeParse({
      ...plan,
      accounts: [...plan.accounts, ...plan.accounts],
    }).success,
    false,
  );
});
test("login, dados por usuário, persistência, conflito, validação e logout", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "clareza-test-"));
  const databasePath = path.join(dir, "test.sqlite");
  let server = createApp({ databasePath, distPath: path.resolve("dist") });
  let base = "";
  async function start() {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    base = "http://127.0.0.1:" + address.port;
  }
  async function close() {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
  async function request(
    route: string,
    method = "GET",
    data?: unknown,
    cookie = "",
  ) {
    return fetch(base + route, {
      method,
      headers: {
        Origin: base,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  }
  const credentials = { username: "alice", password: "senha-teste-segura" };
  try {
    await start();
    assert.equal((await request("/api/plan")).status, 401);
    assert.equal((await request("/")).status, 200);
    assert.equal(
      (
        await request("/api/auth/register", "POST", {
          username: "x",
          password: "123",
        })
      ).status,
      400,
    );
    const registered = await request("/api/auth/register", "POST", credentials);
    assert.equal(registered.status, 201);
    const cookie = registered.headers.get("set-cookie")!.split(";")[0];
    assert.match(registered.headers.get("set-cookie")!, /HttpOnly/);
    assert.equal(
      (await request("/api/auth/register", "POST", credentials)).status,
      409,
    );
    assert.equal(
      (
        await request("/api/auth/login", "POST", {
          ...credentials,
          password: "senha-errada",
        })
      ).status,
      401,
    );
    const initial = await (
      await request("/api/plan", "GET", undefined, cookie)
    ).json();
    assert.equal(initial.version, 0);
    assert.equal(
      (await request("/api/plan", "PUT", { plan, version: 0 }, cookie)).status,
      200,
    );
    assert.equal(
      (await request("/api/plan", "PUT", { plan, version: 0 }, cookie)).status,
      409,
    );
    assert.equal(
      (
        await request(
          "/api/plan",
          "PUT",
          {
            plan: {
              ...plan,
              entries: [{ ...plan.entries[0], account: "other" }],
            },
            version: 1,
          },
          cookie,
        )
      ).status,
      400,
    );
    assert.equal((await request("/api/plan", "PUT", null, cookie)).status, 400);
    const cross = await fetch(base + "/api/plan", {
      method: "PUT",
      headers: {
        Origin: "https://outra.example",
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    assert.equal(cross.status, 403);
    const bob = await request("/api/auth/register", "POST", {
      username: "bob",
      password: "outra-senha-segura",
    });
    assert.equal(bob.status, 201);
    const bobCookie = bob.headers.get("set-cookie")!.split(";")[0];
    const bobPlan = await (
      await request("/api/plan", "GET", undefined, bobCookie)
    ).json();
    assert.equal(bobPlan.plan.accounts.length, 0);
    assert.equal(
      (await request("/api/auth/logout", "POST", undefined, bobCookie)).status,
      200,
    );
    assert.equal(
      (await request("/api/plan", "GET", undefined, bobCookie)).status,
      401,
    );
    await close();
    server = createApp({ databasePath, distPath: path.resolve("dist") });
    await start();
    const saved = await (
      await request("/api/plan", "GET", undefined, cookie)
    ).json();
    assert.equal(saved.version, 1);
    assert.deepEqual(saved.plan, plan);
    const login = await request("/api/auth/login", "POST", credentials);
    assert.equal(login.status, 200);
    const session = login.headers.get("set-cookie")!.split(";")[0];
    assert.equal(
      (await request("/api/auth/me", "GET", undefined, session)).status,
      200,
    );
    const db = new DatabaseSync(databasePath);
    const user = db
      .prepare("SELECT * FROM users WHERE username=?")
      .get("alice");
    assert.notEqual(user?.password_hash, credentials.password);
    const tokens = db.prepare("SELECT token_hash FROM sessions").all();
    assert.ok(tokens.every((t) => t.token_hash !== session.split("=")[1]));
    db.close();
    assert.equal(
      (await request("/api/auth/logout", "POST", undefined, session)).status,
      200,
    );
    assert.equal(
      (await request("/api/auth/me", "GET", undefined, session)).status,
      401,
    );
  } finally {
    if (server.listening) await close();
    const resolved = path.resolve(dir);
    assert.equal(path.dirname(resolved), path.resolve(tmpdir()));
    assert.ok(path.basename(resolved).startsWith("clareza-test-"));
    rmSync(resolved, { recursive: true, force: true });
  }
});
test("o frontend compilado não depende de serviços externos", () => {
  const html = readFileSync("dist/index.html", "utf8");
  assert.ok(html.includes("/assets/"));
  assert.ok(!html.includes("chatgpt"));
  assert.ok(!html.includes("cloudflare"));
});
