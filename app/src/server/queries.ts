import "server-only";
import { prisma } from "@/lib/db";
import { featureEnabled, type FeatureFlags, type FeatureKey } from "@/lib/features";
import { normalizeAvailability, type Availability } from "@/lib/availability";
import { TONE_RANK, TONE_LABEL, worstTone, type LevelTone } from "@/lib/levels";
import { patientSnapshot } from "@/lib/clinicalSummary";
import { ageFromBirthDate } from "@/lib/patients";
import { processMotivoLabel } from "@/lib/validations";
import type { ScoreResult } from "@/lib/scoring/types";

/** ¿El usuario debe cambiar su contraseña antes de seguir usando la app? */
export async function mustChangePassword(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { mustChangePassword: true },
  });
  return u?.mustChangePassword ?? false;
}

/** Interruptores maestros de la plataforma (fila única). */
export async function getPlatformFlags(): Promise<FeatureFlags> {
  const s = await prisma.platformSettings.findUnique({
    where: { id: "platform" },
    select: { featureFlags: true },
  });
  return (s?.featureFlags as FeatureFlags) ?? null;
}

/** Proveedor/modelo de IA configurados por el super admin (null = usar env/default). */
export async function getAiSettings(): Promise<{
  aiProvider: string | null;
  aiModel: string | null;
}> {
  const s = await prisma.platformSettings.findUnique({
    where: { id: "platform" },
    select: { aiProvider: true, aiModel: true },
  });
  return { aiProvider: s?.aiProvider ?? null, aiModel: s?.aiModel ?? null };
}

/** Horario de atención del psicólogo (normalizado), o null si no lo configuró. */
export async function getAvailability(
  userId: string,
): Promise<Availability | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { availability: true },
  });
  return u?.availability ? normalizeAvailability(u.availability) : null;
}

/**
 * ¿La función `key` está efectivamente habilitada para este psicólogo?
 * Respeta los 3 niveles: plataforma → entitlement → preferencia.
 */
export async function userFeatureEnabled(
  userId: string,
  key: FeatureKey,
): Promise<boolean> {
  const [u, platform] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { featureEntitlements: true, featurePreferences: true },
    }),
    getPlatformFlags(),
  ]);
  return featureEnabled(
    u?.featureEntitlements as FeatureFlags,
    u?.featurePreferences as FeatureFlags,
    key,
    platform,
  );
}

/** Inicio del mes en curso (medianoche UTC del día 1). */
function currentMonthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Conversaciones de WhatsApp por psicólogo en el mes en curso (todos los tipos).
 * Proxy de costo facturable por Meta: cada mensaje saliente exitoso
 * (`WhatsAppMessage`) abre una conversación. La relación al User es directa.
 */
async function getWhatsAppUsageThisMonth(): Promise<Map<string, number>> {
  const monthStart = currentMonthStart();
  const rows = await prisma.whatsAppMessage.groupBy({
    by: ["userId"],
    where: { sentAt: { gte: monthStart } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.userId, r._count._all]));
}

/** Consumo de WhatsApp del propio psicólogo en el mes, desglosado por tipo. */
export interface WhatsAppUsage {
  total: number;
  checkin: number;
  reminder: number;
  appointment: number;
  test: number;
}

/**
 * Consumo de WhatsApp del propio psicólogo en el mes en curso, por tipo.
 * Mismo proxy de costo que la versión de admin, acotado a un userId.
 */
export async function getWhatsAppUsageForUser(
  userId: string,
): Promise<WhatsAppUsage> {
  const monthStart = currentMonthStart();
  const rows = await prisma.whatsAppMessage.groupBy({
    by: ["type"],
    where: { userId, sentAt: { gte: monthStart } },
    _count: { _all: true },
  });
  let checkin = 0;
  let reminder = 0;
  let appointment = 0;
  let test = 0;
  for (const r of rows) {
    if (r.type === "CHECKIN") checkin = r._count._all;
    else if (r.type === "APPOINTMENT_REMINDER") reminder = r._count._all;
    else if (r.type === "APPOINTMENT_NOTICE") appointment = r._count._all;
    else if (r.type === "TEST_ASSIGNED" || r.type === "TEST_REMINDER")
      test += r._count._all;
  }
  return {
    total: checkin + reminder + appointment + test,
    checkin,
    reminder,
    appointment,
    test,
  };
}

