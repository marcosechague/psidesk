"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  User,
  Users,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  MessageCircleOff,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GroupFormDialog } from "./GroupFormDialog";

export interface PatientRow {
  id: string;
  fullName: string;
  age: number | null;
  sex: string | null;
  lastSessionAt: Date | string | null;
  sessions: number;
  worsening: boolean;
  inactive: boolean;
  noWhatsapp: boolean;
  active: boolean;
}
export interface GroupRow {
  id: string;
  name: string;
  memberNames: string[];
  lastSessionAt: Date | string | null;
  sessions: number;
}

type DisplayRow =
  | ({ kind: "patient" } & PatientRow)
  | ({ kind: "group" } & GroupRow);

type Owner = "todos" | "individuales" | "grupos";

function lastLabel(d: Date | string | null): string {
  if (!d) return "—";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  if (days < 365) return `hace ${Math.round(days / 30.4)} meses`;
  return fmtDate(d);
}

/** Badges de estado/alertas de un paciente (vacío para grupos). */
function PatientStatus({ p }: { p: PatientRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {p.worsening && (
        <Badge variant="outline" className="text-level-high border-level-high/30 gap-1">
          <AlertTriangle className="h-3 w-3" />
          Empeoró
        </Badge>
      )}
      {!p.worsening && p.inactive && (
        <Badge variant="outline" className="text-muted-foreground">
          Sin actividad
        </Badge>
      )}
      {p.noWhatsapp && (
        <Badge variant="outline" className="text-muted-foreground gap-1">
          <MessageCircleOff className="h-3 w-3" />
          Sin WhatsApp
        </Badge>
      )}
      {!p.active && (
        <Badge variant="outline" className="text-muted-foreground">
          Finalizado
        </Badge>
      )}
    </div>
  );
}

export function PatientsTable({
  patients,
  groups,
  patientOptions,
}: {
  patients: PatientRow[];
  groups: GroupRow[];
  patientOptions: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const [owner, setOwner] = useState<Owner>("todos");
  const [q, setQ] = useState("");
  const [newGroup, setNewGroup] = useState(false);

  const rows: DisplayRow[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out: DisplayRow[] = [];
    if (owner !== "grupos") {
      for (const p of patients) out.push({ kind: "patient", ...p });
    }
    if (owner !== "individuales") {
      for (const g of groups) out.push({ kind: "group", ...g });
    }
    if (!term) return out;
    return out.filter((r) =>
      r.kind === "patient"
        ? r.fullName.toLowerCase().includes(term)
        : r.name.toLowerCase().includes(term) ||
          r.memberNames.some((n) => n.toLowerCase().includes(term)),
    );
  }, [patients, groups, owner, q]);

  const owners: { key: Owner; label: string }[] = [
    { key: "todos", label: `Todos (${patients.length + groups.length})` },
    { key: "individuales", label: `Individuales (${patients.length})` },
    { key: "grupos", label: `Grupos (${groups.length})` },
  ];

  function hrefOf(r: DisplayRow) {
    return r.kind === "patient"
      ? `/pacientes/${r.id}`
      : `/pacientes/grupos/${r.id}`;
  }

  return (
    <div className="space-y-4">
      {/* Buscador + Nuevo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar paciente o grupo…"
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button>
                <Plus className="h-4 w-4" />
                Nuevo
                <ChevronDown className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem render={<Link href="/pacientes/nuevo" />}>
              <User className="h-4 w-4" />
              Nuevo paciente
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setNewGroup(true)}>
              <Users className="h-4 w-4" />
              Nuevo grupo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filtro por tipo */}
      <div className="bg-muted inline-flex gap-1 rounded-lg p-1">
        {owners.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => setOwner(o.key)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              owner === o.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          {q ? `Nada coincide con “${q}”.` : "Sin registros."}
        </p>
      ) : (
        <>
          {/* Desktop: tabla */}
          <Card className="hidden overflow-hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Última sesión</TableHead>
                  <TableHead className="text-right">Sesiones</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={`${r.kind}-${r.id}`}
                    className="cursor-pointer"
                    onClick={() => router.push(hrefOf(r))}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="bg-secondary text-secondary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                          {r.kind === "group" ? (
                            <Users className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {r.kind === "patient" ? r.fullName : r.name}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">
                            {r.kind === "patient"
                              ? [r.age ? `${r.age} años` : null, r.sex]
                                  .filter(Boolean)
                                  .join(" · ") || "—"
                              : r.memberNames.join(" · ")}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {r.kind === "group" ? "Grupo" : "Individual"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {lastLabel(r.lastSessionAt)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.sessions}
                    </TableCell>
                    <TableCell>
                      {r.kind === "patient" ? (
                        <PatientStatus p={r} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile: tarjetas */}
          <div className="grid gap-3 sm:hidden">
            {rows.map((r) => (
              <Link key={`${r.kind}-${r.id}`} href={hrefOf(r)} className="block">
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="flex items-center gap-3 py-4">
                    <span className="bg-secondary text-secondary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                      {r.kind === "group" ? (
                        <Users className="h-5 w-5" />
                      ) : (
                        <User className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {r.kind === "patient" ? r.fullName : r.name}
                      </p>
                      <p className="text-muted-foreground truncate text-sm">
                        {r.kind === "patient"
                          ? [r.age ? `${r.age} años` : null, r.sex]
                              .filter(Boolean)
                              .join(" · ") || "—"
                          : r.memberNames.join(" · ")}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">
                          {r.kind === "group" ? "Grupo" : "Individual"}
                        </Badge>
                        {r.kind === "patient" && <PatientStatus p={r} />}
                      </div>
                    </div>
                    <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      <GroupFormDialog
        open={newGroup}
        onClose={() => setNewGroup(false)}
        patientOptions={patientOptions}
      />
    </div>
  );
}
