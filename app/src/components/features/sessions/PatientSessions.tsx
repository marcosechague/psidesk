"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Trash2,
  Pencil,
  Target,
  ArrowRightCircle,
  ArrowUpRight,
  CalendarClock,
} from "lucide-react";

import { deleteSession } from "@/server/actions";
import {
  topicLabel,
  statusLabel,
  statusBadgeVariant,
  sessionEmphasisClass,
} from "@/lib/sessionLabels";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection } from "@/components/ui/list-row";
import { RowActions } from "@/components/ui/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SessionForm, type SessionEditData } from "./SessionForm";

export interface SessionProcessGroup {
  id: string | null;
  motivo: string | null;
  motivoCategory: string | null;
  status: string | null;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  sessions: SessionEditData[];
}

interface PatientSessionsProps {
  patientId: string;
  groups: SessionProcessGroup[];
  /** El psicólogo tiene habilitados los avisos de cita por WhatsApp. */
  canNotify?: boolean;
}

/**
 * Separa las sesiones por estado (no solo por fecha):
 * - inProgress: en curso (IN_PROGRESS)
 * - pending: PROGRAMADAS cuya fecha ya pasó (vencidas, falta cerrarlas)
 * - upcoming: PROGRAMADAS futuras (próximas, asc)
 * - done: realizadas / no asistió / canceladas (desc)
 */
function bucketSessions(sessions: SessionEditData[]) {
  const now = Date.now();
  const inProgress: SessionEditData[] = [];
  const pending: SessionEditData[] = [];
  const upcoming: SessionEditData[] = [];
  const done: SessionEditData[] = [];
  for (const s of sessions) {
    const isPast = new Date(s.startsAt).getTime() < now;
    if (s.status === "IN_PROGRESS") inProgress.push(s);
    else if (s.status === "SCHEDULED") (isPast ? pending : upcoming).push(s);
    else done.push(s);
  }
  upcoming.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  pending.sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );
  done.sort(
    (a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime(),
  );
  return { inProgress, pending, upcoming, done };
}

export function PatientSessions({
  patientId,
  groups,
  canNotify,
}: PatientSessionsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalSessions = groups.reduce((n, g) => n + g.sessions.length, 0);

  const allSessions = groups.flatMap((g) => g.sessions);
  const { inProgress, pending, upcoming, done } = bucketSessions(allSessions);

  function remove(id: string) {
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteSession(id);
      setDeletingId(null);
      if (res?.error) toast.error(res.error);
      else toast.success("Sesión eliminada");
    });
  }

  function renderSession(
    s: SessionEditData,
    emphasis: "active" | "next" | "muted" | "normal" = "normal",
  ) {
    const motivo = topicLabel(s.topic, s.topicOther);
    const hasBody = s.observations || s.goals || s.nextSteps;
    return (
      <ListRow
        key={s.id}
        icon={CalendarClock}
        className={sessionEmphasisClass(emphasis)}
        title={
          <>
            {fmtDateTime(s.startsAt)} · {s.durationMin}′
          </>
        }
        meta={
          <>
            <Badge variant={statusBadgeVariant(s.status)}>
              {statusLabel(s.status)}
            </Badge>
            {motivo && <Badge variant="outline">{motivo}</Badge>}
          </>
        }
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/sesiones/${s.id}`}>
                Abrir
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
            <RowActions>
              <DropdownMenuItem onClick={() => setEditingId(s.id)}>
                <Pencil className="h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => remove(s.id)}
                disabled={isPending && deletingId === s.id}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </RowActions>
          </>
        }
      >
        {hasBody ? (
          <div className="space-y-2 px-4 py-3">
            {s.observations && (
              <p className="text-sm whitespace-pre-wrap">{s.observations}</p>
            )}
            {s.goals && (
              <p className="text-muted-foreground flex gap-2 text-sm">
                <Target className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="whitespace-pre-wrap">{s.goals}</span>
              </p>
            )}
            {s.nextSteps && (
              <p className="text-muted-foreground flex gap-2 text-sm">
                <ArrowRightCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="whitespace-pre-wrap">{s.nextSteps}</span>
              </p>
            )}
          </div>
        ) : undefined}
      </ListRow>
    );
  }

  const editingSession =
    editingId != null
      ? groups.flatMap((g) => g.sessions).find((s) => s.id === editingId) ?? null
      : null;

  return (
    <div className="space-y-4">
      {/* Editar sesión en modal (consistente con "Nueva sesión"). */}
      <Dialog
        open={!!editingSession}
        onOpenChange={(open) => !open && setEditingId(null)}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar sesión</DialogTitle>
          </DialogHeader>
          {editingSession && (
            <SessionForm
              patients={[]}
              lockedPatientId={patientId}
              session={editingSession}
              canNotify={canNotify}
              onSaved={() => setEditingId(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {totalSessions === 0 ? (
        <EmptyState>Sin sesiones todavía.</EmptyState>
      ) : (
        <div className="space-y-6">
          {inProgress.length > 0 && (
            <ListSection>
              {inProgress.map((s) => renderSession(s, "active"))}
            </ListSection>
          )}

          {pending.length > 0 && (
            <ListSection title="Pendientes de iniciar">
              {pending.map((s) => renderSession(s, "normal"))}
            </ListSection>
          )}

          {upcoming.length > 0 && (
            <ListSection title="Próximas">
              {upcoming.map((s, i) =>
                renderSession(s, i === 0 ? "next" : "normal"),
              )}
            </ListSection>
          )}

          {done.length > 0 && (
            <ListSection title="Realizadas">
              {done.map((s) =>
                renderSession(
                  s,
                  s.status === "CANCELED" || s.status === "NO_SHOW"
                    ? "muted"
                    : "normal",
                ),
              )}
            </ListSection>
          )}
        </div>
      )}
    </div>
  );
}
