import { z } from "zod";

// ── Perfil del profesional ────────────────────────────────────────────────
/// Prefijos/títulos para los mensajes. "" = sin prefijo.
export const PREFIX_OPTIONS = [
  { value: "", label: "Sin prefijo" },
  { value: "Lic.", label: "Lic." },
  { value: "Dra.", label: "Dra." },
  { value: "Dr.", label: "Dr." },
  { value: "Psic.", label: "Psic." },
  { value: "Mgtr.", label: "Mgtr." },
  { value: "Esp.", label: "Esp." },
  { value: "Prof.", label: "Prof." },
] as const;
const PREFIX_VALUES = PREFIX_OPTIONS.map((o) => o.value) as [string, ...string[]];

/// Especialidades disponibles (lista fija, multi-select).
export const SPECIALTY_OPTIONS = [
  { value: "clinica", label: "Psicología clínica" },
  { value: "cognitivo_conductual", label: "Terapia cognitivo-conductual" },
  { value: "psicoanalisis", label: "Psicoanálisis" },
  { value: "sistemica", label: "Terapia sistémica" },
  { value: "gestalt", label: "Gestalt" },
  { value: "humanista", label: "Humanística" },
  { value: "infantojuvenil", label: "Infantojuvenil" },
  { value: "adultos", label: "Adultos" },
  { value: "pareja_familia", label: "Pareja y familia" },
  { value: "neuropsicologia", label: "Neuropsicología" },
  { value: "educacional", label: "Educacional" },
  { value: "organizacional", label: "Organizacional" },
  { value: "forense", label: "Forense" },
  { value: "adicciones", label: "Adicciones" },
] as const;
const SPECIALTY_VALUES = SPECIALTY_OPTIONS.map((o) => o.value) as [
  string,
  ...string[],
];

const profileFields = {
  firstName: z.string().min(2, "Ingresá tu nombre").max(80),
  lastName: z.string().min(2, "Ingresá tu apellido").max(80),
  prefix: z.enum(PREFIX_VALUES).optional().or(z.literal("")),
  specialties: z.array(z.enum(SPECIALTY_VALUES)).max(SPECIALTY_VALUES.length).optional(),
};

export const profileSchema = z.object(profileFields);
export type ProfileInput = z.infer<typeof profileSchema>;

// ── Auth ────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ── Administración (alta y gestión de psicólogos) ─────────────────────────
/// Alta de un psicólogo por parte del super admin (perfil + credenciales).
export const adminCreateUserSchema = z.object({
  ...profileFields,
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres").max(100),
});
export type AdminCreateUserInput = z.infer<typeof adminCreateUserSchema>;

/// Reset de contraseña de un psicólogo por parte del super admin.
export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "Mínimo 8 caracteres").max(100),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/// Estado comercial de un psicólogo (beta/prueba/activo/vencido) + vencimiento.
export const adminSetBillingSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["BETA", "TRIAL", "ACTIVE", "EXPIRED"]),
  // fecha de vencimiento opcional, "YYYY-MM-DD" (input date) o vacío = sin vencimiento
  until: z.string().optional(),
});
export type AdminSetBillingInput = z.infer<typeof adminSetBillingSchema>;

/// Funciones que el super admin habilita/deshabilita para un psicólogo.
export const adminSetFeaturesSchema = z.object({
  userId: z.string().min(1),
  entitlements: z.record(z.string(), z.boolean()),
});
export type AdminSetFeaturesInput = z.infer<typeof adminSetFeaturesSchema>;

/// Preferencias del propio psicólogo sobre las funciones habilitadas.
export const featurePreferencesSchema = z.object({
  preferences: z.record(z.string(), z.boolean()),
});
export type FeaturePreferencesInput = z.infer<typeof featurePreferencesSchema>;

/// Interruptores maestros de la plataforma (super admin, afectan a todos).
export const adminSetPlatformFlagsSchema = z.object({
  flags: z.record(z.string(), z.boolean()),
});
export type AdminSetPlatformFlagsInput = z.infer<
  typeof adminSetPlatformFlagsSchema
>;

/// Configuración del proveedor/modelo de IA (super admin). Claves van por env.
export const adminSetAiSettingsSchema = z.object({
  aiProvider: z.enum(["anthropic", "openai", "google", "deepseek", "mock"]),
  aiModel: z.string().trim().max(120).optional().default(""),
});
export type AdminSetAiSettingsInput = z.infer<typeof adminSetAiSettingsSchema>;

