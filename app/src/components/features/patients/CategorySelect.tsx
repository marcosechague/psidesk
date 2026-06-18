"use client";

import { MOTIVO_OPTIONS } from "@/lib/validations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Select de categoría de motivo de consulta (placeholder "Categoría…"). */
export function CategorySelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Categoría…" />
      </SelectTrigger>
      <SelectContent>
        {MOTIVO_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
