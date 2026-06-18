"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createAssignment } from "@/server/actions";
import { REMINDER_DAYS_OPTIONS } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShareLink } from "./ShareLink";

type Patient = { id: string; fullName: string; phone?: string | null };

function offsetLabel(d: number): string {
  if (d === 0) return "El día";
  return `${d} ${d === 1 ? "día" : "días"} antes`;
}

/** Popup para asignar un test (fijo) a un paciente, con deadline y aviso. */
export function AssignDialog({
  open,
  onClose,
  test,
  patients,
  defaultPatientId,
}: {
  open: boolean;
  onClose: () => void;
  test: { id: string; name: string } | null;
  patients: Patient[];
  defaultPatientId?: string;
}) {
  const router = useRouter();
  const [patientId, setPatientId] = useState(defaultPatientId ?? "");
  const [dueDate, setDueDate] = useState("");
  const [reminderOffsets, setReminderOffsets] = useState<Set<number>>(
    () => new Set([1]),
  );
  const [notify, setNotify] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Al abrir, resetear el form (preseleccionando el paciente si vino por contexto).
  useEffect(() => {
    if (open) {
      setPatientId(defaultPatientId ?? "");
      setDueDate("");
      setReminderOffsets(new Set([1]));
      setNotify(true);
      setToken(null);
      setError(null);
    }
  }, [open, defaultPatientId]);

  function toggleOffset(d: number) {
    setReminderOffsets((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  function submit() {
    if (!test) return;
    if (!patientId) return setError("Elegí un paciente");
    setError(null);
    startTransition(async () => {
      const res = await createAssignment({
        patientId,
        testId: test.id,
        dueDate: dueDate || undefined,
        reminderOffsetsDays: dueDate ? [...reminderOffsets] : undefined,
        notifyOnAssign: notify,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.token) setToken(res.token);
      router.refresh();
    });
  }

  const patient = patients.find((p) => p.id === patientId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {token ? "Test asignado" : `Asignar: ${test?.name ?? ""}`}
          </DialogTitle>
        </DialogHeader>

        {token ? (
          <div className="space-y-4">
            <p className="text-primary flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-5 w-5" />
              Listo. Compartí el link con {patient?.fullName ?? "el paciente"}.
            </p>
            <ShareLink
              token={token}
              patientName={patient?.fullName}
              testName={test?.name}
              patientPhone={patient?.phone}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Paciente</Label>
              <Select value={patientId} onValueChange={(v) => setPatientId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Elegí un paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Fecha tope (opcional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {dueDate && (
              <div className="space-y-1.5">
                <Label>Recordatorios</Label>
                <div className="flex flex-wrap gap-1.5">
                  {REMINDER_DAYS_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleOffset(d)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        reminderOffsets.has(d)
                          ? "border-primary bg-secondary"
                          : "hover:bg-muted",
                      )}
                    >
                      {offsetLabel(d)}
                    </button>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Recordatorio por WhatsApp para completar el test. Podés elegir
                  varios; ninguno = sin recordatorios.
                </p>
              </div>
            )}

            <label className="flex cursor-pointer items-start justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  Avisar al paciente al asignar
                </span>
                <span className="text-muted-foreground block text-xs">
                  Le llega el link del test por WhatsApp.
                </span>
              </span>
              <Switch checked={notify} onCheckedChange={setNotify} />
            </label>

            {error && (
              <p className="text-destructive flex items-center gap-1.5 text-sm">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button onClick={submit} disabled={isPending || !patientId}>
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Asignar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
