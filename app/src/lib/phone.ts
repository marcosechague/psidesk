/** Códigos de país para el teléfono del paciente (se guarda en formato +<dial><local>). */
export interface CountryCode {
  /** ISO 3166-1 alfa-2, solo para la key */
  iso: string;
  label: string;
  flag: string;
  /** código de discado sin "+", ej "595" */
  dial: string;
  /** ejemplo de número local (cómo lo tipearía la persona) */
  placeholder: string;
}

// Paraguay primero (default). Lista acotada a la región + algunos comunes.
export const COUNTRY_CODES: CountryCode[] = [
  { iso: "PY", label: "Paraguay", flag: "🇵🇾", dial: "595", placeholder: "0981 123 456" },
  { iso: "AR", label: "Argentina", flag: "🇦🇷", dial: "54", placeholder: "011 15 5555 1234" },
  { iso: "BR", label: "Brasil", flag: "🇧🇷", dial: "55", placeholder: "11 91234 5678" },
  { iso: "UY", label: "Uruguay", flag: "🇺🇾", dial: "598", placeholder: "099 123 456" },
  { iso: "BO", label: "Bolivia", flag: "🇧🇴", dial: "591", placeholder: "7 123 4567" },
  { iso: "CL", label: "Chile", flag: "🇨🇱", dial: "56", placeholder: "9 1234 5678" },
  { iso: "PE", label: "Perú", flag: "🇵🇪", dial: "51", placeholder: "912 345 678" },
  { iso: "CO", label: "Colombia", flag: "🇨🇴", dial: "57", placeholder: "300 123 4567" },
  { iso: "MX", label: "México", flag: "🇲🇽", dial: "52", placeholder: "55 1234 5678" },
  { iso: "ES", label: "España", flag: "🇪🇸", dial: "34", placeholder: "612 345 678" },
  { iso: "US", label: "EE. UU.", flag: "🇺🇸", dial: "1", placeholder: "201 555 0123" },
];

export const DEFAULT_DIAL = "595"; // Paraguay

export function countryByDial(dial: string): CountryCode | undefined {
  return COUNTRY_CODES.find((c) => c.dial === dial);
}

/**
 * Arma el teléfono almacenado a partir del código de país y el número local.
 * Descarta todo lo que no sea dígito y los ceros a la izquierda del local
 * (ej Paraguay: "0981…" → "+595981…"). Devuelve "" si no hay número.
 */
export function composePhone(dial: string, local: string): string {
  const digits = local.replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return "";
  return `+${dial}${digits}`;
}

/**
 * Separa un teléfono almacenado en código de país + número local. Hace
 * coincidir el prefijo de discado más largo; si no matchea, asume el default.
 */
export function splitPhone(
  stored: string | null | undefined,
): { dial: string; local: string } {
  const raw = (stored ?? "").replace(/[^\d+]/g, "");
  const digits = raw.startsWith("+") ? raw.slice(1) : raw;
  if (digits) {
    const match = [...COUNTRY_CODES]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => digits.startsWith(c.dial));
    if (match) return { dial: match.dial, local: digits.slice(match.dial.length) };
  }
  return { dial: DEFAULT_DIAL, local: digits };
}
