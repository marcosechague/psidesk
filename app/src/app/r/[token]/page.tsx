import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { getAssignmentByToken } from "@/server/queries";
import { normalizeItems } from "@/lib/testItems";
import { Card, CardContent } from "@/components/ui/card";
import { PatientTestForm } from "@/components/features/patient-test/PatientTestForm";

export default async function ResponderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const assignment = await getAssignmentByToken(token);
  if (!assignment) notFound();

  const items = normalizeItems(
    assignment.test.itemsJson,
    assignment.test.responseType,
  );

  return (
    <main className="bg-background min-h-screen">
      <header className="bg-card border-b">
        <div className="mx-auto max-w-2xl px-4 py-5">
          <h1 className="font-serif text-2xl">{assignment.test.name}</h1>
          <p className="text-muted-foreground text-sm">
            {assignment.test.description}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {assignment.status === "COMPLETED" ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle2 className="text-primary h-12 w-12" />
              <h2 className="text-xl">Este cuestionario ya fue respondido</h2>
              <p className="text-muted-foreground max-w-sm text-sm">
                Gracias. No es necesario volver a completarlo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-muted-foreground mb-4 text-sm">
              Leé cada frase y elegí la opción que mejor describa cómo te
              sentiste. No hay respuestas correctas ni incorrectas.
            </p>
            <PatientTestForm token={token} items={items} />
          </>
        )}
      </div>
    </main>
  );
}
