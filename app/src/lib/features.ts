/**
 * Catálogo de funciones (feature flags) en dos niveles:
 *  1. ENTITLEMENT (super admin): si el psicólogo TIENE la función disponible.
 *  2. PREFERENCIA (psicólogo): si la tiene, si la prende o apaga.
 * Efectivo = habilitada por el admin Y prendida por el psicólogo.
 *
 * Ambos se guardan como JSON en `User` (`featureEntitlements` / `featurePreferences`):
 * `{ [key]: boolean }`. Default ON (clave ausente = habilitada), así no hace falta
 * backfill y los planes futuros solo escriben este mismo objeto (ver
 * memoria business-model-mvp: plan = preset de funciones).
 */

export const FEATURE_KEYS = [
  "whatsappCheckins",
  "whatsappReminders",
  "whatsappAppointments",
  "whatsappTests",
  "whatsappTasks",
  "aiSummary",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURES: Record<
  FeatureKey,
  { label: string; description: string }
> = {
  whatsappCheckins: {
    label: "Seguimiento por WhatsApp",
    description: "Check-ins programados que se le envían al paciente.",
  },
  whatsappReminders: {
    label: "Recordatorios de cita",
    description: "Aviso por WhatsApp antes de cada sesión.",
  },
  whatsappAppointments: {
    label: "Avisos de cita",
    description: "Aviso al agendar, reprogramar o cancelar una sesión.",
  },
  whatsappTests: {
    label: "Tests por WhatsApp",
    description: "Aviso de asignación y recordatorios para completar tests.",
  },
  whatsappTasks: {
    label: "Tareas por WhatsApp",
    description: "Enviar al paciente la tarea/consigna al finalizar una sesión.",
  },
  aiSummary: {
    label: "Resumen con IA",
    description:
      "Generar un resumen clínico de la sesión con IA a partir de las observaciones.",
  },
};

/** Mapa de flags tal como sale del JSON de Prisma. */
export type FeatureFlags = Record<string, boolean> | null | undefined;

/** ¿La función está prendida a nivel PLATAFORMA? (interruptor maestro, default sí). */
export function platformOn(platform: FeatureFlags, key: FeatureKey): boolean {
  return platform?.[key] !== false;
}

/** ¿El admin le dejó disponible esta función al psicólogo? (default: sí). */
export function isEntitled(entitlements: FeatureFlags, key: FeatureKey): boolean {
  return entitlements?.[key] !== false;
}

/**
 * Efectivo: la función está prendida en la plataforma Y el admin la habilitó al
 * psicólogo Y el psicólogo no la apagó (los tres default ON). Si la plataforma
 * la apaga, queda off para todos sin importar entitlement/preferencia.
 */
export function featureEnabled(
  entitlements: FeatureFlags,
  prefs: FeatureFlags,
  key: FeatureKey,
  platform?: FeatureFlags,
): boolean {
  return (
    platform?.[key] !== false &&
    entitlements?.[key] !== false &&
    prefs?.[key] !== false
  );
}

/**
 * Claves que el psicólogo puede ver/configurar: las que el admin le habilitó Y
 * que están prendidas a nivel plataforma (si la plataforma la apagó, ni la ve).
 */
export function entitledKeys(
  entitlements: FeatureFlags,
  platform?: FeatureFlags,
): FeatureKey[] {
  return FEATURE_KEYS.filter(
    (k) => isEntitled(entitlements, k) && platformOn(platform, k),
  );
}
