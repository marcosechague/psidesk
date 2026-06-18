import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NoteTemplateBuilder } from "@/components/features/plantillas/NoteTemplateBuilder";

export default function NuevaPlantillaPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/plantillas">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl">Crear plantilla</h1>
        <p className="text-muted-foreground">
          Definí las secciones que querés que tenga el resumen clínico.
        </p>
      </div>

      <NoteTemplateBuilder />
    </div>
  );
}
