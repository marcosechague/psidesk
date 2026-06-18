import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreBar } from "./ScoreBar";
import { Disclaimer } from "./Disclaimer";
import type { ScoreResult } from "@/lib/scoring/types";

interface ReportViewProps {
  patientName: string;
  testName: string;
  testDescription?: string;
  completedAt?: Date | null;
  result: ScoreResult;
}

/** Informe completo de un resultado (presentación pura). */
export function ReportView({
  patientName,
  testName,
  testDescription,
  completedAt,
  result,
}: ReportViewProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{testName}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {patientName}
            {completedAt && (
              <>
                {" · "}
                {new Date(completedAt).toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </>
            )}
          </p>
          {testDescription && (
            <p className="text-muted-foreground pt-1 text-sm">
              {testDescription}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {result.scores.map((score) => (
            <ScoreBar key={score.key} score={score} />
          ))}
        </CardContent>
      </Card>

      <Disclaimer />
    </div>
  );
}
