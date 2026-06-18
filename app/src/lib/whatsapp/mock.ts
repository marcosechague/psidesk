import type { WhatsAppDriver, OutgoingMessage } from "./types";

/** Resumen legible del mensaje (texto + opciones) para el log de dev. */
function preview(message: OutgoingMessage): string {
  switch (message.kind) {
    case "buttons":
      return `${message.body}\n[botones] ${message.buttons.map((b) => b.title).join(" | ")}`;
    case "list":
      return `${message.body}\n[lista: ${message.button}] ${message.rows.map((r) => r.title).join(" | ")}`;
    case "template":
      return `[template: ${message.name} (${message.language})] ${message.bodyParams.join(" · ")}`;
    case "text":
    default:
      return message.body;
  }
}

/**
 * Driver de desarrollo: no envía nada real, solo loguea y devuelve un id falso.
 * Permite probar todo el flujo de check-ins sin una cuenta de WhatsApp.
 * Las respuestas se simulan con la action `simulateCheckinReply`.
 */
export function mockDriver(): WhatsAppDriver {
  return {
    name: "mock",
    async send(to, message) {
      console.log(`[whatsapp:mock] → ${to}\n${preview(message)}`);
      return { sent: true, providerMessageId: `mock-${to}-${Date.now()}` };
    },
  };
}
