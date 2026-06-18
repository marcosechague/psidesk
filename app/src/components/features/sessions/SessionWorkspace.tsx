"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Play,
  Square,
  Ban,
  UserX,
  RotateCcw,
  MoreVertical,
  Clock,
  Timer,
  Users as UsersIcon,
  FileText,
  Paperclip,
  CalendarClock,
  ArrowUpRight,
  AlertTriangle,
  Loader2,
  Check,
  CalendarPlus,
  Flag,
  Target,
  History,
  UserRound,
  TrendingUp,
  Eye,
  EyeOff,
  FilePlus,
  MessageCircle,
  Mic,
  Pencil,
  Sparkles,
  Send,
  Stethoscope,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import {
  startSession,
  finishSession,
  setSessionStatus,
  saveSessionNotes,
  saveIndividualNotes,
  generateSessionSummary,
  saveSessionSummary,
  saveSessionPatientMessage,
  generatePatientMessage,
  generateSessionNextSteps,
  generateSessionContent,
  setPatientMessageEmojis,
  sendSessionTask,
  createDiagnosis,
  markResultReviewedAction,
} from "@/server/actions";
import { searchDiagnoses } from "@/lib/diagnoses";
import { topicLabel, statusLabel, statusBadgeVariant } from "@/lib/sessionLabels";
import { TONE_BADGE } from "@/lib/levels";
import type { PatientSnapshot } from "@/lib/clinicalSummary";
import type { EvolutionPoint, EvolutionSeries } from "@/lib/evolution";
import { EvolutionChart } from "@/components/features/results/EvolutionChart";
import { ReportView } from "@/components/features/results/ReportView";
import { ResponseSummary } from "@/components/features/results/ResponseSummary";
import type { ScoreResult } from "@/lib/scoring/types";
import type { ResponseType } from "@prisma/client";
import { AssignDialog } from "@/components/features/assignments/AssignDialog";
import { CheckinPlanForm } from "@/components/features/checkins/CheckinPlanForm";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { SECTION_LABEL } from "@/lib/ui";
import { EmptyState } from "@/components/ui/empty-state";
import { Markdown } from "@/components/ui/markdown";
import { WhatsappPreview } from "@/components/ui/whatsapp-preview";
import { SessionForm } from "./SessionForm";

interface WorkspaceParticipant {
  participantId: string;
  patientId: string;
  fullName: string;
  age: number | null;
  sex: string | null;
  maritalStatus: string | null;
  email: string | null;
  phone: string | null;
  individualNotes: string | null;
  snapshot: PatientSnapshot;
  /** Series de evolución por test (solo tests con ≥2 tomas), para el gráfico. */
  testCharts: {
    testName: string;
    data: EvolutionPoint[];
    series: EvolutionSeries[];
  }[];
  assignments: {
    id: string;
    testId: string;
    testName: string;
    status: string;
    createdAt: Date | string;
    completedAt: Date | string | null;
    hasResult: boolean;
    /** Detalle del informe para mostrarlo inline (sin navegar a /resultados). */
    testDescription: string | null;
    responseType: ResponseType;
    itemsJson: unknown;
    scoresJson: ScoreResult | null;
    findings: { label: string; value: string }[] | null;
    notes: string | null;
    editedAt: Date | string | null;
    answersJson: unknown;
  }[];
  attachments: { id: string; fileName: string; createdAt: Date | string }[];
  diagnoses: {
    code: string;
    label: string;
    isPrimary: boolean;
    createdAt: Date | string;
  }[];
  manualResults: {
    testName: string;
    takenAt: Date | string;
    findings: { label: string; value: string }[];
    notes: string | null;
  }[];
  checkinPlans: {
    id: string;
    question: string;
    status: string;
    createdAt: Date | string;
  }[];
  history: {
    id: string;
    startsAt: Date | string;
    status: string;
    topic: string | null;
    topicOther: string | null;
  }[];
}

type WorkspaceAssignment = WorkspaceParticipant["assignments"][number];
type WorkspaceManualResult = WorkspaceParticipant["manualResults"][number];

interface WorkspaceSession {
  id: string;
  title: string | null;
  startsAt: Date | string;
  durationMin: number;
  status: string;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  topic: string | null;
  topicOther: string | null;
  observations: string | null;
  goals: string | null;
  nextSteps: string | null;
  summary: string | null;
  templateId: string | null;
  voiceId: string | null;
  summaryModel: string | null;
  summaryAt: Date | string | null;
  patientMessage: string | null;
  taskSentAt: Date | string | null;
  participants: WorkspaceParticipant[];
}

/** Opción de plantilla de estructura (resumen) o de voz/estilo, para los selectores. */
export interface TemplateOption {
  id: string;
  name: string;
  isSystem: boolean;
  isDefault: boolean;
}
export interface VoiceOption {
  id: string;
  name: string;
  isSystem: boolean;
  isDefault: boolean;
}

/** Pestañas de la sesión finalizada: notas (fuente), outputs y acciones. */
type OutputTab = "notas" | "resumen" | "pasos" | "mensaje" | "acciones";

/** Id por defecto a preseleccionar: el default propio del usuario, si no el
 *  default del sistema, si no el primero de la lista. "" si no hay ninguno. */
function defaultOptionId(opts: { id: string; isSystem: boolean; isDefault: boolean }[]): string {
  const own = opts.find((o) => o.isDefault && !o.isSystem);
  const sys = opts.find((o) => o.isDefault);
  return (own ?? sys ?? opts[0])?.id ?? "";
}

/** Sesión anterior (continuidad): de dónde venimos. */
interface PreviousSession {
  startsAt: Date | string;
  observations: string | null;
  goals: string | null;
  nextSteps: string | null;
  summary: string | null;
}

type SaveState = "idle" | "saving" | "saved" | "error";
/** Test disponible para asignar (catálogo del sistema + propios). */
type SessionTest = { id: string; name: string };
/** Paneles de consulta on-demand del modo consola. */
type PanelKey = "goals" | "tests" | "history" | "profile" | "files";

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Indicador de estado del autoguardado. */
function SaveStatus({ state }: { state: SaveState }) {
  if (state === "saving")
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Guardando…
      </span>
    );
  if (state === "saved")
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <Check className="h-3 w-3" />
        Guardado
      </span>
    );
  if (state === "error")
    return (
      <span className="text-level-high flex items-center gap-1 text-xs">
        <AlertTriangle className="h-3 w-3" />
        No se pudo guardar
      </span>
    );
  return null;
}

/**
 * Tarjeta colapsable: cabecera clickeable (chevron + título) que despliega el
 * contenido. `extra` queda siempre visible en la cabecera (p. ej. estado de
 * guardado), aunque esté plegada. Fuente única para las tarjetas de la sesión.
 */
function CollapsibleCard({
  title,
  icon: Icon,
  defaultOpen = true,
  extra,
  children,
}: {
  title: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="-m-1 flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left"
        >
          <Chevron className="text-muted-foreground h-5 w-5 shrink-0" />
          <CardTitle className="flex min-w-0 items-center gap-2 text-lg">
            {Icon && <Icon className="h-5 w-5 shrink-0" />}
            {title}
          </CardTitle>
        </button>
        {extra}
      </CardHeader>
      {open && <CardContent className="space-y-3">{children}</CardContent>}
    </Card>
  );
}

/** Cronómetro: vivo si está en curso, total si ya terminó. */
function SessionTimer({ session }: { session: WorkspaceSession }) {
  const [, setTick] = useState(0);
  const running = session.status === "IN_PROGRESS" && Boolean(session.startedAt);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (running && session.startedAt) {
    const elapsed = Date.now() - new Date(session.startedAt).getTime();
    return (
      <span className="text-level-high flex items-center gap-1.5 font-mono text-lg tabular-nums">
        <span className="bg-level-high h-2 w-2 animate-pulse rounded-full" />
        {clock(elapsed)}
      </span>
    );
  }
  if (session.status === "COMPLETED" && session.startedAt && session.endedAt) {
    const dur =
      new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
    return (
      <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
        <Clock className="h-4 w-4" />
        Duró {clock(dur)}
      </span>
    );
  }
  return null;
}

/**
 * Tiempo de la sesión en curso: transcurrido / planificado + barra de progreso.
 * La barra pasa a ámbar cerca del final y a rojo al excederse (conciencia de
 * tiempo, propia de una consola de trabajo).
 */
function SessionProgress({ session }: { session: WorkspaceSession }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const plannedMs = session.durationMin * 60_000;
  const elapsedMs = session.startedAt
    ? Math.max(0, Date.now() - new Date(session.startedAt).getTime())
    : 0;
  const pct = plannedMs > 0 ? (elapsedMs / plannedMs) * 100 : 0;
  const over = pct >= 100;
  const near = pct >= 90 && !over;
  const barColor = over ? "bg-level-high" : near ? "bg-level-mid" : "bg-primary";
  const overBy = over ? clock(elapsedMs - plannedMs) : null;

  return (
    <div className="flex w-full min-w-[180px] flex-col gap-1.5">
      <div className="flex items-baseline justify-end gap-2 font-mono text-2xl tabular-nums">
        <span className="text-foreground">{clock(elapsedMs)}</span>
        <span className="text-muted-foreground text-base">/ {clock(plannedMs)}</span>
        {overBy && (
          <span className="text-level-high text-sm font-medium">+{overBy}</span>
        )}
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Símbolo del modificador según el sistema: ⌘ en Mac, Ctrl en el resto.
 * Arranca en "⌘" (coincide con el SSR) y se ajusta tras montar para no romper
 * la hidratación.
 */
function useModKey() {
  const [mod, setMod] = useState("⌘");
  useEffect(() => {
    const ua = navigator.userAgent;
    const isMac = /Mac|iPhone|iPad|iPod/.test(ua);
    setMod(isMac ? "⌘" : "Ctrl");
  }, []);
  return mod;
}

/**
 * Visibilidad del cronómetro, recordada entre sesiones (localStorage). Algunos
 * profesionales prefieren no tener un reloj corriendo a la vista.
 */
function useTimerVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(localStorage.getItem("session:timer-hidden") !== "1");
  }, []);
  const toggle = () =>
    setVisible((v) => {
      const next = !v;
      localStorage.setItem("session:timer-hidden", next ? "0" : "1");
      return next;
    });
  return [visible, toggle] as const;
}

