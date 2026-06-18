"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { FEATURES, type FeatureKey } from "@/lib/features";
import { setMyFeaturePreferences } from "@/server/actions";

/**
 * Switches de las funciones que el admin habilitó (nivel preferencia). Guarda
 * en cada cambio. Solo se renderiza con las claves entitled (las decide la page).
 */
export function FeaturePreferences({
  keys,
  initial,
}: {
  keys: FeatureKey[];
  initial: Record<string, boolean>;
}) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initial);
  const [isPending, startTransition] = useTransition();

  function toggle(key: FeatureKey, checked: boolean) {
    const prev = prefs;
    const next = { ...prefs, [key]: checked };
    setPrefs(next);
    startTransition(async () => {
      const res = await setMyFeaturePreferences({ preferences: next });
      if (res?.error) {
        toast.error(res.error);
        setPrefs(prev); // revertir
        return;
      }
      toast.success(checked ? "Función activada" : "Función desactivada");
    });
  }

  return (
    <div className="space-y-4">
      {keys.map((k) => (
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
            checked={prefs[k] ?? true}
            disabled={isPending}
            onCheckedChange={(checked) => toggle(k, checked)}
          />
        </label>
      ))}
    </div>
  );
}
