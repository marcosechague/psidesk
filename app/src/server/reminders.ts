import "server-only";
import { prisma } from "@/lib/db";
import { getWhatsApp } from "@/lib/whatsapp";
import { logWhatsAppSent } from "./whatsappLog";
import { professionalName } from "@/lib/users";
import { featureEnabled, type FeatureFlags } from "@/lib/features";
import { getPlatformFlags } from "./queries";
import type { OutgoingMessage } from "@/lib/whatsapp/types";

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** Fecha/hora de la sesión en texto (idéntico en WhatsApp y email). */
function formatWhen(startsAt: Date): string {
  return startsAt.toLocaleString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Mensaje de recordatorio de cita (una vía, sin botones). Usa template si está
 * configurado (único modo válido fuera de la ventana de 24 h); si no, cae a
 * texto (útil en dev/mock). Variables del template: {{1}} paciente,
 * {{2}} profesional, {{3}} fecha/hora.
 */
function reminderMessage(
  patient: string,
  professional: string,
  when: string,
): OutgoingMessage {
  const name = process.env.WHATSAPP_REMINDER_TEMPLATE_NAME;
  if (name) {
    return {
      kind: "template",
      name,
      language: process.env.WHATSAPP_REMINDER_TEMPLATE_LANG ?? "es",
      bodyParams: [patient || "", professional || "Tu profesional", when],
    };
  }
  const prof = professional ? ` con ${professional}` : "";
  return {
    kind: "text",
    body: `Hola ${patient}, te recordamos tu sesión${prof}: ${when}.`
      .replace(/\s+/g, " ")
      .trim(),
  };
}

/**
 * Envía los recordatorios de sesión que vencen, SOLO por WhatsApp (paciente con
 * teléfono + consentimiento y función habilitada). Idempotente: marca
 * `reminderSentAt` para no reenviar. Devuelve cuántas sesiones notificó.
 */
export async function sendSessionReminders(now = new Date()): Promise<number> {
  const sessions = await prisma.session.findMany({
    where: {
      reminderOffsetMin: { not: null },
      reminderSentAt: null,
      status: "SCHEDULED",
      startsAt: { gte: now },
    },
    include: {
      user: {
        select: {
          name: true,
          firstName: true,
          lastName: true,
          prefix: true,
          featureEntitlements: true,
          featurePreferences: true,
        },
      },
      participants: {
        include: {
          patient: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              whatsappOptIn: true,
            },
          },
        },
      },
    },
  });

  const platformFlags = await getPlatformFlags();
  let count = 0;
  for (const s of sessions) {
    const remindAt = new Date(s.startsAt.getTime() - s.reminderOffsetMin! * 60_000);
    if (now < remindAt) continue;

    const when = formatWhen(s.startsAt);
    const professional = professionalName(s.user);
    // ¿El recordatorio por WhatsApp está habilitado para este psicólogo?
    const whatsappAllowed = featureEnabled(
      s.user.featureEntitlements as FeatureFlags,
      s.user.featurePreferences as FeatureFlags,
      "whatsappReminders",
      platformFlags,
    );
    // Sesiones de pareja → varios participantes.
    let sentAny = false;

    // Solo WhatsApp: paciente con teléfono + consentimiento y función habilitada.
    if (!whatsappAllowed) continue;
    for (const { patient } of s.participants) {
      if (!patient.phone || !patient.whatsappOptIn) continue;
      const msg = reminderMessage(firstNameOf(patient.fullName), professional, when);
      const res = await getWhatsApp().send(patient.phone, msg);
      if (res.sent) {
        await logWhatsAppSent({
          userId: s.userId,
          patientId: patient.id,
          type: "APPOINTMENT_REMINDER",
          sentAt: now,
          providerMessageId: res.providerMessageId,
          sessionId: s.id,
        });
        sentAny = true;
      }
    }

    if (sentAny) {
      await prisma.session.update({
        where: { id: s.id },
        data: { reminderSentAt: now },
      });
      count++;
    }
  }
  return count;
}

export type AppointmentEvent = "scheduled" | "rescheduled" | "canceled";

const EVENT_LABEL: Record<AppointmentEvent, string> = {
  scheduled: "agendó",
  rescheduled: "reprogramó",
  canceled: "canceló",
};

/** Mensaje de aviso de cita. Template si está configurado; si no, texto (dev). */
function appointmentMessage(
  eventLabel: string,
  patient: string,
  professional: string,
  when: string,
): OutgoingMessage {
  const name = process.env.WHATSAPP_APPOINTMENT_TEMPLATE_NAME;
  if (name) {
    return {
      kind: "template",
      name,
      language: process.env.WHATSAPP_APPOINTMENT_TEMPLATE_LANG ?? "es",
      // {{1}} paciente, {{2}} profesional, {{3}} acción (agendó/…), {{4}} fecha/hora
      bodyParams: [patient || "", professional || "Tu profesional", eventLabel, when],
    };
  }
  const prof = professional || "Tu profesional";
  return {
    kind: "text",
    body: `Hola ${patient}, ${prof} te ${eventLabel} una sesión: ${when}.`
      .replace(/\s+/g, " ")
      .trim(),
  };
}

/**
 * Aviso de cita por WhatsApp (agendada / reprogramada / cancelada). Se dispara
 * desde las actions de sesión (no por cron). Gateado por: la sesión tiene
 * `notifyPatient`, el psicólogo tiene `whatsappAppointments` habilitado, y la
 * cita es futura (no avisamos de sesiones pasadas, ej. cargadas a mano). Solo
 * WhatsApp: paciente con teléfono + consentimiento.
 */
export async function sendAppointmentNotice(
  sessionId: string,
  event: AppointmentEvent,
): Promise<void> {
  const s = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      userId: true,
      startsAt: true,
      notifyPatient: true,
      user: {
        select: {
          name: true,
          firstName: true,
          lastName: true,
          prefix: true,
          featureEntitlements: true,
          featurePreferences: true,
        },
      },
      participants: {
        select: {
          patient: {
            select: { id: true, fullName: true, phone: true, whatsappOptIn: true },
          },
        },
      },
    },
  });
  if (!s || !s.notifyPatient) return;
  // Solo citas futuras (evita avisar al cargar/editar sesiones pasadas).
  if (s.startsAt.getTime() <= Date.now()) return;
  const allowed = featureEnabled(
    s.user.featureEntitlements as FeatureFlags,
    s.user.featurePreferences as FeatureFlags,
    "whatsappAppointments",
    await getPlatformFlags(),
  );
  if (!allowed) return;

  const professional = professionalName(s.user);
  const when = formatWhen(s.startsAt);
  const label = EVENT_LABEL[event];

  for (const { patient } of s.participants) {
    if (!patient.phone || !patient.whatsappOptIn) continue;
    const msg = appointmentMessage(
      label,
      firstNameOf(patient.fullName),
      professional,
      when,
    );
    const res = await getWhatsApp().send(patient.phone, msg);
    if (res.sent) {
      await logWhatsAppSent({
        userId: s.userId,
        patientId: patient.id,
        type: "APPOINTMENT_NOTICE",
        sentAt: new Date(),
        providerMessageId: res.providerMessageId,
        sessionId,
      });
    }
  }
}
