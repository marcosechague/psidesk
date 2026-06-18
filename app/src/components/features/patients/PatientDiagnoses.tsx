"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Star, Trash2, Loader2 } from "lucide-react";

import {
  createDiagnosis,
  deleteDiagnosis,
  togglePrimaryDiagnosis,
} from "@/server/actions";
import { searchDiagnoses } from "@/lib/diagnoses";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow, ListSection } from "@/components/ui/list-row";
import { RowActions } from "@/components/ui/row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface DiagnosisData {
  id: string;
  code: string;
  label: string;
  isPrimary: boolean;
}

export function PatientDiagnoses({
  patientId,
  diagnoses,
}: {
  patientId: string;
  diagnoses: DiagnosisData[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteDiagnosis(id);
      setBusyId(null);
      if (res?.error) toast.error(res.error);
      else toast.success("Diagnóstico eliminado");
    });
  }

  function togglePrimary(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await togglePrimaryDiagnosis(id);
      setBusyId(null);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Diagnósticos del paciente. La estrella marca el principal.
        </p>
        <AddDiagnosisDialog patientId={patientId} hasAny={diagnoses.length > 0} />
      </div>

      {diagnoses.length === 0 ? (
        <EmptyState>Sin diagnósticos cargados.</EmptyState>
      ) : (
        <ListSection>
          {diagnoses.map((d) => (
            <ListRow
              key={d.id}
              className={d.isPrimary ? "border-primary/40 bg-primary/5" : undefined}
              title={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => togglePrimary(d.id)}
                    disabled={isPending && busyId === d.id}
                    aria-label={
                      d.isPrimary ? "Quitar como principal" : "Marcar como principal"
                    }
                    title={d.isPrimary ? "Principal" : "Marcar como principal"}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Star
                      className={cn(
                        "h-5 w-5",
                        d.isPrimary && "fill-primary text-primary",
                      )}
                    />
                  </button>
                  {d.code && (
                    <span className="bg-muted text-foreground shrink-0 rounded px-2 py-0.5 font-mono text-sm">
                      {d.code}
                    </span>
                  )}
                  <span className="min-w-0 truncate">{d.label}</span>
                  {d.isPrimary && (
                    <span className="text-primary shrink-0 text-xs font-semibold uppercase">
                      Principal
                    </span>
                  )}
                </div>
              }
              actions={
                <RowActions>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => remove(d.id)}
                    disabled={isPending && busyId === d.id}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </DropdownMenuItem>
                </RowActions>
              }
            />
          ))}
        </ListSection>
      )}
    </div>
  );
}

function AddDiagnosisDialog({
  patientId,
  hasAny,
}: {
  patientId: string;
  hasAny: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Catálogo filtrado (query vacío = se ven todas las opciones de una).
  const results = useMemo(() => searchDiagnoses(query), [query]);
  const q = query.trim();
  // ¿El texto coincide con algún código del catálogo? Si no, ofrecemos cargarlo
  // como diagnóstico libre (solo texto, sin código).
  const exactCode = results.some((d) => d.code.toLowerCase() === q.toLowerCase());

  function add(code: string, label: string) {
    startTransition(async () => {
      // El primer diagnóstico del paciente queda como principal.
      const res = await createDiagnosis({
        patientId,
        code,
        label,
        isPrimary: !hasAny,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Diagnóstico agregado");
      setQuery("");
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setQuery("");
      }}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Agregar
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Agregar diagnóstico</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Elegí de la lista o escribí uno libre</Label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ansiedad, depresión, F41…"
              autoFocus
            />
          </div>

          <ul className="border-border max-h-72 divide-y overflow-y-auto rounded-lg border">
            {/* Diagnóstico libre: usa el texto tal cual, sin código CIE-10 */}
            {q.length >= 3 && !exactCode && (
              <li>
                <button
                  type="button"
                  onClick={() => add("", q)}
                  disabled={isPending}
                  className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  <Plus className="text-muted-foreground h-4 w-4 shrink-0" />
                  <span className="text-sm">
                    Usar <span className="font-medium">«{q}»</span>{" "}
                    <span className="text-muted-foreground">(libre, sin código)</span>
                  </span>
                </button>
              </li>
            )}
            {results.length === 0 && q.length < 3 ? (
              <li className="text-muted-foreground px-3 py-2 text-sm">
                Escribí al menos 3 letras para cargar uno libre.
              </li>
            ) : (
              results.map((d) => (
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
              ))
            )}
          </ul>
          {isPending && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Agregando…
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
