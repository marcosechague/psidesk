"use client";

import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Menú de acciones de fila estándar (⋮). ÚNICO trigger para todas las listas:
 * botón ghost `size="icon"` con `MoreVertical`. Los ítems van como children
 * (`DropdownMenuItem`). Regla de UI: la acción primaria de la fila queda como
 * botón visible; el resto (editar, eliminar, compartir, pausar…) va acá.
 */
export function RowActions({
  children,
  label = "Más acciones",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={label}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
