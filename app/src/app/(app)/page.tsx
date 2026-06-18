import { redirect } from "next/navigation";
import { Clock, CheckCircle2, ClipboardList, Inbox, Calendar } from "lucide-react";

import { requireUserId, getCurrentUser } from "@/server/session";
import { impersonatedUserId } from "@/server/impersonation";
import { getDashboardData } from "@/server/queries";
import { DayBoard } from "@/components/features/dashboard/DayBoard";
import { WeekLoad } from "@/components/features/dashboard/WeekLoad";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const userId = await requireUserId();
  // El super admin no tiene dashboard de psicólogo: va al panel.
  // Salvo que esté impersonando (ahí sí ve el dashboard del psicólogo).
  const current = await getCurrentUser();
  const impersonatedId = await impersonatedUserId(current?.role === "SUPER_ADMIN");
  if (current?.role === "SUPER_ADMIN" && !impersonatedId) redirect("/admin");
  const [user, data] = await Promise.all([
    getCurrentUser(),
    getDashboardData(userId),
  ]);
  const { stats, today, weekLoad } = data;

  const firstName = user?.name?.split(" ")[0] ?? "";
  const todayLabel = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const statCards = [
    { key: "today", label: "Sesiones hoy", value: stats.sessionsToday, icon: Clock },
    { key: "done", label: "Sesiones hechas", value: stats.doneToday, icon: CheckCircle2 },
    {
      key: "tests",
      label: "Tests sin responder",
      value: stats.pendingTests,
      icon: ClipboardList,
    },
    { key: "review", label: "Informes sin ver", value: stats.toReview, icon: Inbox },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">
          {firstName ? `Hola, ${firstName}` : "Inicio"}
        </h1>
        <p className="text-muted-foreground capitalize">{todayLabel}</p>
      </div>

      <DayBoard
        today={today}
        stats={
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {statCards.map(({ key, label, value, icon: Icon }) => (
              <Card key={key}>
                <CardContent className="flex items-center gap-3 py-4">
                  <div className="bg-secondary text-secondary-foreground flex h-10 w-10 items-center justify-center rounded-lg">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-3xl font-semibold tabular-nums">{value}</p>
                    <p className="text-muted-foreground text-sm">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        }
      />

      {/* Carga de la semana */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Carga de la semana
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WeekLoad data={weekLoad} />
        </CardContent>
      </Card>
    </div>
  );
}
