import { requireUserId } from "@/server/session";
import { getActiveTreatments } from "@/server/queries";
import { PageHeader } from "@/components/ui/page-header";
import { TreatmentsTable } from "@/components/features/treatments/TreatmentsTable";

export default async function TratamientosPage() {
  const userId = await requireUserId();
  const treatments = await getActiveTreatments(userId);

  // Orden: primero los que empeoraron, luego por próxima sesión (sin próxima al
  // final), luego por nombre. Así arriba queda lo que pide atención.
  const rows = [...treatments].sort((a, b) => {
    if (a.worsening !== b.worsening) return a.worsening ? -1 : 1;
    const an = a.nextSessionAt?.getTime() ?? Infinity;
    const bn = b.nextSessionAt?.getTime() ?? Infinity;
    if (an !== bn) return an - bn;
    return a.patientName.localeCompare(b.patientName);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tratamientos"
        description="Tus casos activos. Un tratamiento agrupa las sesiones, tests y seguimientos de un mismo curso de atención."
      />
      <TreatmentsTable rows={rows} />
    </div>
  );
}
