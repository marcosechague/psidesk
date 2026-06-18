/**
 * Crea (o actualiza) el super admin de la plataforma.
 *
 * Como el auto-registro está cerrado, este script siembra la primera cuenta
 * de administración. Es idempotente: si el email ya existe, lo promueve a
 * SUPER_ADMIN y actualiza la contraseña.
 *
 * Uso:
 *   ADMIN_EMAIL=admin@psidesk.com ADMIN_PASSWORD=secreto123 pnpm admin:create
 *   pnpm admin:create -- --email admin@psidesk.com --password secreto123
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/** Lee una clave del archivo .env (fallback cuando no está en el entorno). */
function fromEnvFile(key: string): string | undefined {
  try {
    const txt = readFileSync(".env", "utf8");
    const m = txt.match(new RegExp(`^${key}="?([^"\\n]*)`, "m"));
    return m?.[1];
  } catch {
    return undefined;
  }
}

/** Toma --flag valor de los argumentos de la línea de comandos. */
function fromArgs(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// Asegurar DATABASE_URL para PrismaClient (tsx no carga .env automáticamente).
if (!process.env.DATABASE_URL) {
  const url = fromEnvFile("DATABASE_URL");
  if (url) process.env.DATABASE_URL = url;
}

const email = fromArgs("--email") ?? process.env.ADMIN_EMAIL;
const password = fromArgs("--password") ?? process.env.ADMIN_PASSWORD;
const firstName = fromArgs("--firstName") ?? process.env.ADMIN_FIRST_NAME ?? "Super";
const lastName = fromArgs("--lastName") ?? process.env.ADMIN_LAST_NAME ?? "Admin";

if (!email || !password) {
  console.error(
    "Faltan credenciales. Definí ADMIN_EMAIL y ADMIN_PASSWORD (o pasá --email y --password).",
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error("La contraseña debe tener al menos 8 caracteres.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(password!, 10);
  const user = await prisma.user.upsert({
    where: { email: email! },
    update: {
      role: "SUPER_ADMIN",
      active: true,
      passwordHash,
    },
    create: {
      email: email!,
      passwordHash,
      role: "SUPER_ADMIN",
      active: true,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
    },
  });
  console.log(`✅ Super admin listo: ${user.email} (id: ${user.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
