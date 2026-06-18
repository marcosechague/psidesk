import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TestBuilder } from "@/components/features/tests/TestBuilder";

export default function NuevoTestPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/tests">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl">Crear test</h1>
        <p className="text-muted-foreground">
          Definí el propósito, la escala de respuesta, las preguntas y cómo se
          interpretan los puntajes.
        </p>
      </div>

      <TestBuilder />
    </div>
  );
}
