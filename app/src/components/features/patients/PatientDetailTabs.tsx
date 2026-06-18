"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Send,
  AlertTriangle,
  MessageCircleOff,
  Stethoscope,
  CalendarClock,
  ClipboardList,
  MessageCircle,
} from "lucide-react";

import type { PatientSnapshot } from "@/lib/clinicalSummary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewSessionDialog } from "@/components/features/sessions/NewSessionDialog";
import { cn } from "@/lib/utils";
import { SECTION_LABEL } from "@/lib/ui";
import { ageFromBirthDate, patientFullName } from "@/lib/patients";
import { processMotivoLabel } from "@/lib/validations";
import type { ClinicalRecordData } from "@/server/actions";
import { PatientForm, type PatientEditData } from "./PatientForm";
import { ClinicalRecordForm } from "./ClinicalRecord";
import {
  PatientTreatments,
  type TreatmentView,
} from "./PatientTreatments";

type Tab =
  | "resumen"
  | "tratamiento"
  | "ficha"
  | "sesiones"
  | "tests"
  | "diagnostico"
  | "seguimiento"
  | "adjuntos";

/** Resumen de un proceso (tratamiento): sus sesiones, tests y snapshot clínico. */
export interface ProcessSummary {
  id: string;
  motivo: string | null;
  motivoCategory: string | null;
  status: string;
  startedAt: Date | string;
  endedAt: Date | string | null;
  sessions: number;
  testsCompleted: number;
  nextSession: { id: string; startsAt: Date | string } | null;
  lastSession: { id: string; startsAt: Date | string } | null;
  snapshot: PatientSnapshot;
  checkins: {
    active: number;
    total: number;
    lastResponse: Date | string | null;
  };
}

/** Conteos transversales del paciente para el tab "Resumen". */
export interface PatientSummary {
  sessionsTotal: number;
  sessionsDone: number;
  nextSession: { id: string; startsAt: Date | string } | null;
  testsDone: number;
  testsPending: number;
  checkinsTotal: number;
  checkinsActive: number;
  diagnosesCount: number;
  primaryDiagnosis: { code: string; label: string } | null;
  worsening: boolean;
}

interface PatientDetailTabsProps {
  patient: PatientEditData;
  processSummaries: ProcessSummary[];
  summary: PatientSummary;
  treatments: TreatmentView[];
  clinicalRecord: ClinicalRecordData;
  sessionsSlot: React.ReactNode;
  testsSlot: React.ReactNode;
  diagnosesSlot: React.ReactNode;
  checkinsSlot: React.ReactNode;
  attachmentsSlot: React.ReactNode;
  /** avisos de cita por WhatsApp habilitados (para el form de nueva sesión) */
  canNotify?: boolean;
}

