"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/db";
import { signIn, signOut } from "@/auth";
import { requireUserId, requireSuperAdmin } from "./session";
import { setImpersonation, clearImpersonation } from "./impersonation";
import { sendAppointmentNotice } from "./reminders";
import { sendTestAssignedNotice } from "./testReminders";
import { generatePublicToken } from "@/lib/tokens";
import { patientFullName } from "@/lib/patients";
import { getStorage, type StorageDriverName } from "@/lib/storage";
import { scoreTest } from "@/lib/scoring/scoreTest";
import type { ScoringConfig } from "@/lib/scoring/types";
import {
  normalizeItems,
  itemMaxMap,
  itemValuesMap,
} from "@/lib/testItems";
import {
  adminCreateUserSchema,
  resetPasswordSchema,
  adminSetBillingSchema,
  adminSetFeaturesSchema,
  featurePreferencesSchema,
  adminSetPlatformFlagsSchema,
  adminSetAiSettingsSchema,
  diagnosisSchema,
  manualResultSchema,
  editManualResultSchema,
  externalTestSchema,
  changePasswordSchema,
  profileSchema,
  patientSchema,
  assignmentSchema,
  sessionSchema,
  blockSchema,
  groupSchema,
  availabilitySchema,
  SESSION_STATUS,
  testSchema,
  checkinPlanSchema,
  MAX_ATTACHMENT_BYTES,
  ALLOWED_ATTACHMENT_TYPES,
  buildAnswersSchema,
  processMotivoLabel,
  type AdminCreateUserInput,
  type ResetPasswordInput,
  type AdminSetBillingInput,
  type AdminSetFeaturesInput,
  type FeaturePreferencesInput,
  type AdminSetPlatformFlagsInput,
  type AdminSetAiSettingsInput,
  type DiagnosisInput,
  type ManualResultInput,
  type EditManualResultInput,
  type ExternalTestInput,
  type ChangePasswordInput,
  type ProfileInput,
  type PatientInput,
  type AssignmentInput,
  type SessionInput,
  type BlockInput,
  type GroupInput,
  type AvailabilityInput,
  type TestInput,
  type CheckinPlanInput,
  noteTemplateSchema,
  type NoteTemplateInput,
  writingVoiceSchema,
  type WritingVoiceInput,
} from "@/lib/validations";
import { FEATURE_KEYS } from "@/lib/features";
import { normalizeAvailability } from "@/lib/availability";
import { zonedInstant, addDays as addLocalDays, type LocalDate } from "@/lib/checkins";
import { TIMEZONE } from "@/lib/format";
import { getAiDriver } from "@/lib/ai";
import { userFeatureEnabled, getAiSettings, markResultReviewed } from "./queries";
import { topicLabel } from "@/lib/sessionLabels";
import { getWhatsApp } from "@/lib/whatsapp";
import { logWhatsAppSent } from "./whatsappLog";
import { professionalName } from "@/lib/users";
import type { LevelTone } from "@/lib/scoring/types";
import {
  sendCheckinForPlan,
  recordReplyForEntry,
  generatePlanEntries,
} from "./checkins";
import { Prisma } from "@prisma/client";
import type { CheckinPlanStatus } from "@prisma/client";

// ── Administración de psicólogos (solo super admin) ───────────────────────

/** Alta de un psicólogo por parte del super admin. No inicia sesión. */
export async function adminCreatePsychologist(
  input: AdminCreateUserInput,
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const parsed = adminCreateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { firstName, lastName, prefix, specialties, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Ya existe una cuenta con ese email" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      role: "PSYCHOLOGIST",
      active: true,
      // contraseña temporal: el psicólogo debe cambiarla al ingresar
      mustChangePassword: true,
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      prefix: prefix || null,
      specialties: specialties ?? [],
      email,
      passwordHash,
    },
  });

  revalidatePath("/admin");
  return {};
}

/** Suspende o reactiva la cuenta de un psicólogo. */
export async function adminSetActive(
  userId: string,
  active: boolean,
): Promise<{ error?: string }> {
  const adminId = await requireSuperAdmin();
  if (userId === adminId) {
    return { error: "No podés suspender tu propia cuenta" };
  }
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "Usuario no encontrado" };
  if (target.role === "SUPER_ADMIN") {
    return { error: "No se puede suspender a un administrador" };
  }

  await prisma.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/admin");
  return {};
}

/** Resetea la contraseña de un psicólogo (la define el admin). */
export async function adminResetPassword(
  input: ResetPasswordInput,
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { userId, password } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "Usuario no encontrado" };
  if (target.role === "SUPER_ADMIN") {
    return { error: "No se puede cambiar la contraseña de un administrador" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: userId },
    // contraseña temporal: debe cambiarla en el próximo ingreso
    data: { passwordHash, mustChangePassword: true },
  });
  revalidatePath("/admin");
  return {};
}

/**
 * Define el estado comercial de un psicólogo (beta/prueba/activo/vencido) y su
 * vencimiento. Informativo: no corta el acceso (eso lo hace `active`).
 */
export async function adminSetBilling(
  input: AdminSetBillingInput,
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const parsed = adminSetBillingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { userId, status, until } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "Usuario no encontrado" };
  if (target.role === "SUPER_ADMIN") {
    return { error: "El administrador no tiene estado comercial" };
  }

  // "YYYY-MM-DD" → medianoche UTC; vacío = sin vencimiento
  const billingUntil = until ? new Date(`${until}T00:00:00.000Z`) : null;
  if (until && Number.isNaN(billingUntil!.getTime())) {
    return { error: "Fecha de vencimiento inválida" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { billingStatus: status, billingUntil },
  });
  revalidatePath("/admin");
  return {};
}

/** Deja solo las claves de funciones conocidas con valor booleano. */
function sanitizeFlags(input: Record<string, unknown>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const k of FEATURE_KEYS) {
    if (typeof input[k] === "boolean") out[k] = input[k] as boolean;
  }
  return out;
}

/**
 * Habilita/deshabilita funciones de un psicólogo (nivel 1: entitlement).
 * Si el admin apaga una función, el psicólogo ni la ve.
 */
export async function adminSetFeatureEntitlements(
  input: AdminSetFeaturesInput,
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const parsed = adminSetFeaturesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
  if (!target) return { error: "Usuario no encontrado" };
  if (target.role === "SUPER_ADMIN") {
    return { error: "El administrador no usa funciones" };
  }
  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { featureEntitlements: sanitizeFlags(parsed.data.entitlements) },
  });
  revalidatePath("/admin");
  return {};
}

/**
 * Interruptores maestros de la plataforma (super admin). Apagar una función acá
 * la deshabilita para TODOS los psicólogos, sin importar entitlement/preferencia.
 */
export async function adminSetPlatformFlags(
  input: AdminSetPlatformFlagsInput,
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const parsed = adminSetPlatformFlagsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const flags = sanitizeFlags(parsed.data.flags);
  await prisma.platformSettings.upsert({
    where: { id: "platform" },
    create: { id: "platform", featureFlags: flags },
    update: { featureFlags: flags },
  });
  revalidatePath("/admin/funciones");
  revalidatePath("/admin");
  return {};
}

/**
 * Configura el proveedor/modelo de IA para el resumen (super admin). Las claves
 * NO se guardan acá: viven en variables de entorno (son secretos).
 */
export async function adminSetAiSettings(
  input: AdminSetAiSettingsInput,
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const parsed = adminSetAiSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const aiModel = parsed.data.aiModel?.trim() || null;
  await prisma.platformSettings.upsert({
    where: { id: "platform" },
    create: { id: "platform", aiProvider: parsed.data.aiProvider, aiModel },
    update: { aiProvider: parsed.data.aiProvider, aiModel },
  });
  revalidatePath("/admin/ia");
  revalidatePath("/admin");
  return {};
}

/**
 * El propio psicólogo prende/apaga las funciones que el admin le habilitó
 * (nivel 2: preferencia). Una preferencia sobre algo no habilitado no tiene
 * efecto (manda el entitlement).
 */
export async function setMyFeaturePreferences(
  input: FeaturePreferencesInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = featurePreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { featurePreferences: sanitizeFlags(parsed.data.preferences) },
  });
  revalidatePath("/perfil");
  return {};
}

/**
 * Cambia la propia contraseña del usuario logueado y limpia la marca de
 * cambio obligatorio. Se usa en el primer ingreso (alta/reset del admin).
 */
export async function changeOwnPassword(
  input: ChangePasswordInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
  return {};
}

/**
 * El super admin empieza a ver la app COMO un psicólogo (soporte). Setea la
 * cookie de impersonación y manda al inicio (ya verá su dashboard).
 */
export async function startImpersonation(
  userId: string,
): Promise<{ error?: string }> {
  await requireSuperAdmin();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "Usuario no encontrado" };
  if (target.role !== "PSYCHOLOGIST") {
    return { error: "Solo se puede entrar como psicólogo" };
  }
  await setImpersonation(userId);
  redirect("/");
}

/** Termina la impersonación y vuelve al panel de administración. */
export async function stopImpersonation(): Promise<void> {
  await clearImpersonation();
  redirect("/admin");
}

/** Elimina la cuenta de un psicólogo y sus datos asociados (cascada). */
export async function adminDeleteUser(
  userId: string,
): Promise<{ error?: string }> {
  const adminId = await requireSuperAdmin();
  if (userId === adminId) {
    return { error: "No podés eliminar tu propia cuenta" };
  }
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "Usuario no encontrado" };
  if (target.role === "SUPER_ADMIN") {
    return { error: "No se puede eliminar a un administrador" };
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
  return {};
}

export async function authenticate(
  input: { email: string; password: string },
): Promise<{ error?: string }> {
  try {
    await signIn("credentials", { ...input, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email o contraseña incorrectos" };
    }
    throw error;
  }
  return {};
}

/** Actualiza el perfil del profesional logueado (nombre, prefijo, especialidades). */
export async function updateProfile(
  input: ProfileInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { firstName, lastName, prefix, specialties } = parsed.data;
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: `${firstName} ${lastName}`,
      firstName,
      lastName,
      prefix: prefix || null,
      specialties: specialties ?? [],
    },
  });
  revalidatePath("/perfil");
  return {};
}

