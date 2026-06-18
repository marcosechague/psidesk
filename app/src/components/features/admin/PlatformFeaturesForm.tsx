"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { FEATURE_KEYS, FEATURES, type FeatureKey } from "@/lib/features";
import { adminSetPlatformFlags } from "@/server/actions";

/**
 * Interruptores maestros de la plataforma. Apagar una función acá la deshabilita
 * para TODOS los psicólogos. Guarda en cada cambio.
 */
export function PlatformFeaturesForm({
  initial,
}: {
  initial: Record<string, boolean>;
}) {
  const [flags, setFlags] = useState<Record<string, boolean>>(initial);
  const [isPending, startTransition] = useTransition();

  function toggle(key: FeatureKey, checked: boolean) {
    const prev = flags;
    const next = { ...flags, [key]: checked };
    setFlags(next);
    startTransition(async () => {
      const res = await adminSetPlatformFlags({ flags: next });
      if (res?.error) {
        toast.error(res.error);
        setFlags(prev); // revertir
        return;
      }
      toast.success(
        checked
          ? "Función activada para toda la plataforma"
          : "Función desactivada para toda la plataforma",
      );
    });
  }

  return (
    <div className="space-y-4">
      {FEATURE_KEYS.map((k) => (
        <label
          key={k}
          className="flex cursor-pointer items-start justify-between gap-4"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium">{FEATURES[k].label}</span>
            <span className="text-muted-foreground block text-xs">
              {FEATURES[k].description}
            </span>
          </span>
          <Switch
            checked={flags[k] ?? true}
            disabled={isPending}
            onCheckedChange={(checked) => toggle(k, checked)}
          />
        </label>
      ))}
    </div>
  );
}
