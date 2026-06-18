"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Stethoscope,
  CalendarClock,
  FileText,
  MessageCircle,
  ArrowUpRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { SECTION_LABEL } from "@/lib/ui";
import { TONE_BADGE, type LevelTone } from "@/lib/levels";
import {
  statusLabel,
  statusBadgeVariant,
  checkinStatusLabel,
  checkinStatusBadgeVariant,
} from "@/lib/sessionLabels";
import { motivoCategoryLabel } from "@/lib/validations";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection } from "@/components/ui/list-row";
import { ProcessManager } from "./ProcessManager";
import { NewProcessDialog } from "./ClinicalRecord";

export interface TreatmentSession {
  id: string;
  startsAt: Date | string;
  status: string;
  topic: string | null;
}
export interface TreatmentTest {
  assignmentId: string;
  testName: string;
  status: string;
  levelLabel: string | null;
  tone: LevelTone | null;
  when: Date | string | null;
}
export interface TreatmentCheckin {
  id: string;
  question: string;
  status: string;
}
export interface TreatmentView {
  id: string | null; // null = consultas puntuales (sin tratamiento)
  status: string | null;
  motivo: string | null;
  motivoCategory: string | null;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  sessions: TreatmentSession[];
  tests: TreatmentTest[];
  checkins: TreatmentCheckin[];
}

export function PatientTreatments({
  patientId,
  treatments,
}: {
  patientId: string;
  treatments: TreatmentView[];
}) {
  const hasActive = treatments.some((t) => t.status === "ACTIVE");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Cada tratamiento agrupa sus sesiones, tests y seguimientos. Abrí uno
          para ver el detalle.
        </p>
        <NewProcessDialog patientId={patientId} disabled={hasActive} />
      </div>

      {treatments.length === 0 ? (
        <EmptyState>
          Sin tratamientos todavía. Se abre uno al agendar la primera sesión
          (salvo consulta puntual).
        </EmptyState>
      ) : (
        <ListSection>
          {treatments.map((t) => (
            <TreatmentCard key={t.id ?? "loose"} t={t} patientId={patientId} />
          ))}
        </ListSection>
      )}
    </div>
  );
}

function TreatmentCard({
  t,
  patientId,
}: {
  t: TreatmentView;
  patientId: string;
}) {
  // Colapsado al entrar; el psicólogo abre el que quiera mirar.
  const [open, setOpen] = useState(false);
  const loose = t.id === null;
  const category = motivoCategoryLabel(t.motivoCategory);
  const narrative = t.motivo?.trim() || null;
  // Identidad del tratamiento = el motivo (categoría). El detalle/narrativa va
  // como texto secundario, solo si la categoría no es ya la narrativa.
  const name = loose
    ? "Sin tratamiento (consultas puntuales)"
    : (category ?? narrative ?? "Tratamiento sin motivo");
  const detail = !loose && category ? narrative : null;

  return (
    <ListRow
      icon={Stethoscope}
      collapsible
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      ariaLabel={name}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {name}
          {!loose && (
            <Badge variant={t.status === "ACTIVE" ? "default" : "secondary"}>
              {t.status === "ACTIVE" ? "En curso" : "Finalizado"}
            </Badge>
          )}
        </span>
      }
      meta={
        <>
          {detail && (
            <span className="text-muted-foreground w-full text-sm">{detail}</span>
          )}
          <span className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm">
            {!loose && t.startedAt && (
              <span>
                desde {fmtDate(t.startedAt)}
                {t.endedAt ? ` · alta ${fmtDate(t.endedAt)}` : ""}
              </span>
            )}
            <span>{t.sessions.length} sesiones</span>
            <span>{t.tests.length} tests</span>
            <span>{t.checkins.length} seguimientos</span>
          </span>
        </>
      }
      actions={
        !loose && t.id ? (
          <ProcessManager
            patientId={patientId}
            processId={t.id}
            status={t.status ?? "ACTIVE"}
            motivo={t.motivo}
            motivoCategory={t.motivoCategory}
          />
        ) : undefined
      }
    >
      <div className="divide-border divide-y">
        <DetailSection title="Sesiones" icon={CalendarClock}>
                {t.sessions.length === 0 ? (
                  <Empty>Sin sesiones.</Empty>
                ) : (
                  t.sessions.map((s) => (
                    <Link
                      key={s.id}
                      href={`/sesiones/${s.id}`}
                      className="hover:bg-muted -mx-2 flex items-center justify-between gap-2 rounded px-2 py-1.5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm">
                          {fmtDateTime(s.startsAt)}
                        </span>
                        {s.topic && (
                          <span className="text-muted-foreground truncate text-xs">
                            · {s.topic}
                          </span>
                        )}
                      </span>
                      <Badge variant={statusBadgeVariant(s.status)} className="shrink-0">
                        {statusLabel(s.status)}
                      </Badge>
                    </Link>
                  ))
                )}
              </DetailSection>

              <DetailSection title="Tests" icon={FileText}>
                {t.tests.length === 0 ? (
                  <Empty>Sin tests.</Empty>
                ) : (
                  t.tests.map((te) => (
                    <Link
                      key={te.assignmentId}
                      href={`/resultados/${te.assignmentId}`}
                      className="hover:bg-muted -mx-2 flex items-center justify-between gap-2 rounded px-2 py-1.5"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm">{te.testName}</span>
                        {te.when && (
                          <span className="text-muted-foreground shrink-0 text-xs">
                            · {fmtDate(te.when)}
                          </span>
                        )}
                      </span>
                      {te.levelLabel && te.tone ? (
                        <Badge
                          variant="outline"
                          className={cn("shrink-0", TONE_BADGE[te.tone])}
                        >
                          {te.levelLabel}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          pendiente
                        </span>
                      )}
                    </Link>
                  ))
                )}
              </DetailSection>

              <DetailSection title="Seguimientos" icon={MessageCircle}>
                {t.checkins.length === 0 ? (
                  <Empty>Sin seguimientos.</Empty>
                ) : (
                  t.checkins.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 py-1.5"
                    >
                      <span className="min-w-0 truncate text-sm">{c.question}</span>
                      <Badge
                        variant={checkinStatusBadgeVariant(c.status)}
                        className="shrink-0"
                      >
                        {checkinStatusLabel(c.status)}
                      </Badge>
                    </div>
                  ))
                )}
              </DetailSection>

        {!loose && t.id && (
          <div className="flex justify-end px-4 py-2.5">
            <Link
              href={`/pacientes/${patientId}/procesos/${t.id}`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-sm font-medium"
            >
              Ver línea de tiempo
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </ListRow>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1 px-4 py-3">
      <p className={cn(SECTION_LABEL, "flex items-center gap-1.5")}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      <div>{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}
