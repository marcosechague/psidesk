import { recordReplyForPhone, sendOptionsForPhone } from "@/server/checkins";

// Webhook de WhatsApp para recibir lo que mandan los pacientes.
//
// GET  → verificación de Meta Cloud API (devuelve hub.challenge).
// POST → mensaje entrante. Acepta el formato de Meta Cloud API y también un
//        formato simple para pruebas ({ from, text } o { from, button }).
//
// Dos intenciones:
//  - "trigger": el paciente tocó el botón "Responder" del template (flujo
//    híbrido) → le mandamos el mensaje interactivo con las opciones.
//  - "answer": una respuesta (texto, o toque de botón/lista) → se registra.

/** Texto/payload del botón quick-reply del template que dispara el interactivo. */
const RESPOND_TRIGGER = "Responder";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

type Incoming =
  | { from: string; intent: "trigger" }
  | { from: string; intent: "answer"; text: string };

/** Clasifica un payload de Meta Cloud API o el formato simple de pruebas. */
function parseIncoming(body: unknown): Incoming | null {
  const b = body as Record<string, unknown>;
  // Formato simple para pruebas.
  if (typeof b?.from === "string") {
    if (typeof b?.button === "string") {
      return b.button === RESPOND_TRIGGER
        ? { from: b.from, intent: "trigger" }
        : { from: b.from, intent: "answer", text: b.button };
    }
    if (typeof b?.text === "string") {
      return { from: b.from, intent: "answer", text: b.text };
    }
  }
  // Meta Cloud API: entry[].changes[].value.messages[]
  try {
    const entry = (b?.entry as unknown[])?.[0] as Record<string, unknown>;
    const change = (entry?.changes as unknown[])?.[0] as Record<string, unknown>;
    const value = change?.value as Record<string, unknown>;
    const msg = (value?.messages as unknown[])?.[0] as Record<string, unknown>;
    const from = msg?.from as string | undefined;
    if (!from) return null;

    // Botón quick-reply del template ("Responder") → disparador.
    const button = msg?.button as Record<string, unknown> | undefined;
    const buttonText = (button?.payload ?? button?.text) as string | undefined;
    if (buttonText === RESPOND_TRIGGER) return { from, intent: "trigger" };

    // Cualquier otra cosa (texto o toque de opción interactiva) → respuesta.
    const text = answerTextOf(msg);
    if (text) return { from, intent: "answer", text };
  } catch {
    // payload no reconocido
  }
  return null;
}

/**
 * Texto a interpretar de una respuesta. Para toques de botón/lista interactivos
 * devuelve el `id` elegido (que armamos en buildMessage para que parseReply lo
 * entienda, ej "si" / "7"); para texto, el cuerpo escrito.
 */
function answerTextOf(msg: Record<string, unknown>): string | undefined {
  const interactive = msg?.interactive as Record<string, unknown> | undefined;
  if (interactive) {
    const buttonReply = interactive.button_reply as Record<string, unknown> | undefined;
    const listReply = interactive.list_reply as Record<string, unknown> | undefined;
    const id = (buttonReply?.id ?? listReply?.id) as string | undefined;
    if (id) return id;
  }
  return (msg?.text as Record<string, unknown>)?.body as string | undefined;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const incoming = parseIncoming(body);
  // Siempre 200 para que el proveedor no reintente; informamos en el cuerpo.
  if (!incoming) return Response.json({ ok: true, handled: false });

  const res =
    incoming.intent === "trigger"
      ? await sendOptionsForPhone(incoming.from)
      : await recordReplyForPhone(incoming.from, incoming.text);
  return Response.json({ ok: true, handled: res.ok });
}
