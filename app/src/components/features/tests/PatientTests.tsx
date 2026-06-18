"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpRight,
  MessageCircle,
  Copy,
  Pencil,
  Trash2,
  ClipboardList,
  Clock,
} from "lucide-react";

import { deleteManualResult } from "@/server/actions";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { TONE_BADGE, type LevelTone } from "@/lib/levels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection } from "@/components/ui/list-row";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/ui/row-actions";
import {
  TestResultLoader,
  ManualResultEditDialog,
  type CatalogTest,
  type ManualResultEdit,
} from "./TestResultLoader";

export interface TestHistoryRow {
  assignmentId: string;
  token: string;
  testName: string;
  status: string; // PENDING | COMPLETED
  manual: boolean;
  edited: boolean;
  when: Date | string;
  level: { label: string; tone: LevelTone } | null;
  findings: { label: string; value: string }[];
  notes: string | null;
  resultId: string | null;
}

export function PatientTests({
  patientId,
  patientName,
  patientPhone,
  history,
  catalog,
}: {
  patientId: string;
  patientName: string;
  patientPhone: string | null;
  history: TestHistoryRow[];
  catalog: CatalogTest[];
}) {
  const [editing, setEditing] = useState<ManualResultEdit | null>(null);

  const pending = history.filter((h) => h.status === "PENDING");
  const done = history.filter((h) => h.status !== "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Historial de tests del paciente.
        </p>
        <TestResultLoader patientId={patientId} catalog={catalog} />
      </div>

      {history.length === 0 ? (
        <EmptyState>
          Sin tests todavía. Asigná uno o cargá un resultado.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <ListSection title="Pendientes de responder">
              {pending.map((h) => (
                <TestRow
                  key={h.assignmentId}
                  h={h}
                  patientName={patientName}
                  patientPhone={patientPhone}
                  onEdit={setEditing}
                />
              ))}
            </ListSection>
          )}

          {done.length > 0 && (
            <ListSection title={pending.length > 0 ? "Historial" : undefined}>
              {done.map((h) => (
                <TestRow
                  key={h.assignmentId}
                  h={h}
                  patientName={patientName}
                  patientPhone={patientPhone}
                  onEdit={setEditing}
                />
              ))}
            </ListSection>
          )}
        </div>
      )}

      {editing && (
        <ManualResultEditDialog
          edit={editing}
          open={Boolean(editing)}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
  );
}

function TestRow({
  h,
  patientName,
  patientPhone,
  onEdit,
}: {
  h: TestHistoryRow;
  patientName: string;
  patientPhone: string | null;
  onEdit: (e: ManualResultEdit) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function publicUrl() {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/r/${h.token}`;
  }
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(publicUrl());
      toast.success("Link copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }
  function shareWhatsApp() {
    const digits = (patientPhone ?? "").replace(/\D/g, "");
    if (!digits) {
      toast.error("Cargá el teléfono del paciente para compartir por WhatsApp.");
      return;
    }
    const text = `Hola ${patientName}, te comparto el link para responder ${h.testName}: ${publicUrl()}`;
    window.open(
      `https://wa.me/${digits}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }
  function remove() {
    if (!h.resultId) return;
    startTransition(async () => {
      const res = await deleteManualResult(h.resultId!);
      if (res?.error) toast.error(res.error);
      else toast.success("Resultado eliminado");
    });
  }

  // Badge de estado/resultado a la izquierda.
  const badge = h.manual ? (
    <Badge variant="secondary">a mano</Badge>
  ) : h.level ? (
    <Badge variant="outline" className={cn(TONE_BADGE[h.level.tone])}>
      {h.level.label}
    </Badge>
  ) : (
    <Badge variant="outline">Pendiente</Badge>
  );

  const Icon =
    h.manual ? ClipboardList : h.status === "PENDING" ? Clock : undefined;

  return (
    <ListRow
      icon={Icon}
      title={h.testName}
      meta={
        <>
          {badge}
          {h.edited && <Badge variant="outline">editado</Badge>}
          <span className="text-muted-foreground text-sm tabular-nums">
            {fmtDate(h.when)}
          </span>
        </>
      }
      actions={
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/resultados/${h.assignmentId}`}>
              Abrir
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <RowMenu
            h={h}
            isBusy={isPending}
            onCopy={copyUrl}
            onShare={shareWhatsApp}
            onEdit={onEdit}
            onDelete={remove}
          />
        </>
      }
    />
  );
}

/** Kebab con las acciones según el tipo de fila. */
function RowMenu({
  h,
  isBusy,
  onCopy,
  onShare,
  onEdit,
  onDelete,
}: {
  h: TestHistoryRow;
  isBusy: boolean;
  onCopy: () => void;
  onShare: () => void;
  onEdit: (e: ManualResultEdit) => void;
  onDelete: () => void;
}) {
  // Pendiente (link respondible): compartir / copiar. A mano: editar / borrar.
  const shareable = h.status === "PENDING" && !h.manual;
  if (!shareable && !h.manual) return null;

  return (
    <RowActions>
      {shareable && (
        <>
          <DropdownMenuItem onClick={onShare}>
            <MessageCircle className="h-4 w-4" />
            Compartir por WhatsApp
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopy}>
            <Copy className="h-4 w-4" />
            Copiar URL
          </DropdownMenuItem>
        </>
      )}
      {h.manual && (
        <>
          <DropdownMenuItem
            onClick={() =>
              onEdit({
                resultId: h.resultId!,
                testName: h.testName,
                takenAt: h.when,
                findings: h.findings,
                notes: h.notes,
              })
            }
          >
            <Pencil className="h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={onDelete}
            disabled={isBusy}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </DropdownMenuItem>
        </>
      )}
    </RowActions>
  );
}
