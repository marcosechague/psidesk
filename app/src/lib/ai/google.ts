import "server-only";

import type { AiDriver, SummarizeInput, SummarizeResult } from "./types";
import { buildSystem, buildSummaryUserPrompt } from "./prompt";

const DEFAULT_MODEL = "gemini-2.0-flash";

/**
 * Driver Google Gemini (generativelanguage API, vía fetch). PREPARADO: estructura
 * estándar de la API; al activarlo, validá con una llamada real y la key.
 */
export function googleDriver(model: string = DEFAULT_MODEL): AiDriver {
  return {
    name: "google",
    async summarize(input: SummarizeInput): Promise<SummarizeResult> {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) return { text: "", model, error: "Falta GOOGLE_API_KEY" };
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: buildSystem(input.kind, input.voiceRules) }] },
            contents: [
              { role: "user", parts: [{ text: buildSummaryUserPrompt(input) }] },
            ],
            generationConfig: { maxOutputTokens: 1500 },
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          error?: { message?: string };
        } | null;
        if (!res.ok) {
          return {
            text: "",
            model,
            error: data?.error?.message ?? `HTTP ${res.status}`,
          };
        }
        const text = (data?.candidates?.[0]?.content?.parts ?? [])
          .map((p) => p.text ?? "")
          .join("")
          .trim();
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
