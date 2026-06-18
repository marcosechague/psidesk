import { randomBytes } from "node:crypto";

/**
 * Token aleatorio para el link público del paciente.
 * 24 bytes en base64url ≈ 192 bits de entropía: imposible de adivinar.
 */
export function generatePublicToken(): string {
  return randomBytes(24).toString("base64url");
}
