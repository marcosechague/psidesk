"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pause,
  Play,
  Square,
  Send,
  MessageCircle,
} from "lucide-react";

import {
  setCheckinPlanStatus,
  deleteCheckinPlan,
  sendCheckinNow,
  simulateCheckinReply,
} from "@/server/actions";
import { describeValue } from "@/lib/checkins";
import { fmtDayMonth } from "@/lib/format";
import {
  checkinStatusLabel,
  checkinStatusBadgeVariant,
} from "@/lib/sessionLabels";
import { WEEKDAY_OPTIONS } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection } from "@/components/ui/list-row";
import { RowActions } from "@/components/ui/row-actions";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type ProcessHeaderData } from "@/components/features/patients/TreatmentTag";
import { CheckinPlanForm } from "./CheckinPlanForm";
import { CheckinChart } from "@/components/features/charts/CheckinChart";

type QType = "SCALE_1_10" | "YES_NO" | "CHOICE";

export interface CheckinEntryData {
  id: string;
  scheduledFor: Date | string;
  status: string;
  responseText: string | null;
  responseValue: number | null;
  respondedAt: Date | string | null;
}
export interface CheckinPlanData {
  id: string;
  question: string;
  questionType: QType;
  optionsJson: unknown;
  frequency: "DAILY" | "EVERY_N_DAYS" | "WEEKDAYS";
  everyNDays: number | null;
  weekdaysJson: unknown;
  timeOfDay: string;
  startDate: Date | string;
  endDate: Date | string;
  status: string;
  entries: CheckinEntryData[];
}
export interface CheckinProcessGroup extends ProcessHeaderData {
  plans: CheckinPlanData[];
}
interface PatientCheckinsProps {
  patientId: string;
  phone: string | null;
  whatsappOptIn: boolean;
  groups: CheckinProcessGroup[];
}

const TYPE_LABEL: Record<QType, string> = {
  SCALE_1_10: "Escala 1–10",
  YES_NO: "Sí / No",
  CHOICE: "Opción múltiple",
};

function freqLabel(p: CheckinPlanData): string {
  if (p.frequency === "DAILY") return "Todos los días";
  if (p.frequency === "EVERY_N_DAYS") return `Cada ${p.everyNDays ?? "?"} días`;
  const days = (p.weekdaysJson as number[] | null) ?? [];
  return WEEKDAY_OPTIONS.filter((w) => days.includes(w.value))
    .map((w) => w.label)
    .join(", ");
}

