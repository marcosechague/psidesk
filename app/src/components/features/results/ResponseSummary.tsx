import type { ResponseType } from "@prisma/client";
import { ListChecks } from "lucide-react";

import { normalizeItems } from "@/lib/testItems";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ResponseSummaryProps {
  itemsJson: unknown;
  responseType: ResponseType;
  /** { numeroItem(1-based): valor } — las claves pueden ser número o string. */
  answersJson: unknown;
}

/** Lee el valor respondido para un ítem (1-based), tolerando clave num o string. */
function answerValue(answers: unknown, item: number): number | null {
  if (!answers || typeof answers !== "object") return null;
  const rec = answers as Record<string, unknown>;
  const raw = rec[item] ?? rec[String(item)];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

/** Resumen de las respuestas crudas del paciente: cada ítem con la opción elegida. */
export function ResponseSummary({
  itemsJson,
  responseType,
  answersJson,
}: ResponseSummaryProps) {
  const items = normalizeItems(itemsJson, responseType);
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListChecks className="h-5 w-5" />
          Resumen de respuestas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="divide-border divide-y">
          {items.map((item, i) => {
            const num = i + 1;
            const value = answerValue(answersJson, num);
            const option =
              value === null
                ? null
                : item.options.find((o) => o.value === value) ?? null;
            return (
              <li
                key={num}
                className="flex items-start justify-between gap-3 py-3"
              >
                <p className="text-sm">
                  <span className="text-muted-foreground tabular-nums">
                    {num}.
                  </span>{" "}
                  {item.text || <span className="italic">Ítem {num}</span>}
                </p>
                {option ? (
                  <Badge variant="secondary" className="shrink-0">
                    {option.label}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground shrink-0 text-sm">—</span>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
