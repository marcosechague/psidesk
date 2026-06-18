import { Users, MessageCircle } from "lucide-react";

import { requireSuperAdmin } from "@/server/session";
import { getPsychologists, getPlatformFlags } from "@/server/queries";
import { Card, CardContent } from "@/components/ui/card";
import {
  PsychologistList,
  type PsychologistListItem,
} from "@/components/features/admin/PsychologistList";
import { NewPsychologistDialog } from "@/components/features/admin/NewPsychologistDialog";

export default async function AdminPsychologistsPage() {
  await requireSuperAdmin();
  const [rows, platform] = await Promise.all([
    getPsychologists(),
    getPlatformFlags(),
  ]);

  const psychologists: PsychologistListItem[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    firstName: p.firstName,
    lastName: p.lastName,
    prefix: p.prefix,
    email: p.email,
    active: p.active,
    billingStatus: p.billingStatus,
    billingUntil: p.billingUntil,
    entitlements: (p.featureEntitlements as Record<string, boolean> | null) ?? null,
    createdAt: p.createdAt,
    patientCount: p._count.patients,
    whatsappThisMonth: p.whatsappThisMonth,
  }));

  const totalWhatsapp = psychologists.reduce(
    (sum, p) => sum + p.whatsappThisMonth,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl">Psicólogos</h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {psychologists.length}{" "}
              {psychologists.length === 1 ? "profesional" : "profesionales"}
            </span>
            <span
              className="flex items-center gap-1"
              title="Conversaciones de WhatsApp de toda la plataforma este mes"
            >
              <MessageCircle className="h-4 w-4" />
              {totalWhatsapp} WhatsApp este mes
            </span>
          </p>
        </div>
        <NewPsychologistDialog />
      </div>

      {psychologists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Users className="text-muted-foreground h-10 w-10" />
            <p className="text-muted-foreground">
              Todavía no diste de alta a ningún psicólogo.
            </p>
            <NewPsychologistDialog />
          </CardContent>
        </Card>
      ) : (
        <PsychologistList
          psychologists={psychologists}
          platform={(platform as Record<string, boolean> | null) ?? null}
        />
      )}
    </div>
  );
}
