import "server-only";

import type {
  AiDriver,
  AiProviderName,
  SummarizeInput,
  SummarizeResult,
} from "./types";
import { buildSystem, buildSummaryUserPrompt } from "./prompt";

/**
 * Driver para APIs compatibles con OpenAI Chat Completions (OpenAI y DeepSeek
 * comparten exactamente esta forma). Vía fetch, sin SDK. PREPARADO: probado solo
 * con la forma estándar; al activar un proveedor, validá con una llamada real.
 */
export function openAiCompatibleDriver(opts: {
  name: AiProviderName;
  baseUrl: string;
  apiKey: string | undefined;
  apiKeyEnv: string;
  model: string;
}): AiDriver {
  const { name, baseUrl, apiKey, apiKeyEnv, model } = opts;
  return {
    name,
    async summarize(input: SummarizeInput): Promise<SummarizeResult> {
      if (!apiKey) return { text: "", model, error: `Falta ${apiKeyEnv}` };
      try {
        const body: Record<string, unknown> = {
          model,
          max_tokens: 1500,
          messages: [
            { role: "system", content: buildSystem(input.kind, input.voiceRules) },
            { role: "user", content: buildSummaryUserPrompt(input) },
          ],
        };
        // DeepSeek V4 razona por defecto (thinking mode); para resúmenes no hace
        // falta y es más lento/caro, así que lo desactivamos. Los alias legacy
        // (deepseek-chat/reasoner) no aceptan este parámetro, los dejamos como están.
        if (name === "deepseek" && model.startsWith("deepseek-v4")) {
          body.thinking = { type: "disabled" };
        }
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => null)) as {
          choices?: { message?: { content?: string } }[];
          error?: { message?: string };
        } | null;
        if (!res.ok) {
          return {
            text: "",
            model,
            error: data?.error?.message ?? `HTTP ${res.status}`,
          };
        }
        const text = (data?.choices?.[0]?.message?.content ?? "").trim();
        if (!text) return { text: "", model, error: "Respuesta vacía del modelo" };
        return { text, model };
      } catch (err) {
        return {
          text: "",
          model,
          error: err instanceof Error ? err.message : "Error de red",
        };
      }
    },
  };
}
