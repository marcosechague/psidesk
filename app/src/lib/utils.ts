import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// NBSP (0x00A0) y narrow NBSP (0x202F): espacios "especiales" que inserta el
// formateo de fecha/hora (toLocale*), p. ej. antes de "a. m." en es-AR.
const ICU_SPECIAL_SPACES = new RegExp("[" + String.fromCharCode(0x00a0, 0x202f) + "]", "g")

/**
 * Normaliza esos espacios a un espacio comun. El ICU de Node (servidor) y el del
 * navegador usan versiones distintas, asi que el texto SSR no coincide con el del
 * cliente y React tira un error de hidratacion. Normalizando, ambos coinciden.
 */
export function fixIcuSpaces(s: string): string {
  return s.replace(ICU_SPECIAL_SPACES, " ")
}