// ── Pacientes ───────────────────────────────────────────────────────────
/**
 * Crea un paciente del psicólogo (con su proceso ACTIVO inicial) y devuelve el
 * registro creado. Sin redirect ni revalidación: lo usan tanto el alta completa
 * como el quick-create inline del form de sesión.
 */
async function persistPatient(userId: string, data: PatientInput) {
  const {
    email,
    phone,
    motivoConsulta,
    motivoCategoria,
    firstName,
    lastName,
    birthDate,
    ...rest
  } = data;
  return prisma.patient.create({
    data: {
      userId,
      ...rest,
      firstName,
      lastName,
      fullName: patientFullName({ firstName, lastName }),
      birthDate: birthDate ? new Date(birthDate) : null,
      email: email || null,
      phone: phone || null,
      // Todo paciente nuevo arranca con un proceso terapéutico ACTIVO (queda
      // "En curso"); el motivo (categoría + narrativa) es opcional para pre-cargarlo.
      processes: {
        create: {
          motivo: motivoConsulta?.trim() || null,
          motivoCategory: motivoCategoria || null,
        },
      },
    },
    include: {
      processes: {
        where: { status: "ACTIVE" },
        orderBy: { startedAt: "desc" },
        take: 1,
        select: { id: true, motivo: true, motivoCategory: true },
      },
    },
  });
}

export async function createPatient(
  input: PatientInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = patientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const patient = await persistPatient(userId, parsed.data);

  revalidatePath("/pacientes");
  redirect(`/pacientes/${patient.id}`);
}

/**
 * Alta rápida de paciente desde el form de sesión (sin salir del popup).
 * Devuelve el paciente ya con su tratamiento activo para seleccionarlo al toque.
 */
export async function quickCreatePatient(input: PatientInput): Promise<{
  patient?: { id: string; fullName: string; activeProcess: { id: string; label: string | null } | null };
  error?: string;
}> {
  const userId = await requireUserId();
  const parsed = patientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const patient = await persistPatient(userId, parsed.data);
  const active = patient.processes[0];

  revalidatePath("/pacientes");
  revalidatePath("/agenda");
  revalidatePath("/sesiones");
  return {
    patient: {
      id: patient.id,
      fullName: patient.fullName,
      activeProcess: active
        ? { id: active.id, label: processMotivoLabel(active) }
        : null,
    },
  };
}

/** Edita los datos de un paciente existente (verifica propiedad). */
export async function updatePatient(
  patientId: string,
  input: PatientInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = patientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const existing = await prisma.patient.findFirst({
    where: { id: patientId, userId },
    select: { id: true },
  });
  if (!existing) return { error: "Paciente no encontrado" };

  // motivoConsulta no se edita acá (se maneja como lista aparte).
  const { firstName, lastName, email, phone, whatsappOptIn, birthDate, sex, maritalStatus } =
    parsed.data;
  await prisma.patient.update({
    where: { id: patientId },
    data: {
      firstName,
      lastName,
      fullName: patientFullName({ firstName, lastName }),
      whatsappOptIn,
      birthDate: birthDate ? new Date(birthDate) : null,
      sex,
      maritalStatus,
      email: email || null,
      phone: phone || null,
    },
  });

  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${patientId}`);
  return {};
}

// ── Procesos terapéuticos + notas clínicas ─────────────────────────────────
/** Devuelve el proceso activo del paciente; si no hay, crea uno. */
async function ensureActiveProcess(patientId: string): Promise<string> {
  const active = await prisma.process.findFirst({
    where: { patientId, status: "ACTIVE" },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (active) return active.id;
  const created = await prisma.process.create({
    data: { patientId },
    select: { id: true },
  });
  return created.id;
}

/**
 * Decide a qué tratamiento (Process) se engancha cada participante de la sesión.
 * - Individual (1 paciente): según `treatmentMode` elegido en el form:
 *   "active" = tratamiento en curso (se crea si no hay); "new" = cierra el activo
 *   y abre uno nuevo con el motivo; "none" = consulta puntual (sin tratamiento).
 * - Pareja/familia (2+): cada uno a su tratamiento activo (se crea si no hay).
 * Asume que la propiedad de los pacientes ya fue validada por el llamador.
 */
async function resolveSessionProcesses(
  participantIds: string[],
  data: {
    treatmentMode?: "active" | "new" | "none";
    treatmentMotivoCategoria?: string;
    treatmentMotivoConsulta?: string;
  },
): Promise<Map<string, string>> {
  const byPatient = new Map<string, string>();

  if (participantIds.length === 1) {
    const pid = participantIds[0];
    const mode = data.treatmentMode ?? "active";
    if (mode === "none") return byPatient;
    if (mode === "new") {
      // Regla de negocio: máx. 1 tratamiento activo. Cierra el actual y abre el nuevo.
      await prisma.process.updateMany({
        where: { patientId: pid, status: "ACTIVE" },
        data: { status: "ENDED", endedAt: new Date() },
      });
      const created = await prisma.process.create({
        data: {
          patientId: pid,
          motivo: data.treatmentMotivoConsulta?.trim() || null,
          motivoCategory: data.treatmentMotivoCategoria || null,
        },
        select: { id: true },
      });
      byPatient.set(pid, created.id);
      return byPatient;
    }
    byPatient.set(pid, await ensureActiveProcess(pid));
    return byPatient;
  }

  for (const pid of participantIds) {
    byPatient.set(pid, await ensureActiveProcess(pid));
  }
  return byPatient;
}

/** Crea un nuevo proceso terapéutico (re-consulta). */
export async function createProcess(
  patientId: string,
  motivo?: string,
  motivoCategory?: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId },
    select: { id: true },
  });
  if (!patient) return { error: "Paciente no encontrado" };
  // Regla de negocio: máximo un proceso activo por paciente.
  const existingActive = await prisma.process.findFirst({
    where: { patientId, status: "ACTIVE" },
    select: { id: true },
  });
  if (existingActive) {
    return {
      error: "El paciente ya tiene un tratamiento en curso. Dale de alta antes de abrir uno nuevo.",
    };
  }
  await prisma.process.create({
    data: {
      patientId,
      motivo: motivo?.trim() || null,
      motivoCategory: motivoCategory || null,
    },
  });
  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/pacientes");
  return {};
}

/** Da de alta (cierra) o reabre un proceso. */
export async function setProcessStatus(
  processId: string,
  ended: boolean,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const process = await prisma.process.findFirst({
    where: { id: processId, patient: { userId } },
    select: { id: true, patientId: true },
  });
  if (!process) return { error: "Tratamiento no encontrado" };
  // Regla de negocio: máximo un proceso activo por paciente (al reabrir).
  if (!ended) {
    const otherActive = await prisma.process.findFirst({
      where: { patientId: process.patientId, status: "ACTIVE", id: { not: processId } },
      select: { id: true },
    });
    if (otherActive) {
      return {
        error: "El paciente ya tiene un tratamiento en curso. Dale de alta antes de reabrir este.",
      };
    }
  }
  await prisma.process.update({
    where: { id: processId },
    data: {
      status: ended ? "ENDED" : "ACTIVE",
      endedAt: ended ? new Date() : null,
    },
  });
  revalidatePath(`/pacientes/${process.patientId}`);
  revalidatePath("/pacientes");
  return {};
}

/** Edita el motivo de consulta de un proceso (categoría + narrativa). */
export async function updateProcessMotivo(
  processId: string,
  motivo: string,
  motivoCategory?: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const process = await prisma.process.findFirst({
    where: { id: processId, patient: { userId } },
    select: { id: true, patientId: true },
  });
  if (!process) return { error: "Tratamiento no encontrado" };
  await prisma.process.update({
    where: { id: processId },
    data: { motivo: motivo.trim() || null, motivoCategory: motivoCategory || null },
  });
  revalidatePath(`/pacientes/${process.patientId}`);
  return {};
}

/** Elimina un proceso (las sesiones/tests quedan sin proceso asociado). */
export async function deleteProcess(
  processId: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const process = await prisma.process.findFirst({
    where: { id: processId, patient: { userId } },
    select: { id: true, patientId: true },
  });
  if (!process) return { error: "Tratamiento no encontrado" };
  await prisma.process.delete({ where: { id: processId } });
  revalidatePath(`/pacientes/${process.patientId}`);
  revalidatePath("/pacientes");
  return {};
}

/**
 * Ficha clínica estructurada (anamnesis): bloques estables del paciente,
 * transversales a los tratamientos. El detalle por sesión, el motivo y el
 * diagnóstico viven en sus propias secciones, NO acá.
 */
export interface ClinicalRecordData {
  /** factores de riesgo: ideación suicida, autolesión, riesgo a terceros */
  risk?: string;
  /** antecedentes personales (psicológicos/psiquiátricos, médicos relevantes) */
  personalHistory?: string;
  /** medicación actual y psiquiatra tratante */
  medication?: string;
  /** antecedentes familiares (salud mental en la familia) */
  familyHistory?: string;
  /** historia personal (desarrollo, familia, educación/trabajo, social, consumo) */
  lifeHistory?: string;
  /** fortalezas y red de apoyo */
  strengths?: string;
  /** notas generales (acá migra el campo libre legacy clinicalNotes) */
  notes?: string;
}

/** Orden y claves de los bloques de la ficha clínica. */
const CLINICAL_RECORD_FIELDS = [
  "risk",
  "personalHistory",
  "medication",
  "familyHistory",
  "lifeHistory",
  "strengths",
  "notes",
] as const;

const clinicalRecordSchema = z.object({
  risk: z.string().trim().max(5000).optional(),
  personalHistory: z.string().trim().max(5000).optional(),
  medication: z.string().trim().max(5000).optional(),
  familyHistory: z.string().trim().max(5000).optional(),
  lifeHistory: z.string().trim().max(5000).optional(),
  strengths: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(5000).optional(),
});

/** Guarda la ficha clínica estructurada del paciente (autosave). */
export async function savePatientClinicalRecord(
  patientId: string,
  input: ClinicalRecordData,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = clinicalRecordSchema.safeParse(input);
  if (!parsed.success) return { error: "Datos inválidos" };

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId },
    select: { id: true },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  const record: Record<string, string> = {};
  for (const k of CLINICAL_RECORD_FIELDS) {
    const v = parsed.data[k];
    if (v) record[k] = v;
  }

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      clinicalRecordJson:
        Object.keys(record).length > 0
          ? (record as Prisma.InputJsonValue)
          : Prisma.DbNull,
      // ya migrado a la ficha estructurada: retiramos el campo libre legacy
      clinicalNotes: null,
    },
  });
  revalidatePath(`/pacientes/${patientId}`);
  return {};
}

/** Guarda el horario de atención semanal del psicólogo. */
export async function updateAvailability(
  input: AvailabilityInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      availability: normalizeAvailability(
        parsed.data.availability,
      ) as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/perfil");
  revalidatePath("/agenda");
  return {};
}

// ── Grupos de pacientes ───────────────────────────────────────────────────

/** Crea un grupo (nombre + 2+ pacientes del psicólogo). */
export async function createGroup(
  input: GroupInput,
): Promise<{ id?: string; error?: string }> {
  const userId = await requireUserId();
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const patientIds = [...new Set(parsed.data.patientIds)];
  if (patientIds.length < 2) {
    return { error: "Un grupo necesita al menos 2 pacientes" };
  }
  if (!(await ownsAllPatients(userId, patientIds))) {
    return { error: "Paciente no encontrado" };
  }
  const group = await prisma.patientGroup.create({
    data: {
      userId,
      name: parsed.data.name.trim(),
      members: { create: patientIds.map((patientId) => ({ patientId })) },
    },
    select: { id: true },
  });
  revalidatePath("/pacientes");
  return { id: group.id };
}

/** Edita un grupo (nombre + miembros). Reconcilia la lista de miembros. */
export async function updateGroup(
  groupId: string,
  input: GroupInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const group = await prisma.patientGroup.findFirst({
    where: { id: groupId, userId },
    select: { id: true },
  });
  if (!group) return { error: "Grupo no encontrado" };

  const patientIds = [...new Set(parsed.data.patientIds)];
  if (patientIds.length < 2) {
    return { error: "Un grupo necesita al menos 2 pacientes" };
  }
  if (!(await ownsAllPatients(userId, patientIds))) {
    return { error: "Paciente no encontrado" };
  }

  // Reconciliar miembros: borrar todos y recrear (simple, sin datos colgando).
  await prisma.$transaction([
    prisma.patientGroupMember.deleteMany({ where: { groupId } }),
    prisma.patientGroup.update({
      where: { id: groupId },
      data: {
        name: parsed.data.name.trim(),
        members: { create: patientIds.map((patientId) => ({ patientId })) },
      },
    }),
  ]);
  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/grupos/${groupId}`);
  return {};
}