/// Diagnóstico CIE-10 de un paciente.
export const diagnosisSchema = z.object({
  patientId: z.string().min(1, "Falta el paciente"),
  // Código CIE-10 opcional: se puede cargar un diagnóstico libre (solo texto).
  // Si viene, debe respetar el formato CIE-10.
  code: z
    .string()
    .trim()
    .max(10, "Código muy largo")
    .regex(/^[A-Za-z]\d{2}(\.\d{1,2})?$/, "Formato CIE-10 inválido (ej: F41.1)")
    .or(z.literal(""))
    .optional(),
  label: z.string().trim().min(3, "Ingresá el diagnóstico").max(200),
  isPrimary: z.boolean().optional().default(false),
});
export type DiagnosisInput = z.infer<typeof diagnosisSchema>;

/// Resultado de test cargado a mano (hallazgos ya interpretados).
const findingsArray = z
  .array(
    z.object({
      label: z.string().trim().min(1, "Falta la escala").max(80),
      value: z.string().trim().min(1, "Falta el resultado").max(120),
    }),
  )
  .min(1, "Cargá al menos un hallazgo")
  .max(20);

/** Cargar un resultado a mano para un test ya existente (seleccionado o creado). */
export const manualResultSchema = z.object({
  patientId: z.string().min(1, "Falta el paciente"),
  testId: z.string().min(1, "Elegí un test"),
  takenAt: z.string().min(1, "Elegí la fecha"),
  findings: findingsArray,
  notes: z.string().trim().max(2000).optional(),
});
export type ManualResultInput = z.infer<typeof manualResultSchema>;

/** Editar un resultado cargado a mano (hallazgos / fecha / notas). */
export const editManualResultSchema = z.object({
  resultId: z.string().min(1),
  takenAt: z.string().min(1, "Elegí la fecha"),
  findings: findingsArray,
  notes: z.string().trim().max(2000).optional(),
});
export type EditManualResultInput = z.infer<typeof editManualResultSchema>;

/** Crear un test externo (de papel, sin motor): queda guardado en el catálogo. */
export const externalTestSchema = z.object({
  name: z.string().trim().min(2, "Ingresá el nombre del test").max(120),
  description: z.string().trim().max(500).optional(),
});
export type ExternalTestInput = z.infer<typeof externalTestSchema>;

/// Cambio de la propia contraseña (forzado en el primer ingreso o desde el perfil).
export const changePasswordSchema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres").max(100),
    confirm: z.string().min(1, "Repetí la contraseña"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ── Pacientes ───────────────────────────────────────────────────────────
// Categorías del motivo de consulta (nivel proceso). "otro" = catch-all; el
// detalle va en la narrativa libre (Process.motivo). Distinto de TOPIC_OPTIONS
// (foco del día, nivel sesión).
export const MOTIVO_OPTIONS = [
  { value: "ansiedad", label: "Ansiedad" },
  { value: "depresion", label: "Depresión" },
  { value: "estres", label: "Estrés" },
  { value: "autoestima", label: "Autoestima" },
  { value: "pareja", label: "Relación de pareja" },
  { value: "familia", label: "Familia" },
  { value: "duelo", label: "Duelo" },
  { value: "trauma", label: "Trauma" },
  { value: "adicciones", label: "Adicciones" },
  { value: "alimentacion", label: "Conducta alimentaria" },
  { value: "sueno", label: "Sueño" },
  { value: "laboral", label: "Laboral / vocacional" },
  { value: "otro", label: "Otro" },
] as const;
const MOTIVO_VALUES = MOTIVO_OPTIONS.map((m) => m.value) as [string, ...string[]];

/** Etiqueta legible de una categoría de motivo (null si no hay). */
export function motivoCategoryLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return MOTIVO_OPTIONS.find((m) => m.value === value)?.label ?? value;
}

/** Nombre a mostrar de un tratamiento: la categoría del motivo (Ansiedad,
 *  Depresión…) es la identidad del tratamiento; si no hay categoría, se usa la
 *  narrativa libre como respaldo. El detalle/narrativa va aparte, como texto
 *  secundario. Null si no hay ninguna. */
export function processMotivoLabel(p: {
  motivo?: string | null;
  motivoCategory?: string | null;
}): string | null {
  return motivoCategoryLabel(p.motivoCategory) || (p.motivo?.trim() || null);
}

