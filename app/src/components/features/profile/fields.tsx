"use client";

import { PREFIX_OPTIONS, SPECIALTY_OPTIONS } from "@/lib/validations";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Select de prefijo/título ("Sin prefijo" = ""). Controlado. */
export function PrefixSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  // El item de "Sin prefijo" usa un sentinel porque Select no admite value="".
  const NONE = "__none__";
  return (
    <Select
      value={value === "" ? NONE : value}
      onValueChange={(v) => onChange(v == null || v === NONE ? "" : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PREFIX_OPTIONS.map((o) => (
          <SelectItem key={o.value || NONE} value={o.value || NONE}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Multi-select de especialidades como grilla de toggles. Controlado. */
export function SpecialtyPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }
  return (
    <div className="space-y-2">
      <Label>Especialidades</Label>
      <div className="flex flex-wrap gap-1.5">
        {SPECIALTY_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm transition-colors",
              value.includes(o.value)
                ? "border-primary bg-secondary"
                : "hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
