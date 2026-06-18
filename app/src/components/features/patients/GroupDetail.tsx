"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Users,
  CalendarClock,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { deleteGroup } from "@/server/actions";
import { statusLabel, statusBadgeVariant } from "@/lib/sessionLabels";
import { fmtDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GroupFormDialog } from "./GroupFormDialog";

interface GroupSession {
  id: string;
  startsAt: Date | string;
  status: string;
  participantNames: string[];
}

export function GroupDetail({
  group,
  sessions,
  patientOptions,
}: {
  group: { id: string; name: string; members: { id: string; fullName: string }[] };
  sessions: GroupSession[];
  patientOptions: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const res = await deleteGroup(group.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Grupo eliminado");
      router.push("/pacientes");
    });
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/pacientes">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="bg-secondary text-secondary-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-3xl">{group.name}</h1>
            <p className="text-muted-foreground">
              {group.members.map((m) => m.fullName).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Miembros (links a cada ficha) */}
      <div className="flex flex-wrap gap-2">
        {group.members.map((m) => (
          <Button key={m.id} asChild variant="outline" size="sm">
            <Link href={`/pacientes/${m.id}`}>{m.fullName}</Link>
          </Button>
        ))}
      </div>

      {/* Historial de sesiones del grupo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sesiones del grupo</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Todavía no hay sesiones agendadas para este grupo. Agendá una desde
              el calendario eligiendo este grupo.
            </p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="border-border flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <CalendarClock className="text-muted-foreground h-4 w-4" />
                      {fmtDateTime(s.startsAt)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant={statusBadgeVariant(s.status)}>
                        {statusLabel(s.status)}
                      </Badge>
                      <span className="text-muted-foreground text-sm">
                        {s.participantNames.join(" · ")}
                      </span>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/sesiones/${s.id}`}>
                      Abrir
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <GroupFormDialog
        open={editing}
        onClose={() => setEditing(false)}
        patientOptions={patientOptions}
        group={{
          id: group.id,
          name: group.name,
          memberIds: group.members.map((m) => m.id),
        }}
      />

      <Dialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar grupo</DialogTitle>
            <DialogDescription>
              Se elimina el grupo <span className="font-medium">{group.name}</span>.
              Los pacientes y sus sesiones se mantienen; las sesiones solo dejan de
              estar asociadas al grupo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remove} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