/** Diferencia en días-calendario respecto de hoy (negativo = pasado). */
function dayDiff(d: Date | string) {
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date();
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}
/** Etiqueta relativa compacta: "hoy", "en 3 días", "hace 2 sem", "hace 3 meses". */
function relLabel(d: Date | string) {
  const diff = dayDiff(d);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  const n = Math.abs(diff);
  let val: string;
  if (n < 7) val = `${n} días`;
  else if (n < 31) val = `${Math.round(n / 7)} sem`;
  else if (n < 365) val = `${Math.round(n / 30.4)} meses`;
  else val = `${Math.round(n / 365)} a`;
  return diff > 0 ? `en ${val}` : `hace ${val}`;
}
export function PatientDetailTabs({
  patient,
  processSummaries,
  summary,
  treatments,
  clinicalRecord,
  sessionsSlot,
  testsSlot,
  diagnosesSlot,
  checkinsSlot,
  attachmentsSlot,
  canNotify,
}: PatientDetailTabsProps) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [editing, setEditing] = useState(false);
  const activeProcesses = processSummaries.filter((p) => p.status === "ACTIVE");
  const activeProcessLabel = activeProcesses[0]
    ? processMotivoLabel(activeProcesses[0])
    : null;

  const age = ageFromBirthDate(patient.birthDate);
  const demographics =
    [age !== null ? `${age} años` : null, patient.sex, patient.maritalStatus]
      .filter(Boolean)
      .join(" · ") || "Sin datos adicionales";

  const tabs: { key: Tab; label: string }[] = [
    { key: "resumen", label: "Resumen" },
    { key: "tratamiento", label: "Tratamiento" },
    { key: "ficha", label: "Ficha clínica" },
    { key: "sesiones", label: "Sesiones" },
    { key: "tests", label: "Tests" },
    { key: "diagnostico", label: "Diagnóstico" },
    { key: "seguimiento", label: "Seguimiento" },
    { key: "adjuntos", label: "Adjuntos" },
  ];

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/pacientes">
          <ArrowLeft className="h-4 w-4" />
          Pacientes
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">{patientFullName(patient)}</h1>
          <p className="text-muted-foreground">{demographics}</p>
          {(!patient.phone || !patient.whatsappOptIn) && (
            <Badge
              variant="outline"
              className="text-muted-foreground mt-2 gap-1"
              title="Falta teléfono o consentimiento: no recibe mensajes por WhatsApp"
            >
              <MessageCircleOff className="h-3 w-3" />
              Sin WhatsApp
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <NewSessionDialog
            patientId={patient.id}
            patientName={patientFullName(patient)}
            activeProcessId={activeProcesses[0]?.id ?? null}
            activeProcessLabel={activeProcessLabel}
            canNotify={canNotify}
          />
          <Button asChild variant="outline">
            <Link href={`/tests?patient=${patient.id}`}>
              <Send className="h-4 w-4" />
              Asignar test
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => setEditing((v) => !v)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={(o) => !o && setEditing(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar paciente</DialogTitle>
          </DialogHeader>
          <PatientForm patient={patient} onSaved={() => setEditing(false)} />
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <div className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "resumen" && (
        <div className="space-y-4">
          {/* Alerta clínica accionable (solo si algún test empeoró) */}
          {summary.worsening && (
            <button
              type="button"
              onClick={() => setTab("tratamiento")}
              className="block w-full text-left"
            >
              <Card className="border-destructive/40">
                <CardContent className="flex items-center gap-2 py-3 text-sm">
                  <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
                  <span className="font-medium">Un test empeoró.</span>
                  <span className="text-muted-foreground">
                    Revisá el tratamiento
                  </span>
                  <span className="text-muted-foreground ml-auto text-xs">
                    Ver →
                  </span>
                </CardContent>
              </Card>
            </button>
          )}

          {/* Conteos del paciente (clic para ir al detalle de cada tab) */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat
              icon={CalendarClock}
              label="Sesiones"
              value={summary.sessionsTotal}
              sub={
                summary.sessionsDone < summary.sessionsTotal
                  ? `${summary.sessionsDone} hechas`
                  : undefined
              }
              onClick={() => setTab("sesiones")}
            />
            <SummaryStat
              icon={ClipboardList}
              label="Tests hechos"
              value={summary.testsDone}
              sub={
                summary.testsPending
                  ? `${summary.testsPending} pendientes`
                  : undefined
              }
              onClick={() => setTab("tests")}
            />
            <SummaryStat
              icon={MessageCircle}
              label="Seguimientos"
              value={summary.checkinsTotal}
              sub={
                summary.checkinsActive
                  ? `${summary.checkinsActive} activos`
                  : undefined
              }
              onClick={() => setTab("seguimiento")}
            />
            <SummaryStat
              icon={Stethoscope}
              label="Diagnósticos"
              value={summary.diagnosesCount}
              onClick={() => setTab("diagnostico")}
            />
          </div>

          {/* Próxima sesión */}
          {summary.nextSession && (
            <Card>
              <CardContent className="flex items-center gap-2 py-3 text-sm">
                <CalendarClock className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="text-muted-foreground">Próxima sesión</span>
                <span className="font-medium">
                  {relLabel(summary.nextSession.startsAt)}
                </span>
                <Button asChild variant="ghost" size="sm" className="ml-auto">
                  <Link href={`/sesiones/${summary.nextSession.id}`}>Abrir</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Diagnóstico principal */}
          {summary.primaryDiagnosis && (
            <Card>
              <CardContent className="space-y-0.5 py-3 text-sm">
                <p className={SECTION_LABEL}>Diagnóstico principal</p>
                <p className="flex items-center gap-2">
                  {summary.primaryDiagnosis.code && (
                    <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                      {summary.primaryDiagnosis.code}
                    </span>
                  )}
                  <span className="font-medium">
                    {summary.primaryDiagnosis.label}
                  </span>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Datos personales del paciente */}
          <Card>
            <CardContent className="space-y-3 py-4">
              <p className={SECTION_LABEL}>Datos del paciente</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                <DataItem
                  label="Edad"
                  value={age !== null ? `${age} años` : "—"}
                />
                <DataItem label="Sexo" value={patient.sex || "—"} />
                <DataItem
                  label="Estado civil"
                  value={patient.maritalStatus || "—"}
                />
                <DataItem
                  label="Nacimiento"
                  value={fmtBirth(patient.birthDate)}
                />
                <DataItem label="Email" value={patient.email || "—"} />
                <DataItem label="Teléfono" value={patient.phone || "—"} />
              </dl>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "tratamiento" && (
        <PatientTreatments patientId={patient.id} treatments={treatments} />
      )}

      {tab === "ficha" && (
        <ClinicalRecordForm patientId={patient.id} initial={clinicalRecord} />
      )}
      {tab === "sesiones" && sessionsSlot}
      {tab === "tests" && testsSlot}
      {tab === "diagnostico" && diagnosesSlot}
      {tab === "seguimiento" && checkinsSlot}
      {tab === "adjuntos" && attachmentsSlot}
    </div>
  );
}

/** Tarjeta-conteo del resumen; clic lleva al tab con el detalle. */
function SummaryStat({
  icon: Icon,
  label,
  value,
  sub,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="block h-full text-left">
      <Card className="hover:border-primary/40 h-full transition-colors">
        <CardContent className="space-y-1 py-4">
          <Icon className="text-muted-foreground h-5 w-5" />
          <p className="text-3xl font-semibold tabular-nums">{value}</p>
          <p className="text-muted-foreground text-sm">
            {label}
            {sub ? ` · ${sub}` : ""}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}

/** Formatea una fecha "YYYY-MM-DD" (input date) a "DD/MM/YYYY" sin desfase de TZ. */
function fmtBirth(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return y && m && day ? `${day}/${m}/${y}` : "—";
}
