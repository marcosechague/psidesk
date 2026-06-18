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
import { AdminCreateUserForm } from "./AdminCreateUserForm";

/**
 * Botón "Nuevo psicólogo" + modal con el formulario de alta. Reemplaza la
 * navegación a /admin/nuevo para que el alta sea un popup.
 */
export function NewPsychologistDialog({
  variant = "default",
}: {
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Nuevo psicólogo
      </Button>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nuevo psicólogo</DialogTitle>
          <DialogDescription>
            Creá la cuenta de un profesional y definí su contraseña inicial.
          </DialogDescription>
        </DialogHeader>
        <AdminCreateUserForm onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
