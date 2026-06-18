export interface SendResult {
  sent: boolean;
  providerMessageId?: string;
  error?: string;
}

/** Botón de respuesta rápida (WhatsApp: máx 3 por mensaje, título ≤ 20 chars). */
export interface OutgoingButton {
  id: string;
  title: string;
}

/** Fila de una lista interactiva (WhatsApp: máx 10 filas, título ≤ 24 chars). */
export interface OutgoingRow {
  id: string;
  title: string;
  description?: string;
}

/**
 * Mensaje a enviar.
 * - `text`/`buttons`/`list`: mensajes de sesión, SOLO se entregan dentro de la
 *   ventana de 24 h (texto plano o interactivos donde el paciente toca).
 * - `template`: mensaje de plantilla pre-aprobada por Meta; es el único que se
 *   puede iniciar fuera de la ventana (ej. los check-ins programados del cron).
 *   `bodyParams` son las variables {{1}}, {{2}}… del cuerpo (sin saltos de línea).
 */
export type OutgoingMessage =
  | { kind: "text"; body: string }
  | { kind: "buttons"; body: string; buttons: OutgoingButton[] }
  | { kind: "list"; body: string; button: string; rows: OutgoingRow[] }
  | { kind: "template"; name: string; language: string; bodyParams: string[] };

/** Driver de envío de WhatsApp. Intercambiable: mock (dev) | cloud | twilio. */
export interface WhatsAppDriver {
  name: WhatsAppDriverName;
  /** envía `message` al teléfono `to` (con código de país, ej "+54911..."). */
  send(to: string, message: OutgoingMessage): Promise<SendResult>;
}

export type WhatsAppDriverName = "mock" | "cloud" | "twilio";