/** Elimina un grupo. Las sesiones quedan (se desvinculan: groupId → null). */
export async function deleteGroup(
  groupId: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const group = await prisma.patientGroup.findFirst({
    where: { id: groupId, userId },
    select: { id: true },
  });
  if (!group) return { error: "Grupo no encontrado" };
  await prisma.patientGroup.delete({ where: { id: groupId } });
  revalidatePath("/pacientes");
  return {};
}

// ── Sesiones (cita + notas + motivo, unificado) ───────────────────────────
/** Construye los campos comunes de una sesión a partir del input validado. */
function buildSessionData(data: SessionInput) {
  // data.date "aaaa-mm-dd" + data.time "HH:MM" se interpretan como hora de pared
  // de Asunción (no la del servidor, que en Docker corre en UTC).
  const [y, mo, d] = data.date.split("-").map(Number);
  const startsAt = zonedInstant({ year: y, month: mo, day: d }, data.time, TIMEZONE);
  if (Number.isNaN(startsAt.getTime())) return null;
  return {
    title: data.title?.trim() || null,
    startsAt,
    durationMin: data.durationMin,
    status: data.status,
    topic: data.topic || null,
    topicOther: data.topic === "otro" ? data.topicOther?.trim() || null : null,
    // Las notas clínicas (observaciones/objetivos/próximos pasos) NO se tocan acá:
    // viven en el workspace de la sesión (saveSessionNotes). El form solo agenda.
    reminderOffsetMin: data.reminderOffsetMin ?? null,
    notifyPatient: data.notifyPatient ?? true,
    groupId: data.groupId || null,
  };
}

/** Si el groupId no pertenece al psicólogo, lo descarta (devuelve null). */
async function validGroupId(
  userId: string,
  groupId: string | null,
): Promise<string | null> {
  if (!groupId) return null;
  const g = await prisma.patientGroup.findFirst({
    where: { id: groupId, userId },
    select: { id: true },
  });
  return g ? groupId : null;
}

/**
 * Busca una sesión del psicólogo que se superponga en horario con
 * [startsAt, startsAt+durationMin). Ignora canceladas/no-asistió (no ocupan) y
 * la propia sesión (al editar). Devuelve un texto descriptivo o null.
 */
