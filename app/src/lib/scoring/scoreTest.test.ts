import { describe, it, expect } from "vitest";
import { scoreTest } from "./scoreTest";
import type { ScorableTest, Answers } from "./types";

// Config reducida de DASS-42 (2 ítems por subescala) para testear subescalas.
const dassLike: ScorableTest = {
  responseType: "SCALE_0_3_FREQ",
  scoring: {
    mode: "subscales",
    subscales: [
      {
        key: "depression",
        label: "Depresión",
        items: [1, 2],
        cutoffs: [
          { min: 0, max: 2, level: "normal", label: "Normal" },
          { min: 3, max: 4, level: "mild", label: "Leve" },
          { min: 5, max: 6, level: "severe", label: "Severo" },
        ],
      },
      {
        key: "anxiety",
        label: "Ansiedad",
        items: [3, 4],
        cutoffs: [
          { min: 0, max: 2, level: "normal", label: "Normal" },
          { min: 3, max: 6, level: "high", label: "Alto" },
        ],
      },
    ],
  },
};

// Config tipo PHQ-9 (puntaje total).
const totalLike: ScorableTest = {
  responseType: "SCALE_0_3",
  scoring: {
    mode: "total",
    subscales: [
      {
        key: "total",
        label: "Total",
        items: [1, 2, 3],
        cutoffs: [
          { min: 0, max: 2, level: "minimal", label: "Mínimo" },
          { min: 3, max: 5, level: "moderate", label: "Moderado" },
          { min: 6, max: 9, level: "severe", label: "Severo" },
        ],
      },
    ],
  },
};

describe("scoreTest", () => {
  it("suma cada subescala con sus propios ítems", () => {
    const answers: Answers = { 1: 3, 2: 2, 3: 1, 4: 0 };
    const res = scoreTest(dassLike, answers);
    const dep = res.scores.find((s) => s.key === "depression")!;
    const anx = res.scores.find((s) => s.key === "anxiety")!;
    expect(dep.raw).toBe(5);
    expect(dep.levelLabel).toBe("Severo");
    expect(anx.raw).toBe(1);
    expect(anx.levelLabel).toBe("Normal");
  });

  it("calcula el máximo posible según responseType", () => {
    const res = scoreTest(dassLike, {});
    // 2 ítems * max 3 por ítem = 6
    expect(res.scores[0].max).toBe(6);
  });

  it("respeta los límites de los cortes (boundaries)", () => {
    expect(scoreTest(totalLike, { 1: 0, 2: 1, 3: 1 }).scores[0].levelLabel).toBe(
      "Mínimo",
    ); // raw 2 -> último del rango 0-2
    expect(scoreTest(totalLike, { 1: 1, 2: 1, 3: 1 }).scores[0].levelLabel).toBe(
      "Moderado",
    ); // raw 3 -> primer valor del siguiente rango
  });

  it("trata ítems faltantes como 0", () => {
    const res = scoreTest(totalLike, { 1: 2 });
    expect(res.scores[0].raw).toBe(2);
    expect(res.scores[0].levelLabel).toBe("Mínimo");
  });

  it("acepta claves de ítem como string o número", () => {
    const res = scoreTest(totalLike, { "1": 3, "2": 3, "3": 3 });
    expect(res.scores[0].raw).toBe(9);
    expect(res.scores[0].levelLabel).toBe("Severo");
  });

  it("calcula puntaje BOOLEAN con max 1 por ítem", () => {
    const boolTest: ScorableTest = {
      responseType: "BOOLEAN",
      scoring: {
        mode: "total",
        subscales: [
          {
            key: "total",
            label: "Total",
            items: [1, 2, 3, 4],
            cutoffs: [
              { min: 0, max: 1, level: "low", label: "Bajo" },
              { min: 2, max: 4, level: "high", label: "Alto" },
            ],
          },
        ],
      },
    };
    const res = scoreTest(boolTest, { 1: 1, 2: 1, 3: 0, 4: 1 });
    expect(res.scores[0].raw).toBe(3);
    expect(res.scores[0].max).toBe(4);
    expect(res.scores[0].levelLabel).toBe("Alto");
  });

  it("aplica el multiplicador al crudo y al máximo (DASS-21)", () => {
    const test: ScorableTest = {
      responseType: "SCALE_0_3_FREQ",
      scoring: {
        mode: "subscales",
        subscales: [
          {
            key: "stress",
            label: "Estrés",
            items: [1, 2, 3],
            multiplier: 2,
            cutoffs: [
              { min: 0, max: 5, level: "normal", label: "Normal" },
              { min: 6, max: 18, level: "high", label: "Alto" },
            ],
          },
        ],
      },
    };
    const res = scoreTest(test, { 1: 1, 2: 1, 3: 1 }); // 3 * 2 = 6
    expect(res.scores[0].raw).toBe(6);
    expect(res.scores[0].max).toBe(18); // 3 ítems * 3 * 2
    expect(res.scores[0].levelLabel).toBe("Alto");
  });

  it("invierte ítems marcados y respeta el tono del corte (Rosenberg)", () => {
    const test: ScorableTest = {
      responseType: "SCALE_AGREE_4",
      scoring: {
        mode: "total",
        subscales: [
          {
            key: "total",
            label: "Autoestima",
            items: [1, 2, 3, 4],
            reverseItems: [2, 4],
            cutoffs: [
              { min: 0, max: 5, level: "low", label: "Baja", tone: "high" },
              { min: 6, max: 12, level: "high", label: "Alta", tone: "ok" },
            ],
          },
        ],
      },
    };
    // 1:3, 2:0(→3), 3:3, 4:0(→3) = 12
    const res = scoreTest(test, { 1: 3, 2: 0, 3: 3, 4: 0 });
    expect(res.scores[0].raw).toBe(12);
    expect(res.scores[0].levelLabel).toBe("Alta");
    expect(res.scores[0].tone).toBe("ok");
  });

  it("usa el máximo por ítem (itemMax) en tests con opciones propias", () => {
    const custom: ScorableTest = {
      // responseType es solo el fallback; itemMax tiene prioridad.
      responseType: "BOOLEAN",
      itemMax: { 1: 5, 2: 5, 3: 2 },
      scoring: {
        mode: "total",
        subscales: [
          {
            key: "total",
            label: "Total",
            items: [1, 2, 3],
            cutoffs: [
              { min: 0, max: 6, level: "low", label: "Bajo" },
              { min: 7, max: 12, level: "high", label: "Alto" },
            ],
          },
        ],
      },
    };
    const res = scoreTest(custom, { 1: 5, 2: 5, 3: 2 });
    expect(res.scores[0].raw).toBe(12);
    expect(res.scores[0].max).toBe(12); // 5 + 5 + 2
    expect(res.scores[0].levelLabel).toBe("Alto");
  });

  it("invierte ítems usando el máximo propio de cada ítem", () => {
    const custom: ScorableTest = {
      responseType: "BOOLEAN",
      itemMax: { 1: 4, 2: 4 },
      scoring: {
        mode: "total",
        subscales: [
          {
            key: "total",
            label: "Total",
            items: [1, 2],
            reverseItems: [2],
            cutoffs: [{ min: 0, max: 8, level: "x", label: "X" }],
          },
        ],
      },
    };
    // 1:1 (=1) + 2:1 invertido (4-1=3) = 4
    const res = scoreTest(custom, { 1: 1, 2: 1 });
    expect(res.scores[0].raw).toBe(4);
    expect(res.scores[0].max).toBe(8);
  });
});
