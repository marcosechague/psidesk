import "server-only";
import { prisma } from "@/lib/db";
import { getWhatsApp } from "@/lib/whatsapp";
import {
  localDateInTz,
  zonedInstant,
  dueDatesBetween,
  buildMessage,
  parseReply,
  ackMessage,
  type DuePlan,
} from "@/lib/checkins";
import { professionalName, type ProfessionalNameParts } from "@/lib/users";
import { featureEnabled, type FeatureFlags } from "@/lib/features";
import { getPlatformFlags } from "./queries";
import { logWhatsAppSent } from "./whatsappLog";
import type { OutgoingMessage } from "@/lib/whatsapp/types";

/** Solo los dígitos del teléfono (para comparar números con distinto formato). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

type PlanRow = {
  id: string;
  question: string;
  questionType: "SCALE_1_10" | "YES_NO" | "CHOICE";
  optionsJson: unknown;
  frequency: "DAILY" | "EVERY_N_DAYS" | "WEEKDAYS";
  everyNDays: number | null;
  weekdaysJson: unknown;
  timeOfDay: string;
  timezone: string;
  startDate: Date;
  endDate: Date;
  patient: {
    id: string;
    userId: string;
    phone: string | null;
    fullName: string;
    user: ProfessionalNameParts | null;
  } | null;
};

/** Nombre de pila (para el saludo personalizado). */
function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** Campos del profesional que incluimos para armar su nombre en el mensaje. */
const userNameSelect = {
  name: true,
  firstName: true,
  lastName: true,
  prefix: true,
} as const;

/**
 * Elige el mensaje a enviar. Si hay un template configurado
 * (WHATSAPP_TEMPLATE_NAME) usa template — único modo válido fuera de la ventana
 * de 24 h, necesario para los check-ins programados. Si no, cae al mensaje
 * interactivo (útil en dev/mock y dentro de la ventana).
 */
function outgoingFor(
  question: string,
  type: PlanRow["questionType"],
  options: string[],
  professional: string,
  patient: string,
): OutgoingMessage {
  const name = process.env.WHATSAPP_TEMPLATE_NAME;
  if (name) {
    return {
      kind: "template",
      name,
      language: process.env.WHATSAPP_TEMPLATE_LANG ?? "es",
      // {{1}} = paciente, {{2}} = profesional, {{3}} = pregunta (sola, sin
      // instrucción ni opciones: en el flujo híbrido se responde tocando botones,
      // no escribiendo). Colapsamos espacios porque la variable no admite saltos.
      bodyParams: [
        patient || "",
        professional || "Tu profesional",
        question.replace(/\s+/g, " ").trim(),
      ],
    };
  }
  return buildMessage(question, type, options, { professional, patient });
}

/** Construye y envía el mensaje de una toma existente; actualiza su estado. */
async function deliver(
  entryId: string,
  plan: Pick<PlanRow, "question" | "questionType" | "optionsJson" | "patient">,
  now: Date,
): Promise<"sent" | "failed" | "skipped"> {
  const phone = plan.patient?.phone;
  if (!phone) return "skipped";

  const options = (plan.optionsJson as string[] | null) ?? [];
  const professional = plan.patient?.user ? professionalName(plan.patient.user) : "";
  const patientName = plan.patient ? firstNameOf(plan.patient.fullName) : "";
  const message = outgoingFor(
    plan.question,
    plan.questionType,
    options,
    professional,
    patientName,
  );
  const res = await getWhatsApp().send(phone, message);

  await prisma.checkinEntry.update({
    where: { id: entryId },
    data: res.sent
      ? { status: "SENT", sentAt: now, providerMessageId: res.providerMessageId }
      : { status: "FAILED" },
  });
  // Registrar el envío en el log unificado (consumo por tipo). Solo si salió bien.
  if (res.sent && plan.patient) {
    await logWhatsAppSent({
      userId: plan.patient.userId,
      patientId: plan.patient.id,
      type: "CHECKIN",
      sentAt: now,
      providerMessageId: res.providerMessageId,
      checkinEntryId: entryId,
    });
  }
  return res.sent ? "sent" : "failed";
}