/** Métricas globales de la plataforma para el panel del super admin. */
export async function getPlatformStats() {
  const monthStart = currentMonthStart();
  const [total, active, patients, wa] = await Promise.all([
    prisma.user.count({ where: { role: "PSYCHOLOGIST" } }),
    prisma.user.count({ where: { role: "PSYCHOLOGIST", active: true } }),
    prisma.patient.count(),
    prisma.whatsAppMessage.groupBy({
      by: ["type"],
      where: { sentAt: { gte: monthStart } },
      _count: { _all: true },
    }),
  ]);
  let checkin = 0;
  let reminder = 0;
  let appointment = 0;
  let test = 0;
  for (const r of wa) {
    if (r.type === "CHECKIN") checkin = r._count._all;
    else if (r.type === "APPOINTMENT_REMINDER") reminder = r._count._all;
    else if (r.type === "APPOINTMENT_NOTICE") appointment = r._count._all;
    else if (r.type === "TEST_ASSIGNED" || r.type === "TEST_REMINDER")
      test += r._count._all;
  }
  return {
    psychologists: { total, active, suspended: total - active },
    patients,
    whatsapp: {
      total: checkin + reminder + appointment + test,
      checkin,
      reminder,
      appointment,
      test,
    },
  };
}

/**
 * Lista de psicólogos para el panel de admin, con cantidad de pacientes
 * y consumo de conversaciones de WhatsApp del mes en curso.
 */
export async function getPsychologists() {
  const [users, usage] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PSYCHOLOGIST" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        prefix: true,
        email: true,
        specialties: true,
        active: true,
        billingStatus: true,
        billingUntil: true,
        featureEntitlements: true,
        createdAt: true,
        _count: { select: { patients: true } },
      },
    }),
    getWhatsAppUsageThisMonth(),
  ]);
  return users.map((u) => ({ ...u, whatsappThisMonth: usage.get(u.id) ?? 0 }));
}

/** Grupos del psicólogo, con sus miembros y cantidad de sesiones. */
export async function getGroups(userId: string) {
  return prisma.patientGroup.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        include: { patient: { select: { id: true, fullName: true } } },
      },
      sessions: { orderBy: { startsAt: "desc" }, take: 1, select: { startsAt: true } },
      _count: { select: { sessions: true } },
    },
  });
}

/** Un grupo con miembros + historial de sesiones (verifica ownership). */
export async function getGroup(userId: string, groupId: string) {
  return prisma.patientGroup.findFirst({
    where: { id: groupId, userId },
    include: {
      members: {
        include: { patient: { select: { id: true, fullName: true } } },
      },
      sessions: {
        orderBy: { startsAt: "desc" },
        include: {
          participants: {
            include: { patient: { select: { id: true, fullName: true } } },
          },
        },
      },
    },
  });
}

/** Pacientes del psicólogo, con cantidad de tests asignados. */
export async function getPatients(userId: string) {
  return prisma.patient.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { assignments: true } },
    },
  });
}

/** Tratamiento activo de un paciente: su id + etiqueta legible (motivo). */
export interface ActiveProcessRef {
  id: string;
  label: string | null;
}

/**
 * Pacientes para el selector de agenda: id, nombre y el tratamiento en curso
 * (si hay), para que el form de sesión preseleccione el tratamiento.
 */
export async function getPatientsForScheduling(
  userId: string,
): Promise<{ id: string; fullName: string; activeProcess: ActiveProcessRef | null }[]> {
  const patients = await prisma.patient.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      processes: {
        where: { status: "ACTIVE" },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, motivo: true, motivoCategory: true },
      },
    },
  });
  return patients.map((p) => {
    const active = p.processes[0];
    return {
      id: p.id,
      fullName: p.fullName,
      activeProcess: active
        ? { id: active.id, label: processMotivoLabel(active) }
        : null,
    };
  });
}

