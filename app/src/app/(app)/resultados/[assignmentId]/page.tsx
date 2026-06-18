import { notFound } from "next/navigation";
import { Clock } from "lucide-react";

import { requireUserId } from "@/server/session";
import { getAssignmentForResult, markResultReviewed } from "@/server/queries";
import type { ScoreResult } from "@/lib/scoring/types";
import { fmtDate } from "@/lib/format";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportView } from "@/components/features/results/ReportView";
import { ResponseSummary } from "@/components/features/results/ResponseSummary";
import { ShareLink } from "@/components/features/assignments/ShareLink";

export default async function ResultadoPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { assignmentId } = await params;
  const userId = await requireUserId();
  const assignment = await getAssignmentForResult(userId, assignmentId);
  if (!assignment) notFound();

  // Al abrir el informe, queda marcado como revisado (sale de "Para revisar").
  if (assignment.status === "COMPLETED" && assignment.result) {
    await markResultReviewed(assignment.id);
  }

  return (
    <div className="space-y-6">
      <BackButton fallback={`/pacientes/${assignment.patientId}`} />

      {assignment.status === "COMPLETED" && assignment.result ? (
        assignment.result.scoresJson ? (
          <>
            <ReportView
              patientName={assignment.patient.fullName}
              testName={assignment.test.name}
              testDescription={assignment.test.description}
              completedAt={assignment.completedAt}
              result={assignment.result.scoresJson as unknown as ScoreResult}
            />
            {assignment.response && (
              <ResponseSummary
                itemsJson={assignment.test.itemsJson}
                responseType={assignment.test.responseType}
                answersJson={assignment.response.answersJson}
              />
            )}
          </>
        ) : (
          // Resultado cargado a mano: hallazgos libres + notas.
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {assignment.test.name}
                <Badge variant="secondary">a mano</Badge>
                {assignment.result.editedAt && (
                  <Badge variant="outline">editado</Badge>
                )}
              </CardTitle>
              {assignment.completedAt && (
                <p className="text-muted-foreground text-sm">
                  {fmtDate(assignment.completedAt)}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="divide-border divide-y">
                {(
                  (assignment.result.findingsJson as
                    | { label: string; value: string }[]
                    | null) ?? []
                ).map((f, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-3 py-2"
                  >
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="text-right font-medium">{f.value}</span>
                  </li>
                ))}
              </ul>
              {assignment.result.notes && (
                <p className="text-muted-foreground border-border border-t pt-3 whitespace-pre-wrap">
                  {assignment.result.notes}
                </p>
              )}
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Clock className="text-muted-foreground h-10 w-10" />
            <div>
              <h2 className="text-xl">Pendiente de respuesta</h2>
              <p className="text-muted-foreground text-sm">
                {assignment.patient.fullName} todavía no respondió{" "}
                {assignment.test.name}.
              </p>
            </div>
            <div className="w-full max-w-md">
              <ShareLink
                token={assignment.token}
                patientName={assignment.patient.fullName}
                testName={assignment.test.name}
                patientPhone={assignment.patient.phone}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
