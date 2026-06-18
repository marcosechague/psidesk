import type { CheckinQuestionType, CheckinFrequency } from "@prisma/client";
import type { OutgoingMessage } from "@/lib/whatsapp/types";

// ── Fechas / timezone ──────────────────────────────────────────────────────
export interface LocalDate {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Offset en ms (local - UTC) de una zona horaria en un instante dado. */
function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUTC - instant.getTime();
}

/** Fecha local (calendario) de un instante en una zona horaria. */
export function localDateInTz(instant: Date, tz: string): LocalDate {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return { year: p.year, month: p.month, day: p.day };
}

/** Lee una fecha-calendario guardada como medianoche UTC (start/end del plan). */
export function asLocalDate(d: Date): LocalDate {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function dateUTC(d: LocalDate): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

/** Días enteros entre dos fechas-calendario (b - a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((dateUTC(b) - dateUTC(a)) / 86_400_000);
}

/** Día de la semana (0=domingo … 6=sábado) de una fecha-calendario. */
export function weekdayOf(d: LocalDate): number {
  return new Date(dateUTC(d)).getUTCDay();
}

/** Instante UTC de `date` a las `time` ("HH:MM") en la zona `tz`. */
export function zonedInstant(date: LocalDate, time: string, tz: string): Date {
  const [h, m] = time.split(":").map(Number);
  const guess = Date.UTC(date.year, date.month - 1, date.day, h || 0, m || 0);
  const offset = tzOffsetMs(new Date(guess), tz);
  return new Date(guess - offset);
}

// ── ¿Toca un check-in este día? ─────────────────────────────────────────────
export interface DuePlan {
  frequency: CheckinFrequency;
  everyNDays: number | null;
  weekdays: number[];
  startDate: Date;
  endDate: Date;
}

/** ¿Corresponde enviar el check-in del plan en la fecha local `today`? */
export function isDueOn(plan: DuePlan, today: LocalDate): boolean {
  const start = asLocalDate(plan.startDate);
  const end = asLocalDate(plan.endDate);
  if (daysBetween(start, today) < 0) return false; // antes de empezar
  if (daysBetween(today, end) < 0) return false; // después de terminar

  switch (plan.frequency) {
    case "DAILY":
      return true;
    case "EVERY_N_DAYS": {
      const n = plan.everyNDays ?? 1;
      return n >= 1 && daysBetween(start, today) % n === 0;
    }
    case "WEEKDAYS":
      return plan.weekdays.includes(weekdayOf(today));
    default:
      return false;
  }
}

/** Suma `n` días a una fecha-calendario. */
export function addDays(d: LocalDate, n: number): LocalDate {
  const dt = new Date(Date.UTC(d.year, d.month - 1, d.day) + n * 86_400_000);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

/** Todas las fechas-calendario en las que corresponde el plan (de start a end). */
export function dueDatesBetween(plan: DuePlan): LocalDate[] {
  const start = asLocalDate(plan.startDate);
  const end = asLocalDate(plan.endDate);
  const total = daysBetween(start, end);
  if (total < 0) return [];
  const out: LocalDate[] = [];
  for (let i = 0; i <= total; i++) {
    const d = addDays(start, i);
    if (isDueOn(plan, d)) out.push(d);
  }
  return out;
}

// ── Mensaje + parseo de respuesta ────────────────────────────────────────────
/** Arma el texto del mensaje que recibe el paciente. */
export function formatQuestion(
  question: string,
  type: CheckinQuestionType,
  options: string[] = [],
): string {
  switch (type) {
    case "SCALE_1_10":
      return `${question}\n\nRespondé con un número del 1 (mínimo) al 10 (máximo).`;
    case "YES_NO":
      return `${question}\n\nRespondé SÍ o NO.`;
    case "CHOICE":
      return `${question}\n\n${options
        .map((o, i) => `${i + 1}) ${o}`)
        .join("\n")}\n\nRespondé con el número de la opción.`;
    default:
      return question;
  }
}

/** Recorta a `max` caracteres (los límites de botones/filas de WhatsApp). */
function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * Pregunta + instrucción en UNA sola línea, para usar como variable de un
 * template de Meta (las variables no admiten saltos de línea ni tabs).
 */
export function formatQuestionLine(
  question: string,
  type: CheckinQuestionType,
  options: string[] = [],
): string {
  const q = question.replace(/\s+/g, " ").trim();
  switch (type) {
    case "SCALE_1_10":
      return `${q} Respondé con un número del 1 (mínimo) al 10 (máximo).`;
    case "YES_NO":
      return `${q} Respondé SÍ o NO.`;
    case "CHOICE":
      return `${q} Respondé con el número de la opción: ${options
        .map((o, i) => `${i + 1}) ${o}`)
        .join(", ")}.`;
    default:
      return q;
  }
}