/** Pacientes para la lista, enriquecidos: última sesión + alertas clínicas. */
export async function getPatientsForList(userId: string) {
  const DAY = 86_400_000;
  const now = Date.now();
  const patients = await prisma.patient.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      assignments: {
        include: { test: { select: { name: true } }, result: true },
        orderBy: { createdAt: "asc" },
      },
      sessionParticipations: {
        include: { session: { select: { startsAt: true } } },
      },
      processes: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
    },
  });

  return patients.map((p) => {
    const snap = patientSnapshot(p.assignments);
    const sessionDates = p.sessionParticipations.map((sp) =>
      sp.session.startsAt.getTime(),
    );
    const past = sessionDates.filter((t) => t <= now).sort((a, b) => b - a);
    const lastSessionAt = past[0] ? new Date(past[0]) : null;

    const lastActivity = Math.max(
      p.createdAt.getTime(),
      ...p.assignments.filter((a) => a.completedAt).map((a) => a.completedAt!.getTime()),
      ...sessionDates,
    );
    const inactive = now - lastActivity > 30 * DAY;

    return {
      id: p.id,
      fullName: p.fullName,
      age: ageFromBirthDate(p.birthDate),
      sex: p.sex,
      lastSessionAt,
      worsening: snap.worsening,
      inactive,
      active: p.processes.length > 0,
      // No puede recibir mensajes: falta teléfono o consentimiento de WhatsApp.
      noWhatsapp: !p.phone || !p.whatsappOptIn,
      sessions: p.sessionParticipations.length,
    };
  });
}

/** Ficha de un paciente con su historial de tests (verifica propiedad). */
export async function getPatient(userId: string, patientId: string) {
  return prisma.patient.findFirst({
    where: { id: patientId, userId },
    include: {
      assignments: {
        orderBy: { createdAt: "desc" },
        include: { test: true, result: true },
      },
      sessionParticipations: {
        orderBy: { session: { startsAt: "desc" } },
        include: {
          session: {
            include: {
              participants: {
                include: { patient: { select: { id: true, fullName: true } } },
              },
            },
          },
        },
      },
      attachments: { orderBy: { createdAt: "desc" } },
      diagnoses: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] },
      manualResults: { orderBy: { takenAt: "desc" } },
      checkinPlans: {
        orderBy: { createdAt: "desc" },
        include: { entries: { orderBy: { scheduledFor: "desc" } } },
      },
      processes: {
        orderBy: [{ status: "asc" }, { startedAt: "desc" }],
        include: {
          _count: { select: { participations: true, assignments: true } },
        },
      },
    },
  });
}

/** Sesión en curso (IN_PROGRESS) del psicólogo, para el indicador flotante. */
export async function getActiveSession(userId: string) {
  const s = await prisma.session.findFirst({
    where: { userId, status: "IN_PROGRESS" },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      participants: { select: { patient: { select: { fullName: true } } } },
    },
  });
  if (!s) return null;
  const label =
    s.participants.map((p) => p.patient.fullName).join(", ") ||
    s.title ||
    "Sesión";
  return { id: s.id, label };
}

/** Detalle de un proceso terapéutico: sus sesiones y tests (verifica propiedad). */
export async function getProcess(userId: string, processId: string) {
  return prisma.process.findFirst({
    where: { id: processId, patient: { userId } },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      participations: {
        include: {
          session: {
            select: {
              id: true,
              startsAt: true,
              durationMin: true,
              status: true,
              topic: true,
              topicOther: true,
            },
          },
        },
      },
      assignments: {
        orderBy: { createdAt: "asc" },
        include: { test: true, result: true },
      },
      checkinPlans: {
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          question: true,
          status: true,
          startDate: true,
          entries: { select: { status: true } },
        },
      },
    },
  });
}

/**
 * Tratamientos activos del psicólogo cruzando todos sus pacientes (caseload).
 * Para la sección global /tratamientos: motivo, conteos, última/próxima sesión y
 * alerta de empeoramiento por paciente.
 */
