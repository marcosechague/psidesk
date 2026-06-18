"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createGroup, updateGroup } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Crear (sin `group`) o editar (con `group`) un grupo de pacientes. */
export function GroupFormDialog({
  open,
  onClose,
  patientOptions,
  group,
}: {
  open: boolean;
  onClose: () => void;
  patientOptions: { id: string; fullName: string }[];
  group?: { id: string; name: string; memberIds: string[] };
}) {
  const router = useRouter();
  const editing = Boolean(group);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setName(group?.name ?? "");
      setSelected(new Set(group?.memberIds ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group?.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    startTransition(async () => {
      const input = { name, patientIds: [...selected] };
      const res = group
        ? await updateGroup(group.id, input)
        : await createGroup(input);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Grupo actualizado" : "Grupo creado");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar grupo" : "Nuevo grupo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Pareja Ana & Juan"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Pacientes{" "}
              <span className="text-muted-foreground">
                (elegí 2 o más — {selected.size} seleccionados)
              </span>
            </label>
            {patientOptions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Cargá pacientes primero.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {patientOptions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      selected.has(p.id)
                        ? "border-primary bg-secondary"
                        : "hover:bg-muted",
                    )}
                  >
                    {p.fullName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || name.trim().length < 2 || selected.size < 2}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {editing ? "Guardar" : "Crear grupo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