const SEX_VALUES = ["Femenino", "Masculino", "Otro", "Prefiere no decir"] as const;
const MARITAL_VALUES = [
  "Soltero/a",
  "En pareja",
  "Casado/a",
  "Divorciado/a",
  "Viudo/a",
] as const;

export const patientSchema = z.object({
  firstName: z.string().min(2, "Ingresá el nombre").max(80),
  lastName: z.string().min(2, "Ingresá el apellido").max(80),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z
    .string()
    .max(30)
    .regex(/^\+?[\d\s().-]*$/, "Teléfono inválido")
    .optional()
    .or(z.literal("")),
  whatsappOptIn: z.boolean().optional(),
  birthDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || (!Number.isNaN(Date.parse(v)) && new Date(v) <= new Date()),
      "Fecha de nacimiento inválida",
    ),
  sex: z.enum(SEX_VALUES).optional(),
  maritalStatus: z.enum(MARITAL_VALUES).optional(),
  /// categoría del motivo de consulta inicial (solo se usa al crear el paciente)
  motivoCategoria: z.enum(MOTIVO_VALUES).optional().or(z.literal("")),
  /// motivo de consulta inicial, narrativa libre (solo se usa al crear el paciente)
  motivoConsulta: z.string().max(2000).optional(),
});
export type PatientInput = z.infer<typeof patientSchema>;

export const SEX_OPTIONS = SEX_VALUES;
export const MARITAL_OPTIONS = MARITAL_VALUES;

// ── Asignación ──────────────────────────────────────────────────────────
export const REMINDER_DAYS_OPTIONS = [0, 1, 2, 3, 7] as const;

export const assignmentSchema = z.object({
  patientId: z.string().min(1, "Elegí un paciente"),
  testId: z.string().min(1, "Elegí un test"),
  dueDate: z.string().optional(),
  /// días antes del deadline en que recordar (ej [2,1,0]); vacío = sin recordatorios
  reminderOffsetsDays: z.array(z.number().int().min(0).max(60)).optional(),
  /// avisar al paciente al asignar
  notifyOnAssign: z.boolean().optional(),
});
export type AssignmentInput = z.infer<typeof assignmentSchema>;

// ── Sesiones (agenda + notas + motivo, unificado) ─────────────────────────
export const DURATION_OPTIONS = [30, 45, 50, 60, 90] as const;

// Presets de "cuánto antes" para el recordatorio de la sesión (en minutos).
export const REMINDER_OFFSET_OPTIONS = [
  { value: 1440, label: "1 día antes" },
  { value: 180, label: "3 horas antes" },
  { value: 60, label: "1 hora antes" },
  { value: 30, label: "30 min antes" },
  { value: 15, label: "15 min antes" },
] as const;

// Motivos/temas de consulta más comunes. "otro" habilita texto libre.
export const TOPIC_OPTIONS = [
  { value: "ansiedad", label: "Ansiedad" },
  { value: "estres", label: "Estrés" },
  { value: "depresion", label: "Depresión" },
  { value: "autoestima", label: "Autoestima" },
  { value: "pareja", label: "Relación de pareja" },
  { value: "familia", label: "Familia" },
  { value: "duelo", label: "Duelo" },
  { value: "trauma", label: "Trauma" },
  { value: "otro", label: "Otro" },
] as const;
const TOPIC_VALUES = TOPIC_OPTIONS.map((t) => t.value) as [string, ...string[]];

export const SESSION_STATUS = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELED",
  "NO_SHOW",
] as const;
export const SESSION_STATUS_OPTIONS = [
  { value: "SCHEDULED", label: "Programada" },
  { value: "COMPLETED", label: "Realizada" },
  { value: "NO_SHOW", label: "No asistió" },
  { value: "CANCELED", label: "Cancelada" },
] as const;

