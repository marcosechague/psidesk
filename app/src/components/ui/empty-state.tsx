import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Estado vacío uniforme (envuelto en Card). Para los vacíos de nivel superior. */
export function EmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card>
      <CardContent
        className={cn(
          "text-muted-foreground py-8 text-center text-sm",
          className,
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}
