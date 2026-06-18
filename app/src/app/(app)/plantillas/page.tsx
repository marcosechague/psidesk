import { requireUserId } from "@/server/session";
import { getNoteTemplates, getWritingVoices } from "@/server/queries";
import { PlantillasManager } from "@/components/features/plantillas/PlantillasManager";

export default async function PlantillasPage() {
  const userId = await requireUserId();
  const [templates, voices] = await Promise.all([
    getNoteTemplates(userId),
    getWritingVoices(userId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Plantillas y estilo</h1>
        <p className="text-muted-foreground">
          Las plantillas definen la estructura del resumen; la voz, cómo se
          redacta. Se eligen al generar el contenido de una sesión.
        </p>
      </div>

      <PlantillasManager
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          isSystem: t.isSystem,
          isDefault: t.isDefault,
        }))}
        voices={voices.map((v) => ({
          id: v.id,
          name: v.name,
          description: v.description,
          rules: Array.isArray(v.rulesJson)
            ? (v.rulesJson as unknown[]).filter(
                (r): r is string => typeof r === "string",
              )
            : [],
          isSystem: v.isSystem,
          isDefault: v.isDefault,
        }))}
      />
    </div>
  );
}
