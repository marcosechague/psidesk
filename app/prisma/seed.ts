/**
 * Seed de los 3 tests iniciales (todos de uso libre).
 *
 * ⚠️ IMPORTANTE — TEXTOS DE ÍTEMS:
 * Los textos de abajo son PLACEHOLDERS editables. NO se incluyen los textos
 * oficiales por derechos de autor. El usuario debe pegar los textos oficiales
 * descargados de la fuente original:
 *   - PHQ-9 y GAD-7:  https://www.phqscreeners.com  (uso libre, sin permiso)
 *   - DASS-42:        http://www2.psy.unsw.edu.au/dass/  (fuente oficial Lovibond)
 *
 * Reemplazá cada "Ítem N (CODE) — pegar texto oficial" por el ítem real,
 * respetando el ORDEN (el orden define a qué subescala suma cada ítem).
 */
import { PrismaClient, type ResponseType } from "@prisma/client";
import type { ScoringConfig } from "../src/lib/scoring/types";

const prisma = new PrismaClient();

function placeholderItems(code: string, count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `Ítem ${i + 1} (${code}) — pegar texto oficial`,
  );
}

interface SeedTest {
  code: string;
  name: string;
  description: string;
  /// categorías temáticas (valores de TEST_CATEGORY_OPTIONS)
  categories: string[];
  responseType: ResponseType;
  items: string[];
  scoring: ScoringConfig;
}

// ── DASS-42 ───────────────────────────────────────────────────────────────
// Asignación de ítems por subescala y cortes según Lovibond & Lovibond (1995).
const DASS42: SeedTest = {
  code: "DASS42",
  name: "DASS-42",
  categories: ["depresion", "ansiedad", "estres"],
  description:
    "Escala de Depresión, Ansiedad y Estrés (42 ítems). 3 subescalas, frecuencia 0–3 referida a la última semana.",
  responseType: "SCALE_0_3_FREQ",
  items: placeholderItems("DASS-42", 42),
  scoring: {
    mode: "subscales",
    subscales: [
      {
        key: "depression",
        label: "Depresión",
        items: [3, 5, 10, 13, 16, 17, 21, 24, 26, 31, 34, 37, 38, 42],
        cutoffs: [
          { min: 0, max: 9, level: "normal", label: "Normal" },
          { min: 10, max: 13, level: "mild", label: "Leve" },
          { min: 14, max: 20, level: "moderate", label: "Moderado" },
          { min: 21, max: 27, level: "severe", label: "Severo" },
          { min: 28, max: 42, level: "extreme", label: "Extremadamente severo" },
        ],
      },
      {
        key: "anxiety",
        label: "Ansiedad",
        items: [2, 4, 7, 9, 15, 19, 20, 23, 25, 28, 30, 36, 40, 41],
        cutoffs: [
          { min: 0, max: 7, level: "normal", label: "Normal" },
          { min: 8, max: 9, level: "mild", label: "Leve" },
          { min: 10, max: 14, level: "moderate", label: "Moderado" },
          { min: 15, max: 19, level: "severe", label: "Severo" },
          { min: 20, max: 42, level: "extreme", label: "Extremadamente severo" },
        ],
      },
      {
        key: "stress",
        label: "Estrés",
        items: [1, 6, 8, 11, 12, 14, 18, 22, 27, 29, 32, 33, 35, 39],
        cutoffs: [
          { min: 0, max: 14, level: "normal", label: "Normal" },
          { min: 15, max: 18, level: "mild", label: "Leve" },
          { min: 19, max: 25, level: "moderate", label: "Moderado" },
          { min: 26, max: 33, level: "severe", label: "Severo" },
          { min: 34, max: 42, level: "extreme", label: "Extremadamente severo" },
        ],
      },
    ],
  },
};

// ── PHQ-9 ─────────────────────────────────────────────────────────────────
const PHQ9: SeedTest = {
  code: "PHQ9",
  name: "PHQ-9",
  categories: ["depresion"],
  description:
    "Cuestionario de salud del paciente para depresión (9 ítems). Puntaje total 0–27.",
  responseType: "SCALE_0_3",
  items: placeholderItems("PHQ-9", 9),
  scoring: {
    mode: "total",
    subscales: [
      {
        key: "total",
        label: "Depresión (total)",
        items: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        cutoffs: [
          { min: 0, max: 4, level: "minimal", label: "Mínimo" },
          { min: 5, max: 9, level: "mild", label: "Leve" },
          { min: 10, max: 14, level: "moderate", label: "Moderado" },
          { min: 15, max: 19, level: "moderate_severe", label: "Moderado-severo" },
          { min: 20, max: 27, level: "severe", label: "Severo" },
        ],
      },
    ],
  },
};

