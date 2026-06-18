import Link from "next/link";
import {
  Users,
  UserCheck,
  UserX,
  Contact,
  MessageCircle,
  ArrowRight,
} from "lucide-react";

import { requireSuperAdmin } from "@/server/session";
import { getPlatformStats } from "@/server/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminPage() {
  await requireSuperAdmin();
  const stats = await getPlatformStats();

  const cards = [
    { key: "total", label: "Psicólogos", value: stats.psychologists.total, icon: Users },
    { key: "active", label: "Activos", value: stats.psychologists.active, icon: UserCheck },
    { key: "suspended", label: "Suspendidos", value: stats.psychologists.suspended, icon: UserX },
    { key: "patients", label: "Pacientes", value: stats.patients, icon: Contact },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">Plataforma</h1>
          <p className="text-muted-foreground">Resumen general de Psidesk.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/psicologos">
            <Users className="h-4 w-4" />
            Ver psicólogos
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map(({ key, label, value, icon: Icon }) => (
          <Card key={key}>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="bg-secondary text-secondary-foreground flex h-10 w-10 items-center justify-center rounded-lg">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
                <p className="text-muted-foreground text-xs">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <div className="bg-secondary text-secondary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-semibold tabular-nums">
              {stats.whatsapp.total}
            </p>
            <p className="text-muted-foreground text-xs">
              {stats.whatsapp.total === 1 ? "conversación" : "conversaciones"} de
              WhatsApp este mes (toda la plataforma)
              {stats.whatsapp.total > 0 && (
                <>
                  {" · "}
                  {stats.whatsapp.checkin} seguimiento · {stats.whatsapp.reminder}{" "}
                  {stats.whatsapp.reminder === 1 ? "recordatorio" : "recordatorios"} ·{" "}
                  {stats.whatsapp.appointment} avisos · {stats.whatsapp.test} tests
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/psicologos">
          Gestionar psicólogos <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
