"use client";

import { useMemo, useState } from "react";
import { ClipboardList, Search, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  TEST_CATEGORY_OPTIONS,
  testCategoryLabel,
} from "@/lib/validations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssignDialog } from "@/components/features/assignments/AssignDialog";

export interface CatalogTest {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  categories: string[];
  itemCount: number;
}

type Owner = "todos" | "publicos" | "mios";

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active ? "border-primary bg-secondary" : "hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

export function TestCatalog({
  tests,
  patients,
  defaultPatientId,
}: {
  tests: CatalogTest[];
  patients: { id: string; fullName: string; phone?: string | null }[];
  defaultPatientId?: string;
}) {
  const [owner, setOwner] = useState<Owner>("todos");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [assignTest, setAssignTest] = useState<CatalogTest | null>(null);

  const counts = useMemo(
    () => ({
      todos: tests.length,
      publicos: tests.filter((t) => t.isSystem).length,
      mios: tests.filter((t) => !t.isSystem).length,
    }),
    [tests],
  );

  // 1) Por propiedad.
  const byOwner = useMemo(() => {
    if (owner === "publicos") return tests.filter((t) => t.isSystem);
    if (owner === "mios") return tests.filter((t) => !t.isSystem);
    return tests;
  }, [tests, owner]);

  // Categorías presentes en el set actual (para los chips).
  const presentCategories = useMemo(
    () =>
      TEST_CATEGORY_OPTIONS.map((c) => c.value).filter((v) =>
        byOwner.some((t) => t.categories.includes(v)),
      ),
    [byOwner],
  );

  // 2) Por categoría + búsqueda.
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return byOwner.filter((t) => {
      if (category && !t.categories.includes(category)) return false;
      if (
        term &&
        !t.name.toLowerCase().includes(term) &&
        !t.description.toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [byOwner, category, q]);

  const owners: { key: Owner; label: string }[] = [
    { key: "todos", label: `Todos (${counts.todos})` },
    { key: "publicos", label: `Públicos (${counts.publicos})` },
    { key: "mios", label: `Mis tests (${counts.mios})` },
  ];

  return (
    <div className="space-y-4">
      {/* Pestañas de propiedad */}
      <div className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1">
        {owners.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => {
              setOwner(o.key);
              setCategory("");
            }}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              owner === o.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar test…"
          className="pl-9"
        />
      </div>

      {/* Filtro por categoría */}
      {presentCategories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip
            label="Todas"
            active={category === ""}
            onClick={() => setCategory("")}
          />
          {presentCategories.map((c) => (
            <Chip
              key={c}
              label={testCategoryLabel(c)}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          No hay tests que coincidan.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-start gap-3 py-4">
                <div className="bg-secondary text-secondary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{t.name}</p>
                    {!t.isSystem && (
                      <Badge variant="secondary" className="text-xs">
                        Propio
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-sm">
                    {t.description}
                  </p>
                  {t.categories.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {t.categories.map((c) => (
                        <Badge key={c} variant="outline" className="text-xs">
                          {testCategoryLabel(c)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t.itemCount}{" "}
                    {t.itemCount === 1 ? "pregunta" : "preguntas"}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => setAssignTest(t)}
                >
                  <Send className="h-4 w-4" />
                  Asignar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AssignDialog
        open={!!assignTest}
        onClose={() => setAssignTest(null)}
        test={assignTest}
        patients={patients}
        defaultPatientId={defaultPatientId}
      />
    </div>
  );
}
