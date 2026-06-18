import { requireSuperAdmin } from "@/server/session";
import { getPlatformFlags } from "@/server/queries";
import { Card, CardContent } from "@/components/ui/card";
import { FEATURE_KEYS, type FeatureFlags } from "@/lib/features";
import { PlatformFeaturesForm } from "@/components/features/admin/PlatformFeaturesForm";

export default async function AdminFuncionesPage() {
  await requireSuperAdmin();
  const platform = (await getPlatformFlags()) as FeatureFlags;
  const initial = Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, platform?.[k] !== false]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Funciones</h1>
        <p className="text-muted-foreground">
          Interruptores maestros de la plataforma. Apagar una función la
          deshabilita para <strong>todos</strong> los psicólogos, sin importar su
          configuración.
        </p>
      </div>

      <Card>
        <CardContent className="py-6">
          <PlatformFeaturesForm initial={initial} />
        </CardContent>
      </Card>
    </div>
  );
}