export function PatientCheckins({
  patientId,
  phone,
  whatsappOptIn,
  groups,
}: PatientCheckinsProps) {
  const canSend = Boolean(phone) && whatsappOptIn;

  // Lista plana: cada seguimiento lleva el tag de su tratamiento en vez de ir
  // agrupado en una tarjeta por proceso (más claro de leer).
  const flatPlans = groups.flatMap((g) => g.plans.map((plan) => ({ plan, g })));

  return (
    <div className="space-y-4">
      {/* El contacto (teléfono + consentimiento) vive en los datos del paciente
          (botón Editar). Acá solo gestionamos los seguimientos. */}
      {!canSend && (
        <Card>
          <CardContent className="py-4">
            <p className="text-muted-foreground text-sm">
              Este paciente todavía no recibe mensajes por WhatsApp. Cargá el
              teléfono y el consentimiento desde <strong>Editar</strong> (datos
              del paciente).
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <NewCheckinDialog patientId={patientId} />
      </div>

      {flatPlans.length === 0 ? (
        <EmptyState>Sin seguimientos todavía.</EmptyState>
      ) : (
        <ListSection>
          {flatPlans.map(({ plan, g }) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              process={g}
              patientId={patientId}
              canSend={canSend}
            />
          ))}
        </ListSection>
      )}
    </div>
  );
}

/** Botón "Nuevo seguimiento" que abre un modal con el formulario. */
function NewCheckinDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Nuevo seguimiento
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo seguimiento</DialogTitle>
        </DialogHeader>
        <CheckinPlanForm patientId={patientId} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function PlanCard({
  plan,
  process,
  patientId,
  canSend,
}: {
  plan: CheckinPlanData;
  process: ProcessHeaderData | undefined;
  patientId: string;
  canSend: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const options = (plan.optionsJson as string[] | null) ?? [];
  // Solo tomas pasadas/de hoy en el historial (las futuras están pre-generadas).
  const pastEntries = plan.entries.filter(
    (e) => new Date(e.scheduledFor).getTime() <= Date.now(),
  );

  function act(fn: () => Promise<{ error?: string }>, okMsg?: string) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else if (okMsg) toast.success(okMsg);
    });
  }

  const respondedCount = plan.entries.filter(
    (e) => e.status === "RESPONDED",
  ).length;
  // Detalle expandible: gráfico (2+ respuestas) y/o historial de tomas.
  const hasDetail = respondedCount >= 2 || pastEntries.length > 0;

  return (
    <ListRow
      icon={MessageCircle}
      title={plan.question}
      collapsible={hasDetail}
      expanded={open}
      onToggle={() => setOpen((v) => !v)}
      ariaLabel={plan.question}
      meta={
        <>
          <Badge variant="outline">{freqLabel(plan)}</Badge>
          <Badge variant={checkinStatusBadgeVariant(plan.status)}>
            {checkinStatusLabel(plan.status)}
          </Badge>
          <span className="text-muted-foreground text-sm">
            {fmtDayMonth(plan.startDate)} → {fmtDayMonth(plan.endDate)} ·{" "}
            {plan.timeOfDay}
          </span>
        </>
      }
      actions={
        <RowActions>
          {canSend && plan.status === "ACTIVE" && (
            <DropdownMenuItem
              onClick={() => act(() => sendCheckinNow(plan.id), "Check-in enviado")}
              disabled={isPending}
            >
              <Send className="h-4 w-4" />
              Enviar ahora
            </DropdownMenuItem>
          )}
          {plan.status === "ACTIVE" && (
            <DropdownMenuItem
              onClick={() => act(() => setCheckinPlanStatus(plan.id, "PAUSED"), "Pausado")}
              disabled={isPending}
            >
              <Pause className="h-4 w-4" />
              Pausar
            </DropdownMenuItem>
          )}
          {plan.status === "PAUSED" && (
            <DropdownMenuItem
              onClick={() => act(() => setCheckinPlanStatus(plan.id, "ACTIVE"), "Reanudado")}
              disabled={isPending}
            >
              <Play className="h-4 w-4" />
              Reanudar
            </DropdownMenuItem>
          )}
          {plan.status !== "ENDED" && (
            <DropdownMenuItem
              onClick={() => act(() => setCheckinPlanStatus(plan.id, "ENDED"), "Terminado")}
              disabled={isPending}
            >
              <Square className="h-4 w-4" />
              Terminar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => act(() => deleteCheckinPlan(plan.id), "Eliminado")}
            disabled={isPending}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </RowActions>
      }
    >
      {hasDetail ? (
        <div className="space-y-3 px-4 py-3">
          {/* Gráfico de evolución (aparece con 2+ respuestas) */}
          <CheckinChart
            questionType={plan.questionType}
            options={options}
            entries={plan.entries}
          />

          {/* Tomas y respuestas (historial: pasadas / de hoy) */}
          {pastEntries.length > 0 && (
            <ul className="divide-border border-border divide-y rounded-md border">
              {pastEntries.slice(0, 8).map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  questionType={plan.questionType}
                  options={options}
                />
              ))}
            </ul>
          )}
        </div>
      ) : undefined}
    </ListRow>
  );
}

function EntryRow({
  entry,
  questionType,
  options,
}: {
  entry: CheckinEntryData;
  questionType: QType;
  options: string[];
}) {
  const [raw, setRaw] = useState("");
  const [isPending, startTransition] = useTransition();
  const responded = entry.status === "RESPONDED";

  function simulate() {
    if (!raw.trim()) return;
    startTransition(async () => {
      const res = await simulateCheckinReply(entry.id, raw);
      if (res?.error) toast.error(res.error);
      else toast.success("Respuesta registrada");
    });
  }

  return (
    <li className="flex items-center justify-between gap-3 p-2.5 text-sm">
      <span className="text-muted-foreground">
        {fmtDayMonth(entry.scheduledFor)}
      </span>
      {responded ? (
        <span className="flex items-center gap-2 font-medium">
          <MessageCircle className="text-primary h-4 w-4" />
          {describeValue(questionType, entry.responseValue, options)}
        </span>
      ) : entry.status === "SENT" ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={raw}
            placeholder="Simular respuesta…"
            className="h-8 w-40"
            onChange={(e) => setRaw(e.target.value)}
          />
          <Button size="sm" onClick={simulate} disabled={isPending}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Badge variant="outline">{entry.status}</Badge>
      )}
    </li>
  );
}
