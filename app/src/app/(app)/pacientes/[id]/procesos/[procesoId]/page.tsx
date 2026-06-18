import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireUserId } from "@/server/session";
import { getProcess } from "@/server/queries";
import { buildTestCharts } from "@/lib/charts";
import { resultOf } from "@/lib/clinicalSummary";
import { motivoCategoryLabel } from "@/lib/validations";
import {
  topicLabel,
  statusLabel,
  statusBadgeVariant,
  checkinStatusLabel,
  checkinStatusBadgeVariant,
} from "@/lib/sessionLabels";
import { TONE_BADGE } from "@/lib/levels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ProcessManager } from "@/components/features/patients/ProcessManager";
import {
  ProcessDetailView,
  type TimelineActivity,
  type TreatmentSummary,
} from "@/components/features/patients/ProcessDetailView";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("es-AR");
}

export default async function ProcesoDetallePage({
  params,
}: {
  params: Promise<{ id: string; procesoId: string }>;
}) {
  const { id, procesoId } = await params;
  const userId = await requireUserId();
  const process = await getProcess(userId, procesoId);
  if (!process || process.patientId !== id) notFound();

  const isActive = process.status === "ACTIVE";
  const category = motivoCategoryLabel(process.motivoCategory);
  const narrative = process.motivo?.trim() || null;
  // El motivo (categoría) es el título; el detalle/narrativa va como bajada.
  const title = category ?? narrative ?? "Tratamiento";
  const detail = category ? narrative : null;

  const charts = buildTestCharts(process.assignments);

  // ── Línea de tiempo: sesiones + tests + seguimientos, más reciente primero ──
  const sessionEvents: TimelineActivity[] = process.participations.map((p) => {
    const s = p.session;
    const state =
      s.status === "COMPLETED"
        ? "done"
        : s.status === "CANCELED" || s.status === "NO_SHOW"
          ? "canceled"
          : "pending";
    return {
      id: s.id,
      kind: "session",
      when: s.startsAt,
      state,
      title: "Sesión",
      subtitle: topicLabel(s.topic, s.topicOther) || null,
      badgeLabel: statusLabel(s.status),
      badgeVariant: statusBadgeVariant(s.status),
      toneClass: null,
      detail: null,
      href: `/sesiones/${s.id}`,
    };
  });

  const testEvents: TimelineActivity[] = process.assignments.map((a) => {
    const r = resultOf(a);
    return {
      id: a.id,
      kind: "test",
      when: r ? r.when : a.createdAt,
      state: r ? "done" : "pending",
      title: a.test.name,
      subtitle: null,
      badgeLabel: r ? r.levelLabel : "Pendiente",
      badgeVariant: "outline",
      toneClass: r ? TONE_BADGE[r.tone] : null,
      detail: null,
      href: `/resultados/${a.id}`,
    };
  });

  const checkinEvents: TimelineActivity[] = process.checkinPlans.map((c) => {
    const total = c.entries.length;
    const responded = c.entries.filter((e) => e.status === "RESPONDED").length;
    return {
      id: c.id,
      kind: "checkin",
      when: c.startDate,
      state: responded > 0 ? "done" : "pending",
      title: c.question,
      subtitle: null,
      badgeLabel: checkinStatusLabel(c.status),
      badgeVariant: checkinStatusBadgeVariant(c.status),
      toneClass: null,
      detail: total > 0 ? `${responded}/${total} respondidas` : "sin envíos aún",
      href: null,
    };
  });

  const timeline = [...sessionEvents, ...testEvents, ...checkinEvents].sort(
    (a, b) => new Date(b.when).getTime() - new Date(a.when).getTime(),
  );

  const summary: TreatmentSummary = {
    sessions: {
      done: sessionEvents.filter((e) => e.state === "done").length,
      total: sessionEvents.length,
    },
    tests: {
      done: testEvents.filter((e) => e.state === "done").length,
      total: testEvents.length,
    },
    checkins: {
      done: checkinEvents.filter((e) => e.state === "done").length,
      total: checkinEvents.length,
    },
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/pacientes/${id}`}>
          <ArrowLeft className="h-4 w-4" />
          Volver al paciente
        </Link>
      </Button>

      {/* Encabezado del proceso (con acciones: editar motivo, alta/reabrir, eliminar) */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isActive ? "default" : "secondary"}>
                  {isActive ? "En curso" : "Alta"}
                </Badge>
              </div>
              <h1 className="text-3xl">{title}</h1>
              {detail && (
                <p className="text-muted-foreground text-sm">{detail}</p>
              )}
              <p className="text-muted-foreground text-sm">
                desde {fmtDate(process.startedAt)}
                {process.endedAt ? ` · alta ${fmtDate(process.endedAt)}` : ""} ·{" "}
                {summary.sessions.total} sesiones · {summary.tests.done} tests
              </p>
            </div>
            <ProcessManager
              patientId={id}
              processId={process.id}
              status={process.status}
              motivo={process.motivo}
              motivoCategory={process.motivoCategory}
            />
          </div>
        </CardContent>
      </Card>

      <ProcessDetailView
        timeline={timeline}
        summary={summary}
        charts={charts}
      />
    </div>
  );
}
