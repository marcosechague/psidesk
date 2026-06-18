import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WritingVoiceBuilder } from "@/components/features/plantillas/WritingVoiceBuilder";

export default function NuevaVozPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/plantillas">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl">Nueva voz</h1>
        <p className="text-muted-foreground">
          Definí las reglas de redacción que se aplican a lo que genera la IA.
        </p>
      </div>

      <WritingVoiceBuilder />
    </div>
  );
}
