"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Save, AlertTriangle } from "lucide-react";

import {
  createProcess,
  savePatientClinicalRecord,
  type ClinicalRecordData,
} from "@/server/actions";
import { SECTION_LABEL } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategorySelect } from "./CategorySelect";

export function NewProcessDialog({
  patientId,
  disabled,
}: {
  patientId: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [category, setCategory] = useState("");
  const [isPending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const res = await createProcess(patientId, motivo, category);
      if (res?.error) toast.error(res.error);
      else {
        setMotivo("");
        setCategory("");
        setOpen(false);
        toast.success("Tratamiento creado");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={
          disabled
            ? "El paciente ya tiene un tratamiento en curso. Dale de alta para abrir uno nuevo."
            : undefined
        }
      >
        <Plus className="h-4 w-4" />
        Nuevo tratamiento
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo tratamiento</DialogTitle>
          <DialogDescription>
            Abrí un tratamiento cuando el paciente vuelve a consulta tras el alta.
            Agrupa sus sesiones y tests. Podés completar el motivo ahora o después.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Categoría del motivo</label>
            <CategorySelect
              value={category}
              onChange={setCategory}
              className="w-full"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Detalle (opcional)</label>
            <Textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Por qué vuelve a consultar…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button onClick={add} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Crear tratamiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Bloques de la ficha clínica (anamnesis), en orden de presentación. */
const RECORD_SECTIONS: {
  key: keyof ClinicalRecordData;
  label: string;
  placeholder: string;
  rows: number;
}[] = [
  {
    key: "personalHistory",
    label: "Antecedentes personales",
    placeholder:
      "Tratamientos psicológicos/psiquiátricos previos, internaciones, enfermedades relevantes…",
    rows: 3,
  },
  {
    key: "medication",
    label: "Medicación actual y psiquiatra",
    placeholder:
      "Fármacos actuales (dosis), profesional que los indica, fecha de inicio…",
    rows: 2,
  },
  {
    key: "familyHistory",
    label: "Antecedentes familiares",
    placeholder:
      "Salud mental en la familia: depresión, adicciones, suicidio, etc.",
    rows: 2,
  },
  {
    key: "lifeHistory",
    label: "Historia personal",
    placeholder:
      "Desarrollo, familia de origen, educación/trabajo, relaciones, consumo de sustancias…",
    rows: 4,
  },
  {
    key: "strengths",
    label: "Fortalezas y red de apoyo",
    placeholder:
      "Recursos del paciente, vínculos de apoyo, intereses, factores protectores…",
    rows: 2,
  },
  {
    key: "notes",
    label: "Notas generales",
    placeholder: "Cualquier otra observación clínica que quieras dejar registrada…",
    rows: 3,
  },
];

/**
 * Ficha clínica estructurada (anamnesis) del paciente. Bloques estables y
 * transversales a los tratamientos; el motivo, el diagnóstico y la evolución
 * por sesión viven en sus propias pestañas.
 */
export function ClinicalRecordForm({
  patientId,
  initial,
}: {
  patientId: string;
  initial: ClinicalRecordData;
}) {
  const [record, setRecord] = useState<ClinicalRecordData>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const persisted = useRef(JSON.stringify(initial));

  useEffect(() => {
    const snapshot = JSON.stringify(record);
    if (snapshot === persisted.current) return;
    setState("saving");
    const t = setTimeout(async () => {
      const res = await savePatientClinicalRecord(patientId, record);
      if (res?.error) setState("error");
      else {
        persisted.current = snapshot;
        setState("saved");
      }
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  function set(key: keyof ClinicalRecordData, value: string) {
    setRecord((r) => ({ ...r, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Historia clínica del paciente: lo estable, transversal a todos los
          tratamientos.
        </p>
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          {state === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
            </>
          )}
          {state === "saved" && (
            <>
              <Save className="h-3 w-3" /> Guardado
            </>
          )}
          {state === "error" && (
            <span className="text-level-high">No se pudo guardar</span>
          )}
        </span>
      </div>

      {/* Factores de riesgo: arriba y resaltado, siempre a la vista */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Factores de riesgo
          </CardTitle>
          <CardDescription>
            Ideación suicida, autolesiones, riesgo a terceros. Dejalo vacío si no
            hay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={2}
            value={record.risk ?? ""}
            onChange={(e) => set("risk", e.target.value)}
            placeholder="Indicadores de riesgo, antecedentes de intentos, plan de seguridad…"
          />
        </CardContent>
      </Card>

      {/* Resto de la anamnesis */}
      <Card>
        <CardContent className="space-y-4 py-4">
          {RECORD_SECTIONS.map((s) => (
            <div key={s.key} className="space-y-1.5">
              <label className={SECTION_LABEL}>{s.label}</label>
              <Textarea
                rows={s.rows}
                value={record[s.key] ?? ""}
                onChange={(e) => set(s.key, e.target.value)}
                placeholder={s.placeholder}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
