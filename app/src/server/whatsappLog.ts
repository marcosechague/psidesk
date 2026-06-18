import "server-only";
import { prisma } from "@/lib/db";
import type { WhatsAppMessageType } from "@prisma/client";

/**
 * Registra un envío EXITOSO de WhatsApp. Fuente única para medir consumo
 * (proxy de costo Meta) y mostrarlo por tipo. Solo se llama cuando el envío
 * salió bien (un fallo no abre conversación ni se factura).
 */
export async function logWhatsAppSent(input: {
  userId: string;
  patientId?: string | null;
  type: WhatsAppMessageType;
  sentAt: Date;
  providerMessageId?: string;
  sessionId?: string;
  checkinEntryId?: string;
}): Promise<void> {
  await prisma.whatsAppMessage.create({
    data: {
      userId: input.userId,
      patientId: input.patientId ?? null,
      type: input.type,
      sentAt: input.sentAt,
      providerMessageId: input.providerMessageId,
      sessionId: input.sessionId,
      checkinEntryId: input.checkinEntryId,
    },
  });
}
