"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SessionForm } from "./SessionForm";

/**
 * Botón "Nueva sesión" + modal, para un paciente (se asocia a su proceso en
 * curso). Se usa en el header de la ficha del paciente.
 */
export function NewSessionDialog({
  patientId,
  patientName,
  activeProcessId,
  activeProcessLabel,
  canNotify,
}: {
  patientId: string;
  patientName: string;
  activeProcessId: string | null;
  activeProcessLabel: string | null;
  canNotify?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" className="shrink-0" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nueva sesión
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva sesión</DialogTitle>
          {activeProcessLabel && (
            <DialogDescription>
              Se suma al tratamiento en curso: {activeProcessLabel}
            </DialogDescription>
          )}
        </DialogHeader>
        <SessionForm
          patients={[
            {
              id: patientId,
              fullName: patientName,
              activeProcess: activeProcessId
                ? { id: activeProcessId, label: activeProcessLabel }
                : null,
            },
          ]}
          lockedPatientId={patientId}
          canNotify={canNotify}
          onSaved={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
