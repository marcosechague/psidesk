/**
 * Dispara el endpoint de recordatorios contra el server local.
 * Uso:  pnpm reminders:run   (con el server `pnpm dev` corriendo)
 *
 * Para automatizarlo en local, agregá una línea de cron del sistema, ej:
 *   *\/15 * * * * cd /ruta/al/app && pnpm reminders:run >> /tmp/psidesk-reminders.log 2>&1
 */
import { readFileSync } from "node:fs";

function fromEnvFile(key: string): string | undefined {
  try {
    const txt = readFileSync(".env", "utf8");
    const m = txt.match(new RegExp(`^${key}="?([^"\\n]*)`, "m"));
    return m?.[1];
  } catch {
    return undefined;
  }
}

const secret = process.env.CRON_SECRET ?? fromEnvFile("CRON_SECRET");
const base =
  process.env.NEXTAUTH_URL ?? fromEnvFile("NEXTAUTH_URL") ?? "http://localhost:3001";

if (!secret) {
  console.error("Falta CRON_SECRET (en .env). Abortando.");
  process.exit(1);
}

const res = await fetch(`${base}/api/cron/reminders?secret=${secret}`);
const body = await res.text();
console.log(`HTTP ${res.status}: ${body}`);
process.exit(res.ok ? 0 : 1);
