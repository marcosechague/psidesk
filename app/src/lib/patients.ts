/** Utilidades de paciente compartidas entre server y client. */

/** Nombre completo a partir de las partes (lo que se guarda en `fullName`). */
export function patientFullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim().replace(/\s+/g, " ");
}

/** Edad en años cumplidos a partir de la fecha de nacimiento (null si no hay). */
export function ageFromBirthDate(
  birthDate: Date | string | null | undefined,
): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Fecha como "YYYY-MM-DD" para un <input type="date"> (string vacío si no hay). */
export function toDateInputValue(
  d: Date | string | null | undefined,
): string {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
