import "server-only";
import { prisma } from "@/lib/db";
import { getWhatsApp } from "@/lib/whatsapp";
import { logWhatsAppSent } from "./whatsappLog";
import { professionalName } from "@/lib/users";
import { featureEnabled, type FeatureFlags } from "@/lib/features";
import { getPlatformFlags } from "./queries";
import type { OutgoingMessage } from "@/lib/whatsapp/types";
import type { WhatsAppMessageType } from "@prisma/client";

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3001";
}

/** Fecha del deadline en texto (sin hora). */
function formatDue(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const DAY_MS = 86_400_000;

// Campos del psicólogo para el nombre + flags de feature.
const userSelect = {
  name: true,
  firstName: true,
  lastName: true,
  prefix: true,
  featureEntitlements: true,
  featurePreferences: true,
} as const;

const patientSelect = {
  id: true,
  userId: true,
  fullName: true,
  phone: true,
  whatsappOptIn: true,
  user: { select: userSelect },
} as const;

type PatientRow = {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  whatsappOptIn: boolean;
  user: {
    name: string;
    firstName: string | null;
    lastName: string | null;
    prefix: string | null;
    featureEntitlements: unknown;
    featurePreferences: unknown;
  };
};

/** Mensaje "test asignado". Template si está configurado; si no, texto. */
function assignedMessage(
  patient: string,
  professional: string,
  testName: string,
  link: string,
): OutgoingMessage {
  const name = process.env.WHATSAPP_TEST_ASSIGNED_TEMPLATE_NAME;
  if (name) {
    return {
      kind: "template",
      name,
      language: process.env.WHATSAPP_TEST_ASSIGNED_TEMPLATE_LANG ?? "es",
      // {{1}} paciente, {{2}} profesional, {{3}} test, {{4}} link
      bodyParams: [patient || "", professional || "Tu profesional", testName, link],
    };
  }
  return {
    kind: "text",
    body:
      `Hola ${patient}, ${professional || "Tu profesional"} te asignó el test "${testName}". ` +
      `Completalo acá: ${link}`,
  };
}

/** Mensaje "recordatorio de test". Template si está configurado; si no, texto. */
function reminderMessage(
  patient: string,
  professional: string,
  testName: string,
  dueStr: string,
  link: string,
): OutgoingMessage {
  const name = process.env.WHATSAPP_TEST_REMINDER_TEMPLATE_NAME;
  if (name) {
    return {
      kind: "template",
      name,
      language: process.env.WHATSAPP_TEST_REMINDER_TEMPLATE_LANG ?? "es",
      // {{1}} paciente, {{2}} profesional, {{3}} test, {{4}} deadline, {{5}} link
      bodyParams: [
        patient || "",
        professional || "Tu profesional",
        testName,
        dueStr,
        link,
      ],
    };
  }
  return {
    kind: "text",
    body:
      `Hola ${patient}, te recordamos completar el test "${testName}" antes del ${dueStr}. ` +
      `Respondé acá: ${link}`,
  };
}

/**
 * Entrega un mensaje al paciente SOLO por WhatsApp: requiere que la función
 * (whatsappTests) esté habilitada y el paciente tenga teléfono + consentimiento.
 * Devuelve si se entregó.
 */
async function deliverToPatient(opts: {
  patient: PatientRow;
  platform: FeatureFlags;
  message: OutgoingMessage;
  type: WhatsAppMessageType;
}): Promise<boolean> {
  const { patient, platform, message, type } = opts;
  const whatsappAllowed = featureEnabled(
    patient.user.featureEntitlements as FeatureFlags,
    patient.user.featurePreferences as FeatureFlags,
    "whatsappTests",
    platform,
  );
  if (!whatsappAllowed || !patient.phone || !patient.whatsappOptIn) return false;

  const res = await getWhatsApp().send(patient.phone, message);
  if (!res.sent) return false;
  await logWhatsAppSent({
    userId: patient.userId,
    patientId: patient.id,
    type,
    sentAt: new Date(),
    providerMessageId: res.providerMessageId,
  });
  return true;
}

/**
 * Aviso "test asignado" (lo dispara createAssignment). Gateado por
 * `notifyOnAssign`. WhatsApp con respaldo a email; incluye el link del test.
 */
export async function sendTestAssignedNotice(assignmentId: string): Promise<void> {
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      token: true,
      notifyOnAssign: true,
      patient: { select: patientSelect },
      test: { select: { name: true } },
    },
  });
  if (!a || !a.notifyOnAssign) return;

  const platform = await getPlatformFlags();
  const link = `${baseUrl()}/r/${a.token}`;
  const professional = professionalName(a.patient.user);
  const message = assignedMessage(
    firstNameOf(a.patient.fullName),
    professional,
    a.test.name,
    link,
  );
  await deliverToPatient({
    patient: a.patient as PatientRow,
    platform,
    message,
    type: "TEST_ASSIGNED",
  });
}

/**
 * Recordatorios de tests con deadline aún PENDIENTES. Manda cada offset
 * configurado (`reminderOffsetsDays`) una sola vez (marca `remindersSentDays`).
 * WhatsApp con respaldo a email. Devuelve cuántas asignaciones notificó.
 */
export async function sendDueTestReminders(now = new Date()): Promise<number> {
  const assignments = await prisma.assignment.findMany({
    where: { status: "PENDING", dueDate: { not: null } },
    select: {
      id: true,
      token: true,
      dueDate: true,
      reminderOffsetsDays: true,
      remindersSentDays: true,
      patient: { select: patientSelect },
      test: { select: { name: true } },
    },
  });

  const platform = await getPlatformFlags();
  let count = 0;

  for (const a of assignments) {
    if (!a.reminderOffsetsDays.length) continue;
    const due = a.dueDate!;
    const sent = new Set(a.remindersSentDays);
    const link = `${baseUrl()}/r/${a.token}`;
    const professional = professionalName(a.patient.user);
    const patientFirst = firstNameOf(a.patient.fullName);
    const dueStr = formatDue(due);
    let changed = false;

    for (const offset of a.reminderOffsetsDays) {
      if (sent.has(offset)) continue;
      const remindAt = new Date(due.getTime() - offset * DAY_MS);
      if (now < remindAt) continue;

      const delivered = await deliverToPatient({
        patient: a.patient as PatientRow,
        platform,
        message: reminderMessage(patientFirst, professional, a.test.name, dueStr, link),
        type: "TEST_REMINDER",
      });
      if (delivered) {
        sent.add(offset);
        changed = true;
      }
    }

    if (changed) {
      await prisma.assignment.update({
        where: { id: a.id },
        data: { remindersSentDays: [...sent] },
      });
      count++;
    }
  }
  return count;
}
