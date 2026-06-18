"use client";

import { cn } from "@/lib/utils";

/**
 * Control segmentado (pill) para elegir entre pocas opciones mutuamente
 * excluyentes. Patrón reutilizable: tabs de la agenda, tipo de sesión, etc.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("bg-muted inline-flex gap-1 rounded-lg p-1", className)}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-md px-3 py-1 text-sm font-medium transition-colors",
            value === o.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
