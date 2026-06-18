import "server-only";

import {
  type AiDriver,
  type AiProviderName,
  defaultModelFor,
} from "./types";
import { mockDriver } from "./mock";
import { anthropicDriver } from "./anthropic";
import { googleDriver } from "./google";
import { openAiCompatibleDriver } from "./openai-compatible";

export type {
  AiDriver,
  AiProviderName,
  SummarizeInput,
  SummarizeResult,
  SummaryKind,
} from "./types";
export { AI_PROVIDERS, defaultModelFor } from "./types";

/**
 * Devuelve el driver de IA. La selección de proveedor/modelo viene resuelta por
 * quien llama (settings de plataforma en DB), con fallback a env y luego al
 * default del proveedor. Las CLAVES siempre se leen de env (son secretos).
 * Mismo patrón que getWhatsApp().
 */
export function getAiDriver(opts?: {
  provider?: string | null;
  model?: string | null;
}): AiDriver {
  const provider = (opts?.provider ||
    process.env.AI_PROVIDER ||
    "mock") as AiProviderName;
  const model =
    opts?.model || process.env.AI_MODEL || defaultModelFor(provider);

  switch (provider) {
    case "anthropic":
      return anthropicDriver(model);
    case "google":
      return googleDriver(model);
    case "openai":
      return openAiCompatibleDriver({
        name: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY,
        apiKeyEnv: "OPENAI_API_KEY",
        model,
      });
    case "deepseek":
      return openAiCompatibleDriver({
        name: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: process.env.DEEPSEEK_API_KEY,
        apiKeyEnv: "DEEPSEEK_API_KEY",
        model,
      });
    case "mock":
    default:
      return mockDriver();
  }
}
