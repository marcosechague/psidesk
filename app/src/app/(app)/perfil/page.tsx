import { prisma } from "@/lib/db";
import { requireUserId } from "@/server/session";
import { getPlatformFlags } from "@/server/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "@/components/features/profile/ProfileForm";
import { FeaturePreferences } from "@/components/features/profile/FeaturePreferences";
import { AvailabilityForm } from "@/components/features/profile/AvailabilityForm";
import { ChangePasswordForm } from "@/components/features/auth/ChangePasswordForm";
import { entitledKeys, type FeatureFlags } from "@/lib/features";
import {
  normalizeAvailability,
  DEFAULT_AVAILABILITY,
} from "@/lib/availability";
import type { ProfileInput } from "@/lib/validations";

export default async function PerfilPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      prefix: true,
      specialties: true,
      featureEntitlements: true,
      featurePreferences: true,
      availability: true,
    },
  });

  // El super admin no es un profesional: no tiene datos clínicos ni funciones de
  // psicólogo. Le mostramos su cuenta y el cambio de contraseña.
  if (user?.role === "SUPER_ADMIN") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          title="Mi cuenta"
          description="Tu cuenta de administrador de la plataforma."
        />

        <Card>
          <CardHeader>
            <CardTitle>Datos de la cuenta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <p>
              <span className="text-muted-foreground">Nombre: </span>
              {user.name}
            </p>
            <p>
              <span className="text-muted-foreground">Email: </span>
              {user.email}
            </p>
            <p>
              <span className="text-muted-foreground">Rol: </span>
              Administrador
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contraseña</CardTitle>
            <p className="text-muted-foreground text-sm">
              Cambiá la contraseña de tu cuenta.
            </p>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Para cuentas viejas sin firstName/lastName, derivamos del nombre completo.
  const [legacyFirst, ...legacyRest] = (user?.name ?? "").split(" ");
  const defaultValues: ProfileInput = {
    firstName: user?.firstName ?? legacyFirst ?? "",
    lastName: user?.lastName ?? legacyRest.join(" ") ?? "",
    prefix: user?.prefix ?? "",
    specialties: user?.specialties ?? [],
  };

  // Funciones que el admin habilitó (las únicas que el psicólogo puede ver/configurar).
  const entitlements =
    (user?.featureEntitlements as Record<string, boolean> | null) ?? null;
  const prefs = (user?.featurePreferences as Record<string, boolean> | null) ?? null;
  const platform = await getPlatformFlags();
  // Solo las funciones habilitadas por el admin Y prendidas a nivel plataforma.
  const featureKeys = entitledKeys(entitlements, platform as FeatureFlags);
  const initialPrefs = Object.fromEntries(
    featureKeys.map((k) => [k, prefs?.[k] !== false]),
  );

  // Horario de atención: si nunca lo configuró, ofrecemos la plantilla por defecto.
  const initialAvailability = user?.availability
    ? normalizeAvailability(user.availability)
    : DEFAULT_AVAILABILITY;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Mi perfil"
        description="Tu nombre y prefijo se usan en los mensajes de seguimiento que reciben los pacientes."
      />

      <Card>
        <CardHeader>
          <CardTitle>Datos del profesional</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm defaultValues={defaultValues} />
        </CardContent>
      </Card>

      {featureKeys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Funciones</CardTitle>
            <p className="text-muted-foreground text-sm">
              Prendé o apagá las funciones de tu cuenta.
            </p>
          </CardHeader>
          <CardContent>
            <FeaturePreferences keys={featureKeys} initial={initialPrefs} />
          </CardContent>
        </Card>
      )}

      <Card id="horario" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>Horario de atención</CardTitle>
          <p className="text-muted-foreground text-sm">
            Tus rangos disponibles por día. En el calendario se sombrean las
            horas fuera de atención.
          </p>
        </CardHeader>
        <CardContent>
          <AvailabilityForm initial={initialAvailability} />
        </CardContent>
      </Card>
    </div>
  );
}
