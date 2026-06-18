"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Stethoscope } from "lucide-react";

import { processMotivoLabel } from "@/lib/validations";
import { fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface TreatmentRow {
  id: string;
  patientId: string;
  patientName: string;
  motivo: string | null;
  motivoCategory: string | null;
  startedAt: Date | string;
  sessions: number;
  tests: number;
  lastSessionAt: Date | string | null;
  nextSessionAt: Date | string | null;
  worsening: boolean;
}

/** Listado global de tratamientos activos (caseload): tabla en desktop, tarjetas
 *  en mobile — mismo patrón que Pacientes y Sesiones. */
export function TreatmentsTable({ rows }: { rows: TreatmentRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <EmptyState>
        Sin tratamientos activos. Se abren al agendar la primera sesión de un
        paciente (salvo que sea una consulta puntual).
      </EmptyState>
    );
  }

  const href = (t: TreatmentRow) =>
    `/pacientes/${t.patientId}/procesos/${t.id}`;
  const motivoOf = (t: TreatmentRow) =>
    processMotivoLabel(t) ?? "Sin motivo";
  const statusBadge = (t: TreatmentRow) =>
    t.worsening ? (
      <Badge variant="destructive">
        <AlertTriangle className="h-3.5 w-3.5" />
        Empeoramiento
      </Badge>
    ) : (
      <Badge variant="secondary">En curso</Badge>
    );

  return (
    <>
      {/* Desktop: tabla */}
      <Card className="hidden overflow-hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead className="text-right">Sesiones</TableHead>
              <TableHead className="text-right">Tests</TableHead>
              <TableHead>Próxima sesión</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow
                key={t.id}
                className="cursor-pointer"
                onClick={() => router.push(href(t))}
              >
                <TableCell>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.patientName}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {motivoOf(t)}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {t.sessions}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {t.tests}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                  {t.nextSessionAt ? fmtDate(t.nextSessionAt) : "—"}
                </TableCell>
                <TableCell>{statusBadge(t)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile: tarjetas */}
      <div className="grid gap-3 sm:hidden">
        {rows.map((t) => (
          <Link key={t.id} href={href(t)} className="block">
            <Card className="hover:border-primary/40 transition-colors">
              <CardContent className="flex items-center gap-3 py-4">
                <span className="bg-secondary text-secondary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <Stethoscope className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.patientName}</p>
                  <p className="text-muted-foreground truncate text-sm">
                    {motivoOf(t)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {t.worsening && statusBadge(t)}
                    <span className="text-muted-foreground text-sm">
                      {t.sessions} sesiones ·{" "}
                      {t.nextSessionAt
                        ? `próxima ${fmtDate(t.nextSessionAt)}`
                        : "sin próxima"}
                    </span>
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
