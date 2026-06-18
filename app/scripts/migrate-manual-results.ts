/**
 * Migra los ManualResult viejos (nombre de test suelto) al modelo unificado:
 * cada uno pasa a ser un Test externo (find-or-create por nombre) + una
 * Assignment completada + un Result (origen profesional, hallazgos).
 *
 * Es idempotente por borrado: elimina cada ManualResult al migrarlo, así que
 * correrlo de nuevo no duplica. Uso: pnpm tsx scripts/migrate-manual-results.ts
 */
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

function fromEnvFile(key: string): string | undefined {
  try {
    const txt = readFileSync(".env", "utf8");
    const m = txt.match(new RegExp(`^${key}="?([^"\\n]*)`, "m"));
    return m?.[1];
  } catch {
    return undefined;
  }
}
if (!process.env.DATABASE_URL) {
  const url = fromEnvFile("DATABASE_URL");
  if (url) process.env.DATABASE_URL = url;
}

const prisma = new PrismaClient();

async function main() {
  const manuals = await prisma.manualResult.findMany({
    include: { patient: { select: { userId: true } } },
    orderBy: { takenAt: "asc" },
  });
  console.log(`ManualResult a migrar: ${manuals.length}`);
  let migrated = 0;

  for (const m of manuals) {
    const userId = m.patient.userId;

    // Test externo: reusar si ya existe uno con ese nombre, si no crearlo.
    let test = await prisma.test.findFirst({
      where: { userId, name: m.testName, scored: false },
      select: { id: true },
    });
    if (!test) {
      test = await prisma.test.create({
        data: {
          userId,
          isSystem: false,
          scored: false,
          name: m.testName,
          description: "Test externo (cargado a mano).",
          categories: [],
          responseType: "SCALE_0_3",
          itemsJson: [],
          scoringJson: {},
        },
        select: { id: true },
      });
    }

    // Proceso activo del paciente (reusar o crear).
    let proc = await prisma.process.findFirst({
      where: { patientId: m.patientId, status: "ACTIVE" },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    if (!proc) {
      proc = await prisma.process.create({
        data: { patientId: m.patientId },
        select: { id: true },
      });
    }

    await prisma.assignment.create({
      data: {
        patientId: m.patientId,
        testId: test.id,
        processId: proc.id,
        token: randomUUID(),
        status: "COMPLETED",
        completedAt: m.takenAt,
        createdAt: m.createdAt,
        notifyOnAssign: false,
        result: {
          create: {
            findingsJson: m.findingsJson as object,
            notes: m.notes,
            source: "PROFESSIONAL",
            reviewedAt: m.createdAt,
          },
        },
      },
    });
    await prisma.manualResult.delete({ where: { id: m.id } });
    migrated++;
  }

  console.log(`Migrados: ${migrated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
