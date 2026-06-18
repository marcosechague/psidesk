/**
 * Datos de demostración para ver los gráficos con info real.
 * Crea un usuario demo con un paciente que tiene varias tomas que mejoran.
 *   Login:  demo@psidesk.local  /  demo1234
 * Uso:  pnpm db:demo   (idempotente: recrea el paciente demo)
 */
import { PrismaClient, type Test } from "@prisma/client";
import bcrypt from "bcryptjs";
import { scoreTest } from "../src/lib/scoring/scoreTest";
import type { ScoringConfig } from "../src/lib/scoring/types";
import { generatePublicToken } from "../src/lib/tokens";

const prisma = new PrismaClient();

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function inDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function answers(count: number, value: number): Record<string, number> {
  const o: Record<string, number> = {};
  for (let i = 1; i <= count; i++) o[String(i)] = value;
  return o;
}

async function addToma(
  patientId: string,
  processId: string,
  test: Test,
  itemCount: number,
  value: number,
  date: Date,
) {
  const ans = answers(itemCount, value);
  const result = scoreTest(
    {
      responseType: test.responseType,
      scoring: test.scoringJson as unknown as ScoringConfig,
    },
    ans,
  );
  const a = await prisma.assignment.create({
    data: {
      patientId,
      processId,
      testId: test.id,
      token: generatePublicToken(),
      status: "COMPLETED",
      createdAt: date,
      completedAt: date,
    },
  });
  await prisma.response.create({
    data: { assignmentId: a.id, answersJson: ans, createdAt: date },
  });
  await prisma.result.create({
    data: {
      assignmentId: a.id,
      scoresJson: result as unknown as object,
      createdAt: date,
    },
  });
}

async function main() {
  const email = "demo@psidesk.local";
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Demo",
      passwordHash: await bcrypt.hash("demo1234", 10),
    },
  });

  // Limpiar datos previos del demo (cascade borra todo lo del paciente)
  await prisma.patient.deleteMany({ where: { userId: user.id } });
  await prisma.session.deleteMany({ where: { userId: user.id } });

  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
      firstName: "Paciente",
      lastName: "Demo",
      fullName: "Paciente Demo",
      email: "paciente@demo.local",
      birthDate: new Date("1990-05-12"),
      sex: "Femenino",
    },
  });

  const dass = await prisma.test.findUniqueOrThrow({ where: { code: "DASS21" } });
  const phq = await prisma.test.findUniqueOrThrow({ where: { code: "PHQ9" } });

  // Dos procesos: uno con alta y una re-consulta en curso.
  const proc1 = await prisma.process.create({
    data: {
      patientId: patient.id,
      motivo: "Cuadro de ansiedad",
      motivoCategory: "ansiedad",
      status: "ENDED",
      startedAt: daysAgo(70),
      endedAt: daysAgo(25),
    },
  });
  const proc2 = await prisma.process.create({
    data: {
      patientId: patient.id,
      motivo: "Re-consulta por estrés laboral",
      motivoCategory: "estres",
      status: "ACTIVE",
      startedAt: daysAgo(12),
    },
  });

  // Proceso 1 (alta): tomas iniciales
  await addToma(patient.id, proc1.id, dass, 21, 2, daysAgo(60));
  await addToma(patient.id, proc1.id, dass, 21, 1, daysAgo(30));
  await addToma(patient.id, proc1.id, phq, 9, 2, daysAgo(40));

  // Proceso 2 (en curso): tomas recientes
  await addToma(patient.id, proc2.id, dass, 21, 0, daysAgo(5));
  await addToma(patient.id, proc2.id, phq, 9, 1, daysAgo(8));

  // Sesión pasada del proceso 1
  await prisma.session.create({
    data: {
      userId: user.id,
      startsAt: daysAgo(45),
      durationMin: 50,
      status: "COMPLETED",
      topic: "ansiedad",
      observations: "Encuadre inicial. Se trabaja psicoeducación sobre ansiedad.",
      participants: { create: { patientId: patient.id, processId: proc1.id } },
    },
  });

  // Sesiones del proceso 2 (en curso): próximas + una realizada
  await prisma.session.create({
    data: {
      userId: user.id,
      startsAt: inDays(1),
      durationMin: 50,
      status: "SCHEDULED",
      topic: "estres",
      reminderOffsetMin: 1440,
      participants: { create: { patientId: patient.id, processId: proc2.id } },
    },
  });
  await prisma.session.create({
    data: {
      userId: user.id,
      startsAt: inDays(7),
      durationMin: 50,
      status: "SCHEDULED",
      topic: "estres",
      participants: { create: { patientId: patient.id, processId: proc2.id } },
    },
  });
  await prisma.session.create({
    data: {
      userId: user.id,
      startsAt: daysAgo(5),
      durationMin: 50,
      status: "COMPLETED",
      topic: "estres",
      observations: "Estrés laboral. Estrategias de afrontamiento y límites.",
      goals: "Registrar disparadores de estrés en la semana.",
      nextSteps: "Revisar registro y practicar respiración.",
      participants: { create: { patientId: patient.id, processId: proc2.id } },
    },
  });

  console.log("✓ Demo creado. Login: demo@psidesk.local / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