export const sessionSchema = z
  .object({
    /** pacientes de la sesión: 0 = bloque, 1 = individual, 2+ = pareja/familia */
    participantIds: z.array(z.string()),
    title: z.string().max(160).optional(),
    date: z.string().min(1, "Elegí una fecha"),
    time: z.string().min(1, "Elegí una hora"),
    durationMin: z.number().int().min(5).max(480),
    status: z.enum(SESSION_STATUS),
    topic: z.enum(TOPIC_VALUES).optional(),
    topicOther: z.string().max(160).optional(),
    // Notas clínicas (observaciones/objetivos/próximos pasos) NO van acá: se
    // cargan en el workspace de la sesión, no al agendar.
    // null = sin recordatorio (RHF revierte `undefined` al default, por eso null).
    reminderOffsetMin: z.number().int().min(0).max(20160).nullable().optional(),
    notifyPatient: z.boolean().optional(),
    /// grupo al que pertenece la sesión (si se agendó para un grupo); "" / undefined = ninguno
    groupId: z.string().optional(),
    /// a qué tratamiento se engancha la sesión (sesión individual):
    /// "active" = tratamiento en curso del paciente (se crea si no hay);
    /// "new" = abre un tratamiento nuevo (cierra el activo si existe), con el motivo de abajo;
    /// "none" = consulta puntual, sin tratamiento.
    treatmentMode: z.enum(["active", "new", "none"]).optional(),
    /// categoría del motivo del tratamiento nuevo (solo si treatmentMode = "new")
    treatmentMotivoCategoria: z.enum(MOTIVO_VALUES).optional().or(z.literal("")),
    /// narrativa libre del motivo del tratamiento nuevo (solo si treatmentMode = "new")
    treatmentMotivoConsulta: z.string().max(2000).optional(),
  })
  .refine(
    (d) => d.participantIds.length > 0 || Boolean(d.title && d.title.trim()),
    {
      message: "Elegí al menos un paciente o escribí un título",
      path: ["participantIds"],
    },
  )
  .refine((d) => d.topic !== "otro" || Boolean(d.topicOther && d.topicOther.trim()), {
    message: "Describí el motivo",
    path: ["topicOther"],
  });
export type SessionInput = z.infer<typeof sessionSchema>;

// ── Bloqueos de horario (eventos sin paciente: supervisión, vacaciones…) ───
// Un bloqueo se guarda como Session sin participantes (solo título). Puede ser
// de un día o de un rango (un Session por día). Lo recurrente/"siempre" no va
// acá: se resuelve con el horario de atención.
export const blockSchema = z
  .object({
    title: z.string().trim().min(1, "Ponele un motivo").max(160),
    startDate: z.string().min(1, "Elegí la fecha"),
    /// fin del rango (inclusive); vacío = bloqueo de un solo día
    endDate: z.string().optional(),
    /// todo el día (ocupa toda la franja del calendario); ignora hora/duración
    allDay: z.boolean().optional(),
    time: z.string().optional(),
    durationMin: z.number().int().min(5).max(480).optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.allDay) {
      if (!d.time)
        ctx.addIssue({ code: "custom", message: "Elegí una hora", path: ["time"] });
      if (!d.durationMin)
        ctx.addIssue({
          code: "custom",
          message: "Elegí la duración",
          path: ["durationMin"],
        });
    }
    if (d.endDate && d.endDate < d.startDate)
      ctx.addIssue({
        code: "custom",
        message: "La fecha de fin no puede ser anterior al inicio",
        path: ["endDate"],
      });
  });
export type BlockInput = z.infer<typeof blockSchema>;