// ── GAD-7 ─────────────────────────────────────────────────────────────────
const GAD7: SeedTest = {
  code: "GAD7",
  name: "GAD-7",
  categories: ["ansiedad"],
  description: "Escala de ansiedad generalizada (7 ítems). Puntaje total 0–21.",
  responseType: "SCALE_0_3",
  items: placeholderItems("GAD-7", 7),
  scoring: {
    mode: "total",
    subscales: [
      {
        key: "total",
        label: "Ansiedad (total)",
        items: [1, 2, 3, 4, 5, 6, 7],
        cutoffs: [
          { min: 0, max: 4, level: "minimal", label: "Mínimo" },
          { min: 5, max: 9, level: "mild", label: "Leve" },
          { min: 10, max: 14, level: "moderate", label: "Moderado" },
          { min: 15, max: 21, level: "severe", label: "Severo" },
        ],
      },
    ],
  },
};

// ── DASS-21 ───────────────────────────────────────────────────────────────
// Versión breve: 7 ítems por subescala; el crudo se multiplica ×2 para usar
// los mismos cortes que DASS-42 (Lovibond & Lovibond, 1995).
const DASS21: SeedTest = {
  code: "DASS21",
  name: "DASS-21",
  categories: ["depresion", "ansiedad", "estres"],
  description:
    "Escala breve de Depresión, Ansiedad y Estrés (21 ítems). 3 subescalas; frecuencia 0–3 (última semana). El crudo de cada subescala se multiplica ×2.",
  responseType: "SCALE_0_3_FREQ",
  items: placeholderItems("DASS-21", 21),
  scoring: {
    mode: "subscales",
    subscales: [
      {
        key: "depression",
        label: "Depresión",
        items: [3, 5, 10, 13, 16, 17, 21],
        multiplier: 2,
        cutoffs: [
          { min: 0, max: 9, level: "normal", label: "Normal" },
          { min: 10, max: 13, level: "mild", label: "Leve" },
          { min: 14, max: 20, level: "moderate", label: "Moderado" },
          { min: 21, max: 27, level: "severe", label: "Severo" },
          { min: 28, max: 42, level: "extreme", label: "Extremadamente severo" },
        ],
      },
      {
        key: "anxiety",
        label: "Ansiedad",
        items: [2, 4, 7, 9, 15, 19, 20],
        multiplier: 2,
        cutoffs: [
          { min: 0, max: 7, level: "normal", label: "Normal" },
          { min: 8, max: 9, level: "mild", label: "Leve" },
          { min: 10, max: 14, level: "moderate", label: "Moderado" },
          { min: 15, max: 19, level: "severe", label: "Severo" },
          { min: 20, max: 42, level: "extreme", label: "Extremadamente severo" },
        ],
      },
      {
        key: "stress",
        label: "Estrés",
        items: [1, 6, 8, 11, 12, 14, 18],
        multiplier: 2,
        cutoffs: [
          { min: 0, max: 14, level: "normal", label: "Normal" },
          { min: 15, max: 18, level: "mild", label: "Leve" },
          { min: 19, max: 25, level: "moderate", label: "Moderado" },
          { min: 26, max: 33, level: "severe", label: "Severo" },
          { min: 34, max: 42, level: "extreme", label: "Extremadamente severo" },
        ],
      },
    ],
  },
};

// ── Rosenberg (autoestima) ──────────────────────────────────────────────────
// 10 ítems, nivel de acuerdo 0–3. Cinco ítems puntúan invertido.
// ⚠️ reverseItems asume el ORDEN clásico (ítems 2,5,6,8,9 redactados en negativo).
// Al pegar los textos oficiales, verificá que los ítems negativos coincidan.
const ROSENBERG: SeedTest = {
  code: "ROSENBERG",
  name: "Escala de Autoestima de Rosenberg",
  categories: ["autoestima"],
  description:
    "Autoestima global (10 ítems, nivel de acuerdo 0–3). Cinco ítems con puntaje invertido. Puntaje total 0–30.",
  responseType: "SCALE_AGREE_4",
  items: placeholderItems("Rosenberg", 10),
  scoring: {
    mode: "total",
    subscales: [
      {
        key: "total",
        label: "Autoestima (total)",
        items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        reverseItems: [2, 5, 6, 8, 9],
        cutoffs: [
          { min: 0, max: 14, level: "low", label: "Autoestima baja", tone: "high" },
          { min: 15, max: 25, level: "normal", label: "Autoestima media", tone: "mid" },
          { min: 26, max: 30, level: "high", label: "Autoestima alta", tone: "ok" },
        ],
      },
    ],
  },
};

const TESTS: SeedTest[] = [DASS42, DASS21, PHQ9, GAD7, ROSENBERG];

// ── Plantillas de estructura del resumen (NoteTemplate del sistema) ──────────
// `structure` se inyecta como guía de secciones en el prompt del resumen.
type SeedTemplate = {
  code: string;
  name: string;
  description: string;
  structure: string;
  isDefault?: boolean;
};