async function findOverlap(
  userId: string,
  startsAt: Date,
  durationMin: number,
  excludeId?: string,
): Promise<string | null> {
  const nStart = startsAt.getTime();
  const nEnd = nStart + durationMin * 60_000;
  // Ventana acotada: cualquier sesión que arranque hasta 12h antes podría seguir
  // corriendo sobre el inicio nuevo; y hasta el fin nuevo.
  const candidates = await prisma.session.findMany({
    where: {
      userId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      status: { notIn: ["CANCELED", "NO_SHOW"] },
      startsAt: {
        gte: new Date(nStart - 12 * 60 * 60_000),
        lt: new Date(nEnd),
      },
    },
    select: {
      startsAt: true,
      durationMin: true,
      title: true,
      participants: { select: { patient: { select: { fullName: true } } } },
    },
  });
  for (const c of candidates) {
    const cStart = c.startsAt.getTime();
    const cEnd = cStart + c.durationMin * 60_000;
    if (cStart < nEnd && cEnd > nStart) {
      const label =
        c.participants.map((p) => p.patient.fullName).join(", ") ||
        c.title ||
        "otra sesión";
      const time = c.startsAt.toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${label} a las ${time}`;
    }
  }
  return null;
}

/** Verifica que todos los ids sean pacientes del psicólogo. */
async function ownsAllPatients(
  userId: string,
  patientIds: string[],
): Promise<boolean> {
  if (patientIds.length === 0) return true;
  const count = await prisma.patient.count({
    where: { id: { in: patientIds }, userId },
  });
  return count === patientIds.length;
}

/** Revalida la agenda, el dashboard, /sesiones y la ficha de cada paciente. */
function revalidateSession(patientIds: string[]) {
  revalidatePath("/agenda");
  revalidatePath("/sesiones");
  revalidatePath("/");
  for (const pid of patientIds) revalidatePath(`/pacientes/${pid}`);
}

export async function createSession(
  input: SessionInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const participantIds = [...new Set(parsed.data.participantIds)];

  if (!(await ownsAllPatients(userId, participantIds))) {
    return { error: "Paciente no encontrado" };
  }

  const fields = buildSessionData(parsed.data);
  if (!fields) return { error: "Fecha u hora inválida" };
  fields.groupId = await validGroupId(userId, fields.groupId);

  // Bloquear solapamiento con otra sesión (salvo que esta nazca cancelada/no-show).
  if (fields.status !== "CANCELED" && fields.status !== "NO_SHOW") {
    const clash = await findOverlap(userId, fields.startsAt, fields.durationMin);
    if (clash) return { error: `Se superpone con otra sesión: ${clash}.` };
  }

  // Cada participante se engancha a un tratamiento (Process) según lo elegido en
  // el form; una consulta puntual queda sin vincular.
  const processByPatient = await resolveSessionProcesses(participantIds, parsed.data);

  const created = await prisma.session.create({
    data: {
      userId,
      ...fields,
      participants: {
        create: participantIds.map((patientId) => ({
          patientId,
          processId: processByPatient.get(patientId) ?? null,
        })),
      },
    },
    select: { id: true },
  });

  // Aviso "cita agendada" (gateado por feature + notifyPatient + futura).
  await sendAppointmentNotice(created.id, "scheduled");

  revalidateSession(participantIds);
  return {};
}

// Bloqueo "todo el día": cubre la franja visible del calendario (7:00–22:00).
const BLOCK_ALL_DAY_TIME = "07:00";
const BLOCK_ALL_DAY_MIN = 15 * 60;
const BLOCK_MAX_DAYS = 92; // tope del rango para no crear miles de filas

/**
 * Crea un bloqueo de horario (evento sin paciente): un día o un rango. En un
 * rango se guarda un Session por día. No valida solapamientos: un bloqueo es
 * informativo y puede convivir con sesiones.
 */
export async function createBlock(
  input: BlockInput,
): Promise<{ error?: string; count?: number }> {
  const userId = await requireUserId();
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  const allDay = d.allDay ?? false;
  const time = allDay ? BLOCK_ALL_DAY_TIME : (d.time as string);
  const durationMin = allDay ? BLOCK_ALL_DAY_MIN : (d.durationMin as number);
  const title = d.title.trim();

  const toLocal = (s: string): LocalDate | null => {
    const [y, mo, day] = s.split("-").map(Number);
    if (!y || !mo || !day) return null;
    return { year: y, month: mo, day };
  };
  const start = toLocal(d.startDate);
  const end = d.endDate ? toLocal(d.endDate) : start;
  if (!start || !end) return { error: "Fecha inválida" };

  // Días del rango (inclusive).
  const days: LocalDate[] = [];
  let cur = start;
  for (let i = 0; i < 366; i++) {
    days.push(cur);
    if (cur.year === end.year && cur.month === end.month && cur.day === end.day) {
      break;
    }
    cur = addLocalDays(cur, 1);
  }
  if (days.length > BLOCK_MAX_DAYS) {
    return { error: "El rango es muy largo (máximo 3 meses)." };
  }

  const rows = days
    .map((ld) => ({
      userId,
      title,
      startsAt: zonedInstant(ld, time, TIMEZONE),
      durationMin,
      status: "SCHEDULED" as const,
      reminderOffsetMin: null,
    }))
    .filter((r) => !Number.isNaN(r.startsAt.getTime()));
  if (rows.length === 0) return { error: "Fecha u hora inválida" };

  await prisma.session.createMany({ data: rows });
  revalidateSession([]);
  return { count: rows.length };
}

export async function updateSession(
  sessionId: string,
  input: SessionInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existing = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      startsAt: true,
      participants: { select: { patientId: true } },
    },
  });
  if (!existing) return { error: "Sesión no encontrada" };

  const participantIds = [...new Set(parsed.data.participantIds)];
  if (!(await ownsAllPatients(userId, participantIds))) {
    return { error: "Paciente no encontrado" };
  }

  const fields = buildSessionData(parsed.data);
  if (!fields) return { error: "Fecha u hora inválida" };
  fields.groupId = await validGroupId(userId, fields.groupId);

  // Bloquear solapamiento (excluyendo esta misma sesión; salvo cancelada/no-show).
  if (fields.status !== "CANCELED" && fields.status !== "NO_SHOW") {
    const clash = await findOverlap(
      userId,
      fields.startsAt,
      fields.durationMin,
      sessionId,
    );
    if (clash) return { error: `Se superpone con otra sesión: ${clash}.` };
  }

  // Reconciliar participantes preservando las notas individuales de los que quedan.
  const existingIds = existing.participants.map((p) => p.patientId);
  const toAdd = participantIds.filter((id) => !existingIds.includes(id));
  const toRemove = existingIds.filter((id) => !participantIds.includes(id));

  const addProcessByPatient = new Map<string, string>();
  for (const pid of toAdd) {
    addProcessByPatient.set(pid, await ensureActiveProcess(pid));
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      ...fields,
      participants: {
        ...(toRemove.length
          ? { deleteMany: { patientId: { in: toRemove } } }
          : {}),
        ...(toAdd.length
          ? {
              create: toAdd.map((patientId) => ({
                patientId,
                processId: addProcessByPatient.get(patientId),
              })),
            }
          : {}),
      },
    },
  });

  // Si cambió la fecha/hora, avisar "cita reprogramada".
  if (existing.startsAt.getTime() !== fields.startsAt.getTime()) {
    await sendAppointmentNotice(sessionId, "rescheduled");
  }

  revalidateSession([...new Set([...existingIds, ...participantIds])]);
  return {};
}

export async function deleteSession(
  sessionId: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const session = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, participants: { select: { patientId: true } } },
  });
  if (!session) return { error: "Sesión no encontrada" };

  await prisma.session.delete({ where: { id: session.id } });
  revalidateSession(session.participants.map((p) => p.patientId));
  return {};
}

// ── Workspace de sesión (iniciar / finalizar / estado / notas) ─────────────
/** Carga una sesión del psicólogo con los ids de sus participantes (o null). */
async function findOwnedSession(userId: string, sessionId: string) {
  return prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      startedAt: true,
      participants: { select: { patientId: true } },
    },
  });
}

function revalidateSessionAnd(sessionId: string, patientIds: string[]) {
  revalidateSession(patientIds);
  revalidatePath(`/sesiones/${sessionId}`);
  // El banner "sesión en curso" vive en el layout de la app: revalidarlo para
  // que aparezca/desaparezca al iniciar/terminar una sesión.
  revalidatePath("/", "layout");
}

/** Marca la sesión iniciada: estado IN_PROGRESS y arranca el cronómetro. */
export async function startSession(
  sessionId: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const s = await findOwnedSession(userId, sessionId);
  if (!s) return { error: "Sesión no encontrada" };
  await prisma.session.update({
    where: { id: s.id },
    data: { status: "IN_PROGRESS", startedAt: s.startedAt ?? new Date() },
  });
  revalidateSessionAnd(sessionId, s.participants.map((p) => p.patientId));
  return {};
}

/** Finaliza la sesión: estado COMPLETED y registra el fin. */
export async function finishSession(
  sessionId: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const s = await findOwnedSession(userId, sessionId);
  if (!s) return { error: "Sesión no encontrada" };
  await prisma.session.update({
    where: { id: s.id },
    data: { status: "COMPLETED", endedAt: new Date() },
  });
  revalidateSessionAnd(sessionId, s.participants.map((p) => p.patientId));
  return {};
}

/** Cambia el estado de la sesión (no-show, cancelar, reprogramar). */
export async function setSessionStatus(
  sessionId: string,
  status: SessionInput["status"],
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!SESSION_STATUS.includes(status)) return { error: "Estado inválido" };
  const s = await findOwnedSession(userId, sessionId);
  if (!s) return { error: "Sesión no encontrada" };
  await prisma.session.update({
    where: { id: s.id },
    data: { status },
  });
  // Aviso "cita cancelada" (gateado por feature + notifyPatient + futura).
  if (status === "CANCELED") {
    await sendAppointmentNotice(sessionId, "canceled");
  }
  revalidateSessionAnd(sessionId, s.participants.map((p) => p.patientId));
  return {};
}

/** Guarda las notas compartidas (de la sesión / pareja). */
export async function saveSessionNotes(
  sessionId: string,
  notes: { observations?: string; goals?: string; nextSteps?: string },
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const s = await findOwnedSession(userId, sessionId);
  if (!s) return { error: "Sesión no encontrada" };
  // Actualización parcial: solo se tocan los campos provistos. Así guardar el
  // cierre (nextSteps) no pisa las observaciones, y viceversa.
  const data: {
    observations?: string | null;
    goals?: string | null;
    nextSteps?: string | null;
  } = {};
  if (notes.observations !== undefined)
    data.observations = notes.observations.trim() || null;
  if (notes.goals !== undefined) data.goals = notes.goals.trim() || null;
  if (notes.nextSteps !== undefined) data.nextSteps = notes.nextSteps.trim() || null;
  await prisma.session.update({ where: { id: s.id }, data });
  revalidateSessionAnd(sessionId, s.participants.map((p) => p.patientId));
  return {};
}

/** Guarda las notas individuales de un participante. */
export async function saveIndividualNotes(
  participantId: string,
  notes: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const p = await prisma.sessionParticipant.findFirst({
    where: { id: participantId, session: { userId } },
    select: { id: true, sessionId: true, patientId: true },
  });
  if (!p) return { error: "Participante no encontrado" };
  await prisma.sessionParticipant.update({
    where: { id: p.id },
    data: { individualNotes: notes.trim() || null },
  });
  revalidateSessionAnd(p.sessionId, [p.patientId]);
  return {};
}

/** Normaliza el rulesJson de una voz a string[]. */
function voiceRulesOf(json: unknown): string[] {
  return Array.isArray(json)
    ? json.filter((r): r is string => typeof r === "string" && r.trim() !== "")
    : [];
}

/**
 * Resuelve la PLANTILLA de estructura a usar: el id explícito (propio o del
 * sistema), o el default del usuario, o el default del sistema. Devuelve el id
 * (para auditar en la sesión) y la estructura a inyectar (null = guía narrativa).
 */
async function resolveTemplate(
  userId: string,
  templateId?: string | null,
): Promise<{ id: string | null; structure: string | null }> {
  if (templateId) {
    const t = await prisma.noteTemplate.findFirst({
      where: { id: templateId, OR: [{ isSystem: true }, { userId }] },
      select: { id: true, structure: true },
    });
    if (t) return { id: t.id, structure: t.structure };
  }
  const def = await prisma.noteTemplate.findFirst({
    where: { isDefault: true, OR: [{ userId }, { isSystem: true }] },
    orderBy: { isSystem: "asc" }, // el del usuario antes que el del sistema
    select: { id: true, structure: true },
  });
  return def ? { id: def.id, structure: def.structure } : { id: null, structure: null };
}

/**
 * Resuelve la VOZ/estilo a usar: id explícito, default del usuario o del
 * sistema. Devuelve el id (para auditar) y las reglas a aplicar.
 */
async function resolveVoice(
  userId: string,
  voiceId?: string | null,
): Promise<{ id: string | null; rules: string[] }> {
  if (voiceId) {
    const v = await prisma.writingVoice.findFirst({
      where: { id: voiceId, OR: [{ isSystem: true }, { userId }] },
      select: { id: true, rulesJson: true },
    });
    if (v) return { id: v.id, rules: voiceRulesOf(v.rulesJson) };
  }
  const def = await prisma.writingVoice.findFirst({
    where: { isDefault: true, OR: [{ userId }, { isSystem: true }] },
    orderBy: { isSystem: "asc" },
    select: { id: true, rulesJson: true },
  });
  return def ? { id: def.id, rules: voiceRulesOf(def.rulesJson) } : { id: null, rules: [] };
}

/** Preferencia del usuario: emojis en el mensaje al paciente (default true). */
async function emojiPref(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { patientMessageEmojis: true },
  });
  return u?.patientMessageEmojis ?? true;
}

/** Guarda la preferencia de emojis en el mensaje al paciente. */
export async function setPatientMessageEmojis(
  value: boolean,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  await prisma.user.update({
    where: { id: userId },
    data: { patientMessageEmojis: value },
  });
  return {};
}

/**
 * Genera un resumen clínico con IA a partir de las observaciones de la sesión.
 * Gateado por el feature `aiSummary`. No toca las observaciones: guarda el
 * resultado en `summary` (editable). El proveedor/modelo lo decide el driver
 * (AI_PROVIDER / AI_MODEL).
 */
/** Fecha de la sesión en texto legible (hora de Asunción) para el prompt de IA. */
function sessionDateLabel(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateSessionSummary(
  sessionId: string,
  templateId?: string | null,
  voiceId?: string | null,
): Promise<{ summary?: string; model?: string; error?: string }> {
  const userId = await requireUserId();
  if (!(await userFeatureEnabled(userId, "aiSummary"))) {
    return { error: "El resumen con IA no está habilitado para tu cuenta" };
  }
  const s = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      startsAt: true,
      observations: true,
      goals: true,
      nextSteps: true,
      topic: true,
      topicOther: true,
      participants: {
        select: { patientId: true, patient: { select: { fullName: true } } },
      },
    },
  });
  if (!s) return { error: "Sesión no encontrada" };
  if (!s.observations?.trim()) {
    return { error: "No hay observaciones para resumir" };
  }

  const [template, voice] = await Promise.all([
    resolveTemplate(userId, templateId),
    resolveVoice(userId, voiceId),
  ]);
  const settings = await getAiSettings();
  const res = await getAiDriver({
    provider: settings.aiProvider,
    model: settings.aiModel,
  }).summarize({
    observations: s.observations,
    goals: s.goals,
    nextSteps: s.nextSteps,
    patientName: s.participants.map((p) => p.patient.fullName).join(", ") || null,
    topic: topicLabel(s.topic, s.topicOther),
    date: sessionDateLabel(s.startsAt),
    kind: "summary",
    templateStructure: template.structure,
    voiceRules: voice.rules,
  });
  if (res.error || !res.text) {
    return { error: res.error || "No se pudo generar el resumen" };
  }

  await prisma.session.update({
    where: { id: s.id },
    data: {
      summary: res.text,
      templateId: template.id,
      voiceId: voice.id,
      summaryModel: res.model,
      summaryAt: new Date(),
    },
  });
  revalidateSessionAnd(sessionId, s.participants.map((p) => p.patientId));
  return { summary: res.text, model: res.model };
}

/** Guarda ediciones manuales del resumen. */
export async function saveSessionSummary(
  sessionId: string,
  text: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const s = await findOwnedSession(userId, sessionId);
  if (!s) return { error: "Sesión no encontrada" };
  await prisma.session.update({
    where: { id: s.id },
    data: { summary: text.trim() || null },
  });
  revalidateSessionAnd(sessionId, s.participants.map((p) => p.patientId));
  return {};
}

/** Guarda el mensaje OPCIONAL para el paciente (autosave). "" = no se envía nada. */
export async function saveSessionPatientMessage(
  sessionId: string,
  text: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const s = await findOwnedSession(userId, sessionId);
  if (!s) return { error: "Sesión no encontrada" };
  await prisma.session.update({
    where: { id: s.id },
    data: { patientMessage: text.trim() || null },
  });
  revalidateSessionAnd(sessionId, s.participants.map((p) => p.patientId));
  return {};
}

/**
 * Genera con IA un mensaje CÁLIDO para el paciente (no clínico) a partir de las
 * notas, y lo guarda en patientMessage. Gateado por la función aiSummary.
 */
export async function generatePatientMessage(
  sessionId: string,
  voiceId?: string | null,
): Promise<{ message?: string; error?: string }> {
  const userId = await requireUserId();
  if (!(await userFeatureEnabled(userId, "aiSummary"))) {
    return { error: "El generador con IA no está habilitado para tu cuenta" };
  }
  const s = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      startsAt: true,
      startedAt: true,
      observations: true,
      goals: true,
      nextSteps: true,
      topic: true,
      topicOther: true,
      participants: {
        select: {
          patientId: true,
          patient: {
            select: {
              fullName: true,
              assignments: {
                where: { status: "PENDING" },
                select: { createdAt: true, test: { select: { name: true } } },
              },
              checkinPlans: {
                where: { status: "ACTIVE" },
                select: { createdAt: true, question: true },
              },
            },
          },
        },
      },
    },
  });
  if (!s) return { error: "Sesión no encontrada" };
  if (!s.observations?.trim()) {
    return { error: "No hay notas para generar el mensaje" };
  }

  // Lo asignado en ESTA sesión (creado después de iniciarla): tests pendientes y
  // seguimientos. Los diagnósticos quedan afuera: no van en un mensaje al paciente.
  const since = s.startedAt ? s.startedAt.getTime() : 0;
  const assigned: string[] = [];
  for (const p of s.participants) {
    for (const a of p.patient.assignments) {
      if (a.createdAt.getTime() >= since)
        assigned.push(`Test para completar: ${a.test.name}`);
    }
    for (const c of p.patient.checkinPlans) {
      if (c.createdAt.getTime() >= since)
        assigned.push(`Seguimiento por WhatsApp: ${c.question}`);
    }
  }

  const [voice, emojis] = await Promise.all([
    resolveVoice(userId, voiceId),
    emojiPref(userId),
  ]);
  const settings = await getAiSettings();
  const res = await getAiDriver({
    provider: settings.aiProvider,
    model: settings.aiModel,
  }).summarize({
    observations: s.observations,
    goals: s.goals,
    nextSteps: s.nextSteps,
    patientName: s.participants.map((p) => p.patient.fullName).join(", ") || null,
    topic: topicLabel(s.topic, s.topicOther),
    date: sessionDateLabel(s.startsAt),
    assigned: assigned.length ? assigned : null,
    kind: "paciente",
    voiceRules: voice.rules,
    emojis,
  });
  if (res.error || !res.text) {
    return { error: res.error || "No se pudo generar el mensaje" };
  }

  await prisma.session.update({
    where: { id: s.id },
    data: { patientMessage: res.text },
  });
  revalidateSessionAnd(sessionId, s.participants.map((p) => p.patientId));
  return { message: res.text };
}

/**
 * Genera con IA los PRÓXIMOS PASOS pactados a partir de las observaciones.
 * Campo aparte del resumen; se guarda en `nextSteps` (editable). Gateado por
 * la función aiSummary.
 */
export async function generateSessionNextSteps(
  sessionId: string,
  voiceId?: string | null,
): Promise<{ nextSteps?: string; error?: string }> {
  const userId = await requireUserId();
  if (!(await userFeatureEnabled(userId, "aiSummary"))) {
    return { error: "El generador con IA no está habilitado para tu cuenta" };
  }
  const s = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      startsAt: true,
      startedAt: true,
      observations: true,
      goals: true,
      topic: true,
      topicOther: true,
      participants: {
        select: {
          patientId: true,
          patient: {
            select: {
              fullName: true,
              assignments: {
                where: { status: "PENDING" },
                select: { createdAt: true, test: { select: { name: true } } },
              },
              checkinPlans: {
                where: { status: "ACTIVE" },
                select: { createdAt: true, question: true },
              },
            },
          },
        },
      },
    },
  });
  if (!s) return { error: "Sesión no encontrada" };
  if (!s.observations?.trim()) {
    return { error: "No hay notas para generar los próximos pasos" };
  }

  // Lo asignado en ESTA sesión (creado después de iniciarla): para la sección
  // "Tarea del paciente" de la nota de próximos pasos.
  const since = s.startedAt ? s.startedAt.getTime() : 0;
  const assigned: string[] = [];
  for (const p of s.participants) {
    for (const a of p.patient.assignments) {
      if (a.createdAt.getTime() >= since)
        assigned.push(`Test para completar: ${a.test.name}`);
    }
    for (const c of p.patient.checkinPlans) {
      if (c.createdAt.getTime() >= since)
        assigned.push(`Seguimiento por WhatsApp: ${c.question}`);
    }
  }

  const voice = await resolveVoice(userId, voiceId);
  const settings = await getAiSettings();
  const res = await getAiDriver({
    provider: settings.aiProvider,
    model: settings.aiModel,
  }).summarize({
    observations: s.observations,
    goals: s.goals,
    patientName: s.participants.map((p) => p.patient.fullName).join(", ") || null,
    topic: topicLabel(s.topic, s.topicOther),
    date: sessionDateLabel(s.startsAt),
    assigned: assigned.length ? assigned : null,
    kind: "pasos",
    voiceRules: voice.rules,
  });
  if (res.error || !res.text) {
    return { error: res.error || "No se pudieron generar los próximos pasos" };
  }
  await prisma.session.update({
    where: { id: s.id },
    data: { nextSteps: res.text },
  });
  revalidateSessionAnd(sessionId, s.participants.map((p) => p.patientId));
  return { nextSteps: res.text };
}

/**
 * Genera de una sola vez TODO el contenido de cierre a partir de las notas:
 * resumen (en el formato dado), próximos pasos y mensaje para el paciente.
 * Es el botón "Generar contenido" al finalizar la sesión: el profesional solo
 * escribe sus observaciones y la IA completa el resto (sobrescribe los tres
 * campos). Gateado por la función aiSummary.
 */
export async function generateSessionContent(
  sessionId: string,
  templateId?: string | null,
  voiceId?: string | null,
): Promise<{
  summary?: string;
  nextSteps?: string;
  patientMessage?: string;
  model?: string;
  error?: string;
}> {
  const userId = await requireUserId();
  if (!(await userFeatureEnabled(userId, "aiSummary"))) {
    return { error: "El generador con IA no está habilitado para tu cuenta" };
  }
  const s = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      startsAt: true,
      startedAt: true,
      observations: true,
      goals: true,
      nextSteps: true,
      topic: true,
      topicOther: true,
      participants: {
        select: {
          patientId: true,
          patient: {
            select: {
              fullName: true,
              assignments: {
                where: { status: "PENDING" },
                select: { createdAt: true, test: { select: { name: true } } },
              },
              checkinPlans: {
                where: { status: "ACTIVE" },
                select: { createdAt: true, question: true },
              },
            },
          },
        },
      },
    },
  });
  if (!s) return { error: "Sesión no encontrada" };
  if (!s.observations?.trim()) {
    return { error: "No hay notas para generar el contenido" };
  }

  // Lo asignado en ESTA sesión (creado tras iniciarla): para el mensaje al paciente.
  const since = s.startedAt ? s.startedAt.getTime() : 0;
  const assigned: string[] = [];
  for (const p of s.participants) {
    for (const a of p.patient.assignments) {
      if (a.createdAt.getTime() >= since)
        assigned.push(`Test para completar: ${a.test.name}`);
    }
    for (const c of p.patient.checkinPlans) {
      if (c.createdAt.getTime() >= since)
        assigned.push(`Seguimiento por WhatsApp: ${c.question}`);
    }
  }

  const [template, voice, emojis] = await Promise.all([
    resolveTemplate(userId, templateId),
    resolveVoice(userId, voiceId),
    emojiPref(userId),
  ]);
  const settings = await getAiSettings();
  const driver = getAiDriver({
    provider: settings.aiProvider,
    model: settings.aiModel,
  });
  const base = {
    observations: s.observations,
    goals: s.goals,
    patientName: s.participants.map((p) => p.patient.fullName).join(", ") || null,
    topic: topicLabel(s.topic, s.topicOther),
    date: sessionDateLabel(s.startsAt),
    voiceRules: voice.rules,
  };

  // Tres generaciones en paralelo: resumen (plantilla+voz), próximos pasos y
  // mensaje (ambos con la voz). La voz aplica a las tres; la plantilla al resumen.
  const assignedOrNull = assigned.length ? assigned : null;
  const [summaryRes, stepsRes, messageRes] = await Promise.all([
    driver.summarize({
      ...base,
      nextSteps: s.nextSteps,
      kind: "summary",
      templateStructure: template.structure,
    }),
    driver.summarize({ ...base, assigned: assignedOrNull, kind: "pasos" }),
    driver.summarize({
      ...base,
      nextSteps: s.nextSteps,
      assigned: assignedOrNull,
      kind: "paciente",
      emojis,
    }),
  ]);

  // Si las tres fallaron, devolvemos el error; si al menos una salió, guardamos eso.
  if (!summaryRes.text && !stepsRes.text && !messageRes.text) {
    return {
      error:
        summaryRes.error ||
        stepsRes.error ||
        messageRes.error ||
        "No se pudo generar el contenido",
    };
  }

  const data: {
    summary?: string;
    templateId?: string | null;
    voiceId?: string | null;
    summaryModel?: string;
    summaryAt?: Date;
    nextSteps?: string;
    patientMessage?: string;
  } = {};
  if (summaryRes.text) {
    data.summary = summaryRes.text;
    data.templateId = template.id;
    data.voiceId = voice.id;
    data.summaryModel = summaryRes.model;
    data.summaryAt = new Date();
  }
  if (stepsRes.text) data.nextSteps = stepsRes.text;
  if (messageRes.text) data.patientMessage = messageRes.text;

  await prisma.session.update({ where: { id: s.id }, data });
  revalidateSessionAnd(sessionId, s.participants.map((p) => p.patientId));
  return {
    summary: summaryRes.text || undefined,
    nextSteps: stepsRes.text || undefined,
    patientMessage: messageRes.text || undefined,
    model: summaryRes.model,
  };
}

// ── Diagnósticos (CIE-10) del paciente ──────────────────────────────────────
async function ownedDiagnosis(diagnosisId: string, userId: string) {
  return prisma.diagnosis.findFirst({
    where: { id: diagnosisId, patient: { userId } },
    select: { id: true, patientId: true, isPrimary: true },
  });
}

export async function createDiagnosis(
  input: DiagnosisInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = diagnosisSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { patientId, label, isPrimary } = parsed.data;
  const code = (parsed.data.code ?? "").toUpperCase();

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId },
    select: { id: true },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  // No cargar dos veces el mismo diagnóstico (por código o por etiqueta).
  const dupe = await prisma.diagnosis.findFirst({
    where: {
      patientId,
      OR: [
        ...(code ? [{ code }] : []),
        { label: { equals: label.trim(), mode: "insensitive" as const } },
      ],
    },
    select: { id: true },
  });
  if (dupe) return { error: "Ese diagnóstico ya está cargado." };

  await prisma.$transaction([
    // Un solo principal por paciente: si este lo es, desmarcar el resto.
    ...(isPrimary
      ? [
          prisma.diagnosis.updateMany({
            where: { patientId },
            data: { isPrimary: false },
          }),
        ]
      : []),
    prisma.diagnosis.create({
      data: { patientId, code, label: label.trim(), isPrimary },
    }),
  ]);
  revalidatePath(`/pacientes/${patientId}`);
  return {};
}

export async function deleteDiagnosis(
  diagnosisId: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const d = await ownedDiagnosis(diagnosisId, userId);
  if (!d) return { error: "Diagnóstico no encontrado" };
  await prisma.diagnosis.delete({ where: { id: d.id } });
  revalidatePath(`/pacientes/${d.patientId}`);
  return {};
}

/** Marca/desmarca un diagnóstico como principal (a lo sumo uno por paciente). */
export async function togglePrimaryDiagnosis(
  diagnosisId: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const d = await ownedDiagnosis(diagnosisId, userId);
  if (!d) return { error: "Diagnóstico no encontrado" };
  const next = !d.isPrimary;
  await prisma.$transaction([
    ...(next
      ? [
          prisma.diagnosis.updateMany({
            where: { patientId: d.patientId, NOT: { id: d.id } },
            data: { isPrimary: false },
          }),
        ]
      : []),
    prisma.diagnosis.update({ where: { id: d.id }, data: { isPrimary: next } }),
  ]);
  revalidatePath(`/pacientes/${d.patientId}`);
  return {};
}

// ── Resultados de test cargados a mano (test en papel / con copyright) ───────
/**
 * Registra un resultado ya interpretado (hallazgos por escala) sin pasar por el
 * formulario digital. Decoplado del flujo de Assignment/Result: no se autocorrige
 * ni alimenta la alerta de empeoramiento (los perfiles/rasgos no son severidad).
 */
/**
 * Crea un test externo (de papel, sin motor de corrección) y lo guarda en el
 * catálogo del psicólogo. El resultado de estos tests siempre se carga a mano.
 */
export async function createExternalTest(
  input: ExternalTestInput,
): Promise<{ id?: string; name?: string; error?: string }> {
  const userId = await requireUserId();
  const parsed = externalTestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const test = await prisma.test.create({
    data: {
      userId,
      isSystem: false,
      scored: false,
      name: parsed.data.name.trim(),
      description:
        parsed.data.description?.trim() || "Test externo (cargado a mano).",
      categories: [],
      responseType: "SCALE_0_3",
      itemsJson: [],
      scoringJson: {},
    },
    select: { id: true, name: true },
  });
  revalidatePath("/tests");
  return { id: test.id, name: test.name };
}

/**
 * Carga un resultado a mano para un test EXISTENTE (del sistema o propio):
 * crea una asignación ya completada + su resultado (origen profesional). El
 * resultado pertenece al test → entra en el historial y agrupa por test.
 */
export async function saveManualResult(
  input: ManualResultInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = manualResultSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const patient = await prisma.patient.findFirst({
    where: { id: d.patientId, userId },
    select: { id: true },
  });
  if (!patient) return { error: "Paciente no encontrado" };
  const test = await prisma.test.findFirst({
    where: { id: d.testId, OR: [{ isSystem: true }, { userId }] },
    select: { id: true },
  });
  if (!test) return { error: "Test no encontrado" };

  const findings = d.findings.map((f) => ({
    label: f.label.trim(),
    value: f.value.trim(),
  }));
  const processId = await ensureActiveProcess(d.patientId);

  await prisma.assignment.create({
    data: {
      patientId: d.patientId,
      testId: d.testId,
      processId,
      token: generatePublicToken(),
      status: "COMPLETED",
      completedAt: new Date(`${d.takenAt}T00:00:00.000Z`),
      notifyOnAssign: false,
      result: {
        create: {
          findingsJson: findings as unknown as Prisma.InputJsonValue,
          notes: d.notes?.trim() || null,
          source: "PROFESSIONAL",
          // lo cargó el propio profesional: ya está "revisado"
          reviewedAt: new Date(),
        },
      },
    },
  });
  revalidatePath(`/pacientes/${d.patientId}`);
  return {};
}

/** Edita un resultado cargado a mano (hallazgos / fecha / notas). Marca editado. */
export async function updateManualResult(
  input: EditManualResultInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = editManualResultSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;
  const result = await prisma.result.findFirst({
    where: { id: d.resultId, assignment: { patient: { userId } } },
    select: { id: true, assignment: { select: { id: true, patientId: true } } },
  });
  if (!result) return { error: "Resultado no encontrado" };

  const findings = d.findings.map((f) => ({
    label: f.label.trim(),
    value: f.value.trim(),
  }));
  await prisma.$transaction([
    prisma.result.update({
      where: { id: result.id },
      data: {
        findingsJson: findings as unknown as Prisma.InputJsonValue,
        notes: d.notes?.trim() || null,
        editedAt: new Date(),
      },
    }),
    prisma.assignment.update({
      where: { id: result.assignment.id },
      data: { completedAt: new Date(`${d.takenAt}T00:00:00.000Z`) },
    }),
  ]);
  revalidatePath(`/pacientes/${result.assignment.patientId}`);
  return {};
}

/** Borra un resultado cargado a mano (y su asignación). */
export async function deleteManualResult(
  resultId: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const result = await prisma.result.findFirst({
    where: {
      id: resultId,
      source: "PROFESSIONAL",
      assignment: { patient: { userId } },
    },
    select: { assignment: { select: { id: true, patientId: true } } },
  });
  if (!result) return { error: "Resultado no encontrado" };
  // borrar la asignación arrastra el resultado (onDelete: Cascade)
  await prisma.assignment.delete({ where: { id: result.assignment.id } });
  revalidatePath(`/pacientes/${result.assignment.patientId}`);
  return {};
}

// ── Tarea de cierre: enviar al paciente por WhatsApp ────────────────────────
/**
 * Envía la tarea (próximos pasos de la sesión) al/los paciente(s) por WhatsApp.
 * Gateado por `whatsappTasks`. En el driver cloud, el texto libre solo llega
 * dentro de la ventana de 24 h de Meta; el driver mock siempre "envía".
 */
export async function sendSessionTask(
  sessionId: string,
): Promise<{ sent?: number; error?: string }> {
  const userId = await requireUserId();
  if (!(await userFeatureEnabled(userId, "whatsappTasks"))) {
    return { error: "El envío de tareas por WhatsApp no está habilitado" };
  }
  const s = await prisma.session.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      patientMessage: true,
      user: {
        select: { name: true, firstName: true, lastName: true, prefix: true },
      },
      participants: {
        select: {
          patient: {
            select: {
              id: true,
              firstName: true,
              phone: true,
              whatsappOptIn: true,
            },
          },
        },
      },
    },
  });
  if (!s) return { error: "Sesión no encontrada" };
  const task = s.patientMessage?.trim();
  if (!task) {
    return { error: "Escribí un mensaje para el paciente antes de enviarlo." };
  }

  const professional = professionalName(s.user);
  const eligible = s.participants
    .map((p) => p.patient)
    .filter((p) => p.phone && p.whatsappOptIn);
  if (eligible.length === 0) {
    return {
      error: "Ningún paciente tiene WhatsApp configurado (teléfono + consentimiento)",
    };
  }

  const wa = getWhatsApp();
  const now = new Date();
  let sent = 0;
  for (const p of eligible) {
    const body = `Hola ${p.firstName},\n\n${task}\n\n— ${professional}`;
    const res = await wa.send(p.phone!, { kind: "text", body });
    if (res.sent) {
      await logWhatsAppSent({
        userId,
        patientId: p.id,
        type: "SESSION_TASK",
        sentAt: now,
        providerMessageId: res.providerMessageId,
        sessionId: s.id,
      });
      sent++;
    }
  }

  if (sent === 0) {
    return { error: "No se pudo enviar (revisá la conexión de WhatsApp)" };
  }
  await prisma.session.update({
    where: { id: s.id },
    data: { taskSentAt: now },
  });
  revalidateSessionAnd(sessionId, eligible.map((p) => p.id));
  return { sent };
}

// ── Adjuntos ──────────────────────────────────────────────────────────────
export async function uploadAttachment(
  formData: FormData,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const patientId = String(formData.get("patientId") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Elegí un archivo" };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { error: "El archivo supera los 10 MB" };
  }
  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_ATTACHMENT_TYPES.includes(mimeType)) {
    return { error: "Tipo de archivo no permitido" };
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId },
    select: { id: true },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-100);
  const key = `${patientId}/${randomUUID()}-${safeName}`;

  const storage = getStorage();
  await storage.put(key, buffer, mimeType);

  await prisma.attachment.create({
    data: {
      patientId,
      fileName: file.name,
      mimeType,
      size: file.size,
      storageKey: key,
      driver: storage.name,
    },
  });

  revalidatePath(`/pacientes/${patientId}`);
  return {};
}

export async function deleteAttachment(
  attachmentId: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const att = await prisma.attachment.findFirst({
    where: { id: attachmentId, patient: { userId } },
    select: { id: true, patientId: true, storageKey: true, driver: true },
  });
  if (!att) return { error: "Adjunto no encontrado" };

  try {
    await getStorage(att.driver as StorageDriverName).delete(att.storageKey);
  } catch {
    // si el archivo físico ya no está, igual borramos la metadata
  }
  await prisma.attachment.delete({ where: { id: att.id } });
  revalidatePath(`/pacientes/${att.patientId}`);
  return {};
}

// ── Asignación ────────────────────────────────────────────────────────────
export async function createAssignment(
  input: AssignmentInput,
): Promise<{ token?: string; assignmentId?: string; error?: string }> {
  const userId = await requireUserId();
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { patientId, testId, dueDate, reminderOffsetsDays, notifyOnAssign } =
    parsed.data;

  // Verificar que el paciente sea del psicólogo y que el test exista.
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  // El test debe ser del sistema o propiedad del psicólogo.
  const test = await prisma.test.findFirst({
    where: { id: testId, OR: [{ isSystem: true }, { userId }] },
  });
  if (!test) return { error: "Test no encontrado" };

  // No reasignar un test que ya está pendiente para este paciente.
  const existingPending = await prisma.assignment.findFirst({
    where: { patientId, testId, status: "PENDING" },
    select: { id: true },
  });
  if (existingPending) {
    return {
      error: `Ya hay un «${test.name}» pendiente para este paciente.`,
    };
  }

  const due = dueDate ? new Date(`${dueDate}T23:59:59`) : null;
  const validDue = due && !Number.isNaN(due.getTime()) ? due : null;
  // Offsets solo si hay deadline; sin duplicados y de mayor a menor.
  const offsets =
    validDue && reminderOffsetsDays?.length
      ? [...new Set(reminderOffsetsDays)].sort((a, b) => b - a)
      : [];

  const assignment = await prisma.assignment.create({
    data: {
      patientId,
      processId: await ensureActiveProcess(patientId),
      testId,
      token: generatePublicToken(),
      dueDate: validDue,
      reminderOffsetsDays: offsets,
      notifyOnAssign: notifyOnAssign ?? true,
    },
  });

  // Aviso "test asignado" (gateado por feature + notifyOnAssign + contacto).
  await sendTestAssignedNotice(assignment.id);

  revalidatePath("/");
  revalidatePath(`/pacientes/${patientId}`);
  return { token: assignment.token, assignmentId: assignment.id };
}

// ── Tests personalizados ──────────────────────────────────────────────────
const TONE_SCALE: LevelTone[] = ["ok", "low", "mid", "high", "max"];

/** Reparte los rangos de interpretación en la escala de tonos (ok → max). */
function toneForCutoff(index: number, count: number): LevelTone {
  if (count <= 1) return "mid";
  const pos = Math.round((index / (count - 1)) * (TONE_SCALE.length - 1));
  return TONE_SCALE[pos];
}

/** Crea un test personalizado del psicólogo (modo suma simple). */
export async function createTest(
  input: TestInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = testSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, description, categories, showResultsToPatient, options, items, cutoffs } =
    parsed.data;

  // Cada ítem guarda sus propias opciones (de momento, la misma escala para todos).
  const itemsJson = items.map((it) => ({ text: it.text, options }));

  // Modo "total": una sola subescala con todos los ítems.
  const sorted = [...cutoffs].sort((a, b) => a.min - b.min);
  const scoring: ScoringConfig = {
    mode: "total",
    subscales: [
      {
        key: "total",
        label: "Total",
        items: items.map((_, i) => i + 1),
        cutoffs: sorted.map((c, i) => ({
          min: c.min,
          max: c.max,
          level: `l${i + 1}`,
          label: c.label,
          tone: toneForCutoff(i, sorted.length),
        })),
      },
    ],
  };

  await prisma.test.create({
    data: {
      userId,
      isSystem: false,
      name,
      description,
      categories,
      showResultsToPatient,
      // Fallback: los ítems custom traen sus propias opciones, así que el
      // responseType solo se usaría si faltaran. Guardamos uno neutro.
      responseType: "SCALE_0_3",
      itemsJson,
      scoringJson: scoring as unknown as object,
    },
  });

  revalidatePath("/tests");
  redirect("/tests");
}

// ── Check-ins (seguimiento por WhatsApp) ──────────────────────────────────
/** Actualiza el teléfono y el consentimiento de WhatsApp de un paciente. */
export async function updatePatientContact(
  patientId: string,
  phone: string,
  whatsappOptIn: boolean,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, userId },
    select: { id: true },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  const clean = phone.trim();
  if (clean && !/^\+?[\d\s().-]{6,30}$/.test(clean)) {
    return { error: "Teléfono inválido" };
  }

  await prisma.patient.update({
    where: { id: patientId },
    data: { phone: clean || null, whatsappOptIn },
  });
  revalidatePath(`/pacientes/${patientId}`);
  return {};
}

/** Verifica que el plan sea de un paciente del psicólogo logueado. */
async function ownedPlan(planId: string, userId: string) {
  return prisma.checkinPlan.findFirst({
    where: { id: planId, patient: { userId } },
    select: { id: true, patientId: true },
  });
}

export async function createCheckinPlan(
  input: CheckinPlanInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = checkinPlanSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parsed.data;

  const patient = await prisma.patient.findFirst({
    where: { id: d.patientId, userId },
    select: { id: true },
  });
  if (!patient) return { error: "Paciente no encontrado" };

  // No duplicar un seguimiento activo con la misma pregunta.
  const dupePlan = await prisma.checkinPlan.findFirst({
    where: {
      patientId: d.patientId,
      status: "ACTIVE",
      question: { equals: d.question.trim(), mode: "insensitive" },
    },
    select: { id: true },
  });
  if (dupePlan) {
    return { error: "Ya hay un seguimiento activo con esa pregunta." };
  }

  // El seguimiento pertenece al tratamiento (proceso) activo del paciente.
  const processId = await ensureActiveProcess(d.patientId);

  const plan = await prisma.checkinPlan.create({
    data: {
      patientId: d.patientId,
      processId,
      question: d.question.trim(),
      questionType: d.questionType,
      optionsJson: d.questionType === "CHOICE" ? (d.options ?? []) : undefined,
      frequency: d.frequency,
      everyNDays: d.frequency === "EVERY_N_DAYS" ? d.everyNDays : null,
      weekdaysJson: d.frequency === "WEEKDAYS" ? (d.weekdays ?? []) : undefined,
      timeOfDay: d.timeOfDay,
      startDate: new Date(`${d.startDate}T00:00:00.000Z`),
      endDate: new Date(`${d.endDate}T00:00:00.000Z`),
    },
    select: { id: true },
  });

  // Pre-generamos todas las tomas programadas (el cron solo las envía).
  await generatePlanEntries(plan.id);

  revalidatePath(`/pacientes/${d.patientId}`);
  return {};
}

export async function setCheckinPlanStatus(
  planId: string,
  status: CheckinPlanStatus,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const plan = await ownedPlan(planId, userId);
  if (!plan) return { error: "Plan no encontrado" };

  await prisma.checkinPlan.update({ where: { id: planId }, data: { status } });
  // Al terminar el plan, las tomas futuras pendientes no se enviarán nunca.
  if (status === "ENDED") {
    await prisma.checkinEntry.updateMany({
      where: { planId, status: "PENDING" },
      data: { status: "SKIPPED" },
    });
  }
  revalidatePath(`/pacientes/${plan.patientId}`);
  return {};
}

export async function deleteCheckinPlan(
  planId: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const plan = await ownedPlan(planId, userId);
  if (!plan) return { error: "Plan no encontrado" };

  await prisma.checkinPlan.delete({ where: { id: planId } });
  revalidatePath(`/pacientes/${plan.patientId}`);
  return {};
}

/** Envía un check-in del plan ahora mismo (para probar el flujo). */
export async function sendCheckinNow(
  planId: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const plan = await ownedPlan(planId, userId);
  if (!plan) return { error: "Plan no encontrado" };

  const res = await sendCheckinForPlan(planId);
  if (!res.ok) return { error: res.error };
  revalidatePath(`/pacientes/${plan.patientId}`);
  return {};
}

/** Simula la respuesta del paciente a una toma (dev/demo, mientras el driver es mock). */
export async function simulateCheckinReply(
  entryId: string,
  raw: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const entry = await prisma.checkinEntry.findFirst({
    where: { id: entryId, plan: { patient: { userId } } },
    select: { id: true, plan: { select: { patientId: true } } },
  });
  if (!entry) return { error: "Toma no encontrada" };

  const res = await recordReplyForEntry(entryId, raw);
  if (!res.ok) return { error: res.error };
  revalidatePath(`/pacientes/${entry.plan.patientId}`);
  return {};
}

// ── Envío de respuestas del paciente (público, por token) ──────────────────
export async function submitPatientResponse(
  token: string,
  answers: Record<string, number>,
): Promise<{ ok: boolean; error?: string; assignmentId?: string }> {
  const assignment = await prisma.assignment.findUnique({
    where: { token },
    include: { test: true },
  });
  if (!assignment) return { ok: false, error: "Link inválido" };
  if (assignment.status === "COMPLETED") {
    return { ok: false, error: "Este cuestionario ya fue respondido." };
  }

  const items = normalizeItems(
    assignment.test.itemsJson,
    assignment.test.responseType,
  );
  const scoring = assignment.test.scoringJson as unknown as ScoringConfig;
  const itemMax = itemMaxMap(items);

  // Validar respuestas: completas y con valores válidos por ítem.
  const schema = buildAnswersSchema(itemValuesMap(items));
  const parsed = schema.safeParse(answers);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Respuestas inválidas",
    };
  }

  // Corregir con el motor puro.
  const result = scoreTest(
    { responseType: assignment.test.responseType, scoring, itemMax },
    parsed.data,
  );

  // Guardar todo en una transacción y marcar COMPLETED.
  // El @unique en Response.assignmentId garantiza que solo se pueda
  // responder una vez (un segundo envío falla con violación de unicidad).
  try {
    await prisma.$transaction(async (tx) => {
      const fresh = await tx.assignment.findUnique({
        where: { id: assignment.id },
        select: { status: true },
      });
      if (fresh?.status === "COMPLETED") {
        throw new Error("ALREADY_COMPLETED");
      }
      await tx.response.create({
        data: { assignmentId: assignment.id, answersJson: parsed.data },
      });
      await tx.result.create({
        data: {
          assignmentId: assignment.id,
          scoresJson: result as unknown as object,
        },
      });
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    });
  } catch {
    return {
      ok: false,
      error: "No se pudo guardar la respuesta. ¿Ya la enviaste?",
    };
  }

  return { ok: true, assignmentId: assignment.id };
}

// ── Plantillas de estructura y voces/estilos (gestión) ───────────────────────
// Los del sistema (isSystem) son de solo lectura: se pueden duplicar pero no
// editar/borrar. El "predeterminado" es por usuario (una plantilla y una voz).

export async function createNoteTemplate(
  input: NoteTemplateInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = noteTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, description, structure, isDefault } = parsed.data;
  if (isDefault) {
    await prisma.noteTemplate.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }
  await prisma.noteTemplate.create({
    data: {
      userId,
      isSystem: false,
      name,
      description: description?.trim() || null,
      structure,
      isDefault: isDefault ?? false,
    },
  });
  revalidatePath("/plantillas");
  redirect("/plantillas");
}

export async function updateNoteTemplate(
  id: string,
  input: NoteTemplateInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = noteTemplateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const owned = await prisma.noteTemplate.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return { error: "Plantilla no encontrada" };
  const { name, description, structure, isDefault } = parsed.data;
  if (isDefault) {
    await prisma.noteTemplate.updateMany({
      where: { userId, NOT: { id } },
      data: { isDefault: false },
    });
  }
  await prisma.noteTemplate.update({
    where: { id },
    data: {
      name,
      description: description?.trim() || null,
      structure,
      isDefault: isDefault ?? false,
    },
  });
  revalidatePath("/plantillas");
  redirect("/plantillas");
}

export async function deleteNoteTemplate(
  id: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.noteTemplate.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return { error: "Plantilla no encontrada" };
  await prisma.noteTemplate.delete({ where: { id } });
  revalidatePath("/plantillas");
  return {};
}

export async function setDefaultNoteTemplate(
  id: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.noteTemplate.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return { error: "Solo podés predeterminar una plantilla propia" };
  await prisma.noteTemplate.updateMany({
    where: { userId },
    data: { isDefault: false },
  });
  await prisma.noteTemplate.update({ where: { id }, data: { isDefault: true } });
  revalidatePath("/plantillas");
  return {};
}

/** Duplica una plantilla (propia o del sistema) como propia, editable. */
export async function duplicateNoteTemplate(
  id: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const src = await prisma.noteTemplate.findFirst({
    where: { id, OR: [{ isSystem: true }, { userId }] },
    select: { name: true, description: true, structure: true },
  });
  if (!src) return { error: "Plantilla no encontrada" };
  const copy = await prisma.noteTemplate.create({
    data: {
      userId,
      isSystem: false,
      name: `${src.name} (copia)`,
      description: src.description,
      structure: src.structure,
      isDefault: false,
    },
    select: { id: true },
  });
  revalidatePath("/plantillas");
  redirect(`/plantillas/${copy.id}`);
}

export async function createWritingVoice(
  input: WritingVoiceInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = writingVoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { name, description, rules, isDefault } = parsed.data;
  if (isDefault) {
    await prisma.writingVoice.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }
  await prisma.writingVoice.create({
    data: {
      userId,
      isSystem: false,
      name,
      description: description?.trim() || null,
      rulesJson: rules,
      isDefault: isDefault ?? false,
    },
  });
  revalidatePath("/plantillas");
  redirect("/plantillas");
}

export async function updateWritingVoice(
  id: string,
  input: WritingVoiceInput,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = writingVoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const owned = await prisma.writingVoice.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return { error: "Voz no encontrada" };
  const { name, description, rules, isDefault } = parsed.data;
  if (isDefault) {
    await prisma.writingVoice.updateMany({
      where: { userId, NOT: { id } },
      data: { isDefault: false },
    });
  }
  await prisma.writingVoice.update({
    where: { id },
    data: {
      name,
      description: description?.trim() || null,
      rulesJson: rules,
      isDefault: isDefault ?? false,
    },
  });
  revalidatePath("/plantillas");
  redirect("/plantillas");
}

export async function deleteWritingVoice(
  id: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.writingVoice.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return { error: "Voz no encontrada" };
  await prisma.writingVoice.delete({ where: { id } });
  revalidatePath("/plantillas");
  return {};
}

export async function setDefaultWritingVoice(
  id: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.writingVoice.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!owned) return { error: "Solo podés predeterminar una voz propia" };
  await prisma.writingVoice.updateMany({
    where: { userId },
    data: { isDefault: false },
  });
  await prisma.writingVoice.update({ where: { id }, data: { isDefault: true } });
  revalidatePath("/plantillas");
  return {};
}

/** Duplica una voz (propia o del sistema) como propia, editable. */
export async function duplicateWritingVoice(
  id: string,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const src = await prisma.writingVoice.findFirst({
    where: { id, OR: [{ isSystem: true }, { userId }] },
    select: { name: true, description: true, rulesJson: true },
  });
  if (!src) return { error: "Voz no encontrada" };
  const copy = await prisma.writingVoice.create({
    data: {
      userId,
      isSystem: false,
      name: `${src.name} (copia)`,
      description: src.description,
      rulesJson: src.rulesJson ?? [],
      isDefault: false,
    },
    select: { id: true },
  });
  revalidatePath("/plantillas");
  redirect(`/plantillas/voz/${copy.id}`);
}

/**
 * Marca un resultado como revisado (sale de "Para revisar"). Se usa al abrir el
 * informe de forma inline en la consola de sesión, equivalente a navegar a la
 * página del resultado. Verifica que la asignación sea de un paciente del usuario.
 */
export async function markResultReviewedAction(
  assignmentId: string,
): Promise<void> {
  const userId = await requireUserId();
  const owns = await prisma.assignment.findFirst({
    where: { id: assignmentId, patient: { userId } },
    select: { id: true },
  });
  if (!owns) return;
  await markResultReviewed(assignmentId);
}

/** Logout. */
export async function logout() {
  await signOut({ redirectTo: "/login" });
}
