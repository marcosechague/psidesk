/** Datos mínimos del profesional para mostrar su nombre. */
export interface ProfessionalNameParts {
  prefix?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /// nombre completo legacy (fallback si no hay firstName/lastName)
  name?: string | null;
}

/** Nombre completo (firstName + lastName, o `name` legacy). */
export function fullName(u: ProfessionalNameParts): string {
  const joined = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  return joined || (u.name ?? "").trim();
}

/** Nombre para los mensajes: "Lic. Marcos Echague" (o sin prefijo). */
export function professionalName(u: ProfessionalNameParts): string {
  const name = fullName(u);
  const prefix = (u.prefix ?? "").trim();
  return prefix ? `${prefix} ${name}`.trim() : name;
}