const TEMPLATES: SeedTemplate[] = [
  {
    code: "narrativo",
    name: "Narrativo",
    description: "Resumen en prosa, con temas en viñetas. Versátil para cualquier sesión.",
    isDefault: true,
    structure:
      "Escribí el resumen en PROSA clara, con un título **Resumen** y, si aplica, una sección **Temas de la sesión** en viñetas. Mantené el hilo de lo trabajado.",
  },
  {
    code: "soap",
    name: "SOAP",
    description: "Subjetivo, Objetivo, Análisis, Plan. Formato clínico estándar.",
    structure:
      "Organizá el resumen en secciones **S (Subjetivo)**, **O (Objetivo)**, **A (Análisis)**, **P (Plan)**. Solo lo que se desprenda de las notas; no inventes datos.",
  },
  {
    code: "dap",
    name: "DAP",
    description: "Datos, Análisis, Plan. Más compacto que SOAP.",
    structure:
      "Organizá el resumen en secciones **D (Datos)**, **A (Análisis)**, **P (Plan)**. Solo lo que se desprenda de las notas.",
  },
  {
    code: "primera-sesion",
    name: "Primera sesión / Admisión",
    description: "Para la entrevista inicial: motivo, antecedentes, impresión y plan.",
    structure:
      "Estructurá la admisión con estas secciones (omití la que no tenga datos): **Motivo de consulta**, **Antecedentes relevantes**, **Observación / estado actual**, **Impresión diagnóstica preliminar** (con cautela, solo si las notas lo sostienen) y **Plan inicial**. Solo lo que se desprenda de las notas; no inventes.",
  },
  {
    code: "tcc",
    name: "TCC (cognitivo-conductual)",
    description: "Situación, pensamientos, emoción, conducta, intervención y tarea.",
    structure:
      "Organizá el resumen con enfoque TCC: **Situación / disparador**, **Pensamientos automáticos**, **Emociones** (con intensidad si aparece), **Conductas**, **Intervención realizada** y **Tarea / práctica acordada**. Solo lo que se desprenda de las notas.",
  },
];

// ── Voces / estilos de redacción (WritingVoice del sistema) ──────────────────
type SeedVoice = {
  code: string;
  name: string;
  description: string;
  rules: string[];
  isDefault?: boolean;
};

const VOICES: SeedVoice[] = [
  {
    code: "detallado",
    name: "Detallado",
    description: "Nivel de detalle medio, con viñetas claras.",
    isDefault: true,
    rules: [
      "Usá un nivel de detalle medio: desarrollá cada sección en 2 a 4 oraciones o viñetas.",
      "Organizá con viñetas claras cuando ayuden a la lectura.",
      "Lenguaje profesional y concreto, sin relleno.",
    ],
  },
  {
    code: "breve",
    name: "Breve",
    description: "Lo más conciso posible, una idea por viñeta.",
    rules: [
      "Sé lo más conciso posible: viñetas cortas, una idea por viñeta.",
      "Oraciones directas, sin palabras de relleno ni modificadores innecesarios.",
      "Priorizá lo esencial; omití lo accesorio.",
    ],
  },
  {
    code: "clinico-neutro",
    name: "Clínico neutro",
    description: "Tono sobrio; se refiere a 'el/la paciente', sin nombre propio.",
    rules: [
      "Referite a la persona como 'el/la paciente'; no uses su nombre propio.",
      "Tono clínico, sobrio y objetivo.",
      "Evitá juicios de valor; describí lo observado.",
    ],
  },
];

async function main() {
  for (const t of TESTS) {
    await prisma.test.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        description: t.description,
        categories: t.categories,
        responseType: t.responseType,
        isSystem: true,
        itemsJson: t.items,
        scoringJson: t.scoring as unknown as object,
      },
      create: {
        code: t.code,
        name: t.name,
        description: t.description,
        categories: t.categories,
        responseType: t.responseType,
        isSystem: true,
        itemsJson: t.items,
        scoringJson: t.scoring as unknown as object,
      },
    });
    console.log(`✓ Test ${t.code} (${t.items.length} ítems) cargado.`);
  }

  for (const tpl of TEMPLATES) {
    await prisma.noteTemplate.upsert({
      where: { code: tpl.code },
      update: {
        name: tpl.name,
        description: tpl.description,
        structure: tpl.structure,
        isSystem: true,
        isDefault: tpl.isDefault ?? false,
      },
      create: {
        code: tpl.code,
        name: tpl.name,
        description: tpl.description,
        structure: tpl.structure,
        isSystem: true,
        isDefault: tpl.isDefault ?? false,
      },
    });
    console.log(`✓ Plantilla ${tpl.code} cargada.`);
  }

  for (const v of VOICES) {
    await prisma.writingVoice.upsert({
      where: { code: v.code },
      update: {
        name: v.name,
        description: v.description,
        rulesJson: v.rules,
        isSystem: true,
        isDefault: v.isDefault ?? false,
      },
      create: {
        code: v.code,
        name: v.name,
        description: v.description,
        rulesJson: v.rules,
        isSystem: true,
        isDefault: v.isDefault ?? false,
      },
    });
    console.log(`✓ Voz ${v.code} cargada.`);
  }

  console.log("Seed completo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