/** Saludo del mensaje, con el nombre del paciente y del profesional si los hay. */
export function greeting(professional = "", patient = ""): string {
  const who = professional.trim() || "Tu profesional";
  const hi = patient.trim() ? `Hola ${patient.trim()} 👋,` : "Hola 👋";
  return `${hi} ${who} te dejó una pregunta de seguimiento:`;
}

/** Contexto opcional del mensaje (nombres para el saludo, mostrar saludo o no). */
export interface MessageContext {
  professional?: string;
  /// nombre de pila del paciente
  patient?: string;
  /// si false, no incluye el saludo (ej. 2º paso del flujo híbrido)
  greet?: boolean;
}

/**
 * Arma el mensaje interactivo para el paciente. Usa botones (hasta 3) o lista
 * (hasta 10) según el tipo; cae a texto si no entra en interactivo.
 * El `id` de cada opción es el token que entiende `parseReply` (ej "si", "7").
 */
export function buildMessage(
  question: string,
  type: CheckinQuestionType,
  options: string[] = [],
  ctx: MessageContext = {},
): OutgoingMessage {
  const { professional = "", patient = "", greet = true } = ctx;
  const body = greet
    ? `${greeting(professional, patient)}\n\n*${question}*`
    : `*${question}*`;
  switch (type) {
    case "YES_NO":
      return {
        kind: "buttons",
        body,
        buttons: [
          { id: "si", title: "Sí 👍" },
          { id: "no", title: "No 👎" },
        ],
      };
    case "CHOICE": {
      const opts = options.slice(0, 10);
      if (opts.length === 0) return { kind: "text", body };
      if (opts.length <= 3) {
        return {
          kind: "buttons",
          body,
          buttons: opts.map((o, i) => ({ id: String(i + 1), title: truncate(o, 20) })),
        };
      }
      return {
        kind: "list",
        body,
        button: "Ver opciones",
        rows: opts.map((o, i) => ({ id: String(i + 1), title: truncate(o, 24) })),
      };
    }
    case "SCALE_1_10":
      return {
        kind: "list",
        body,
        button: "Elegir 1 a 10",
        rows: Array.from({ length: 10 }, (_, i) => {
          const n = i + 1;
          return {
            id: String(n),
            title: String(n),
            description: n === 1 ? "Mínimo" : n === 10 ? "Máximo" : undefined,
          };
        }),
      };
    default:
      return { kind: "text", body: question };
  }
}

export interface ParsedReply {
  ok: boolean;
  /** escala (1-10), sí/no (1/0) o índice de opción (1-based); null si no se entendió */
  value: number | null;
}

/** Interpreta la respuesta cruda del paciente según el tipo de pregunta. */
export function parseReply(
  type: CheckinQuestionType,
  raw: string,
  optionCount = 0,
): ParsedReply {
  const text = raw.trim().toLowerCase();
  switch (type) {
    case "SCALE_1_10": {
      const m = text.match(/\d{1,2}/);
      const n = m ? Number(m[0]) : NaN;
      return n >= 1 && n <= 10 ? { ok: true, value: n } : { ok: false, value: null };
    }
    case "YES_NO": {
      const first = text.split(/\s+/)[0];
      const YES = new Set(["si", "sí", "s", "yes", "y", "1", "dale", "ok", "sip"]);
      const NO = new Set(["no", "n", "0", "nop", "nope"]);
      if (YES.has(first)) return { ok: true, value: 1 };
      if (NO.has(first)) return { ok: true, value: 0 };
      return { ok: false, value: null };
    }
    case "CHOICE": {
      const m = text.match(/\d{1,2}/);
      const n = m ? Number(m[0]) : NaN;
      return n >= 1 && n <= optionCount
        ? { ok: true, value: n }
        : { ok: false, value: null };
    }
    default:
      return { ok: false, value: null };
  }
}

/** Texto legible de un valor de respuesta (para la UI/historial). */
export function describeValue(
  type: CheckinQuestionType,
  value: number | null,
  options: string[] = [],
): string {
  if (value == null) return "—";
  switch (type) {
    case "SCALE_1_10":
      return `${value}/10`;
    case "YES_NO":
      return value === 1 ? "Sí" : "No";
    case "CHOICE":
      return options[value - 1] ?? `Opción ${value}`;
    default:
      return String(value);
  }
}

/**
 * Mensaje de acuse de recibo que se manda al paciente tras su respuesta.
 * Si la entendimos, confirma; si no, vuelve a pedirla (re-pregunta).
 * Es texto de sesión (la respuesta abrió la ventana de 24 h), no template.
 */
export function ackMessage(
  question: string,
  type: CheckinQuestionType,
  options: string[],
  parsed: ParsedReply,
): OutgoingMessage {
  if (parsed.ok) {
    return {
      kind: "text",
      body: `¡Gracias! Registré tu respuesta: *${describeValue(type, parsed.value, options)}* 🙏`,
    };
  }
  return {
    kind: "text",
    body: `Mmm, no entendí tu respuesta 🤔\n\n${formatQuestionLine(question, type, options)}`,
  };
}