export async function getActiveTreatments(userId: string) {
  const now = Date.now();
  const processes = await prisma.process.findMany({
    where: { status: "ACTIVE", patient: { userId } },
    orderBy: { startedAt: "desc" },
    include: {
      patient: {
        select: {
          id: true,
          fullName: true,
          assignments: {
            include: { test: { select: { name: true } }, result: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      participations: {
        include: { session: { select: { startsAt: true, status: true } } },
      },
      _count: { select: { participations: true, assignments: true } },
    },
  });

  return processes.map((p) => {
    const snap = patientSnapshot(p.patient.assignments);
    const dates = p.participations
      .map((pp) => pp.session)
      .filter((s) => s.status !== "CANCELED" && s.status !== "NO_SHOW")
      .map((s) => s.startsAt.getTime());
    const past = dates.filter((t) => t <= now).sort((a, b) => b - a);
    const future = dates.filter((t) => t > now).sort((a, b) => a - b);
    return {
      id: p.id,
      patientId: p.patient.id,
      patientName: p.patient.fullName,
      motivo: p.motivo,
      motivoCategory: p.motivoCategory,
      startedAt: p.startedAt,
      sessions: p._count.participations,
      tests: p._count.assignments,
      lastSessionAt: past[0] ? new Date(past[0]) : null,
      nextSessionAt: future[0] ? new Date(future[0]) : null,
      worsening: snap.worsening,
    };
  });
}

/** Tests disponibles para un psicólogo: los del sistema + los suyos. */
export async function getTests(userId: string) {
  return prisma.test.findMany({
    where: { OR: [{ isSystem: true }, { userId }] },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
}

/** Plantillas de estructura del resumen: las del sistema + las del psicólogo. */
export async function getNoteTemplates(userId: string) {
  return prisma.noteTemplate.findMany({
    where: { OR: [{ isSystem: true }, { userId }] },
    orderBy: [{ isSystem: "desc" }, { isDefault: "desc" }, { name: "asc" }],
  });
}

/** Voces/estilos de redacción: las del sistema + las del psicólogo. */
export async function getWritingVoices(userId: string) {
  return prisma.writingVoice.findMany({
    where: { OR: [{ isSystem: true }, { userId }] },
    orderBy: [{ isSystem: "desc" }, { isDefault: "desc" }, { name: "asc" }],
  });
}

/** Una plantilla PROPIA del psicólogo (para editar). null si no es suya. */
export async function getOwnNoteTemplate(userId: string, id: string) {
  return prisma.noteTemplate.findFirst({ where: { id, userId } });
}

/** Una voz PROPIA del psicólogo (para editar). null si no es suya. */
export async function getOwnWritingVoice(userId: string, id: string) {
  return prisma.writingVoice.findFirst({ where: { id, userId } });
}

/** Preferencia: emojis en el mensaje al paciente (default true). */
export async function getPatientMessageEmojis(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { patientMessageEmojis: true },
  });
  return u?.patientMessageEmojis ?? true;
}

/** Solo los tests creados por el psicólogo (para "Mis tests"). */
export async function getOwnTests(userId: string) {
  return prisma.test.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

/** Sesión en forma simple para el Inicio (participantes ya aplanados). */
const dashSessionInclude = {
  participants: {
    include: { patient: { select: { id: true, fullName: true } } },
  },
} as const;

type DashSessionRow = {
  id: string;
  startsAt: Date;
  durationMin: number;
  status: string;
  topic: string | null;
  topicOther: string | null;
  participants: { patient: { id: string; fullName: string } }[];
};

function toDaySession(s: DashSessionRow) {
  return {
    id: s.id,
    startsAt: s.startsAt,
    durationMin: s.durationMin,
    status: s.status,
    topic: s.topic,
    topicOther: s.topicOther,
    participants: s.participants.map((p) => p.patient),
  };
}

/** Datos del Inicio: panel operativo del día (acción + día + novedades). */
export async function getDashboardData(userId: string) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  // Semana actual de lunes a domingo (para el gráfico "carga de la semana").
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - ((now.getDay() + 6) % 7));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  // Tests que el paciente completó pero el psicólogo todavía no abrió.
  const unreviewedWhere = {
    patient: { userId },
    status: "COMPLETED" as const,
    completedAt: { not: null },
    result: { is: { reviewedAt: null } },
  };

  const [
    pendingTests,
    todayRows,
    inProgress,
    nextScheduled,
    toReview,
    unreviewed,
    weekSessions,
  ] = await Promise.all([
    prisma.assignment.count({
      where: { patient: { userId }, status: "PENDING" },
    }),
    prisma.session.findMany({
      where: { userId, startsAt: { gte: startOfDay, lt: endOfDay } },
      orderBy: { startsAt: "asc" },
      include: dashSessionInclude,
    }),
    prisma.session.findFirst({
      where: { userId, status: "IN_PROGRESS" },
      orderBy: { startsAt: "asc" },
      include: dashSessionInclude,
    }),
    prisma.session.findFirst({
      where: { userId, status: "SCHEDULED", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      include: dashSessionInclude,
    }),
    prisma.assignment.count({ where: unreviewedWhere }),
    prisma.assignment.findMany({
      where: unreviewedWhere,
      orderBy: { completedAt: "desc" },
      take: 6,
      include: {
        patient: { select: { fullName: true } },
        test: { select: { name: true } },
      },
    }),
    prisma.session.findMany({
      where: { userId, startsAt: { gte: startOfWeek, lt: endOfWeek } },
      select: { startsAt: true },
    }),
  ]);

  const today = todayRows.map(toDaySession);
  const next = inProgress ?? nextScheduled;

  // Carga de la semana: sesiones por día (lun–dom).
  const counts = new Array(7).fill(0);
  for (const s of weekSessions) {
    const idx = Math.floor(
      (s.startsAt.getTime() - startOfWeek.getTime()) / 86_400_000,
    );
    if (idx >= 0 && idx < 7) counts[idx]++;
  }
  const todayIdx = (now.getDay() + 6) % 7;
  const weekLoad = ["L", "M", "M", "J", "V", "S", "D"].map((label, i) => ({
    label,
    count: counts[i],
    isToday: i === todayIdx,
  }));

  // Para revisar: informes nuevos (completados sin abrir todavía).
  const novedades = unreviewed.map((a) => ({
    when: a.completedAt!,
    patientName: a.patient.fullName,
    text: `completó ${a.test.name}`,
    href: `/resultados/${a.id}`,
  }));

  return {
    stats: {
      sessionsToday: today.length,
      doneToday: today.filter((s) => s.status === "COMPLETED").length,
      pendingTests,
      toReview,
    },
    next: next ? toDaySession(next) : null,
    today,
    novedades,
    weekLoad,
  };
}

/** Marca un resultado como revisado la primera vez que se abre el informe. */
export async function markResultReviewed(assignmentId: string) {
  await prisma.result.updateMany({
    where: { assignmentId, reviewedAt: null },
    data: { reviewedAt: new Date() },
  });
}

/** Todas las sesiones del psicólogo desde hace 2 meses en adelante (para la agenda). */
export async function getSessions(userId: string) {
  const from = new Date();
  from.setMonth(from.getMonth() - 2);
  return prisma.session.findMany({
    where: { userId, startsAt: { gte: from } },
    orderBy: { startsAt: "asc" },
    include: {
      participants: {
        include: { patient: { select: { id: true, fullName: true } } },
      },
    },
  });
}

/** Una sesión con todo lo que necesita el workspace: participantes, y por cada
 *  paciente sus tests/resultados, adjuntos e historial de sesiones. */
export async function getSession(userId: string, sessionId: string) {
  return prisma.session.findFirst({
    where: { id: sessionId, userId },
    include: {
      participants: {
        orderBy: { createdAt: "asc" },
        include: {
          patient: {
            include: {
              assignments: {
                orderBy: { createdAt: "desc" },
                include: { test: true, result: true, response: true },
              },
              attachments: { orderBy: { createdAt: "desc" } },
              diagnoses: { orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }] },
              manualResults: { orderBy: { takenAt: "desc" } },
              checkinPlans: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  question: true,
                  status: true,
                  createdAt: true,
                },
              },
              sessionParticipations: {
                orderBy: { session: { startsAt: "desc" } },
                include: {
                  session: {
                    select: {
                      id: true,
                      startsAt: true,
                      status: true,
                      topic: true,
                      topicOther: true,
                      observations: true,
                      goals: true,
                      nextSteps: true,
                      summary: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

/** Insights para el dashboard: empeoramiento, distribución, carga, inactivos. */
export async function getPracticeInsights(userId: string) {
  const now = new Date();
  const DAY = 86_400_000;
  const WEEKS = 8;

  const [patients, sessions] = await Promise.all([
    prisma.patient.findMany({
      where: { userId },
      include: {
        assignments: {
          include: { test: { select: { name: true } }, result: true },
          orderBy: { createdAt: "asc" },
        },
        sessionParticipations: {
          include: { session: { select: { startsAt: true } } },
        },
      },
    }),
    // Sesiones del psicólogo (distintas, sin doble conteo en parejas) para la carga.
    prisma.session.findMany({
      where: { userId },
      select: { startsAt: true },
    }),
  ]);

  const worsening: {
    patientId: string;
    patientName: string;
    testName: string;
    from: string;
    to: string;
  }[] = [];
  const severityCounts: Record<LevelTone, number> = {
    ok: 0,
    low: 0,
    mid: 0,
    high: 0,
    max: 0,
  };
  const inactive: {
    patientId: string;
    fullName: string;
    lastActivity: string;
  }[] = [];
  const citasByWeek = new Array(WEEKS).fill(0);
  const testsByWeek = new Array(WEEKS).fill(0);

  const weekIndex = (d: Date) =>
    Math.floor(Math.floor((now.getTime() - d.getTime()) / DAY) / 7);

  for (const p of patients) {
    const completed = p.assignments.filter(
      (a) => a.status === "COMPLETED" && a.result && a.completedAt,
    );
    // Severidad/empeoramiento: solo resultados puntuados por el sistema
    // (los cargados a mano no tienen tono).
    const scored = completed.filter((a) => a.result!.scoresJson);

    // Empeoramiento: por test, comparar las dos últimas tomas
    const byTest = new Map<string, typeof scored>();
    for (const a of scored) {
      const arr = byTest.get(a.testId) ?? [];
      arr.push(a);
      byTest.set(a.testId, arr);
    }
    for (const arr of byTest.values()) {
      if (arr.length >= 2) {
        const prev = arr[arr.length - 2];
        const last = arr[arr.length - 1];
        const pt = worstTone(
          (prev.result!.scoresJson as unknown as ScoreResult).scores,
        );
        const lt = worstTone(
          (last.result!.scoresJson as unknown as ScoreResult).scores,
        );
        if (TONE_RANK[lt] > TONE_RANK[pt]) {
          worsening.push({
            patientId: p.id,
            patientName: p.fullName,
            testName: last.test.name,
            from: TONE_LABEL[pt],
            to: TONE_LABEL[lt],
          });
        }
      }
    }

    // Distribución de severidad: tono del último resultado PUNTUADO del paciente
    if (scored.length) {
      const latest = scored.reduce((a, b) =>
        a.completedAt! > b.completedAt! ? a : b,
      );
      severityCounts[
        worstTone((latest.result!.scoresJson as unknown as ScoreResult).scores)
      ]++;
    }

    // Inactividad: última señal de actividad
    const dates = [p.createdAt.getTime()];
    for (const a of completed) dates.push(a.completedAt!.getTime());
    for (const sp of p.sessionParticipations)
      dates.push(sp.session.startsAt.getTime());
    const lastActivity = Math.max(...dates);
    if (now.getTime() - lastActivity > 30 * DAY) {
      inactive.push({
        patientId: p.id,
        fullName: p.fullName,
        lastActivity: new Date(lastActivity).toLocaleDateString("es-AR"),
      });
    }

    // Carga semanal de tests (últimas 8 semanas)
    for (const a of p.assignments) {
      const w = weekIndex(a.createdAt);
      if (w >= 0 && w < WEEKS) testsByWeek[w]++;
    }
  }

  // Carga semanal de sesiones: sobre sesiones distintas (las parejas no se duplican).
  for (const s of sessions) {
    const w = weekIndex(s.startsAt);
    if (w >= 0 && w < WEEKS) citasByWeek[w]++;
  }

  const weekly = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = new Date(now.getTime() - i * 7 * DAY);
    weekly.push({
      week: start.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }),
      citas: citasByWeek[i],
      tests: testsByWeek[i],
    });
  }

  const severity = (["ok", "low", "mid", "high", "max"] as LevelTone[]).map(
    (tone) => ({ tone, label: TONE_LABEL[tone], count: severityCounts[tone] }),
  );

  return { worsening, severity, weekly, inactive };
}

/** Asignación para el informe (verifica que el paciente sea del psicólogo). */
export async function getAssignmentForResult(
  userId: string,
  assignmentId: string,
) {
  return prisma.assignment.findFirst({
    where: { id: assignmentId, patient: { userId } },
    include: { test: true, patient: true, result: true, response: true },
  });
}

/** Asignación pública por token (para que el paciente responda). */
export async function getAssignmentByToken(token: string) {
  return prisma.assignment.findUnique({
    where: { token },
    include: { test: true, patient: true },
  });
}
