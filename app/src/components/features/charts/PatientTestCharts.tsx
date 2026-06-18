import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TestChartData } from "@/lib/charts";
import { SeverityEvolutionChart } from "./SeverityEvolutionChart";
import { BeforeAfterChart } from "./BeforeAfterChart";
import { LatestRadarChart } from "./LatestRadarChart";
import { LevelHeatmap } from "./LevelHeatmap";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-muted-foreground text-sm font-medium">{title}</h4>
      {children}
    </div>
  );
}

interface Props {
  data: TestChartData[];
}

/** Conjunto de gráficos por test en la ficha del paciente. */
export function PatientTestCharts({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-6">
      {data.map((g) => {
        const multi = g.tomas.length >= 2;
        const first = g.tomas[0];
        const last = g.tomas[g.tomas.length - 1];
        const hasRadar = g.subscales.length >= 3;

        return (
          <Card key={g.testId}>
            <CardHeader>
              <CardTitle className="text-lg">
                {g.testName}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  · {g.tomas.length} {g.tomas.length === 1 ? "toma" : "tomas"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {hasRadar && (
                <Section title={`Último resultado (${last.date})`}>
                  <LatestRadarChart subscales={g.subscales} latest={last} />
                </Section>
              )}
              {multi && (
                <Section title="Evolución">
                  <SeverityEvolutionChart subscales={g.subscales} tomas={g.tomas} />
                </Section>
              )}
              {multi && (
                <Section title="Antes vs ahora">
                  <BeforeAfterChart
                    subscales={g.subscales}
                    first={first}
                    last={last}
                  />
                </Section>
              )}
              {multi && (
                <Section title="Niveles en el tiempo">
                  <LevelHeatmap subscales={g.subscales} tomas={g.tomas} />
                </Section>
              )}
              {!multi && !hasRadar && (
                <p className="text-muted-foreground text-sm">
                  Con una sola toma todavía no hay evolución. Volvé a asignar este
                  test más adelante para comparar resultados.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