/** Crea una toma ad-hoc (scheduledFor = ahora) y la envía. Para "Enviar ahora". */
async function createAndSend(
  plan: PlanRow,
  now: Date,
): Promise<"sent" | "failed" | "skipped"> {
  if (!plan.patient?.phone) return "skipped";
  let entryId: string;
  try {
    const entry = await prisma.checkinEntry.create({
      data: { planId: plan.id, scheduledFor: now, status: "PENDING" },
    });
    entryId = entry.id;
  } catch {
    return "skipped"; // ya existe una toma para ese instante
  }
  return deliver(entryId, plan, now);
}

/**
 * Pre-genera todas las tomas (PENDING) del plan: una por cada fecha en que
 * corresponde, de start a end. Idempotente por @@unique([planId, scheduledFor]).
 * Se llama al crear el plan; el cron después solo envía las que vencen.
 */
export async function generatePlanEntries(planId: string): Promise<number> {
  const plan = await prisma.checkinPlan.findUnique({ where: { id: planId } });
  if (!plan) return 0;
  const due: DuePlan = {
    frequency: plan.frequency,
    everyNDays: plan.everyNDays,
    weekdays: (plan.weekdaysJson as number[] | null) ?? [],
    startDate: plan.startDate,
    endDate: plan.endDate,
  };
  const data = dueDatesBetween(due).map((d) => ({
    planId,
    scheduledFor: zonedInstant(d, plan.timeOfDay, plan.timezone),
    status: "PENDING" as const,
  }));
  if (data.length === 0) return 0;
  const res = await prisma.checkinEntry.createMany({ data, skipDuplicates: true });
  return res.count;
}

/**
 * Cron: procesa las tomas PENDING vencidas de planes activos.
 *  - si la toma es de HOY (y ya pasó la hora) → se envía.
 *  - si es de un día ANTERIOR (cron caído / pausa) → se marca SKIPPED (no enviada).
 */
export async function dispatchDueCheckins(now = new Date()) {
  const entries = (await prisma.checkinEntry.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
      plan: { status: "ACTIVE", patient: { whatsappOptIn: true, phone: { not: null } } },
    },
    include: {
      plan: {
        include: { patient: { select: { id: true, userId: true, phone: true, fullName: true, user: { select: userNameSelect } } } },
      },
    },
    orderBy: { scheduledFor: "asc" },
    take: 500,
  })) as unknown as { id: string; scheduledFor: Date; plan: PlanRow }[];

  // Flags de seguimiento por psicólogo (nivel feature): gateamos antes de enviar.
  const userIds = [
    ...new Set(
      entries.map((e) => e.plan.patient?.userId).filter((v): v is string => !!v),
    ),
  ];
  const flagUsers = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, featureEntitlements: true, featurePreferences: true },
      })
    : [];
  const flagsByUser = new Map(flagUsers.map((u) => [u.id, u]));
  const platformFlags = await getPlatformFlags();

  let sent = 0;
  let failed = 0;
  let missed = 0;
  for (const entry of entries) {
    // Si el psicólogo tiene el seguimiento por WhatsApp deshabilitado, no enviar.
    const u = entry.plan.patient
      ? flagsByUser.get(entry.plan.patient.userId)
      : undefined;
    if (
      !featureEnabled(
        u?.featureEntitlements as FeatureFlags,
        u?.featurePreferences as FeatureFlags,
        "whatsappCheckins",
        platformFlags,
      )
    ) {
      continue;
    }
    const tz = entry.plan.timezone;
    const today = localDateInTz(now, tz);
    const day = localDateInTz(entry.scheduledFor, tz);
    const sameDay =
      today.year === day.year && today.month === day.month && today.day === day.day;
    if (!sameDay) {
      // Día anterior sin enviar: se marca como no enviada (no se reintenta atrasada).
      await prisma.checkinEntry.update({
        where: { id: entry.id },
        data: { status: "SKIPPED" },
      });
      missed++;
      continue;
    }
    const r = await deliver(entry.id, entry.plan, now);
    if (r === "sent") sent++;
    else if (r === "failed") failed++;
  }
  return { processed: entries.length, sent, failed, missed };
}

