import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

/** Acceso uniforme al detalle de un proceso terapéutico ("Ver detalle ↗"). */
export function ProcessDetailLink({
  patientId,
  processId,
  className,
}: {
  patientId: string;
  processId: string;
  className?: string;
}) {
  return (
    <Link
      href={`/pacientes/${patientId}/procesos/${processId}`}
      className={cn(
        "text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 text-xs font-medium whitespace-nowrap",
        className,
      )}
    >
      Ver detalle
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  );
}
