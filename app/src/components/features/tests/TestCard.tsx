import { cn } from "@/lib/utils";
import { testCategoryLabel } from "@/lib/validations";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Check } from "lucide-react";

interface TestCardProps {
  test: { name: string; description: string; isSystem?: boolean; categories?: string[] };
  selected?: boolean;
  onSelect?: () => void;
}

/** Tarjeta de test del catálogo (seleccionable). */
export function TestCard({ test, selected, onSelect }: TestCardProps) {
  return (
    <Card
      onClick={onSelect}
      className={cn(
        "cursor-pointer transition-colors",
        selected ? "border-primary ring-primary/30 ring-2" : "hover:border-primary/40",
      )}
    >
      <CardContent className="flex items-start gap-3 py-4">
        <div className="bg-secondary text-secondary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
          <ClipboardList className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{test.name}</p>
            {test.isSystem === false && (
              <Badge variant="secondary" className="text-xs">
                Propio
              </Badge>
            )}
            {selected && <Check className="text-primary h-4 w-4" />}
          </div>
          <p className="text-muted-foreground text-sm">{test.description}</p>
          {test.categories && test.categories.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {test.categories.map((c) => (
                <Badge key={c} variant="outline" className="text-xs">
                  {testCategoryLabel(c)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
