// Tipos del driver de IA. Sin secretos ni process.env acá: solo contratos.

export type AiProviderName =
  | "anthropic"
  | "openai"
  | "google"
  | "deepseek"
  | "mock";

/** Catálogo de proveedores: label, modelo por defecto, modelos sugeridos y la
 *  env var de su clave. `models` alimenta el selector del admin; igual se puede
 *  escribir uno personalizado, porque los IDs cambian seguido. */
export const AI_PROVIDERS: {
  value: AiProviderName;
  label: string;
  defaultModel: string;
  /** Modelos sugeridos para el selector (no exhaustivo). */
  models?: { value: string; label: string }[];
  keyEnv?: string;
}[] = [
  { value: "mock", label: "Mock (sin costo)", defaultModel: "" },
  {
    value: "anthropic",
    label: "Anthropic (Claude)",
    defaultModel: "claude-sonnet-4-6",
    keyEnv: "ANTHROPIC_API_KEY",
    models: [
      { value: "claude-opus-4-8", label: "Claude Opus 4.8 (máxima calidad)" },
      { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (equilibrado)" },
      { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (rápido y económico)" },
    ],
  },
  {
    value: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    keyEnv: "OPENAI_API_KEY",
    models: [
      { value: "gpt-4o-mini", label: "GPT-4o mini (económico)" },
      { value: "gpt-4o", label: "GPT-4o" },
    ],
  },
  {
    value: "google",
    label: "Google (Gemini)",
    defaultModel: "gemini-2.0-flash",
    keyEnv: "GOOGLE_API_KEY",
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (rápido)" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-v4-flash",
    keyEnv: "DEEPSEEK_API_KEY",
    models: [
      { value: "deepseek-v4-flash", label: "DeepSeek V4 Flash (rápido y económico)" },
      { value: "deepseek-v4-pro", label: "DeepSeek V4 Pro (razonamiento profundo)" },
      // Legacy: descontinuados el 24-jul-2026, redirigen a v4-flash. Para apps nuevas usar v4-flash.
      { value: "deepseek-chat", label: "DeepSeek Chat (legacy → v4-flash)" },
      { value: "deepseek-reasoner", label: "DeepSeek Reasoner (legacy → v4-flash thinking)" },
    ],
  },
];

/** Modelo por defecto de un proveedor (vacío para mock). */
export function defaultModelFor(provider: AiProviderName): string {
  return AI_PROVIDERS.find((p) => p.value === provider)?.defaultModel ?? "";
}

/** Modelos sugeridos para un proveedor (vacío si no hay catálogo). */
export function modelsFor(provider: AiProviderName): { value: string; label: string }[] {
  return AI_PROVIDERS.find((p) => p.value === provider)?.models ?? [];
}

/** Qué pieza estamos generando:
 *  - "summary":  resumen clínico (la ESTRUCTURA viene de la plantilla elegida).
 *  - "pasos":    nota de próximos pasos para el profesional (estructura fija).
 *  - "paciente": mensaje cálido y simple PARA el paciente (estructura fija).
 *  La VOZ (estilo de redacción) se aplica a las tres. */
export type SummaryKind = "summary" | "pasos" | "paciente";

/** Material clínico que entra al resumen (lo que el psicólogo ya escribió). */
export interface SummarizeInput {
  observations: string;
  goals?: string | null;
  nextSteps?: string | null;
  patientName?: string | null;
  topic?: string | null;
  /** Fecha de la sesión, ya formateada (ej: "9 de junio de 2026"). */
  date?: string | null;
  /** Lo asignado al paciente en esta sesión (tests, seguimientos), para el
   *  mensaje al paciente. Ej: ["Test para completar: PHQ-9"]. */
  assigned?: string[] | null;
  /** Qué pieza generar. */
  kind: SummaryKind;
  /** Estructura/secciones de la plantilla elegida (solo aplica a kind="summary").
   *  Si falta, se usa una guía narrativa por defecto. */
  templateStructure?: string | null;
  /** Reglas de la voz (estilo de redacción); se aplican a TODO lo generado. */
  voiceRules?: string[] | null;
  /** Solo kind="paciente": usar emojis suaves en el mensaje de WhatsApp. */
  emojis?: boolean | null;
}

export interface SummarizeResult {
  /** Resumen en markdown. Vacío si error. */
  text: string;
  /** Modelo efectivamente usado (para auditoría). */
  model: string;
  error?: string;
}

export interface AiDriver {
  name: AiProviderName;
  summarize(input: SummarizeInput): Promise<SummarizeResult>;
}