/** Envía un check-in del plan ahora mismo (ignora la frecuencia). Para probar el flujo. */
export async function sendCheckinForPlan(planId: string, now = new Date()) {
  const plan = (await prisma.checkinPlan.findUnique({
    where: { id: planId },
    include: { patient: { select: { id: true, userId: true, phone: true, fullName: true, user: { select: userNameSelect } } } },
  })) as unknown as PlanRow | null;
  if (!plan) return { ok: false as const, error: "Plan no encontrado" };
  if (!plan.patient?.phone) {
    return { ok: false as const, error: "El paciente no tiene teléfono cargado" };
  }
  const r = await createAndSend(plan, now);
  if (r === "sent") return { ok: true as const };
  if (r === "skipped") return { ok: false as const, error: "Ya hay un envío para ese instante" };
  return { ok: false as const, error: "No se pudo enviar" };
}

/** Guarda la respuesta de una toma concreta (parseada según el tipo de pregunta). */
export async function recordReplyForEntry(entryId: string, raw: string) {
  const entry = await prisma.checkinEntry.findUnique({
    where: { id: entryId },
    include: { plan: { include: { patient: { select: { phone: true } } } } },
  });
  if (!entry) return { ok: false as const, error: "Toma no encontrada" };

  const options = (entry.plan.optionsJson as string[] | null) ?? [];
  const parsed = parseReply(entry.plan.questionType, raw, options.length);

  await prisma.checkinEntry.update({
    where: { id: entry.id },
    // Si no la entendimos, guardamos el texto pero dejamos la toma pendiente
    // (status SENT) para que el paciente pueda reintentar.
    data: parsed.ok
      ? { status: "RESPONDED", responseText: raw, responseValue: parsed.value, respondedAt: new Date() }
      : { responseText: raw },
  });

  // Acuse de recibo: la respuesta del paciente abrió la ventana de 24h, así que
  // podemos mandar texto libre (confirmación o re-pregunta) sin template.
  const phone = entry.plan.patient?.phone;
  if (phone) {
    await getWhatsApp().send(
      phone,
      ackMessage(entry.plan.question, entry.plan.questionType, options, parsed),
    );
  }

  return { ok: true as const, parsed };
}

/** Busca la toma SENT pendiente más reciente para un teléfono (la del webhook). */
async function findPendingEntryForPhone(phone: string) {
  const digits = normalizePhone(phone);
  const candidates = await prisma.checkinEntry.findMany({
    where: { status: "SENT", respondedAt: null, plan: { status: "ACTIVE" } },
    include: {
      plan: {
        include: { patient: { select: { id: true, userId: true, phone: true, fullName: true, user: { select: userNameSelect } } } },
      },
    },
    orderBy: { sentAt: "desc" },
    take: 50,
  });
  return (
    candidates.find((e) => normalizePhone(e.plan.patient.phone ?? "") === digits) ?? null
  );
}

/** Matchea una respuesta entrante (webhook) por teléfono a la toma pendiente más reciente. */
export async function recordReplyForPhone(phone: string, raw: string) {
  const entry = await findPendingEntryForPhone(phone);
  if (!entry) {
    return { ok: false as const, error: "Sin check-in pendiente para ese número" };
  }
  return recordReplyForEntry(entry.id, raw);
}

/**
 * Flujo híbrido: el paciente tocó "Responder" en el template → le mandamos el
 * mensaje interactivo (botones/lista) con las opciones de su check-in pendiente.
 * Su toque abrió la ventana de 24 h, así que el interactivo se entrega bien.
 */
export async function sendOptionsForPhone(phone: string) {
  const entry = await findPendingEntryForPhone(phone);
  if (!entry) {
    return { ok: false as const, error: "Sin check-in pendiente para ese número" };
  }
  const phoneNum = entry.plan.patient.phone;
  if (!phoneNum) return { ok: false as const, error: "Sin teléfono" };

  const options = (entry.plan.optionsJson as string[] | null) ?? [];
  // greet=false: ya vieron el saludo en el template, acá solo van las opciones.
  const message = buildMessage(entry.plan.question, entry.plan.questionType, options, {
    greet: false,
  });
  const res = await getWhatsApp().send(phoneNum, message);
  return res.sent ? { ok: true as const } : { ok: false as const, error: res.error };
}
