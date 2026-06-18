import Link from "next/link";
import { AlertTriangle, UserX, Activity, Calendar } from "lucide-react";

import { requireUserId } from "@/server/session";
import { getPracticeInsights } from "@/server/queries";
import { SeverityDistribution } from "@/components/features/charts/SeverityDistribution";
import { WeeklyLoadChart } from "@/components/features/charts/WeeklyLoadChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PanelPage() {
  const userId = await requireUserId();
  const insights = await getPracticeInsights(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Panel</h1>
        <p className="text-muted-foreground">
          Estadísticas de tu práctica: severidad, carga y pacientes a seguir.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5" />
              Distribución de severidad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SeverityDistribution data={insights.severity} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5" />
              Carga semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyLoadChart data={insights.weekly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="text-level-high h-5 w-5" />
              Empeoramiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.worsening.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Sin empeoramientos en las últimas tomas.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {insights.worsening.map((w, i) => (
                  <li key={i} className="py-2 text-sm">
                    <Link
                      href={`/pacientes/${w.patientId}`}
                      className="font-medium hover:underline"
                    >
                      {w.patientName}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      · {w.testName}: {w.from} → {w.to}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserX className="h-5 w-5" />
              Sin actividad (30 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.inactive.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                Todos los pacientes con actividad reciente.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {insights.inactive.map((p) => (
                  <li
                    key={p.patientId}
                    className="flex justify-between gap-2 py-2 text-sm"
                  >
                    <Link
                      href={`/pacientes/${p.patientId}`}
                      className="font-medium hover:underline"
                    >
                      {p.fullName}
                    </Link>
                    <span className="text-muted-foreground">
                      última: {p.lastActivity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
