import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PatientForm } from "@/components/features/patients/PatientForm";

export default function NuevoPacientePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/pacientes">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl">Nuevo paciente</h1>
        <p className="text-muted-foreground">Cargá los datos del paciente.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <PatientForm />
        </CardContent>
      </Card>
    </div>
  );
}
