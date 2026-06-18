import { Info } from "lucide-react";

/** Aviso fijo obligatorio en todo informe. */
export function Disclaimer() {
  return (
    <div className="border-border bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Herramienta de apoyo. No constituye diagnóstico. Interpretación a cargo
        del profesional.
      </p>
    </div>
  );
}
