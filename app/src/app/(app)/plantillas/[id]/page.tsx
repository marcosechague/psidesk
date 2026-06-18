import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireUserId } from "@/server/session";
import { getOwnNoteTemplate } from "@/server/queries";
import { Button } from "@/components/ui/button";
import { NoteTemplateBuilder } from "@/components/features/plantillas/NoteTemplateBuilder";

export default async function EditarPlantillaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const template = await getOwnNoteTemplate(userId, id);
  if (!template) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/plantillas">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl">Editar plantilla</h1>
        <p className="text-muted-foreground">
          Ajustá las secciones del resumen.
        </p>
      </div>

      <NoteTemplateBuilder
        mode="edit"
        id={template.id}
        initial={{
          name: template.name,
          description: template.description ?? "",
          structure: template.structure,
          isDefault: template.isDefault,
        }}
      />
    </div>
  );
}
