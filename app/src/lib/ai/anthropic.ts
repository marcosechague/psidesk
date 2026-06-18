import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { AiDriver, SummarizeInput, SummarizeResult } from "./types";
import { buildSystem, buildSummaryUserPrompt } from "./prompt";

const DEFAULT_MODEL = "claude-sonnet-4-6";

/** Driver Claude (Anthropic). La clave (ANTHROPIC_API_KEY) se lee de env. */
export function anthropicDriver(model: string = DEFAULT_MODEL): AiDriver {
  return {
    name: "anthropic",
    async summarize(input: SummarizeInput): Promise<SummarizeResult> {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return { text: "", model, error: "Falta ANTHROPIC_API_KEY" };

      try {
        const client = new Anthropic({ apiKey });
        const res = await client.messages.create({
          model,
          max_tokens: 1500,
          system: buildSystem(input.kind, input.voiceRules),
          messages: [{ role: "user", content: buildSummaryUserPrompt(input) }],
        });
        const text = res.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();
        if (!text) return { text: "", model, error: "Respuesta vacía del modelo" };
        return { text, model: res.model };
      } catch (err) {
        return {
          text: "",
          model,
          error: err instanceof Error ? err.message : "Error al generar el resumen",
        };
      }
    },
  };
}
