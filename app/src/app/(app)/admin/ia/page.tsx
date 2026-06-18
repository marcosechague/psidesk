import { requireSuperAdmin } from "@/server/session";
import { getAiSettings } from "@/server/queries";
import { Card, CardContent } from "@/components/ui/card";
import { AI_PROVIDERS, type AiProviderName } from "@/lib/ai/types";
import { AiSettingsForm } from "@/components/features/admin/AiSettingsForm";

export default async function AdminIaPage() {
  await requireSuperAdmin();
  const settings = await getAiSettings();

  const provider = (settings.aiProvider ||
    process.env.AI_PROVIDER ||
    "mock") as AiProviderName;

  // Qué proveedores tienen su API key cargada en el entorno (no exponemos el valor).
  const keyStatus: Partial<Record<AiProviderName, boolean>> = {};
  for (const p of AI_PROVIDERS) {
    if (p.keyEnv) keyStatus[p.value] = Boolean(process.env[p.keyEnv]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Configuración de IA</h1>
        <p className="text-muted-foreground">
          Proveedor y modelo para el <strong>Resumen con IA</strong> de las
          sesiones. Las claves de API se cargan por variables de entorno (son
          secretos) — acá solo elegís proveedor y modelo.
        </p>
      </div>

      <Card>
        <CardContent className="py-6">
          <AiSettingsForm
            initial={{ aiProvider: provider, aiModel: settings.aiModel ?? "" }}
            keyStatus={keyStatus}
          />
        </CardContent>
      </Card>
    </div>
  );
}
