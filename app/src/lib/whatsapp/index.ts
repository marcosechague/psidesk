import "server-only";
import type { WhatsAppDriver, WhatsAppDriverName } from "./types";
import { mockDriver } from "./mock";
import { cloudDriver } from "./cloud";

/**
 * Devuelve el driver de WhatsApp según WHATSAPP_DRIVER (default "mock").
 * Los drivers reales (cloud/twilio) se enchufan acá cuando haya cuenta;
 * mientras tanto, cualquier valor cae al mock para no romper el flujo.
 */
export function getWhatsApp(): WhatsAppDriver {
  const name = (process.env.WHATSAPP_DRIVER as WhatsAppDriverName) ?? "mock";
  switch (name) {
    case "cloud":
      return cloudDriver();
    // case "twilio": return twilioDriver();
    case "mock":
    default:
      return mockDriver();
  }
}

export type { WhatsAppDriver, WhatsAppDriverName, SendResult } from "./types";
