import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { readFile, stat } from "node:fs/promises";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { emptyPlan, planSchema } from "../shared/finance.ts";

const derive = promisify(scrypt);
const credentials = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_.-]{3,40}$/)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(128),
});
const writePlan = z.object({
  plan: planSchema,
  version: z.number().int().safe().nonnegative(),
});
const sessionAge = 7 * 24 * 60 * 60;
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
};
type PublicUser = { id: string; username: string };
const digest = (v: string) => createHash("sha256").update(v).digest("hex");

export function createApp(options: { databasePath: string; distPath: string }) {
  mkdirSync(path.dirname(options.databasePath), { recursive: true });
  const db = new DatabaseSync(options.databasePath);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  const schemaVersion = (
    db.prepare("PRAGMA user_version").get() as { user_version: number }
  ).user_version;
  if (schemaVersion > 1) {
    db.close();
    throw Error("Este banco pertence a uma versão mais nova do Clareza.");
  }
  if (schemaVersion === 0)
    db.exec(`BEGIN;
 CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,salt TEXT NOT NULL);
 CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
 CREATE INDEX sessions_expiry ON sessions(expires_at);
 CREATE TABLE plans(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
 PRAGMA user_version=1;
 COMMIT;`);
  const failures = new Map<string, { count: number; until: number }>();
  function rateKey(req: IncomingMessage) {
    return req.socket.remoteAddress ?? "local";
  }
  function checkRate(req: IncomingMessage) {
    const now = Date.now();
    for (const [key, item] of failures)
      if (item.until < now) failures.delete(key);
    const f = failures.get(rateKey(req));
    if (f && f.count >= 15)
      throw new HttpError(
        429,
        "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.",
      );
  }
  function fail(req: IncomingMessage) {
    const key = rateKey(req),
      old = failures.get(key);
    if (failures.size > 10000) failures.delete(failures.keys().next().value!);
    failures.set(key, {
      count: (old?.count ?? 0) + 1,
      until: old?.until ?? Date.now() + 15 * 60 * 1000,
    });
  }
  function token(req: IncomingMessage) {
    return /(?:^|;\s*)clareza_session=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie ?? "",
    )?.[1];
  }
  function user(req: IncomingMessage): PublicUser | null {
    const t = token(req);
    if (!t) return null;
    return (
      (db
        .prepare(
          "SELECT users.id,users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires_at>?",
        )
        .get(digest(t), Date.now()) as PublicUser | undefined) ?? null
    );
  }
  function session(res: ServerResponse, id: string) {
    db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(Date.now());
    const value = randomBytes(32).toString("hex");
    db.prepare(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
    ).run(digest(value), id, Date.now() + sessionAge * 1000);
    res.setHeader(
      "Set-Cookie",
      `clareza_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionAge}`,
    );
  }
  function json(res: ServerResponse, status: number, data: unknown) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  }
  async function body(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 2_000_000)
        throw new HttpError(413, "O arquivo deve ter até 2 MB.");
      chunks.push(Buffer.from(chunk));
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new HttpError(400, "Dados inválidos.");
    }
  }
  const server = createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    try {
      const host = req.headers.host;
      // Apenas nomes locais e IPs privados: limita ataques de DNS rebinding.
      if (!host) throw new HttpError(400, "Endereço inválido.");
      const hostname = new URL("http://" + host).hostname;
      if (
        !/^(localhost|127\.0\.0\.1|\[::1\]|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(
          hostname,
        )
      )
        throw new HttpError(
          403,
          "Use localhost ou o IP privado do computador.",
        );
      const url = new URL(req.url ?? "/", "http://" + host),
        route = url.pathname,
        method = req.method ?? "GET";
      if (!["GET", "HEAD"].includes(method)) {
        if (req.headers.origin !== url.origin)
          throw new HttpError(
            403,
            "Origem inválida. Abra o aplicativo pelo endereço exibido no computador.",
          );
        if (req.headers["sec-fetch-site"] === "cross-site")
          throw new HttpError(403, "Origem inválida.");
        if (method !== "POST" && method !== "PUT")
          throw new HttpError(405, "Método não permitido.");
      }
      if (route === "/api/auth/register" || route === "/api/auth/login") {
        if (method !== "POST")
          throw new HttpError(405, "Método não permitido.");
        checkRate(req);
        const parsed = credentials.safeParse(await body(req));
        if (!parsed.success) {
          fail(req);
          throw new HttpError(
            400,
            "Use um usuário de 3 a 40 caracteres e senha de 8 a 128 caracteres.",
          );
        }
        const { username, password } = parsed.data;
        let row = db
          .prepare("SELECT * FROM users WHERE username=?")
          .get(username) as UserRow | undefined;
        if (route.endsWith("/register")) {
          if (row) {
            fail(req);
            throw new HttpError(409, "Este usuário já existe.");
          }
          const salt = randomBytes(16).toString("hex"),
            hash = (await derive(password, salt, 64)) as Buffer;
          row = {
            id: randomUUID(),
            username,
            password_hash: hash.toString("hex"),
            salt,
          };
          try {
            db.prepare(
              "INSERT INTO users(id,username,password_hash,salt) VALUES(?,?,?,?)",
            ).run(row.id, row.username, row.password_hash, row.salt);
          } catch {
            throw new HttpError(409, "Este usuário já existe.");
          }
        } else {
          const hash = (await derive(
            password,
            row?.salt ?? "0".repeat(32),
            64,
          )) as Buffer;
          if (
            !row ||
            !timingSafeEqual(hash, Buffer.from(row.password_hash, "hex"))
          ) {
            fail(req);
            throw new HttpError(401, "Usuário ou senha incorretos.");
          }
        }
        failures.delete(rateKey(req));
        session(res, row.id);
        json(res, route.endsWith("/register") ? 201 : 200, {
          user: { id: row.id, username: row.username },
        });
        return;
      }
      if (route === "/api/auth/me" && method === "GET") {
        const current = user(req);
        if (!current) throw new HttpError(401, "Entre para continuar.");
        json(res, 200, { user: current });
        return;
      }
      if (route === "/api/auth/logout" && method === "POST") {
        const t = token(req);
        if (t)
          db.prepare("DELETE FROM sessions WHERE token_hash=?").run(digest(t));
        res.setHeader(
          "Set-Cookie",
          "clareza_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        json(res, 200, { ok: true });
        return;
      }
      if (route === "/api/plan") {
        const current = user(req);
        if (!current)
          throw new HttpError(
            401,
            "Sua sessão expirou. Saia e entre novamente.",
          );
        if (method === "GET") {
          const row = db
            .prepare("SELECT data,version FROM plans WHERE user_id=?")
            .get(current.id) as { data: string; version: number } | undefined;
          json(res, 200, {
            plan: row ? JSON.parse(row.data) : emptyPlan,
            version: row?.version ?? 0,
          });
          return;
        }
        if (method === "PUT") {
          const parsed = writePlan.safeParse(await body(req));
          if (!parsed.success)
            throw new HttpError(
              400,
              "Confira os valores, datas e contas informados.",
            );
          const { plan, version } = parsed.data,
            data = JSON.stringify(plan),
            now = new Date().toISOString();
          const result =
            version === 0
              ? db
                  .prepare(
                    "INSERT INTO plans(user_id,data,version,updated_at) VALUES(?,?,1,?) ON CONFLICT(user_id) DO NOTHING",
                  )
                  .run(current.id, data, now)
              : db
                  .prepare(
                    "UPDATE plans SET data=?,version=version+1,updated_at=? WHERE user_id=? AND version=?",
                  )
                  .run(data, now, current.id, version);
          if (Number(result.changes) !== 1)
            throw new HttpError(
              409,
              "Há uma versão mais recente em outro dispositivo. Recarregue a página antes de continuar.",
            );
          json(res, 200, { version: version + 1 });
          return;
        }
        throw new HttpError(405, "Método não permitido.");
      }
      if (route.startsWith("/api/"))
        throw new HttpError(404, "Operação não encontrada.");
      if (method !== "GET" && method !== "HEAD")
        throw new HttpError(405, "Método não permitido.");
      const root = path.resolve(options.distPath),
        file = path.resolve(
          root,
          "." + decodeURIComponent(route === "/" ? "/index.html" : route),
        );
      if (!file.startsWith(root + path.sep))
        throw new HttpError(404, "Página não encontrada.");
      let info;
      try {
        info = await stat(file);
      } catch {
        throw new HttpError(
          404,
          "Arquivo não encontrado. Execute npm run build para preparar o aplicativo.",
        );
      }
      if (!info.isFile()) throw new HttpError(404, "Página não encontrada.");
      const mime: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ico": "image/x-icon",
      };
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
        "Cache-Control": route.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-store",
      });
      res.end(method === "HEAD" ? undefined : await readFile(file));
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (error instanceof HttpError)
        json(res, error.status, { error: error.message });
      else {
        console.error("Falha interna ao processar uma operação.");
        json(res, 500, {
          error: "Não foi possível concluir. Tente novamente.",
        });
      }
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.on("close", () => db.close());
  return server;
}
