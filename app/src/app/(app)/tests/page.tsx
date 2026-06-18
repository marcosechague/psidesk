import Link from "next/link";
import { Plus } from "lucide-react";

import { requireUserId } from "@/server/session";
import { getTests, getPatients } from "@/server/queries";
import { Button } from "@/components/ui/button";
import {
  TestCatalog,
  type CatalogTest,
} from "@/components/features/tests/TestCatalog";

export default async function TestsPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const userId = await requireUserId();
  const { patient } = await searchParams;
  const [tests, patients] = await Promise.all([
    getTests(userId),
    getPatients(userId),
  ]);

  const catalog: CatalogTest[] = tests.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isSystem: t.isSystem,
    categories: t.categories,
    itemCount: Array.isArray(t.itemsJson) ? t.itemsJson.length : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl">Tests</h1>
          <p className="text-muted-foreground">
            Buscá un test y asignalo a un paciente.
          </p>
        </div>
        <Button asChild>
          <Link href="/tests/nuevo">
            <Plus className="h-4 w-4" />
            Crear test
          </Link>
        </Button>
      </div>

      <TestCatalog
        tests={catalog}
        patients={patients.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          phone: p.phone,
        }))}
        defaultPatientId={patient}
      />
    </div>
  );
}
