"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2 } from "lucide-react";

import {
  AI_PROVIDERS,
  defaultModelFor,
  modelsFor,
  type AiProviderName,
} from "@/lib/ai/types";
import { adminSetAiSettings } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Config del proveedor/modelo de IA para el resumen. Las CLAVES van por env
 * (acá solo se muestra si están cargadas). El modelo vacío usa el default.
 */
export function AiSettingsForm({
  initial,
  keyStatus,
}: {
  initial: { aiProvider: AiProviderName; aiModel: string };
  /** Por proveedor: si su API key está cargada en el entorno. */
  keyStatus: Partial<Record<AiProviderName, boolean>>;
}) {
  const [provider, setProvider] = useState<AiProviderName>(initial.aiProvider);
  const [model, setModel] = useState(initial.aiModel);
  // El modelo guardado no figura en el catálogo del proveedor → modo personalizado.
  const [customMode, setCustomMode] = useState(
    Boolean(initial.aiModel) &&
      !modelsFor(initial.aiProvider).some((m) => m.value === initial.aiModel),
  );
  const [isPending, startTransition] = useTransition();

  const models = modelsFor(provider);
  // Valor del selector: "" (default) y "__custom__" son sentinelas.
  const selectValue = customMode ? "__custom__" : model || "__default__";
  // Label visible en el trigger. base-ui muestra el value crudo si no se lo damos.
  const modelLabel = customMode
    ? "Personalizado…"
    : model
      ? (models.find((m) => m.value === model)?.label ?? model)
      : `Default (${defaultModelFor(provider)})`;

  const meta = AI_PROVIDERS.find((p) => p.value === provider);
  const needsKey = Boolean(meta?.keyEnv);
  const hasKey = keyStatus[provider] ?? false;
  const missingKey = needsKey && !hasKey;

  function save() {
    startTransition(async () => {
      const res = await adminSetAiSettings({ aiProvider: provider, aiModel: model });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Configuración de IA guardada");
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Proveedor</Label>
        <Select
          value={provider}
          onValueChange={(v) => {
            const next = (v as AiProviderName) ?? "mock";
            setProvider(next);
            // Al cambiar de proveedor, volvemos al default (los modelos no se comparten).
            setModel("");
            setCustomMode(false);
          }}
        >
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {needsKey && (
          <p
            className={
              missingKey
                ? "text-level-high flex items-center gap-1.5 text-sm"
                : "text-muted-foreground flex items-center gap-1.5 text-sm"
            }
          >
            {missingKey ? (
              <>
                <AlertTriangle className="h-4 w-4" />
                Falta la clave <code>{meta?.keyEnv}</code> en el entorno. El
                resumen va a fallar hasta cargarla.
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Clave <code>{meta?.keyEnv}</code> cargada.
              </>
            )}
          </p>
        )}
      </div>

      {provider !== "mock" && (
        <div className="space-y-1.5">
          <Label>Modelo</Label>
          <Select
            value={selectValue}
            onValueChange={(v) => {
              if (v === "__custom__") {
                setCustomMode(true);
                setModel("");
                return;
              }
              setCustomMode(false);
              // "__default__" (o null) → modelo vacío (usa el default del proveedor).
              setModel(!v || v === "__default__" ? "" : v);
            }}
          >
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue>{modelLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default__">
                Default ({defaultModelFor(provider)})
              </SelectItem>
              {models.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
              <SelectItem value="__custom__">Personalizado…</SelectItem>
            </SelectContent>
          </Select>
          {customMode && (
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={defaultModelFor(provider) || "ID del modelo"}
              className="w-full sm:w-72"
            />
          )}
          <p className="text-muted-foreground text-sm">
            {customMode
              ? "Escribí el ID exacto del modelo (vacío = default del proveedor)."
              : "Default del proveedor si no elegís otro."}
          </p>
        </div>
      )}

      <Button onClick={save} disabled={isPending}>
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Guardar
      </Button>
    </div>
  );
}