// ── Disponibilidad (horario de atención) ──────────────────────────────────
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida");
export const availabilitySchema = z.object({
  availability: z.record(
    z.string(),
    z.array(z.object({ start: timeStr, end: timeStr })),
  ),
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;

// ── Grupos de pacientes ───────────────────────────────────────────────────
/// Grupo (pareja/familia): nombre + 2 o más pacientes.
export const groupSchema = z.object({
  name: z.string().min(2, "Ingresá un nombre").max(120),
  patientIds: z
    .array(z.string().min(1))
    .min(2, "Un grupo necesita al menos 2 pacientes"),
});
export type GroupInput = z.infer<typeof groupSchema>;

// ── Adjuntos ────────────────────────────────────────────────────────────
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// ── Respuestas del paciente ─────────────────────────────────────────────
/**
 * Valida que las respuestas cubran todos los ítems y que cada valor sea una
 * de las opciones declaradas para ese ítem. `allowedByItem` mapea cada ítem
 * (1-based) a sus valores válidos (derivado de las opciones del test).
 */
export function buildAnswersSchema(allowedByItem: Record<number, number[]>) {
  const itemCount = Object.keys(allowedByItem).length;
  return z
    .record(z.string(), z.number().int())
    .refine((ans) => {
      for (let i = 1; i <= itemCount; i++) {
        const v = ans[String(i)];
        if (v === undefined || v === null) return false;
        if (!allowedByItem[i]?.includes(v)) return false;
      }
      return true;
    }, "Faltan ítems por responder o hay valores inválidos");
}

// ── Tests personalizados (builder) ───────────────────────────────────────
/** Categorías temáticas de los tests (lista fija). */
export const TEST_CATEGORY_OPTIONS = [
  { value: "ansiedad", label: "Ansiedad" },
  { value: "depresion", label: "Depresión" },
  { value: "estado_animo", label: "Estado de ánimo" },
  { value: "estres", label: "Estrés" },
  { value: "autoestima", label: "Autoestima" },
  { value: "personalidad", label: "Personalidad" },
  { value: "cognitivo", label: "Cognitivo" },
  { value: "pareja_familia", label: "Pareja y familia" },
  { value: "otro", label: "Otro" },
] as const;
const TEST_CATEGORY_VALUES = TEST_CATEGORY_OPTIONS.map((c) => c.value) as [
  string,
  ...string[],
];
/** Etiqueta legible de una categoría (fallback al propio valor). */
export function testCategoryLabel(value: string): string {
  return TEST_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? "Otro";
}

/** Una opción de respuesta de la escala del test. */
export const responseOptionSchema = z.object({
  value: z.number().int().min(0).max(100),
  label: z.string().min(1, "Poné una etiqueta").max(80),
});

/** Un rango de interpretación (corte). */
export const cutoffInputSchema = z.object({
  min: z.number().int().min(0),
  max: z.number().int().min(0),
  label: z.string().min(1, "Poné una etiqueta").max(80),
});

/** Puntaje máximo posible: cantidad de preguntas × mayor valor de la escala. */
export function maxTotalScore(
  options: { value: number }[],
  itemCount: number,
): number {
  const maxOption = options.reduce((m, o) => Math.max(m, o.value), 0);
  return maxOption * itemCount;
}

export const testSchema = z
  .object({
    name: z.string().min(2, "Ponele un nombre").max(160),
    description: z.string().min(1, "Escribí una breve descripción").max(1000),
    categories: z
      .array(z.enum(TEST_CATEGORY_VALUES))
      .min(1, "Elegí al menos una categoría")
      .max(TEST_CATEGORY_VALUES.length),
    showResultsToPatient: z.boolean(),
    options: z
      .array(responseOptionSchema)
      .min(2, "Definí al menos 2 opciones de respuesta")
      .max(8, "Máximo 8 opciones"),
    items: z
      .array(z.object({ text: z.string().min(1, "La pregunta no puede estar vacía").max(500) }))
      .min(1, "Agregá al menos una pregunta")
      .max(300, "Máximo 300 preguntas"),
    cutoffs: z
      .array(cutoffInputSchema)
      .min(1, "Definí al menos un rango de interpretación")
      .max(12, "Máximo 12 rangos"),
  })
  .superRefine((data, ctx) => {
    // Los puntajes de las opciones no pueden repetirse.
    const values = data.options.map((o) => o.value);
    if (new Set(values).size !== values.length) {
      ctx.addIssue({
        code: "custom",
        message: "Las opciones no pueden repetir el mismo puntaje",
        path: ["options"],
      });
    }

    // Cada rango: min ≤ max.
    data.cutoffs.forEach((c, i) => {
      if (c.min > c.max) {
        ctx.addIssue({
          code: "custom",
          message: "El mínimo no puede ser mayor que el máximo",
          path: ["cutoffs", i, "max"],
        });
      }
    });

    // Los rangos deben cubrir 0..puntajeMáximo sin huecos ni solapamientos.
    const maxTotal = maxTotalScore(data.options, data.items.length);
    const sorted = [...data.cutoffs].sort((a, b) => a.min - b.min);
    if (sorted.length > 0) {
      if (sorted[0].min !== 0) {
        ctx.addIssue({
          code: "custom",
          message: "El primer rango debe empezar en 0",
          path: ["cutoffs"],
        });
      }
      if (sorted[sorted.length - 1].max !== maxTotal) {
        ctx.addIssue({
          code: "custom",
          message: `El último rango debe terminar en ${maxTotal} (el puntaje máximo posible)`,
          path: ["cutoffs"],
        });
      }
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].min !== sorted[i - 1].max + 1) {
          ctx.addIssue({
            code: "custom",
            message:
              "Los rangos deben ser contiguos: cada uno empieza donde termina el anterior + 1",
            path: ["cutoffs"],
          });
          break;
        }
      }
    }
  });
export type TestInput = z.infer<typeof testSchema>;

