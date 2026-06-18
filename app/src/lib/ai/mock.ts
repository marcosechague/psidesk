import type { AiDriver, SummarizeInput, SummarizeResult } from "./types";

/**
 * Driver simulado: no llama a ninguna API ni gasta créditos. Devuelve un resumen
 * armado a partir del input para poder desarrollar y testear la UX. Default en dev.
 */
export function mockDriver(): AiDriver {
  return {
    name: "mock",
    async summarize(input: SummarizeInput): Promise<SummarizeResult> {
      const obs = input.observations.trim();
      const firstLines = obs.split("\n").slice(0, 3).join(" ").slice(0, 280);
      const gist = firstLines || "lo conversado en la sesión";
      const tarea = input.assigned?.length ? input.assigned.join("; ") : null;

      // Cada kind simula su estructura real para poder ver la UX sin gastar API.
      if (input.kind === "pasos") {
        const text = [
          "**Para retomar (vos):**",
          `- Seguir trabajando sobre: ${gist}.`,
          "- Revisar cómo llegó respecto de la última sesión.",
          "",
          "**Tarea del paciente:**",
          `- ${tarea ?? "Sin tarea asignada"}`,
        ].join("\n");
        return { text, model: "mock" };
      }

      if (input.kind === "paciente") {
        const e = input.emojis ? { d: "📅 ", t: "📝 ", r: "💡 ", k: "✅ " } : { d: "", t: "", r: "", k: "" };
        const text = [
          input.date ? `${e.d}*Sesión del ${input.date}*` : "*Resumen de tu sesión*",
          `${e.t}*Temas que trabajamos:* ${gist}.`,
          `${e.r}*Recomendaciones:* seguí practicando lo que vimos y registrá cómo te sentís.`,
          ...(tarea ? [`${e.k}*Tarea:* ${tarea}`] : []),
        ].join("\n");
        return { text, model: "mock" };
      }

      const hasTemplate = Boolean(input.templateStructure?.trim());
      const hasVoice = Boolean(input.voiceRules?.length);
      const text = [
        "## Resumen (simulado)",
        "",
        `_Generado con el driver \`mock\`${hasTemplate ? " con plantilla" : ""}${hasVoice ? " y voz" : ""}. Configurá \`AI_PROVIDER\` para usar un modelo real._`,
        "",
        firstLines || "_Sin observaciones._",
        ...(input.nextSteps?.trim()
          ? ["", "**Próximos pasos:** " + input.nextSteps.trim()]
          : []),
      ].join("\n");
      return { text, model: "mock" };
    },
  };
}
