import path from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { createApp } from "./app.ts";
const root = fileURLToPath(new URL("../", import.meta.url));
const lan = process.argv.includes("--lan");
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("PORT deve ser uma porta entre 1 e 65535.");
const databasePath = process.env.CLAREZA_DATA_DIR
  ? path.resolve(process.env.CLAREZA_DATA_DIR, "clareza.sqlite")
  : path.join(root, "data", "clareza.sqlite");
const server = createApp({ databasePath, distPath: path.join(root, "dist") });
server.on("error", (error) => {
  console.error(
    "Não foi possível iniciar. Verifique se outro Clareza está usando a porta " +
      port +
      ".",
    error.message,
  );
  process.exitCode = 1;
});
server.listen(port, lan ? "0.0.0.0" : "127.0.0.1", () => {
  console.log("\n◒ Clareza · Finanças pessoais\n");
  console.log("Computador: http://localhost:" + port);
  if (lan) {
    console.log("\nCelular na mesma rede Wi-Fi:");
    for (const list of Object.values(networkInterfaces()))
      for (const item of list ?? [])
        if (item.family === "IPv4" && !item.internal)
          console.log("  http://" + item.address + ":" + port);
    console.log(
      "Mantenha esta janela e o computador ligados. Use apenas uma rede de confiança.",
    );
  } else console.log("Para acessar pelo celular: npm run start:lan");
  console.log("\nDados: " + databasePath + "\nPara encerrar: Ctrl+C\n");
});
function stop() {
  server.close(() => {
    process.exitCode = 0;
  });
  server.closeIdleConnections();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
