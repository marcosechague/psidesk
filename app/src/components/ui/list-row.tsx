import { ChevronDown, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { SECTION_LABEL } from "@/lib/ui";

/**
 * Sección de lista uniforme: subtítulo opcional + la lista. Usar en todos los
 * tabs para que los encabezados y el espaciado sean idénticos.
 */
export function ListSection({
  title,
  children,
  className,
}: {
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      {title && <p className={SECTION_LABEL}>{title}</p>}
      <ul className="space-y-3">{children}</ul>
    </section>
  );
}

/**
 * Fila de lista estándar (una sola fuente de verdad del look de las filas en
 * todos los tabs): contenedor con borde + cabecera `icono? + título + meta` y
 * un slot de acciones a la derecha. Variante colapsable (chevron + detalle) y
 * detalle siempre visible (children sin `collapsible`).
 */
export function ListRow({
  icon: Icon,
  title,
  meta,
  actions,
  className,
  collapsible = false,
  expanded = false,
  onToggle,
  ariaLabel,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  /** línea de badges / fecha / datos bajo el título */
  meta?: React.ReactNode;
  /** acciones a la derecha (botones, kebab) */
  actions?: React.ReactNode;
  /** clases extra del <li> (énfasis: activo, atenuado, principal…) */
  className?: string;
  /** muestra chevron y hace clickeable la cabecera para abrir/cerrar */
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  ariaLabel?: string;
  /** detalle: visible siempre (no colapsable) o al expandir (colapsable) */
  children?: React.ReactNode;
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight;

  const head = (
    <>
      {collapsible && (
        <Chevron className="text-muted-foreground mt-0.5 h-5 w-5 shrink-0" />
      )}
      {Icon && <Icon className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="font-medium">{title}</div>
        {meta && (
          <div className="flex flex-wrap items-center gap-1.5">{meta}</div>
        )}
      </div>
    </>
  );

  const showChildren = children && (!collapsible || expanded);

  return (
    <li className={cn("border-border rounded-lg border", className)}>
      <div className="flex items-start justify-between gap-3 p-4">
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={ariaLabel}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
          >
            {head}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-2">{head}</div>
        )}
        {actions && (
          <div className="flex shrink-0 items-center gap-1">{actions}</div>
        )}
      </div>
      {showChildren && (
        <div className="border-border border-t">{children}</div>
      )}
    </li>
  );
}
