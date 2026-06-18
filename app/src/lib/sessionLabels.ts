import { TOPIC_OPTIONS, SESSION_STATUS_OPTIONS } from "./validations";

const TOPIC_LABEL: Record<string, string> = Object.fromEntries(
  TOPIC_OPTIONS.map((t) => [t.value, t.label]),
);

/** Texto a mostrar del motivo: el label del preset, o el texto libre si es "otro". */
export function topicLabel(
  topic: string | null | undefined,
  topicOther?: string | null,
): string | null {
  if (!topic) return null;
  if (topic === "otro") return topicOther || "Otro";
  return TOPIC_LABEL[topic] ?? topic;
}

const STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(SESSION_STATUS_OPTIONS.map((s) => [s.value, s.label])),
  // IN_PROGRESS no está en el dropdown (se setea con "Iniciar"), pero igual se muestra.
  IN_PROGRESS: "En curso",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/** Variante de Badge para cada estado de sesión. */
export function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "COMPLETED":
      return "secondary";
    case "IN_PROGRESS":
      return "default";
    case "SCHEDULED":
      return "default";
    case "NO_SHOW":
      return "destructive";
    case "CANCELED":
      return "outline";
    default:
      return "outline";
  }
}

/** Estado de un plan de check-ins por WhatsApp. */
export function checkinStatusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Activo";
    case "PAUSED":
      return "Pausado";
    case "ENDED":
      return "Terminado";
    default:
      return status;
  }
}

/** Variante de Badge para el estado de un plan de check-ins. */
export function checkinStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  return status === "ACTIVE" ? "default" : "outline";
}

/** Énfasis visual de una sesión según estado/posición (compartido entre listados). */
export type SessionEmphasis = "active" | "next" | "muted" | "normal";

/** Clase de borde/fondo para destacar una sesión. Unifica el criterio en toda la app:
 *  en curso (resaltada), próxima (acento), cancelada/no-show (atenuada), normal. */
export function sessionEmphasisClass(e: SessionEmphasis): string {
  switch (e) {
    case "active":
      return "border-primary bg-primary/5";
    case "next":
      return "border-primary/40";
    case "muted":
      return "border-border opacity-65";
    default:
      return "border-border";
  }
}

/** Énfasis derivado solo del estado (la posición "next" la decide el listado). */
export function statusEmphasis(status: string): SessionEmphasis {
  if (status === "IN_PROGRESS") return "active";
  if (status === "CANCELED" || status === "NO_SHOW") return "muted";
  return "normal";
}

// ── Colores semánticos por estado para el calendario ──────────────────────
// Programada = azul (lo que viene) · En curso = verde (pasando ahora) ·
// Realizada = gris (hecho) · Cancelada/No asistió = rojo (tachado).
// Fuente ÚNICA: la usan WeekGrid (bloques), MonthGrid (chips) y la leyenda.

// Los bloqueos de horario (eventos sin paciente) NO son sesiones clínicas: se
// pintan neutros, con borde punteado y un rayado diagonal (vía estilo inline,
// BLOCK_STRIPE_STYLE) para distinguirlos a simple vista de las sesiones.
const BLOCK_WEEK_CLASS =
  "bg-muted text-muted-foreground border-dashed border-muted-foreground/50";
const BLOCK_MONTH_CLASS =
  "bg-muted text-muted-foreground border border-dashed border-muted-foreground/50";

/** Rayado diagonal del bloqueo (estilo inline, robusto frente al parser CSS). */
export const BLOCK_STRIPE_STYLE = {
  backgroundImage:
    "repeating-linear-gradient(45deg, color-mix(in oklab, var(--muted-foreground) 22%, transparent) 0 5px, transparent 5px 11px)",
} as const;

/** Clase para el bloque de sesión en la vista Semana (fondo + texto + borde). */
export function calBlockClass(status: string, isBlock = false): string {
  if (isBlock) return BLOCK_WEEK_CLASS;
  switch (status) {
    case "IN_PROGRESS":
      return "bg-level-ok/25 text-foreground border-level-ok";
    case "COMPLETED":
      return "bg-muted text-muted-foreground border-border";
    case "CANCELED":
    case "NO_SHOW":
      return "bg-destructive/10 text-destructive border-destructive/30 line-through";
    default: // SCHEDULED
      return "bg-info/15 text-foreground border-info/40";
  }
}

/** Clase para el chip de sesión en la vista Mes (fondo + texto). */
export function calChipClass(status: string, isBlock = false): string {
  if (isBlock) return BLOCK_MONTH_CLASS;
  switch (status) {
    case "IN_PROGRESS":
      return "bg-level-ok/25 text-foreground";
    case "COMPLETED":
      return "bg-muted text-muted-foreground";
    case "CANCELED":
    case "NO_SHOW":
      return "bg-destructive/10 text-destructive line-through";
    default: // SCHEDULED
      return "bg-info/15 text-foreground";
  }
}

/** Leyenda de colores del calendario (etiqueta + clase del puntito sólido). */
export const CAL_LEGEND: { label: string; dot: string }[] = [
  { label: "Programada", dot: "bg-info" },
  { label: "En curso", dot: "bg-level-ok" },
  { label: "Realizada", dot: "bg-muted-foreground/50" },
  { label: "Cancelada / No asistió", dot: "bg-destructive" },
  { label: "Bloqueo", dot: "border border-dashed border-muted-foreground/60" },
];
