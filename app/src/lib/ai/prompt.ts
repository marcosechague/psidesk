import type { SummarizeInput, SummaryKind } from "./types";

// Prompt compartido por todos los proveedores: misma instrucción, mismo input.
// Así cambiar de modelo no cambia el estilo del resumen.
//
// Dos ejes ortogonales (inspirado en Klarify):
//  - ESTRUCTURA: qué secciones tiene. Para el resumen viene de la PLANTILLA
//    elegida (`templateStructure`); para pasos/paciente es fija (abajo).
//  - VOZ / ESTILO: cómo se redacta. Lista de reglas (`voiceRules`) que se
//    anexan al system prompt y aplican a las tres piezas.

/** Guía de estructura por defecto del resumen (si la plantilla no trae una). */
const DEFAULT_SUMMARY_GUIDE =
  "Escribí el resumen en prosa clara, con un título **Resumen** y, si aplica, una sección **Temas de la sesión** en viñetas.";

/** Estructura fija de los PRÓXIMOS PASOS (nota recordatorio para el profesional). */
const PASOS_GUIDE =
  "Generá una NOTA DE PRÓXIMOS PASOS pensada como RECORDATORIO PARA EL PROFESIONAL (no para el paciente): es lo que el psicólogo va a leer al empezar la próxima sesión para ubicarse en qué quedó pendiente. Estructurala en dos partes con viñetas:\n**Para retomar (vos):** qué trabajar, explorar o seguir de cerca la próxima vez, foco y pendientes de tu parte.\n**Tarea del paciente:** qué quedó para que haga el paciente entre sesiones (ejercicios, registros, hábitos, tests/seguimientos asignados). Si no se asignó nada, poné una viñeta que diga 'Sin tarea asignada'.\nSolo lo que se desprenda de las notas; no inventes. Concisa y accionable, sin preámbulos.";

/** Estructura fija del MENSAJE PARA EL PACIENTE (formato WhatsApp). */
const PACIENTE_GUIDE =
  "Escribí un MENSAJE ESTRUCTURADO PARA EL PACIENTE (tuteo, cálido y simple), pensado para enviar por WhatsApp. Usá exactamente este formato, una etiqueta por línea y omitiendo la que no aplique:\n*Sesión del [fecha de la sesión]*\n*Temas que trabajamos:* <1 o 2 líneas en palabras simples>\n*Recomendaciones:* <lo que sugirió el profesional>\n*Tarea:* <qué tiene que hacer hasta la próxima; si no hay tarea, omití esta línea entera>\nUsá *negrita de WhatsApp* (asteriscos) solo en las etiquetas. Nada de jerga clínica ni diagnósticos. Incluí solo lo que aparezca en las notas o en lo asignado; no inventes. Sin saludo inicial ni firma (se agregan aparte).";

export const SUMMARY_SYSTEM = [
  "Sos un asistente clínico para psicólogos en Paraguay.",
  "Tu tarea: convertir las notas crudas de una sesión (que el profesional ya escribió) en un resumen clínico claro y profesional, en español rioplatense neutro.",
  "Reglas:",
  "- Resumí y organizá; NO inventes datos, diagnósticos ni intervenciones que no estén en las notas.",
  "- No agregues consejos ni opiniones propias; sos un asistente de redacción, no el terapeuta.",
  "- Mantené la confidencialidad: usá solo lo provisto.",
  "- Salida en markdown, conciso. Sin preámbulos como 'Aquí está el resumen'.",
].join("\n");

/** System prompt para el mensaje PARA EL PACIENTE (no clínico). */
export const PATIENT_MESSAGE_SYSTEM = [
  "Ayudás a un psicólogo en Paraguay a redactar un mensaje breve y cálido PARA SU PACIENTE, a partir de las notas de la sesión.",
  "El mensaje lo lee el PACIENTE (no es una nota clínica) y se envía por WhatsApp. Reglas:",
  "- Tono cálido, cercano y simple. Tuteo. Español rioplatense neutro.",
  "- NADA de jerga clínica, diagnósticos, hipótesis ni terminología técnica.",
  "- Basate SOLO en lo provisto; no inventes. Mencioná únicamente lo que aparezca en las notas o en lo asignado.",
  "- Seguí la estructura de etiquetas que se te indica (Sesión del [fecha], Temas que trabajamos, Recomendaciones, Tarea), una por línea, omitiendo la que no aplique. Si no hay tarea, no la inventes ni la menciones.",
  "- Podés usar *negrita de WhatsApp* (asteriscos) solo en las etiquetas; sin otros markdown ni viñetas.",
  "- Breve y claro, cada sección de 1 a 2 líneas. Sin saludo inicial ni firma (se agregan por separado).",
].join("\n");

/** System prompt según el kind, con las reglas de la VOZ anexadas (si hay). */
export function buildSystem(
  kind: SummaryKind,
  voiceRules?: string[] | null,
): string {
  const base = kind === "paciente" ? PATIENT_MESSAGE_SYSTEM : SUMMARY_SYSTEM;
  const rules = (voiceRules ?? []).map((r) => r.trim()).filter(Boolean);
  if (!rules.length) return base;
  return [
    base,
    "",
    "Estilo de redacción (respetá estas reglas, sin que cambien la estructura pedida):",
    ...rules.map((r) => `- ${r}`),
  ].join("\n");
}

/** Instrucción de emojis para el mensaje al paciente, según la preferencia. */
const EMOJIS_ON =
  "Agregá UN emoji suave y pertinente al inicio de cada etiqueta (ej: 📅 para la fecha, 📝 temas, 💡 recomendaciones, ✅ tarea). Máximo uno por línea, nada recargado. IMPORTANTE: si el motivo de la sesión es delicado (duelo, trauma, crisis, ideación), NO uses emojis: serían fuera de lugar.";
const EMOJIS_OFF = "No uses emojis: texto sobrio.";

/** Guía de estructura: plantilla (summary) o estructura fija (pasos/paciente). */
function structureGuide(input: SummarizeInput): string {
  if (input.kind === "pasos") return PASOS_GUIDE;
  if (input.kind === "paciente") {
    return `${PACIENTE_GUIDE}\n${input.emojis ? EMOJIS_ON : EMOJIS_OFF}`;
  }
  return input.templateStructure?.trim() || DEFAULT_SUMMARY_GUIDE;
}

/** Arma el mensaje de usuario con el material clínico. */
export function buildSummaryUserPrompt(input: SummarizeInput): string {
  const parts: string[] = [];
  if (input.date) parts.push(`Fecha de la sesión: ${input.date}`);
  if (input.patientName) parts.push(`Paciente: ${input.patientName}`);
  if (input.topic) parts.push(`Motivo: ${input.topic}`);
  parts.push("", structureGuide(input), "", "── Observaciones ──", input.observations.trim());
  if (input.goals?.trim()) parts.push("", "── Foco/objetivos ──", input.goals.trim());
  if (input.nextSteps?.trim()) parts.push("", "── Próximos pasos ──", input.nextSteps.trim());
  if (input.assigned?.length)
    parts.push(
      "",
      "── Asignado al paciente en esta sesión ──",
      ...input.assigned.map((a) => `- ${a}`),
    );
  return parts.join("\n");
}
