"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Pencil,
  Check,
  RotateCcw,
  Trash2,
  MoreVertical,
  Loader2,
} from "lucide-react";

import {
  setProcessStatus,
  deleteProcess,
  updateProcessMotivo,
} from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategorySelect } from "./CategorySelect";

/** Acciones del encabezado del detalle de un proceso: editar motivo, alta/reabrir, eliminar. */
export function ProcessManager({
  patientId,
  processId,
  status,
  motivo,
  motivoCategory,
}: {
  patientId: string;
  processId: string;
  status: string;
  motivo: string | null;
  motivoCategory: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(motivo ?? "");
  const [category, setCategory] = useState(motivoCategory ?? "");
  const [isPending, startTransition] = useTransition();
  const isActive = status === "ACTIVE";

  function saveMotivo() {
    startTransition(async () => {
      const res = await updateProcessMotivo(processId, detail, category);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success("Motivo actualizado");
    });
  }
  function toggle() {
    startTransition(async () => {
      const res = await setProcessStatus(processId, isActive);
      if (res?.error) toast.error(res.error);
      else
        toast.success(isActive ? "Tratamiento finalizado" : "Tratamiento reabierto");
    });
  }
  function remove() {
    startTransition(async () => {
      const res = await deleteProcess(processId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Tratamiento eliminado");
      router.push(`/pacientes/${patientId}`);
    });
  }

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Más acciones">
                <MoreVertical className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={toggle} disabled={isPending}>
              {isActive ? (
                <>
                  <Check className="h-4 w-4" />
                  Dar de alta
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  Reabrir tratamiento
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={remove}
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar tratamiento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar motivo de consulta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Categoría</label>
              <CategorySelect
                value={category}
                onChange={setCategory}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Detalle</label>
              <Textarea
                rows={2}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Motivo de consulta…"
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
            <Button onClick={saveMotivo} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