// ── Plantillas de estructura del resumen y voces/estilos de redacción ─────────
export const noteTemplateSchema = z.object({
  name: z.string().min(2, "Ponele un nombre").max(120),
  description: z.string().max(300).optional(),
  structure: z
    .string()
    .min(10, "Describí las secciones que querés en el resumen")
    .max(4000),
  isDefault: z.boolean().optional(),
});
export type NoteTemplateInput = z.infer<typeof noteTemplateSchema>;

export const writingVoiceSchema = z.object({
  name: z.string().min(2, "Ponele un nombre").max(120),
  description: z.string().max(300).optional(),
  rules: z
    .array(z.string().trim().min(1, "La regla no puede estar vacía").max(300))
    .min(1, "Agregá al menos una regla")
    .max(20, "Máximo 20 reglas"),
  isDefault: z.boolean().optional(),
});
export type WritingVoiceInput = z.infer<typeof writingVoiceSchema>;

// ── Check-ins (seguimiento por WhatsApp) ──────────────────────────────────
export const CHECKIN_QUESTION_TYPES = ["SCALE_1_10", "YES_NO", "CHOICE"] as const;
export const CHECKIN_TYPE_OPTIONS = [
  { value: "SCALE_1_10", label: "Escala 1 a 10" },
  { value: "YES_NO", label: "Sí / No" },
  { value: "CHOICE", label: "Opción múltiple" },
] as const;

export const CHECKIN_FREQUENCIES = ["DAILY", "EVERY_N_DAYS", "WEEKDAYS"] as const;
export const CHECKIN_FREQUENCY_OPTIONS = [
  { value: "DAILY", label: "Todos los días" },
  { value: "EVERY_N_DAYS", label: "Cada N días" },
  { value: "WEEKDAYS", label: "Días de la semana" },
] as const;

// 0 = domingo … 6 = sábado (igual que Date.getDay()).
export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
] as const;

// Preguntas predefinidas que el psicólogo puede usar como punto de partida.
export const CHECKIN_PRESETS: {
  question: string;
  questionType: (typeof CHECKIN_QUESTION_TYPES)[number];
  options?: string[];
}[] = [
  { question: "¿Cómo estuvo tu ánimo hoy?", questionType: "SCALE_1_10" },
  { question: "¿Qué nivel de estrés sentiste hoy?", questionType: "SCALE_1_10" },
  { question: "¿Cómo dormiste anoche?", questionType: "CHOICE", options: ["Bien", "Regular", "Mal"] },
  { question: "¿Tuviste momentos de ansiedad hoy?", questionType: "YES_NO" },
  { question: "¿Hiciste el ejercicio que acordamos?", questionType: "YES_NO" },
];

/** Fecha local de hoy como "YYYY-MM-DD" (para comparar con los date inputs). */
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export const checkinPlanSchema = z
  .object({
    patientId: z.string().min(1, "Falta el paciente"),
    question: z.string().min(3, "Escribí la pregunta").max(280),
    questionType: z.enum(CHECKIN_QUESTION_TYPES),
    options: z.array(z.string().min(1).max(60)).max(6).optional(),
    frequency: z.enum(CHECKIN_FREQUENCIES),
    everyNDays: z.number().int().min(1).max(30).optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    timeOfDay: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
    startDate: z.string().min(1, "Elegí la fecha de inicio"),
    endDate: z.string().min(1, "Elegí la fecha de fin"),
  })
  .superRefine((d, ctx) => {
    if (d.questionType === "CHOICE" && (d.options?.length ?? 0) < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Definí al menos 2 opciones",
        path: ["options"],
      });
    }
    if (d.frequency === "EVERY_N_DAYS" && !d.everyNDays) {
      ctx.addIssue({
        code: "custom",
        message: "Indicá cada cuántos días",
        path: ["everyNDays"],
      });
    }
    if (d.frequency === "WEEKDAYS" && (d.weekdays?.length ?? 0) < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Elegí al menos un día",
        path: ["weekdays"],
      });
    }
    if (d.startDate < todayStr()) {
      ctx.addIssue({
        code: "custom",
        message: "La fecha de inicio no puede ser anterior a hoy",
        path: ["startDate"],
      });
    }
    if (d.endDate < d.startDate) {
      ctx.addIssue({
        code: "custom",
        message: "La fecha de fin no puede ser anterior al inicio",
        path: ["endDate"],
      });
    }
  });
export type CheckinPlanInput = z.infer<typeof checkinPlanSchema>;
