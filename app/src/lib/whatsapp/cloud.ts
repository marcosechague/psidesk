import "server-only";
import type { WhatsAppDriver, SendResult, OutgoingMessage } from "./types";

// Driver de WhatsApp vía Meta Cloud API (graph.facebook.com).
//
// Envía texto libre con POST /{phoneNumberId}/messages. OJO con la ventana de
// 24 h: Meta solo permite texto libre dentro de las 24 h posteriores al último
// mensaje del usuario. Para iniciar una conversación fuera de esa ventana hay
// que usar un *template* aprobado (todavía no implementado acá).
//
// Variables de entorno:
//   WHATSAPP_TOKEN            → access token (Bearer) del número.
//   WHATSAPP_PHONE_NUMBER_ID  → id del número emisor (no es el teléfono).
//   WHATSAPP_API_VERSION      → opcional, default "v22.0".

const DEFAULT_API_VERSION = "v22.0";

/** Meta espera el número en dígitos con código de país, sin "+" ni símbolos. */
function toRecipient(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Traduce nuestro OutgoingMessage al objeto que espera la Graph API. */
function toPayload(to: string, message: OutgoingMessage): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };
  switch (message.kind) {
    case "buttons":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: message.body },
          action: {
            buttons: message.buttons.map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title },
            })),
          },
        },
      };
    case "list":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: message.body },
          action: {
            button: message.button,
            sections: [{ title: "Opciones", rows: message.rows }],
          },
        },
      };
    case "template":
      return {
        ...base,
        type: "template",
        template: {
          name: message.name,
          language: { code: message.language },
          components: message.bodyParams.length
            ? [
                {
                  type: "body",
                  parameters: message.bodyParams.map((t) => ({ type: "text", text: t })),
                },
              ]
            : [],
        },
      };
    case "text":
    default:
      return { ...base, type: "text", text: { preview_url: false, body: message.body } };
  }
}

export function cloudDriver(): WhatsAppDriver {
  return {
    name: "cloud",
    async send(to, message): Promise<SendResult> {
      const token = process.env.WHATSAPP_TOKEN;
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!token || !phoneNumberId) {
        return {
          sent: false,
          error: "Falta WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID",
        };
      }

      const version = process.env.WHATSAPP_API_VERSION ?? DEFAULT_API_VERSION;
      const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toPayload(toRecipient(to), message)),
        });

        const data = (await res.json().catch(() => null)) as {
          messages?: { id?: string }[];
          error?: { message?: string };
        } | null;

        if (!res.ok) {
          const msg = data?.error?.message ?? `HTTP ${res.status}`;
          return { sent: false, error: msg };
        }

        return { sent: true, providerMessageId: data?.messages?.[0]?.id };
      } catch (err) {
        return {
          sent: false,
          error: err instanceof Error ? err.message : "Error de red",
        };
      }
    },
  };
}
