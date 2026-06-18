"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X, Loader2, ChevronLeft, FilePlus2 } from "lucide-react";

import {
  createExternalTest,
  saveManualResult,
  updateManualResult,
} from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface CatalogTest {
  id: string;
  name: string;
  scored: boolean;
  isSystem: boolean;
}
export interface ManualResultEdit {
  resultId: string;
  testName: string;
  takenAt: Date | string;
  findings: { label: string; value: string }[];
  notes: string | null;
}

type Finding = { label: string; value: string };

function todayInput(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function dateInput(d: Date | string): string {
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

/** Botón + diálogo para CARGAR un resultado a mano: primero elegís (o creás) el
 *  test, después cargás los hallazgos. */
export function TestResultLoader({
  patientId,
  catalog,
}: {
  patientId: string;
  catalog: CatalogTest[];
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(
    null,
  );

  function close() {
    setOpen(false);
    setPicked(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close();
        else setOpen(true);
      }}
    >
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FilePlus2 className="h-4 w-4" />
        Cargar resultado
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {picked ? picked.name : "Cargar resultado"}
          </DialogTitle>
        </DialogHeader>

        {!picked ? (
          <TestPicker catalog={catalog} onPick={setPicked} />
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setPicked(null)}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            >
              <ChevronLeft className="h-4 w-4" />
              Cambiar de test
            </button>
            <FindingsForm
              onSubmit={(data) =>
                saveManualResult({ patientId, testId: picked.id, ...data })
              }
              onDone={close}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Paso 1: elegir un test del catálogo o crear uno externo con lo escrito. */
function TestPicker({
  catalog,
  onPick,
}: {
  catalog: CatalogTest[];
  onPick: (t: { id: string; name: string }) => void;
}) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const q = query.trim();

  const results = useMemo(() => {
    const needle = q.toLowerCase();
    return catalog
      .filter((t) => !needle || t.name.toLowerCase().includes(needle))
      .slice(0, 50);
  }, [catalog, q]);
  const exact = catalog.some((t) => t.name.toLowerCase() === q.toLowerCase());

  function createAndPick() {
    startTransition(async () => {
      const res = await createExternalTest({ name: q });
      if (res.error || !res.id) {
        toast.error(res.error ?? "No se pudo crear el test");
        return;
      }
      toast.success("Test creado");
      onPick({ id: res.id, name: res.name ?? q });
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Elegí el test (o creá uno nuevo)</Label>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar test… (PHQ-9, DASS-42, IPDE)"
          autoFocus
        />
      </div>
      <ul className="border-border max-h-72 divide-y overflow-y-auto rounded-lg border">
        {q.length >= 2 && !exact && (
          <li>
            <button
              type="button"
              onClick={createAndPick}
              disabled={isPending}
              className="hover:bg-muted flex w-full items-center gap-2 px-3 py-2.5 text-left"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Plus className="text-muted-foreground h-4 w-4 shrink-0" />
              )}
              <span className="text-sm">
                Crear test <span className="font-medium">«{q}»</span>{" "}
                <span className="text-muted-foreground">(externo, de papel)</span>
              </span>
            </button>
          </li>
        )}
        {results.length === 0 && (q.length < 2 || exact) ? (
          <li className="text-muted-foreground px-3 py-2 text-sm">
            Sin coincidencias.
          </li>
        ) : (
          results.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onPick({ id: t.id, name: t.name })}
                className="hover:bg-muted flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="text-sm font-medium">{t.name}</span>
                {!t.scored ? (
                  <Badge variant="outline">externo</Badge>
                ) : t.isSystem ? (
                  <Badge variant="secondary">sistema</Badge>
                ) : (
                  <Badge variant="secondary">propio</Badge>
                )}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/** Diálogo controlado para EDITAR un resultado a mano ya cargado. */
export function ManualResultEditDialog({
  edit,
  open,
  onOpenChange,
}: {
  edit: ManualResultEdit;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">{edit.testName}</DialogTitle>
        </DialogHeader>
        <FindingsForm
          initial={{
            takenAt: dateInput(edit.takenAt),
            findings: edit.findings.length
              ? edit.findings
              : [{ label: "", value: "" }],
            notes: edit.notes ?? "",
          }}
          onSubmit={(data) =>
            updateManualResult({ resultId: edit.resultId, ...data })
          }
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Formulario de hallazgos (fecha + filas escala→valor + notas). Reusado por
 *  carga y edición. */
function FindingsForm({
  initial,
  onSubmit,
  onDone,
}: {
  initial?: { takenAt: string; findings: Finding[]; notes: string };
  onSubmit: (data: {
    takenAt: string;
    findings: Finding[];
    notes: string;
  }) => Promise<{ error?: string }>;
  onDone: () => void;
}) {
  const [takenAt, setTakenAt] = useState(initial?.takenAt ?? todayInput());
  const [findings, setFindings] = useState<Finding[]>(
    initial?.findings ?? [{ label: "", value: "" }],
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isPending, startTransition] = useTransition();

  function setRow(i: number, key: keyof Finding, v: string) {
    setFindings((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)),
    );
  }
  const canSave =
    takenAt.length > 0 &&
    findings.some((f) => f.label.trim() && f.value.trim());

  function save() {
    const clean = findings.filter((f) => f.label.trim() && f.value.trim());
    startTransition(async () => {
      const res = await onSubmit({ takenAt, findings: clean, notes });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Resultado guardado");
      onDone();
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Fecha de la toma</Label>
        <Input
          type="date"
          value={takenAt}
          onChange={(e) => setTakenAt(e.target.value)}
          className="w-44"
        />
      </div>

      <div className="space-y-2">
        <Label>Hallazgos</Label>
        <p className="text-muted-foreground text-sm">
          Una fila por escala/dimensión. Ej: «Ansiedad» → «Leve».
        </p>
        {findings.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={f.label}
              onChange={(e) => setRow(i, "label", e.target.value)}
              placeholder="Escala (ej. Ansiedad)"
              className="flex-1"
            />
            <Input
              value={f.value}
              onChange={(e) => setRow(i, "value", e.target.value)}
              placeholder="Resultado (ej. Leve)"
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() =>
                setFindings((rows) =>
                  rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows,
                )
              }
              disabled={findings.length === 1}
              aria-label="Quitar fila"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setFindings((rows) => [...rows, { label: "", value: "" }])}
        >
          <Plus className="h-4 w-4" />
          Agregar fila
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Notas (opcional)</Label>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Interpretación, observaciones…"
          className="text-base leading-relaxed"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone} disabled={isPending}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={isPending || !canSave}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}
