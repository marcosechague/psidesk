/**
 * Catálogo curado de códigos CIE-10 (CIE/ICD-10) de salud mental, los más
 * frecuentes en consulta psicológica. NO es la lista completa: es para elegir
 * rápido; el formulario permite cargar cualquier otro código a mano.
 * Etiquetas en español. Paraguay usa CIE-10 como estándar oficial.
 */
export interface DiagnosisCode {
  code: string;
  label: string;
}

export const CIE10_MENTAL_HEALTH: DiagnosisCode[] = [
  // Depresivos
  { code: "F32.0", label: "Episodio depresivo leve" },
  { code: "F32.1", label: "Episodio depresivo moderado" },
  { code: "F32.2", label: "Episodio depresivo grave sin síntomas psicóticos" },
  { code: "F32.9", label: "Episodio depresivo sin especificar" },
  { code: "F33.1", label: "Trastorno depresivo recurrente, moderado" },
  { code: "F34.1", label: "Distimia" },
  // Ansiedad / estrés
  { code: "F40.0", label: "Agorafobia" },
  { code: "F40.1", label: "Fobia social" },
  { code: "F41.0", label: "Trastorno de pánico" },
  { code: "F41.1", label: "Trastorno de ansiedad generalizada" },
  { code: "F41.2", label: "Trastorno mixto ansioso-depresivo" },
  { code: "F42.9", label: "Trastorno obsesivo-compulsivo" },
  { code: "F43.0", label: "Reacción a estrés agudo" },
  { code: "F43.1", label: "Trastorno de estrés postraumático (TEPT)" },
  { code: "F43.2", label: "Trastornos de adaptación" },
  // Somatomorfos / sueño / alimentación
  { code: "F45.9", label: "Trastorno somatomorfo sin especificar" },
  { code: "F51.0", label: "Insomnio no orgánico" },
  { code: "F50.0", label: "Anorexia nerviosa" },
  { code: "F50.2", label: "Bulimia nerviosa" },
  // Otros frecuentes
  { code: "F31.9", label: "Trastorno afectivo bipolar sin especificar" },
  { code: "F60.3", label: "Trastorno de inestabilidad emocional de la personalidad" },
  { code: "F90.0", label: "Trastorno de la actividad y la atención (TDAH)" },
  { code: "F10.2", label: "Síndrome de dependencia del alcohol" },
  { code: "F93.0", label: "Trastorno de ansiedad de separación en la infancia" },
  // Factores que influyen (Z): contexto, no trastorno
  { code: "Z63.0", label: "Problemas en la relación con cónyuge o pareja" },
  { code: "Z63.8", label: "Otros problemas familiares especificados" },
  { code: "Z56.9", label: "Problemas relacionados con el empleo" },
  { code: "Z73.0", label: "Agotamiento (burnout)" },
  { code: "Z73.3", label: "Estrés no clasificado en otra parte" },
];

/** Formato CIE-10: letra + 2 dígitos, opcional ".d" o ".dd". Ej "F41.1", "Z63.0". */
export const CIE10_CODE_REGEX = /^[A-Z]\d{2}(\.\d{1,2})?$/;

/** Filtra el catálogo por código o etiqueta (case-insensitive). */
export function searchDiagnoses(query: string): DiagnosisCode[] {
  const q = query.trim().toLowerCase();
  if (!q) return CIE10_MENTAL_HEALTH;
  return CIE10_MENTAL_HEALTH.filter(
    (d) =>
      d.code.toLowerCase().includes(q) || d.label.toLowerCase().includes(q),
  );
}
