import { cn } from "@/lib/utils";
import { PAGE_TITLE } from "@/lib/ui";

/**
 * Encabezado de página uniforme: título + descripción opcional + acciones a la
 * derecha. Una sola fuente de verdad para el tamaño/peso del título y el
 * espaciado, en TODAS las pantallas.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className={PAGE_TITLE}>{title}</h1>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