/** Tecla en una leyenda de atajos. */
function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "bg-muted text-muted-foreground inline-flex min-w-[1.5rem] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-sm",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

// ── Dictado por voz (Web Speech API del navegador) ───────────────────────────
// El psicólogo dicta su relato de la sesión; el texto se agrega a las notas.
// Solo Chrome/Edge. El audio lo procesa el navegador (en Chrome, vía Google),
// igual nivel de exposición que enviar las notas a la IA.
type SpeechResult = ArrayLike<{ transcript: string }> & { isFinal: boolean };
type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function useDictation(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const cbRef = useRef(onFinal);
  cbRef.current = onFinal;

  useEffect(() => {
    setSupported(getSpeechCtor() !== null);
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  function start() {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "es-PY";
    rec.continuous = true;
    rec.interimResults = false; // solo resultados finales: se agregan limpios
    rec.onresult = (e) => {
      let chunk = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) chunk += r[0].transcript;
      }
      if (chunk.trim()) cbRef.current(chunk.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stop() {
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }

  return { supported, listening, toggle: () => (listening ? stop() : start()) };
}

/** Botón 🎤 Dictar: agrega lo dictado al final del texto. Oculto si no hay soporte. */
function DictateButton({
  onText,
  className,
}: {
  onText: (chunk: string) => void;
  className?: string;
}) {
  const { supported, listening, toggle } = useDictation(onText);
  if (!supported) return null;
  return (
    <Button
      type="button"
      variant={listening ? "default" : "ghost"}
      size="sm"
      className={cn("h-8 text-sm", className)}
      onClick={toggle}
      title="Dictar tu relato de la sesión (Chrome)"
    >
      {listening ? (
        <>
          <span className="bg-background h-2 w-2 animate-pulse rounded-full" />
          Detener
        </>
      ) : (
        <>
          <Mic className="h-4 w-4" />
          Dictar
        </>
      )}
    </Button>
  );
}

/** Agrega texto al final, con un espacio si hace falta. Para el dictado por voz. */
function appendText(prev: string, chunk: string): string {
  if (!prev) return chunk;
  return /\s$/.test(prev) ? prev + chunk : `${prev} ${chunk}`;
}

export function SessionWorkspace({
  session,
  previousSession = null,
  tests = [],
  templates = [],
  voices = [],
  patientMessageEmojis = true,
  aiSummaryEnabled = false,
  whatsappTasksEnabled = false,
}: {
  session: WorkspaceSession;
  previousSession?: PreviousSession | null;
  tests?: SessionTest[];
  templates?: TemplateOption[];
  voices?: VoiceOption[];
  patientMessageEmojis?: boolean;
  aiSummaryEnabled?: boolean;
  whatsappTasksEnabled?: boolean;
}) {
  // Panel de consulta abierto sobre la consola (Dialog): tests, historial, etc.
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  // Estado de guardado agregado de las notas, para mostrarlo en la barra (consola).
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const mod = useModKey();
  const [timerVisible, toggleTimer] = useTimerVisible();
  // Paso de cierre (Próximos pasos + Agendar) que se abre al Finalizar.
  const [closing, setClosing] = useState(false);

  const names =
    session.participants.map((p) => p.fullName).join(", ") ||
    session.title ||
    "Bloque";
  const isCouple = session.participants.length > 1;
  const single =
    session.participants.length === 1 ? session.participants[0] : null;
  const motivo = topicLabel(session.topic, session.topicOther);
  // Señal de riesgo clínico: pacientes cuya última toma empeoró respecto de la
  // anterior. Se muestra prominente en la barra para que no pase desapercibido.
  const worseningNames = session.participants
    .filter((p) => p.snapshot.worsening)
    .map((p) => p.fullName);
  const terminal =
    session.status === "COMPLETED" ||
    session.status === "NO_SHOW" ||
    session.status === "CANCELED";

  function run(action: string, fn: () => Promise<{ error?: string }>, ok: string) {
    setPendingAction(action);
    startTransition(async () => {
      const res = await fn();
      setPendingAction(null);
      if (res?.error) toast.error(res.error);
      else toast.success(ok);
    });
  }

  const active = session.status === "IN_PROGRESS";

  // Atajos del modo consola (Alt+letra; Alt evita el choque con Ctrl que el
  // navegador reserva). Consultar: O objetivos · R resultados · H historial ·
  // P perfil · A adjuntos. Acciones: T asignar test · S seguimiento · D
  // diagnóstico. Las notas se autoguardan; no hay atajo de guardar/finalizar.
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      // Alt+letra: uso e.code para no depender del carácter que produzca Alt.
      if (e.altKey && !e.shiftKey) {
        const panelByCode: Record<string, PanelKey> = {
          KeyO: "goals",
          KeyR: "tests",
          KeyH: "history",
          KeyP: "profile",
          KeyA: "files",
        };
        const next = panelByCode[e.code];
        if (next) {
          e.preventDefault();
          setPanel((cur) => (cur === next ? null : next));
          return;
        }
        // Acciones: disparan un evento que cada acción escucha para abrirse.
        const actionByCode: Record<string, string> = {
          KeyT: "session:assign-test",
          KeyS: "session:assign-checkin",
          KeyD: "session:assign-diagnosis",
        };
        const evt = actionByCode[e.code];
        if (evt) {
          e.preventDefault();
          window.dispatchEvent(new Event(evt));
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, isPending, session.id]);

  // ── Modo consola enfocado: mientras la sesión está en curso ────────────────
  if (active) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/sesiones">
            <ArrowLeft className="h-4 w-4" />
            Sesiones
          </Link>
        </Button>

        {/* Barra de comando: con quién y para qué (héroe) + tiempo y acciones */}
        <div className="border-level-high/30 bg-level-high/5 sticky top-4 z-20 rounded-xl border px-5 py-4 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-4">
            {/* Héroe: con quién estás y para qué */}
            <div className="min-w-0 space-y-1.5">
              <span className="text-level-high flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
                <span className="bg-level-high h-2.5 w-2.5 animate-pulse rounded-full" />
                En curso
              </span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="flex items-center gap-2.5 text-2xl leading-tight font-bold sm:text-3xl">
                  {isCouple && (
                    <UsersIcon className="text-muted-foreground h-7 w-7 shrink-0" />
                  )}
                  <span className="truncate">{names}</span>
                </h1>
                {single && <FichaLink patientId={single.patientId} />}
              </div>
              {motivo && (
                <Badge
                  variant="outline"
                  className="px-3 py-1 text-base font-normal"
                >
                  {motivo}
                </Badge>
              )}
              {session.participants.length > 0 && (
                <div className="space-y-1 pt-1">
                  {session.participants.map((p) => (
                    <PatientMeta
                      key={p.participantId}
                      p={p}
                      multi={isCouple}
                      signals={false}
                    />
                  ))}
                </div>
              )}
            </div>
            {/* Tiempo (secundario) + acciones siempre a mano */}
            <div className="flex shrink-0 flex-col items-end gap-3">
              <div className="flex items-center gap-2.5">
                <SaveStatus state={saveState} />
                <Button
                  size="lg"
                  className="text-base"
                  onClick={() => setClosing(true)}
                >
                  <Square className="h-5 w-5" />
                  Finalizar
                </Button>
                <SecondaryMenu disabled={isPending}>
                  <DropdownMenuItem
                    onClick={() =>
                      run(
                        "cancel",
                        () => setSessionStatus(session.id, "CANCELED"),
                        "Sesión cancelada",
                      )
                    }
                  >
                    <Ban className="h-4 w-4" />
                    Cancelar
                  </DropdownMenuItem>
                </SecondaryMenu>
              </div>
              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground h-10 w-10 shrink-0"
                  onClick={toggleTimer}
                  aria-label={timerVisible ? "Ocultar cronómetro" : "Mostrar cronómetro"}
                  title={timerVisible ? "Ocultar cronómetro" : "Mostrar cronómetro"}
                >
                  {timerVisible ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </Button>
                {timerVisible && <SessionProgress session={session} />}
              </div>
            </div>
          </div>

          {/* Señal de riesgo clínico: empeoramiento en la última toma */}
          {worseningNames.length > 0 && (
            <div className="text-level-high mt-3 flex items-start gap-2 text-base font-semibold">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                Empeoramiento en la última toma
                {isCouple ? ` · ${worseningNames.join(", ")}` : ""}
              </span>
            </div>
          )}

        </div>

        {/* Atajos de consulta on-demand: Objetivos, Tests, Historial… (cada uno
            abre un Dialog, sin sacar al profesional de las notas) */}
        <ConsoleTools
          onOpen={setPanel}
          hasCharts={session.participants.some((p) => p.testCharts.length > 0)}
        />

        {/* Acciones en vivo: asignar test, programar seguimiento, diagnóstico */}
        <SessionActions participants={session.participants} tests={tests} />

        {/* Lo asignado en esta sesión (se actualiza al asignar) */}
        <SessionAssignedSummary
          participants={session.participants}
          startedAt={session.startedAt}
        />

        {/* Notas = la única superficie en vivo, a ancho completo */}
        <ConsoleNotes
          session={session}
          isCouple={isCouple}
          onSaveState={setSaveState}
        />

        {/* Paneles de consulta (Objetivos / Tests / Historial / Perfil / Adjuntos) */}
        <ConsolePanel
          panel={panel}
          onClose={() => setPanel(null)}
          session={session}
          previousSession={previousSession}
          participants={session.participants}
        />

        {/* Confirmación de cierre (solo confirma; resumen y próximos pasos van
            en el detalle ya finalizado) */}
        <ClosingDialog
          session={session}
          open={closing}
          onOpenChange={setClosing}
        />
      </div>
    );
  }

  // ── Layout estándar: programada / finalizada / no asistió / cancelada ──────
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/sesiones">
          <ArrowLeft className="h-4 w-4" />
          Sesiones
        </Link>
      </Button>

      {/* Header = ficha del paciente: identidad + datos clave a la izquierda,
          acciones (Iniciar / Reabrir / ⋯) a la derecha. Misma forma que la
          consola en curso y la sesión finalizada. */}
      <Card>
        <CardContent className="py-5">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            {/* Identidad */}
            <div className="min-w-0 space-y-2.5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h1 className="flex items-center gap-2 text-2xl">
                    {isCouple && (
                      <UsersIcon className="text-muted-foreground h-6 w-6 shrink-0" />
                    )}
                    {names}
                  </h1>
                  {single && <FichaLink patientId={single.patientId} />}
                </div>
                <p className="text-muted-foreground text-base capitalize">
                  {fmtDateTime(session.startsAt, "long")} · {session.durationMin}′
                </p>
              </div>
              {session.participants.length > 0 && (
                <div className="space-y-1.5">
                  {session.participants.map((p) => (
                    <PatientMeta key={p.participantId} p={p} multi={isCouple} />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={statusBadgeVariant(session.status)}>
                  {statusLabel(session.status)}
                </Badge>
                {isCouple && <Badge variant="outline">Pareja/familia</Badge>}
                {motivo && <Badge variant="outline">{motivo}</Badge>}
              </div>
            </div>

            {/* Acciones (derecha) + tiempo */}
            <div className="flex shrink-0 flex-col items-end gap-3">
              <SessionTimer session={session} />
              <div className="flex items-center gap-2">
                {session.status === "SCHEDULED" && (
                  <>
                    <Button
                      size="lg"
                      className="text-base"
                      onClick={() =>
                        run(
                          "start",
                          () => startSession(session.id),
                          "Sesión iniciada",
                        )
                      }
                      disabled={isPending}
                    >
                      {pendingAction === "start" ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Play className="h-5 w-5" />
                      )}
                      Iniciar sesión
                    </Button>
                    <SecondaryMenu disabled={isPending}>
                      <DropdownMenuItem
                        onClick={() =>
                          run(
                            "noshow",
                            () => setSessionStatus(session.id, "NO_SHOW"),
                            "Marcada como no asistió",
                          )
                        }
                      >
                        <UserX className="h-4 w-4" />
                        No asistió
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          run(
                            "cancel",
                            () => setSessionStatus(session.id, "CANCELED"),
                            "Sesión cancelada",
                          )
                        }
                      >
                        <Ban className="h-4 w-4" />
                        Cancelar
                      </DropdownMenuItem>
                    </SecondaryMenu>
                  </>
                )}
                {terminal && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      run(
                        "reopen",
                        () => setSessionStatus(session.id, "IN_PROGRESS"),
                        "Sesión reabierta",
                      )
                    }
                    disabled={isPending}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reabrir
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenido a ancho completo: el contexto del paciente ya vive en el
          encabezado (no hay rail redundante). */}
      <div className="space-y-4">
        {session.status === "SCHEDULED" && (
          // Antes de empezar: vista de preparación, solo lo útil para arrancar.
          <SessionPrep session={session} previousSession={previousSession} />
        )}
        {session.status === "COMPLETED" && (
          // Finalizada: primero las notas (lo que más importa) con el botón para
          // generar todo el contenido a partir de ellas, después el resumen y el
          // cierre. Sin tabs; tests/adjuntos/historial van en la ficha.
          <CompletedSession
            session={session}
            isCouple={isCouple}
            tests={tests}
            templates={templates}
            voices={voices}
            patientMessageEmojis={patientMessageEmojis}
            aiEnabled={aiSummaryEnabled}
            whatsappEnabled={whatsappTasksEnabled}
          />
        )}
        {(session.status === "NO_SHOW" || session.status === "CANCELED") && (
          <NotesTab session={session} isCouple={isCouple} />
        )}
      </div>
    </div>
  );
}

// ── Vista de preparación (sesión programada, antes de iniciar) ───────────────
// Solo lo útil para arrancar: dónde quedamos · foco de hoy · evolución/resultados
// · seguimientos activos. El resto (adjuntos, historial completo) vive en la ficha.
function SessionPrep({
  session,
  previousSession,
}: {
  session: WorkspaceSession;
  previousSession: PreviousSession | null;
}) {
  return (
    <div className="space-y-4">
      <PrepContinuity previousSession={previousSession} />
      <PrepFocus session={session} previousSession={previousSession} />
      <PrepCheckins participants={session.participants} />
    </div>
  );
}

// Bloque 1 · Dónde quedamos: la última sesión (qué se trabajó + qué quedó pendiente).
function PrepContinuity({
  previousSession,
}: {
  previousSession: PreviousSession | null;
}) {
  // Preferimos el RESUMEN (conciso); si no hay, caemos a las notas crudas y las
  // recortamos para no desbordar (el texto completo está en la ficha).
  const summary = previousSession?.summary?.trim() ?? "";
  const notes = previousSession?.observations?.trim() ?? "";
  const recap = summary || notes;
  const fromSummary = Boolean(summary);
  const hasNotes = Boolean(recap || previousSession?.nextSteps?.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Dónde quedamos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!previousSession ? (
          <p className="text-muted-foreground text-base">
            Primera sesión registrada con este paciente.
          </p>
        ) : !hasNotes ? (
          <p className="text-muted-foreground text-base">
            La sesión anterior ({fmtDate(previousSession.startsAt)}) no tiene
            notas registradas.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              Última sesión · {fmtDate(previousSession.startsAt)}
            </p>
            {recap && (
              <div className="space-y-1">
                <p className={SECTION_LABEL}>
                  {fromSummary ? "Resumen de la sesión" : "Qué se trabajó"}
                </p>
                {fromSummary ? (
                  <Markdown content={recap} className="text-base" />
                ) : (
                  <>
                    <p className="text-base leading-relaxed whitespace-pre-wrap line-clamp-[10]">
                      {recap}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Son tus notas (no hay resumen). El texto completo está en
                      la ficha.
                    </p>
                  </>
                )}
              </div>
            )}
            {previousSession.nextSteps?.trim() && (
              <div className="border-level-mid/40 bg-level-mid/5 rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Flag className="h-4 w-4" />
                  Quedó pendiente
                </p>
                <p className="mt-1 text-base leading-relaxed whitespace-pre-wrap">
                  {previousSession.nextSteps}
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Bloque 2 · Foco de hoy: objetivo editable; puede heredar lo que quedó pendiente.
function PrepFocus({
  session,
  previousSession,
}: {
  session: WorkspaceSession;
  previousSession: PreviousSession | null;
}) {
  const [goals, setGoals] = useState(session.goals ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const persisted = useRef(goals);

  useEffect(() => {
    if (goals === persisted.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const res = await saveSessionNotes(session.id, { goals });
      if (res?.error) setSaveState("error");
      else {
        persisted.current = goals;
        setSaveState("saved");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [goals, session.id]);

  const inherited = previousSession?.nextSteps?.trim();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5" />
          Foco de hoy
        </CardTitle>
        <SaveStatus state={saveState} />
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          rows={4}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="Qué querés trabajar en esta sesión…"
          className="text-base leading-relaxed"
        />
        {inherited && !goals.trim() && (
          <button
            type="button"
            onClick={() => setGoals(inherited)}
            className="text-muted-foreground hover:text-foreground text-left text-sm"
          >
            Quedó pendiente:{" "}
            <span className="underline">{inherited}</span> · usar como foco
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// Bloque 3 · Seguimientos activos: check-ins de WhatsApp en curso entre sesiones.
function PrepCheckins({
  participants,
}: {
  participants: WorkspaceParticipant[];
}) {
  const multi = participants.length > 1;
  const rows = participants
    .map((p) => ({
      name: p.fullName,
      plans: p.checkinPlans.filter((c) => c.status === "ACTIVE"),
    }))
    .filter((r) => r.plans.length > 0);
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5" />
          Seguimientos activos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.name} className="space-y-1.5">
            {multi && <p className="text-base font-semibold">{r.name}</p>}
            <ul className="space-y-1.5">
              {r.plans.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-base">
                  <MessageCircle className="text-muted-foreground mt-1 h-4 w-4 shrink-0" />
                  <span>
                    <span className="font-medium">{c.question}</span>{" "}
                    <span className="text-muted-foreground text-sm">
                      · desde {fmtDate(c.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Botón "Ver ficha" (al lado del nombre). Outline para que sea visible y
// siga el patrón de botones de la app. ───────────────────────────────────────
function FichaLink({
  patientId,
  className,
}: {
  patientId: string;
  className?: string;
}) {
  return (
    <Button asChild variant="outline" size="sm" className={cn("gap-1", className)}>
      <Link href={`/pacientes/${patientId}`} aria-label="Ver ficha del paciente">
        Ver ficha
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </Button>
  );
}

// ── Identidad del paciente en el encabezado (ficha inline) ───────────────────
// Reemplaza al antiguo rail de contexto: demografía y, salvo en la consola
// (signals=false), las señales clínicas clave (diagnósticos, último resultado,
// empeoramiento). En pareja/familia (multi) muestra el nombre + "Ver ficha" por
// persona; en individual el nombre y el botón van junto al título.
function PatientMeta({
  p,
  multi,
  signals = true,
}: {
  p: WorkspaceParticipant;
  multi: boolean;
  signals?: boolean;
}) {
  const info = [p.age != null ? `${p.age} años` : null, p.sex, p.maritalStatus]
    .filter(Boolean)
    .join(" · ");
  const last = p.snapshot.lastResult;
  const hasSignals =
    signals && (p.diagnoses.length > 0 || Boolean(last) || p.snapshot.worsening);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base">
        {multi && <span className="font-semibold">{p.fullName}</span>}
        <span className="text-muted-foreground">
          {info || "Sin datos demográficos"}
        </span>
        {multi && <FichaLink patientId={p.patientId} />}
      </div>
      {hasSignals && (
        <div className="flex flex-wrap items-center gap-1.5">
          {p.diagnoses.map((d) => (
            <Badge
              key={d.code || d.label}
              variant={d.isPrimary ? "secondary" : "outline"}
              className="gap-1"
              title={d.label}
            >
              {d.code && <span className="font-mono">{d.code}</span>}
              <span className="max-w-[12rem] truncate font-normal">
                {d.label}
              </span>
            </Badge>
          ))}
          {last && (
            <Badge
              variant="outline"
              className={cn("gap-1", TONE_BADGE[last.tone])}
              title={`Último resultado · ${fmtDate(last.when)}`}
            >
              <span className="max-w-[10rem] truncate font-normal">
                {last.testName}
              </span>
              <span className="font-medium">{last.levelLabel}</span>
            </Badge>
          )}
          {p.snapshot.worsening && (
            <span className="text-level-high inline-flex items-center gap-1 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" />
              Empeoró
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Toolbar de consulta on-demand (modo consola) ─────────────────────────────
function ConsoleTools({
  onOpen,
  hasCharts,
}: {
  onOpen: (p: PanelKey) => void;
  hasCharts: boolean;
}) {
  const items: {
    key: PanelKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    hint?: string;
  }[] = [
    { key: "goals", label: "Objetivos", icon: Target, hint: "Alt+O" },
    {
      key: "tests",
      label: "Tests y resultados",
      icon: hasCharts ? TrendingUp : FileText,
      hint: "Alt+R",
    },
    { key: "history", label: "Historial", icon: CalendarClock, hint: "Alt+H" },
    { key: "profile", label: "Perfil", icon: UserRound, hint: "Alt+P" },
    { key: "files", label: "Adjuntos", icon: Paperclip, hint: "Alt+A" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-muted-foreground mr-1 text-sm font-semibold tracking-wide uppercase">
        Consultar
      </span>
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onOpen(it.key)}
            title={it.hint ? `${it.label} (${it.hint})` : it.label}
            className="border-border bg-background text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-base font-medium transition-colors"
          >
            <Icon className="h-5 w-5" />
            {it.label}
            {it.hint && (
              <span className="text-muted-foreground ml-1 hidden text-sm lg:inline">
                {it.hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Panel de consulta sobre la consola (Dialog) ──────────────────────────────
function ConsolePanel({
  panel,
  onClose,
  session,
  previousSession,
  participants,
}: {
  panel: PanelKey | null;
  onClose: () => void;
  session: WorkspaceSession;
  previousSession: PreviousSession | null;
  participants: WorkspaceParticipant[];
}) {
  const meta: Record<PanelKey, { title: string; body: React.ReactNode }> = {
    goals: {
      title: "Objetivos de la sesión",
      body: <GoalsPanel session={session} previousSession={previousSession} />,
    },
    tests: {
      title: "Tests y resultados",
      body: <TestsPanel participants={participants} />,
    },
    history: {
      title: "Historial de sesiones",
      body: <HistoryTab participants={participants} />,
    },
    profile: {
      title: "Perfil del paciente",
      body: <ProfilePanel participants={participants} />,
    },
    files: { title: "Adjuntos", body: <FilesTab participants={participants} /> },
  };
  const current = panel ? meta[panel] : null;
  return (
    <Dialog open={panel !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{current?.title ?? ""}</DialogTitle>
        </DialogHeader>
        {current?.body}
      </DialogContent>
    </Dialog>
  );
}

// ── Panel Tests: lista de tests tomados con detalle inline (master-detail) ────
// Al abrir se ve la lista de tests (tarjetas con un vistazo del resultado); al
// elegir uno, su informe completo reemplaza la lista dentro del mismo popup
// (puntajes, gráfico de evolución y respuestas), con "Volver" a la lista.

/** Una entrada de la lista de tests: asignación (puntuada/a mano/pendiente) o
 *  resultado cargado a mano (modelo legacy). Une ambas fuentes en una sola lista. */
type TestEntry = {
  key: string;
  participant: WorkspaceParticipant;
  /** fecha para ordenar y mostrar (toma o asignación) */
  date: Date | string;
} & (
  | { kind: "scored"; assignment: WorkspaceAssignment }
  | { kind: "hand"; assignment: WorkspaceAssignment }
  | { kind: "pending"; assignment: WorkspaceAssignment }
  | { kind: "manual"; manual: WorkspaceManualResult }
);

/** Aplana las asignaciones y resultados a mano de todos los pacientes,
 *  ordenados por fecha (más reciente primero). */
function buildTestEntries(participants: WorkspaceParticipant[]): TestEntry[] {
  const out: TestEntry[] = [];
  for (const p of participants) {
    for (const a of p.assignments) {
      if (a.status === "COMPLETED" && a.hasResult) {
        out.push({
          key: `a-${a.id}`,
          participant: p,
          date: a.completedAt ?? a.createdAt,
          kind: a.scoresJson ? "scored" : "hand",
          assignment: a,
        });
      } else {
        out.push({
          key: `a-${a.id}`,
          participant: p,
          date: a.createdAt,
          kind: "pending",
          assignment: a,
        });
      }
    }
    p.manualResults.forEach((m, i) => {
      out.push({
        key: `m-${p.participantId}-${i}`,
        participant: p,
        date: m.takenAt,
        kind: "manual",
        manual: m,
      });
    });
  }
  return out.sort(
    (x, y) => new Date(y.date).getTime() - new Date(x.date).getTime(),
  );
}

function TestsPanel({ participants }: { participants: WorkspaceParticipant[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [, startReview] = useTransition();

  if (participants.length === 0) {
    return <EmptyCard text="Sin pacientes en esta sesión." />;
  }
  const multi = participants.length > 1;
  const entries = buildTestEntries(participants);
  if (entries.length === 0) {
    return <EmptyCard text="Sin tests para esta sesión." />;
  }

  const selected = entries.find((e) => e.key === selectedKey) ?? null;
  if (selected) {
    return (
      <TestDetail
        entry={selected}
        onBack={() => setSelectedKey(null)}
      />
    );
  }

  function open(entry: TestEntry) {
    setSelectedKey(entry.key);
    // Ver el informe inline lo marca como revisado (igual que abrir su página).
    if (entry.kind === "scored" || entry.kind === "hand") {
      const id = entry.assignment.id;
      startReview(() => {
        void markResultReviewedAction(id);
      });
    }
  }

  return (
    <div className="space-y-4">
      {participants.map((p) => {
        const pEntries = entries.filter(
          (e) => e.participant.participantId === p.participantId,
        );
        return (
          <div key={p.participantId} className="space-y-2">
            {multi && (
              <p className={cn(SECTION_LABEL, "flex items-center gap-2")}>
                <FileText className="h-4 w-4" />
                {p.fullName}
              </p>
            )}
            {pEntries.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sin tests asignados.
              </p>
            ) : (
              pEntries.map((e) => (
                <TestEntryCard key={e.key} entry={e} onOpen={() => open(e)} />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Tarjeta de la lista: nombre del test, vistazo del resultado y estado. */
function TestEntryCard({
  entry,
  onOpen,
}: {
  entry: TestEntry;
  onOpen: () => void;
}) {
  const clickable = entry.kind !== "pending";
  const title =
    entry.kind === "manual" ? entry.manual.testName : entry.assignment.testName;
  const handEntered = entry.kind === "manual" || entry.kind === "hand";
  return (
    <Card
      className={
        clickable
          ? "hover:border-primary/50 cursor-pointer transition-colors"
          : undefined
      }
      onClick={clickable ? onOpen : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
    >
      <CardContent className="flex items-center justify-between gap-3 py-4">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-base font-semibold">
            {title}
            {handEntered && <Badge variant="secondary">a mano</Badge>}
          </p>
          <TestEntryGlimpse entry={entry} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {entry.kind === "pending" ? (
            <Badge variant="outline">Pendiente</Badge>
          ) : (
            <ChevronRight className="text-muted-foreground h-5 w-5" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Vistazo bajo el nombre: fecha + mini puntaje (crudo/máx) de la escala principal. */
function TestEntryGlimpse({ entry }: { entry: TestEntry }) {
  const date = fmtDate(entry.date);
  if (entry.kind === "scored" && entry.assignment.scoresJson) {
    const s = entry.assignment.scoresJson.scores[0];
    return (
      <p className="text-muted-foreground text-sm">
        {date}
        {s && (
          <>
            {" · "}
            <span className="text-foreground font-medium">{s.label}</span>{" "}
            <span className="tabular-nums">
              {s.raw}/{s.max}
            </span>
          </>
        )}
      </p>
    );
  }
  return <p className="text-muted-foreground text-sm">{date}</p>;
}

/** Detalle inline del test seleccionado, con "Volver" a la lista. */
function TestDetail({
  entry,
  onBack,
}: {
  entry: TestEntry;
  onBack: () => void;
}) {
  const p = entry.participant;
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1">
        <ArrowLeft className="h-4 w-4" />
        Volver a la lista
      </Button>
      {entry.kind === "scored" && entry.assignment.scoresJson ? (
        <ScoredDetail assignment={entry.assignment} participant={p} />
      ) : entry.kind === "manual" ? (
        <ManualFindings
          testName={entry.manual.testName}
          takenAt={entry.manual.takenAt}
          findings={entry.manual.findings}
          notes={entry.manual.notes}
        />
      ) : entry.kind === "hand" ? (
        <ManualFindings
          testName={entry.assignment.testName}
          takenAt={entry.assignment.completedAt ?? entry.assignment.createdAt}
          findings={entry.assignment.findings ?? []}
          notes={entry.assignment.notes}
          edited={Boolean(entry.assignment.editedAt)}
        />
      ) : null}
    </div>
  );
}

/** Informe de un test puntuado: barras de puntaje + evolución + respuestas. */
function ScoredDetail({
  assignment,
  participant,
}: {
  assignment: WorkspaceAssignment;
  participant: WorkspaceParticipant;
}) {
  const chart = participant.testCharts.find(
    (c) => c.testName === assignment.testName,
  );
  return (
    <div className="space-y-4">
      <ReportView
        patientName={participant.fullName}
        testName={assignment.testName}
        testDescription={assignment.testDescription ?? undefined}
        completedAt={
          assignment.completedAt ? new Date(assignment.completedAt) : null
        }
        result={assignment.scoresJson!}
      />
      {chart && (
        <EvolutionChart
          title={`${assignment.testName} · evolución`}
          data={chart.data}
          series={chart.series}
        />
      )}
      {assignment.answersJson != null && (
        <ResponseSummary
          itemsJson={assignment.itemsJson}
          responseType={assignment.responseType}
          answersJson={assignment.answersJson}
        />
      )}
    </div>
  );
}

/** Resultado cargado a mano: hallazgos libres + notas. */
function ManualFindings({
  testName,
  takenAt,
  findings,
  notes,
  edited,
}: {
  testName: string;
  takenAt: Date | string;
  findings: { label: string; value: string }[];
  notes: string | null;
  edited?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
          {testName}
          <Badge variant="secondary">a mano</Badge>
          {edited && <Badge variant="outline">editado</Badge>}
        </CardTitle>
        <p className="text-muted-foreground text-sm">{fmtDate(takenAt)}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-border divide-y">
          {findings.map((f, i) => (
            <li
              key={i}
              className="flex items-baseline justify-between gap-3 py-2"
            >
              <span className="text-muted-foreground">{f.label}</span>
              <span className="text-right font-medium">{f.value}</span>
            </li>
          ))}
        </ul>
        {notes && (
          <p className="text-muted-foreground border-border border-t pt-3 whitespace-pre-wrap">
            {notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Contenido del panel Perfil: reusa la tarjeta de contexto del paciente ─────
function ProfilePanel({ participants }: { participants: WorkspaceParticipant[] }) {
  if (participants.length === 0) {
    return <EmptyCard text="Sin pacientes en esta sesión." />;
  }
  return (
    <div className="space-y-3">
      {participants.map((p) => (
        <ContextCard key={p.participantId} p={p} />
      ))}
    </div>
  );
}

// ── Acciones de la sesión: asignar test / crear seguimiento ──────────────────
// Disponibles durante la consola y en el paso de cierre. Reusan AssignDialog y
// CheckinPlanForm (mismos flujos que la ficha del paciente).
function SessionActions({
  participants,
  tests,
}: {
  participants: WorkspaceParticipant[];
  tests: SessionTest[];
}) {
  if (participants.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-muted-foreground mr-1 text-sm font-semibold tracking-wide uppercase">
        Acciones
      </span>
      <AssignTestMenu participants={participants} tests={tests} />
      <NewCheckinButton participants={participants} />
      <NewDiagnosisButton participants={participants} />
    </div>
  );
}

/** Agrega un diagnóstico (CIE-10 o libre) a un paciente de la sesión. */
function NewDiagnosisButton({
  participants,
}: {
  participants: WorkspaceParticipant[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState(participants[0]?.patientId ?? "");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const multi = participants.length > 1;

  // Atajo Alt+D.
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("session:assign-diagnosis", h);
    return () => window.removeEventListener("session:assign-diagnosis", h);
  }, []);

  const results = useMemo(() => searchDiagnoses(query), [query]);
  const q = query.trim();
  const exactCode = results.some((d) => d.code.toLowerCase() === q.toLowerCase());

  function add(code: string, label: string) {
    if (!patientId) {
      setError("Elegí un paciente");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createDiagnosis({ patientId, code, label, isPrimary: false });
      if (res?.error) {
        setError(res.error);
        return;
      }
      toast.success("Diagnóstico agregado");
      setQuery("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="outline"
        className="text-base"
        onClick={() => setOpen(true)}
      >
        <Stethoscope className="h-5 w-5" />
        Diagnóstico
        <Kbd className="ml-1 hidden lg:inline-flex">Alt+D</Kbd>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) {
            setQuery("");
            setError(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Agregar diagnóstico</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {multi && (
              <div className="space-y-1.5">
                <Label className="text-base">Paciente</Label>
                <Select
                  value={patientId}
                  onValueChange={(v) => setPatientId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elegí un paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map((p) => (
                      <SelectItem key={p.patientId} value={p.patientId}>
                        {p.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {error && (
              <p className="text-destructive flex items-center gap-1.5 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ansiedad, depresión, F41…"
              autoFocus
            />
            <ul className="border-border max-h-72 divide-y overflow-y-auto rounded-lg border">
              {q.length >= 3 && !exactCode && (
                <li>
                  <button
                    type="button"
                    onClick={() => add("", q)}
                    disabled={isPending}
                    className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2.5 text-left"
                  >
                    <span className="text-sm">
                      Usar <span className="font-medium">«{q}»</span>{" "}
                      <span className="text-muted-foreground">
                        (libre, sin código)
                      </span>
                    </span>
                  </button>
                </li>
              )}
              {results.map((d) => (
                <li key={d.code}>
                  <button
                    type="button"
                    onClick={() => add(d.code, d.label)}
                    disabled={isPending}
                    className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2.5 text-left"
                  >
                    <span className="bg-muted shrink-0 rounded px-1.5 py-0.5 font-mono text-xs">
                      {d.code}
                    </span>
                    <span className="text-sm">{d.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Elige el test en un menú y delega en AssignDialog (paciente/fecha/aviso/link). */
function AssignTestMenu({
  participants,
  tests,
}: {
  participants: WorkspaceParticipant[];
  tests: SessionTest[];
}) {
  const [test, setTest] = useState<SessionTest | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const patients = participants.map((p) => ({
    id: p.patientId,
    fullName: p.fullName,
    phone: p.phone,
  }));
  // Atajo Alt+T: abre el menú de tests.
  useEffect(() => {
    const h = () => setMenuOpen(true);
    window.addEventListener("session:assign-test", h);
    return () => window.removeEventListener("session:assign-test", h);
  }, []);
  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "outline" }), "text-base")}
        >
          <FilePlus className="h-5 w-5" />
          Asignar test
          <Kbd className="ml-1 hidden lg:inline-flex">Alt+T</Kbd>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          {tests.length === 0 ? (
            <DropdownMenuItem disabled>Sin tests disponibles</DropdownMenuItem>
          ) : (
            tests.map((t) => (
              <DropdownMenuItem key={t.id} onClick={() => setTest(t)}>
                {t.name}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <AssignDialog
        open={test !== null}
        onClose={() => setTest(null)}
        test={test}
        patients={patients}
        defaultPatientId={participants[0]?.patientId}
      />
    </>
  );
}

/** Crea un seguimiento (check-in WhatsApp) para un paciente de la sesión. */
function NewCheckinButton({
  participants,
}: {
  participants: WorkspaceParticipant[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState(participants[0]?.patientId ?? "");
  const multi = participants.length > 1;
  // Atajo Alt+S.
  useEffect(() => {
    const h = () => setOpen(true);
    window.addEventListener("session:assign-checkin", h);
    return () => window.removeEventListener("session:assign-checkin", h);
  }, []);
  return (
    <>
      <Button
        variant="outline"
        className="text-base"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="h-5 w-5" />
        Nuevo seguimiento
        <Kbd className="ml-1 hidden lg:inline-flex">Alt+S</Kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Nuevo seguimiento</DialogTitle>
          </DialogHeader>
          {multi && (
            <div className="space-y-1.5">
              <Label className="text-base">Paciente</Label>
              <Select value={patientId} onValueChange={(v) => setPatientId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí un paciente" />
                </SelectTrigger>
                <SelectContent>
                  {participants.map((p) => (
                    <SelectItem key={p.patientId} value={p.patientId}>
                      {p.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <CheckinPlanForm
            key={patientId}
            patientId={patientId}
            onSaved={() => {
              setOpen(false);
              router.refresh(); // refresca el resumen "Asignado al paciente"
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Lo asignado al paciente en la consola: tests pendientes + seguimientos ───
function SessionAssignedSummary({
  participants,
  startedAt,
}: {
  participants: WorkspaceParticipant[];
  startedAt: Date | string | null;
}) {
  const [open, setOpen] = useState(false);
  // Solo lo creado DESPUÉS de iniciar la sesión = lo asignado en esta sesión.
  const since = startedAt ? new Date(startedAt).getTime() : 0;
  const inSession = (d: Date | string) => new Date(d).getTime() >= since;

  const multi = participants.length > 1;
  const rows = participants
    .map((p) => ({
      name: p.fullName,
      tests: p.assignments.filter(
        (a) => a.status === "PENDING" && inSession(a.createdAt),
      ),
      plans: p.checkinPlans.filter((c) => inSession(c.createdAt)),
      diagnoses: p.diagnoses.filter((d) => inSession(d.createdAt)),
    }))
    .filter(
      (r) => r.tests.length > 0 || r.plans.length > 0 || r.diagnoses.length > 0,
    );

  const total = rows.reduce(
    (n, r) => n + r.tests.length + r.plans.length + r.diagnoses.length,
    0,
  );
  if (total === 0) return null;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
      >
        <Chevron className="h-4 w-4" />
        Asignaciones de esta sesión
        <Badge variant="secondary" className="font-normal">
          {total}
        </Badge>
      </button>
      {open && (
        <div className="bg-muted/40 mt-2 space-y-2.5 rounded-lg border p-3">
          {rows.map((r) => (
            <div key={r.name} className="space-y-1">
          {multi && (
            <p className="text-foreground text-sm font-medium">{r.name}</p>
          )}
          <ul className="space-y-1">
            {r.tests.map((a) => (
              <AssignedItem
                key={a.id}
                icon={FileText}
                kind="Test"
                value={`${a.testName} · pendiente de responder`}
              />
            ))}
            {r.plans.map((c) => (
              <AssignedItem
                key={c.id}
                icon={MessageCircle}
                kind="Seguimiento"
                value={c.question}
              />
            ))}
            {r.diagnoses.map((d, i) => (
              <AssignedItem
                key={`dx-${i}`}
                icon={Stethoscope}
                kind="Diagnóstico"
                value={d.code ? `${d.code} · ${d.label}` : d.label}
              />
            ))}
          </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Fila del resumen "Asignado en esta sesión": ícono + tipo + detalle. */
function AssignedItem({
  icon: Icon,
  kind,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  kind: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
      <span className="text-muted-foreground w-24 shrink-0">{kind}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{value}</span>
    </li>
  );
}

// ── Menú de acciones secundarias ─────────────────────────────────────────────
function SecondaryMenu({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label="Más acciones"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
      >
        <MoreVertical className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Panel de contexto del paciente ───────────────────────────────────────────
function ContextCard({ p }: { p: WorkspaceParticipant }) {
  const info = [p.age ? `${p.age} años` : null, p.sex, p.maritalStatus]
    .filter(Boolean)
    .join(" · ");
  const last = p.snapshot.lastResult;

  return (
    <Card>
      <CardContent className="space-y-3 py-4 text-base">
        <div className="flex items-start justify-between gap-2">
          <p className="text-lg font-semibold">{p.fullName}</p>
          <Button asChild variant="ghost" size="sm" className="-mr-2 -mt-1 h-8">
            <Link href={`/pacientes/${p.patientId}`} aria-label="Abrir ficha">
              Ficha <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <p className="text-muted-foreground">{info || "Sin datos demográficos"}</p>
        {(p.email || p.phone) && (
          <p className="text-muted-foreground text-sm">
            {[p.email, p.phone].filter(Boolean).join(" · ")}
          </p>
        )}

        {p.snapshot.worsening && (
          <div className="text-level-high flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            Empeoramiento en la última toma
          </div>
        )}

        {p.diagnoses.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.diagnoses.map((d) => (
              <Badge
                key={d.code}
                variant={d.isPrimary ? "secondary" : "outline"}
                className="gap-1"
                title={d.label}
              >
                <span className="font-mono">{d.code}</span>
                <span className="max-w-[10rem] truncate font-normal">
                  {d.label}
                </span>
              </Badge>
            ))}
          </div>
        )}

        <div className="border-border border-t pt-3">
          {last ? (
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">
                Último resultado · {fmtDate(last.when)}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{last.testName}</span>
                <Badge variant="outline" className={cn("shrink-0", TONE_BADGE[last.tone])}>
                  {last.levelLabel}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Sin resultados de tests aún.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Panel Objetivos (Alt+O): foco editable de hoy + de dónde venimos ─────────
// Vive detrás de un atajo para que la consola en vivo quede solo en las notas.
function GoalsPanel({
  session,
  previousSession,
}: {
  session: WorkspaceSession;
  previousSession: PreviousSession | null;
}) {
  const [goals, setGoals] = useState(session.goals ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const persisted = useRef(goals);

  // Autoguardado debounced del objetivo de la sesión.
  useEffect(() => {
    if (goals === persisted.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const res = await saveSessionNotes(session.id, { goals });
      if (res?.error) setSaveState("error");
      else {
        persisted.current = goals;
        setSaveState("saved");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [goals, session.id]);

  const inherited = previousSession?.nextSteps?.trim();
  const hasPrev = Boolean(
    previousSession &&
      (previousSession.observations?.trim() ||
        previousSession.nextSteps?.trim()),
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-base font-medium">
            <Target className="h-4 w-4" />
            Foco de hoy
          </label>
          <SaveStatus state={saveState} />
        </div>
        <Textarea
          rows={4}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          placeholder="Qué se busca trabajar en esta sesión…"
          className="text-base leading-relaxed"
          autoFocus
        />
        {inherited && !goals.trim() && (
          <button
            type="button"
            onClick={() => setGoals(inherited)}
            className="text-muted-foreground hover:text-foreground text-left text-sm"
          >
            Quedó pendiente de la última sesión:{" "}
            <span className="underline">{inherited}</span> · usar como foco
          </button>
        )}
      </div>

      {hasPrev && previousSession && (
        <Card>
          <CardContent className="space-y-1.5 py-3">
            <p className={cn(SECTION_LABEL, "flex items-center gap-1.5")}>
              <History className="h-3.5 w-3.5" />
              Última sesión · {fmtDate(previousSession.startsAt)}
            </p>
            {previousSession.observations?.trim() && (
              <p className="text-muted-foreground text-base whitespace-pre-wrap">
                {previousSession.observations}
              </p>
            )}
            {previousSession.nextSteps?.trim() && (
              <p className="text-base">
                <span className="text-muted-foreground">Quedó pendiente: </span>
                {previousSession.nextSteps}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Botón + modal para agendar la próxima cita sin salir de la consola. */
function ScheduleNextButton({ patientId }: { patientId: string | null }) {
  const [open, setOpen] = useState(false);
  if (!patientId) return null; // grupos: agendar desde la agenda
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" />
        Agendar próxima cita
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendar próxima cita</DialogTitle>
          </DialogHeader>
          <SessionForm
            patients={[]}
            lockedPatientId={patientId}
            onSaved={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Paso de cierre: se abre al Finalizar ─────────────────────────────────────
// Próximos pasos + agendar próxima; recién al confirmar se finaliza la sesión.
// Así la consola en vivo queda limpia (solo Observaciones) y "cerrar" es el acto
// donde se pacta la tarea, como en la sesión real.
function ClosingDialog({
  session,
  open,
  onOpenChange,
}: {
  session: WorkspaceSession;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const names =
    session.participants.map((p) => p.fullName).join(", ") ||
    session.title ||
    "la sesión";
  const elapsed = session.startedAt
    ? clock(Math.max(0, Date.now() - new Date(session.startedAt).getTime()))
    : null;
  const noNotes = !session.observations?.trim();

  async function confirm() {
    setSaving(true);
    // Flush de las últimas observaciones antes de cerrar (no se pisan campos).
    window.dispatchEvent(new Event("session:save-now"));
    const fin = await finishSession(session.id);
    setSaving(false);
    if (fin?.error) {
      toast.error(fin.error);
      return;
    }
    toast.success("Sesión finalizada");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Flag className="h-6 w-6" />
            Finalizar sesión
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-base">
            Vas a finalizar la sesión con <strong>{names}</strong>
            {elapsed && (
              <>
                {" "}
                tras <strong>{elapsed}</strong>
              </>
            )}
            . Después vas a poder agregar un resumen y los próximos pasos.
          </p>
          {noNotes && (
            <div className="text-level-high flex items-start gap-2 text-base">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>No registraste observaciones en esta sesión.</span>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Seguir en la sesión
            </Button>
            <Button
              size="lg"
              className="text-base"
              onClick={confirm}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Square className="h-5 w-5" />
              )}
              Finalizar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Notas de consola (en curso): Observaciones, la única superficie de escritura ──
function ConsoleNotes({
  session,
  isCouple,
  onSaveState,
}: {
  session: WorkspaceSession;
  isCouple: boolean;
  onSaveState: (s: SaveState) => void;
}) {
  const [obs, setObs] = useState(session.observations ?? "");
  const persisted = useRef(obs);
  const obsRef = useRef<HTMLTextAreaElement>(null);

  async function persist(o: string) {
    if (o === persisted.current) return;
    onSaveState("saving");
    const res = await saveSessionNotes(session.id, { observations: o });
    if (res?.error) onSaveState("error");
    else {
      persisted.current = o;
      onSaveState("saved");
    }
  }

  // Autoguardado debounced de las observaciones: lo único que se escribe en vivo.
  // Los próximos pasos viven en el paso de cierre (al Finalizar).
  useEffect(() => {
    if (obs === persisted.current) return;
    onSaveState("saving");
    const t = setTimeout(() => persist(obs), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs]);

  // Guardado inmediato (⌘S, o al abrir el cierre).
  const obsValRef = useRef(obs);
  obsValRef.current = obs;
  useEffect(() => {
    const flush = () => persist(obsValRef.current);
    window.addEventListener("session:save-now", flush);
    return () => window.removeEventListener("session:save-now", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  function insertTimestamp() {
    if (!session.startedAt) return;
    const elapsed = Math.max(
      0,
      Date.now() - new Date(session.startedAt).getTime(),
    );
    const stamp = `[${clock(elapsed)}] `;
    const el = obsRef.current;
    const start = el?.selectionStart ?? obs.length;
    const end = el?.selectionEnd ?? obs.length;
    setObs(obs.slice(0, start) + stamp + obs.slice(end));
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + stamp.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="space-y-4">
      {/* Observaciones: lo único que se escribe en vivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            Observaciones{isCouple ? " (compartidas)" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-end gap-1">
            <DictateButton
              onText={(chunk) => setObs((prev) => appendText(prev, chunk))}
            />
            {session.startedAt && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-sm"
                onClick={insertTimestamp}
                title="Insertar marca de tiempo en el cursor"
              >
                <Timer className="h-4 w-4" />
                Marca de tiempo
              </Button>
            )}
          </div>
          <Textarea
            ref={obsRef}
            rows={14}
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Qué se trabajó, cómo llegó, intervenciones…"
            autoFocus={!session.observations}
            className="text-lg leading-relaxed"
          />
        </CardContent>
      </Card>

      {/* Notas individuales: solo tienen sentido en pareja/familia (una nota
          privada por persona). En sesión individual, Observaciones alcanza. */}
      {isCouple &&
        session.participants.map((p) => (
          <IndividualNotes
            key={p.participantId}
            participant={p}
            onSaveState={onSaveState}
          />
        ))}
    </div>
  );
}

// ── Sesión finalizada: notas + generar contenido + resumen / cierre / mensaje ─
// El profesional toma solo las notas en la consola; al finalizar puede pulsar
// "Generar contenido" (junto a las Notas) y la IA completa de una vez el
// resumen, los próximos pasos y el mensaje para el paciente. Cada campo conserva
// su propio "Generar con IA" para regenerarlo aparte.
//
// Los tres campos viven en componentes hijos con estado propio (autoguardado,
// edición). Para reflejar la generación en bloque sin reescribirlos a
// "controlados", aplicamos los valores nuevos como override sobre `session` y
// remontamos los hijos con una `key` (genKey). El server ya persistió todo, así
// que el remonte no vuelve a guardar.
function CompletedSession({
  session,
  isCouple,
  tests,
  templates,
  voices,
  patientMessageEmojis,
  aiEnabled,
  whatsappEnabled,
}: {
  session: WorkspaceSession;
  isCouple: boolean;
  tests: SessionTest[];
  templates: TemplateOption[];
  voices: VoiceOption[];
  patientMessageEmojis: boolean;
  aiEnabled: boolean;
  whatsappEnabled: boolean;
}) {
  const router = useRouter();
  const [genKey, setGenKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [override, setOverride] = useState<{
    summary: string;
    nextSteps: string;
    patientMessage: string;
  } | null>(null);
  const [tab, setTab] = useState<OutputTab>(
    session.summary?.trim() ? "resumen" : "notas",
  );
  const [showOpts, setShowOpts] = useState(false);

  // Plantilla (estructura del resumen) y voz (estilo) elegidas. Fuente única:
  // las edita SessionSummary y las usa tanto el botón en bloque como cada
  // regeneración individual. Default: lo ya usado en la sesión o el primero.
  const [templateId, setTemplateId] = useState<string>(
    session.templateId || defaultOptionId(templates),
  );
  const [voiceId, setVoiceId] = useState<string>(
    session.voiceId || defaultOptionId(voices),
  );

  const hasNotes = Boolean(session.observations?.trim());

  // `session` con los valores recién generados aplicados (para los hijos).
  const effective: WorkspaceSession = override
    ? {
        ...session,
        summary: override.summary,
        nextSteps: override.nextSteps,
        patientMessage: override.patientMessage,
      }
    : session;

  async function generateAll() {
    setGenerating(true);
    const res = await generateSessionContent(
      session.id,
      templateId || null,
      voiceId || null,
    );
    setGenerating(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setOverride({
      summary: res.summary ?? "",
      nextSteps: res.nextSteps ?? "",
      patientMessage: res.patientMessage ?? "",
    });
    setGenKey((k) => k + 1); // remonta los hijos con los valores nuevos
    setTab("resumen"); // mostramos el resumen recién generado
    router.refresh(); // sincroniza datos del server (p. ej. "Generado con IA")
    toast.success("Generamos el resumen, los próximos pasos y el mensaje");
  }

  const hasPatients = session.participants.length > 0;
  const hasContent: Record<"resumen" | "pasos" | "mensaje", boolean> = {
    resumen: Boolean(effective.summary?.trim()),
    pasos: Boolean(effective.nextSteps?.trim()),
    mensaje: Boolean(effective.patientMessage?.trim()),
  };
  const anyContent = hasContent.resumen || hasContent.pasos || hasContent.mensaje;

  const tabs: { key: OutputTab; label: string; done?: boolean }[] = [
    { key: "notas", label: "Notas" },
    { key: "resumen", label: "Resumen", done: hasContent.resumen },
    { key: "pasos", label: "Próximos pasos", done: hasContent.pasos },
    { key: "mensaje", label: "Mensaje", done: hasContent.mensaje },
    ...(hasPatients
      ? [{ key: "acciones" as OutputTab, label: "Acciones" }]
      : []),
  ];

  // Los controles de generación viven DENTRO de la tarjeta de Notas: dejan claro
  // que el resto sale de esas notas. Plantilla/Voz quedan en "Opciones" (plegado).
  const generateControls = aiEnabled ? (
    <div className="border-border space-y-2 border-t pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={generateAll}
          disabled={generating || !hasNotes}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {anyContent
            ? "Regenerar todo"
            : "Generar resumen, pasos y mensaje"}
        </Button>
        <button
          type="button"
          onClick={() => setShowOpts((v) => !v)}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Opciones {showOpts ? "▴" : "▾"}
        </button>
      </div>
      {!hasNotes && (
        <p className="text-level-high text-sm">
          Escribí notas para poder generar.
        </p>
      )}
      {showOpts && (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          {templates.length > 0 && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Plantilla del resumen</span>
              <Select
                value={templateId}
                onValueChange={(v) => setTemplateId(v ?? "")}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Plantilla">
                    {() =>
                      templates.find((t) => t.id === templateId)?.name ??
                      "Plantilla"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
          {voices.length > 0 && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Voz / estilo</span>
              <Select
                value={voiceId}
                onValueChange={(v) => setVoiceId(v ?? "")}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Voz">
                    {() => voices.find((v) => v.id === voiceId)?.name ?? "Voz"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {voices.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {/* Una sola tira de pestañas: Notas (fuente) → outputs → Acciones. */}
      <div className="border-border flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-base font-medium transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.done !== undefined && (
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  t.done ? "bg-level-ok" : "border-muted-foreground/40 border",
                )}
              />
            )}
            {t.label}
          </button>
        ))}
      </div>

      {/* Paneles: se montan todos y se oculta el inactivo (no se pierde el
          autoguardado de los textos en edición). */}
      <div className={cn(tab !== "notas" && "hidden")}>
        <NotesTab
          session={session}
          isCouple={isCouple}
          footer={generateControls}
        />
      </div>
      <div className={cn(tab !== "resumen" && "hidden")}>
        <SessionSummary
          key={`summary-${genKey}`}
          session={effective}
          aiEnabled={aiEnabled}
          templateId={templateId}
          voiceId={voiceId}
        />
      </div>
      <div className={cn(tab !== "pasos" && "hidden")}>
        <NextStepsField
          key={`steps-${genKey}`}
          session={effective}
          aiEnabled={aiEnabled}
          voiceId={voiceId}
        />
      </div>
      <div className={cn(tab !== "mensaje" && "hidden")}>
        <PatientMessageCard
          key={`message-${genKey}`}
          session={effective}
          aiEnabled={aiEnabled}
          whatsappEnabled={whatsappEnabled}
          voiceId={voiceId}
          emojisDefault={patientMessageEmojis}
        />
      </div>
      {hasPatients && (
        <div className={cn(tab !== "acciones" && "hidden")}>
          <ClosingLogistics session={effective} tests={tests} />
        </div>
      )}
    </div>
  );
}

// ── Resumen con IA (sesión finalizada): generar + editar ─────────────────────
function SessionSummary({
  session,
  aiEnabled = false,
  templateId,
  voiceId,
}: {
  session: WorkspaceSession;
  aiEnabled?: boolean;
  /** Plantilla/voz elegidas arriba (en la barra de generación); se usan al regenerar. */
  templateId: string;
  voiceId: string;
}) {
  const [text, setText] = useState(session.summary ?? "");
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const persisted = useRef(text);

  // Autoguardado de las ediciones manuales del resumen.
  useEffect(() => {
    if (text === persisted.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const res = await saveSessionSummary(session.id, text);
      if (res?.error) setSaveState("error");
      else {
        persisted.current = text;
        setSaveState("saved");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [text, session.id]);

  async function generate() {
    setGenerating(true);
    const res = await generateSessionSummary(
      session.id,
      templateId || null,
      voiceId || null,
    );
    setGenerating(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.summary) {
      setText(res.summary);
      persisted.current = res.summary; // ya viene guardado del server
      setSaveState("saved");
      toast.success("Resumen generado");
    }
  }

  return (
    <CollapsibleCard
      title="Resumen de la sesión"
      icon={Sparkles}
      extra={<SaveStatus state={saveState} />}
    >
      {aiEnabled && (
        <div>
          <Button onClick={generate} disabled={generating} variant="outline">
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {text ? "Regenerar con IA" : "Generar con IA"}
          </Button>
        </div>
      )}

      {editing || !text.trim() ? (
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Resumen de lo trabajado en la sesión (opcional)… Podés usar **negrita**, *itálica* y listas con -."
          className="text-base leading-relaxed"
          autoFocus={editing}
        />
      ) : (
        <div className="border-border rounded-lg border p-3.5 text-base">
          <Markdown content={text} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        {session.summaryModel ? (
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            Generado con IA · editable
          </p>
        ) : (
          <span />
        )}
        {text.trim() && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-sm"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? (
              <>
                <Check className="h-4 w-4" />
                Listo
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" />
                Editar
              </>
            )}
          </Button>
        )}
      </div>
    </CollapsibleCard>
  );
}

// ── Próximos pasos (campo autoguardado): qué queda pactado para la próxima ────
// Vive en "Antes de la próxima" (no en las notas), junto a agendar/asignar.
function NextStepsField({
  session,
  aiEnabled = false,
  voiceId,
}: {
  session: WorkspaceSession;
  aiEnabled?: boolean;
  voiceId?: string;
}) {
  const [next, setNext] = useState(session.nextSteps ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const persisted = useRef(next);

  useEffect(() => {
    if (next === persisted.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const res = await saveSessionNotes(session.id, { nextSteps: next });
      if (res?.error) setSaveState("error");
      else {
        persisted.current = next;
        setSaveState("saved");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [next, session.id]);

  async function generate() {
    setGenerating(true);
    const res = await generateSessionNextSteps(session.id, voiceId || null);
    setGenerating(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.nextSteps) {
      setNext(res.nextSteps);
      persisted.current = res.nextSteps; // ya viene guardado del server
      setSaveState("saved");
      setEditing(false);
      toast.success("Próximos pasos generados");
    }
  }

  return (
    <CollapsibleCard
      title="Próximos pasos"
      icon={Flag}
      extra={
        <div className="flex items-center gap-1">
          <DictateButton
            onText={(chunk) => {
              setEditing(true);
              setNext((prev) => appendText(prev, chunk));
            }}
          />
          <SaveStatus state={saveState} />
        </div>
      }
    >
      <p className="text-muted-foreground text-sm">
        Recordatorio para vos al iniciar la próxima sesión: qué retomar y qué le
        quedó al paciente.
      </p>
      {aiEnabled && (
        <div>
          <Button
            type="button"
            onClick={generate}
            disabled={generating}
            variant="outline"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {next.trim() ? "Regenerar con IA" : "Generar con IA"}
          </Button>
        </div>
      )}
      {editing || !next.trim() ? (
        <Textarea
          rows={4}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="Qué queda pactado para la próxima (tarea, foco)…"
          className="text-base leading-relaxed"
          autoFocus={editing}
        />
      ) : (
        <div className="border-border rounded-lg border p-3.5 text-base">
          <Markdown content={next} />
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        {next.trim() && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 text-sm"
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? (
              <>
                <Check className="h-4 w-4" />
                Listo
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" />
                Editar
              </>
            )}
          </Button>
        )}
      </div>
    </CollapsibleCard>
  );
}

// ── Logística de cierre (sesión finalizada): agendar próxima / asignar ────────
// No es contenido generado: son las acciones para preparar lo que sigue.
function ClosingLogistics({
  session,
  tests,
}: {
  session: WorkspaceSession;
  tests: SessionTest[];
}) {
  const single =
    session.participants.length === 1 ? session.participants[0] : null;
  const hasPatients = session.participants.length > 0;
  if (!hasPatients) return null;
  return (
    <CollapsibleCard title="Antes de la próxima" icon={CalendarPlus}>
      <div className="flex flex-wrap gap-2.5">
        <ScheduleNextButton patientId={single?.patientId ?? null} />
        <SessionActions participants={session.participants} tests={tests} />
      </div>
      <SessionAssignedSummary
        participants={session.participants}
        startedAt={session.startedAt}
      />
    </CollapsibleCard>
  );
}

// ── Mensaje para el paciente (opcional): redactar/generar y enviar por WhatsApp ─
function PatientMessageCard({
  session,
  aiEnabled,
  whatsappEnabled,
  voiceId,
  emojisDefault,
}: {
  session: WorkspaceSession;
  aiEnabled: boolean;
  whatsappEnabled: boolean;
  voiceId?: string;
  emojisDefault: boolean;
}) {
  const [emojis, setEmojis] = useState(emojisDefault);
  const [text, setText] = useState(session.patientMessage ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [sentAt, setSentAt] = useState<Date | string | null>(session.taskSentAt);
  const [isSending, startSend] = useTransition();
  const persisted = useRef(text);

  // Autoguardado del mensaje.
  useEffect(() => {
    if (text === persisted.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const res = await saveSessionPatientMessage(session.id, text);
      if (res?.error) setSaveState("error");
      else {
        persisted.current = text;
        setSaveState("saved");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [text, session.id]);

  async function generate() {
    setGenerating(true);
    const res = await generatePatientMessage(session.id, voiceId || null);
    setGenerating(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (res.message) {
      setText(res.message);
      persisted.current = res.message; // ya viene guardado del server
      setSaveState("saved");
      setAiGenerated(true);
      setEditing(false);
      toast.success("Mensaje generado");
    }
  }

  function send() {
    startSend(async () => {
      const res = await sendSessionTask(session.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setSentAt(new Date());
      toast.success(
        `Mensaje enviado a ${res.sent} ${res.sent === 1 ? "paciente" : "pacientes"}`,
      );
    });
  }

  // Preferencia de emojis: se guarda al toque y se usa en la próxima generación.
  function toggleEmojis(value: boolean) {
    setEmojis(value);
    void setPatientMessageEmojis(value);
  }

  return (
    <CollapsibleCard
      title={
        <>
          Mensaje para el paciente
          <Badge variant="outline" className="font-normal">
            opcional
          </Badge>
        </>
      }
      icon={Send}
      extra={<SaveStatus state={saveState} />}
    >
      <p className="text-muted-foreground text-sm">
        Lo que le llega al paciente por WhatsApp. Distinto de tus notas; si lo
        dejás vacío, no se envía nada.
      </p>
      <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {aiEnabled ? (
              <Button onClick={generate} disabled={generating} variant="outline">
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {text ? "Regenerar con IA" : "Generar con IA"}
              </Button>
            ) : (
              <span />
            )}
            {aiEnabled && (
              <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm">
                <Switch checked={emojis} onCheckedChange={toggleEmojis} />
                Emojis
              </label>
            )}
          </div>
          <DictateButton
            onText={(chunk) => {
              setEditing(true);
              setText((prev) => appendText(prev, chunk));
            }}
          />
        </div>
        {editing || !text.trim() ? (
          <Textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej: Hoy trabajamos sobre… Tu tarea para esta semana es… Nos vemos el martes."
            className="text-base leading-relaxed"
            autoFocus={editing}
          />
        ) : (
          <WhatsappPreview content={text} />
        )}
        <div className="flex items-center justify-between gap-2">
          {aiGenerated ? (
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <Sparkles className="h-3 w-3" />
              Generado con IA · editable
            </p>
          ) : (
            <span />
          )}
          {text.trim() && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-sm"
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? (
                <>
                  <Check className="h-4 w-4" />
                  Listo
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />
                  Editar
                </>
              )}
            </Button>
          )}
        </div>
        {whatsappEnabled ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={send}
              disabled={isSending || !text.trim()}
              variant={sentAt ? "outline" : "default"}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sentAt ? "Reenviar por WhatsApp" : "Enviar por WhatsApp"}
            </Button>
            {sentAt && (
              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                <Check className="h-4 w-4" />
                Enviado · {fmtDate(sentAt)}
              </span>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            El envío por WhatsApp no está habilitado en tu cuenta.
          </p>
        )}
      </>
    </CollapsibleCard>
  );
}

// ── Notas (autoguardado) ─────────────────────────────────────────────────────
function NotesTab({
  session,
  isCouple,
  focus = false,
  collapsedInitially = false,
  onSaveState,
  headerExtra,
  footer,
}: {
  session: WorkspaceSession;
  isCouple: boolean;
  /** Modo consola activa: notas como superficie principal (más alto + autofoco). */
  focus?: boolean;
  /** Tarjeta plegada al cargar (en finalizada, para que destaque el resumen). */
  collapsedInitially?: boolean;
  /** Reporta el estado de guardado hacia arriba (barra de comando). Si se pasa,
   *  no se muestra el indicador dentro de la tarjeta. */
  onSaveState?: (s: SaveState) => void;
  /** Acción extra en la cabecera, junto al título (p. ej. "Generar contenido"). */
  headerExtra?: React.ReactNode;
  /** Contenido extra dentro de la tarjeta, debajo del textarea (p. ej. generar). */
  footer?: React.ReactNode;
}) {
  const [obs, setObs] = useState(session.observations ?? "");
  const [state, setState] = useState<SaveState>("idle");
  // Valor ya persistido: evita guardar en el montaje y bajo StrictMode. Objetivos
  // (foco) y próximos pasos viven en sus propias pantallas; acá solo las notas.
  const persisted = useRef(obs);
  const obsRef = useRef<HTMLTextAreaElement>(null);

  const report = (s: SaveState) => {
    setState(s);
    onSaveState?.(s);
  };

  async function persist() {
    if (obs === persisted.current) return;
    report("saving");
    const res = await saveSessionNotes(session.id, { observations: obs });
    if (res?.error) report("error");
    else {
      persisted.current = obs;
      report("saved");
    }
  }

  // Autoguardado debounced.
  useEffect(() => {
    if (obs === persisted.current) return;
    report("saving");
    const t = setTimeout(persist, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obs]);

  // Guardado inmediato (⌘S desde la consola).
  const obsValRef = useRef(obs);
  obsValRef.current = obs;
  useEffect(() => {
    function flush() {
      const value = obsValRef.current;
      if (value === persisted.current) return;
      report("saving");
      saveSessionNotes(session.id, { observations: value }).then((res) => {
        if (res?.error) report("error");
        else {
          persisted.current = value;
          report("saved");
        }
      });
    }
    window.addEventListener("session:save-now", flush);
    return () => window.removeEventListener("session:save-now", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  // Inserta una marca de tiempo [mm:ss] en las observaciones, en el cursor.
  function insertTimestamp() {
    if (!session.startedAt) return;
    const elapsed = Math.max(
      0,
      Date.now() - new Date(session.startedAt).getTime(),
    );
    const stamp = `[${clock(elapsed)}] `;
    const el = obsRef.current;
    const start = el?.selectionStart ?? obs.length;
    const end = el?.selectionEnd ?? obs.length;
    const value = obs.slice(0, start) + stamp + obs.slice(end);
    setObs(value);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + stamp.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="space-y-4">
      <CollapsibleCard
        title={`Notas ${isCouple ? "compartidas (pareja/familia)" : "de la sesión"}`}
        defaultOpen={!collapsedInitially}
        extra={
          headerExtra || !onSaveState ? (
            <div className="flex items-center gap-2">
              {headerExtra}
              {!onSaveState && <SaveStatus state={state} />}
            </div>
          ) : undefined
        }
      >
        <div className="flex justify-end gap-1">
          <DictateButton
            onText={(chunk) => setObs((prev) => appendText(prev, chunk))}
          />
          {focus && session.startedAt && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-sm"
              onClick={insertTimestamp}
              title="Insertar marca de tiempo en el cursor"
            >
              <Timer className="h-4 w-4" />
              Marca de tiempo
            </Button>
          )}
        </div>
        <Textarea
          ref={obsRef}
          rows={focus ? 12 : 8}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Qué se trabajó, cómo llegó, intervenciones…"
          autoFocus={focus && !session.observations}
          className="text-base leading-relaxed"
        />
        {footer}
      </CollapsibleCard>

      {isCouple &&
        session.participants.map((p) => (
          <IndividualNotes
            key={p.participantId}
            participant={p}
            onSaveState={onSaveState}
          />
        ))}
    </div>
  );
}

function IndividualNotes({
  participant,
  onSaveState,
}: {
  participant: WorkspaceParticipant;
  onSaveState?: (s: SaveState) => void;
}) {
  const [notes, setNotes] = useState(participant.individualNotes ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const persisted = useRef(notes);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const report = (s: SaveState) => {
    setState(s);
    onSaveState?.(s);
  };

  async function persist(value: string) {
    if (value === persisted.current) return;
    report("saving");
    const res = await saveIndividualNotes(participant.participantId, value);
    if (res?.error) report("error");
    else {
      persisted.current = value;
      report("saved");
    }
  }

  useEffect(() => {
    if (notes === persisted.current) return;
    report("saving");
    const t = setTimeout(() => persist(notes), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes]);

  // Guardado inmediato (⌘S).
  useEffect(() => {
    const flush = () => persist(notesRef.current);
    window.addEventListener("session:save-now", flush);
    return () => window.removeEventListener("session:save-now", flush);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant.participantId]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">
          Notas individuales · {participant.fullName}
        </CardTitle>
        {!onSaveState && <SaveStatus state={state} />}
      </CardHeader>
      <CardContent>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={`Notas privadas sobre ${participant.fullName} en esta sesión…`}
        />
      </CardContent>
    </Card>
  );
}

// ── Adjuntos ─────────────────────────────────────────────────────────────────
function FilesTab({ participants }: { participants: WorkspaceParticipant[] }) {
  if (participants.length === 0) {
    return <EmptyCard text="Sin pacientes en esta sesión." />;
  }
  return (
    <div className="space-y-4">
      {participants.map((p) => (
        <Card key={p.participantId}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                {p.fullName}
              </span>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/pacientes/${p.patientId}`}>
                  Gestionar <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {p.attachments.length === 0 ? (
              <p className="text-muted-foreground text-sm">Sin adjuntos.</p>
            ) : (
              <ul className="divide-border divide-y">
                {p.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span className="truncate">{a.fileName}</span>
                    <span className="text-muted-foreground text-xs">
                      {fmtDate(a.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Historial ────────────────────────────────────────────────────────────────
function HistoryTab({ participants }: { participants: WorkspaceParticipant[] }) {
  if (participants.length === 0) {
    return <EmptyCard text="Sin pacientes en esta sesión." />;
  }
  return (
    <div className="space-y-4">
      {participants.map((p) => (
        <Card key={p.participantId}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" />
              {p.fullName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {p.history.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Sin otras sesiones registradas.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {p.history.map((s) => {
                  const m = topicLabel(s.topic, s.topicOther);
                  return (
                    <li key={s.id} className="py-2">
                      <Link
                        href={`/sesiones/${s.id}`}
                        className="flex items-center justify-between gap-2 text-sm hover:underline"
                      >
                        <span>{fmtDateTime(s.startsAt, "long")}</span>
                        <span className="flex items-center gap-1.5">
                          {m && <Badge variant="outline">{m}</Badge>}
                          <Badge variant={statusBadgeVariant(s.status)}>
                            {statusLabel(s.status)}
                          </Badge>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return <EmptyState>{text}</EmptyState>;
}
