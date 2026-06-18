"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Clock,
  Users as UsersIcon,
  ArrowRight,
  Circle,
  Play,
  Loader2,
} from "lucide-react";

import { startSession } from "@/server/actions";
import {
  topicLabel,
  statusLabel,
  statusBadgeVariant,
  sessionEmphasisClass,
  type SessionEmphasis,
} from "@/lib/sessionLabels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SessionForm, type SchedulingPatient } from "./SessionForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtTime, fmtDateTime } from "@/lib/format";

export interface HubSession {
  id: string;
  title: string | null;
  startsAt: Date | string;
  durationMin: number;
  status: string;
  topic: string | null;
  topicOther: string | null;
  participants: { id: string; fullName: string }[];
}

type Tab = "today" | "inProgress" | "upcoming" | "history";

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function label(s: HubSession): string {
  return s.participants.map((p) => p.fullName).join(", ") || s.title || "Bloque";
}

export function SessionsHub({
  sessions,
  patients,
  groups,
  canNotify,
}: {
  sessions: HubSession[];
  patients: SchedulingPatient[];
  groups: { id: string; name: string; memberIds: string[] }[];
  canNotify?: boolean;
}) {
  const [now] = useState(() => new Date());
  const [tab, setTab] = useState<Tab>("today");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function startAndOpen(id: string) {
    setStartingId(id);
    startTransition(async () => {
      const res = await startSession(id);
      setStartingId(null);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      router.push(`/sesiones/${id}`);
    });
  }

  const byTime = (a: HubSession, b: HubSession) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();

  const buckets = useMemo(() => {
    const t = now.getTime();
    // Los bloques (almuerzo, supervisión, etc.) son sesiones sin participantes:
    // marcan horario no agendable y no pertenecen al espacio clínico.
    const clinical = sessions.filter((s) => s.participants.length > 0);
    const today = clinical
      .filter((s) => sameDay(new Date(s.startsAt), now))
      .sort(byTime);
    const inProgress = clinical
      .filter((s) => s.status === "IN_PROGRESS")
      .sort(byTime);
    const upcoming = clinical
      .filter(
        (s) => new Date(s.startsAt).getTime() >= t && s.status === "SCHEDULED",
      )
      .sort(byTime);
    const history = clinical
      .filter(
        (s) => new Date(s.startsAt).getTime() < t || s.status === "COMPLETED",
      )
      .sort((a, b) => -byTime(a, b));
    return { today, inProgress, upcoming, history };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, now]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "today", label: "Hoy", count: buckets.today.length },
    { key: "inProgress", label: "En curso", count: buckets.inProgress.length },
    { key: "upcoming", label: "Próximas", count: buckets.upcoming.length },
    { key: "history", label: "Historial", count: buckets.history.length },
  ];

  const list = buckets[tab];
  const showDay = tab === "today";

  // La "próxima" (primera programada futura) se resalta en Hoy y Próximas.
  const nextId =
    tab === "today" || tab === "upcoming"
      ? list.find(
          (s) =>
            s.status === "SCHEDULED" &&
            new Date(s.startsAt).getTime() >= now.getTime(),
        )?.id
      : undefined;

  function emphasisOf(s: HubSession): SessionEmphasis {
    if (s.status === "IN_PROGRESS") return "active";
    if (s.status === "CANCELED" || s.status === "NO_SHOW") return "muted";
    return s.id === nextId ? "next" : "normal";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.key === "inProgress" && t.count > 0 && (
              <Circle className="fill-level-high text-level-high h-2 w-2" />
            )}
            {t.label}
            <span className="text-muted-foreground tabular-nums">{t.count}</span>
          </button>
        ))}
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" />
          Nueva sesión
        </Button>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {tab === "today"
              ? "No tenés sesiones hoy."
              : tab === "inProgress"
                ? "No hay sesiones en curso."
                : tab === "upcoming"
                  ? "No hay sesiones próximas."
                  : "No hay sesiones en el historial."}
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Desktop: tabla */}
        <Card className="hidden overflow-hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuándo</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((s) => {
                const motivo = topicLabel(s.topic, s.topicOther);
                const isCouple = s.participants.length > 1;
                const emph = emphasisOf(s);
                return (
                  <TableRow
                    key={s.id}
                    className={cn(
                      emph === "active" && "bg-primary/5",
                      emph === "muted" && "opacity-60",
                    )}
                  >
                    <TableCell>
                      <Link href={`/sesiones/${s.id}`} className="block">
                        <span className="font-medium whitespace-nowrap">
                          {fmtDateTime(s.startsAt)}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {s.durationMin}′
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {isCouple ? (
                          <UsersIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                        ) : (
                          <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">{label(s)}</span>
                        {isCouple && (
                          <Badge variant="outline" className="shrink-0">
                            Pareja/familia
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {motivo || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(s.status)}>
                        {statusLabel(s.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {s.status === "SCHEDULED" && (
                          <Button
                            size="sm"
                            onClick={() => startAndOpen(s.id)}
                            disabled={isPending}
                          >
                            {startingId === s.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            Iniciar
                          </Button>
                        )}
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/sesiones/${s.id}`}>
                            Abrir <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>

        {/* Mobile: tarjetas */}
        <ul className="space-y-2 sm:hidden">
          {list.map((s) => {
            const motivo = topicLabel(s.topic, s.topicOther);
            const isCouple = s.participants.length > 1;
            const emph = emphasisOf(s);
            return (
              <li key={s.id}>
                <Card
                  className={cn(
                    "transition-colors",
                    sessionEmphasisClass(emph),
                    emph === "normal" && "hover:border-primary/40",
                  )}
                >
                  <CardContent className="flex items-center justify-between gap-3 py-4">
                    <Link
                      href={`/sesiones/${s.id}`}
                      className="min-w-0 flex-1 space-y-1"
                    >
                      <p className="flex items-center gap-2 font-medium">
                        {isCouple ? (
                          <UsersIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                        ) : (
                          <Clock className="text-muted-foreground h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">{label(s)}</span>
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {showDay
                          ? `${fmtTime(s.startsAt)} · ${s.durationMin}′`
                          : fmtDateTime(s.startsAt)}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={statusBadgeVariant(s.status)}>
                          {statusLabel(s.status)}
                        </Badge>
                        {isCouple && <Badge variant="outline">Pareja/familia</Badge>}
                        {motivo && <Badge variant="outline">{motivo}</Badge>}
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      {s.status === "SCHEDULED" && (
                        <Button
                          size="sm"
                          onClick={() => startAndOpen(s.id)}
                          disabled={isPending}
                        >
                          {startingId === s.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                          Iniciar
                        </Button>
                      )}
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/sesiones/${s.id}`}>
                          Abrir <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
        </>
      )}

      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva sesión</DialogTitle>
          </DialogHeader>
          <SessionForm
            patients={patients}
            groups={groups}
            canNotify={canNotify}
            onSaved={() => {
              setShowForm(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
