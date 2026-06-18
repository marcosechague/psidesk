import { describe, it, expect } from "vitest";
import {
  isDueOn,
  dueDatesBetween,
  parseReply,
  formatQuestion,
  formatQuestionLine,
  buildMessage,
  ackMessage,
  describeValue,
  localDateInTz,
  zonedInstant,
  type DuePlan,
} from "./checkins";

const base: Omit<DuePlan, "frequency"> = {
  everyNDays: null,
  weekdays: [],
  // fechas-calendario guardadas como medianoche UTC
  startDate: new Date("2026-06-01T00:00:00.000Z"),
  endDate: new Date("2026-06-30T00:00:00.000Z"),
};

describe("dueDatesBetween", () => {
  it("DAILY: una fecha por día del rango (inclusive)", () => {
    const dates = dueDatesBetween({ ...base, frequency: "DAILY" });
    expect(dates).toHaveLength(30); // 1 al 30 de junio
    expect(dates[0]).toEqual({ year: 2026, month: 6, day: 1 });
    expect(dates[29]).toEqual({ year: 2026, month: 6, day: 30 });
  });
  it("EVERY_N_DAYS=3: solo los días que tocan", () => {
    const dates = dueDatesBetween({ ...base, frequency: "EVERY_N_DAYS", everyNDays: 3 });
    expect(dates).toHaveLength(10); // 1,4,7,...,28
    expect(dates.map((d) => d.day)).toEqual([1, 4, 7, 10, 13, 16, 19, 22, 25, 28]);
  });
  it("rango inválido (fin antes de inicio) → vacío", () => {
    const dates = dueDatesBetween({
      ...base,
      frequency: "DAILY",
      startDate: new Date("2026-06-30T00:00:00.000Z"),
      endDate: new Date("2026-06-01T00:00:00.000Z"),
    });
    expect(dates).toHaveLength(0);
  });
});

describe("isDueOn", () => {
  it("DAILY: toca todos los días dentro del rango", () => {
    const plan: DuePlan = { ...base, frequency: "DAILY" };
    expect(isDueOn(plan, { year: 2026, month: 6, day: 1 })).toBe(true);
    expect(isDueOn(plan, { year: 2026, month: 6, day: 15 })).toBe(true);
    expect(isDueOn(plan, { year: 2026, month: 6, day: 30 })).toBe(true);
  });

  it("respeta el rango de fechas", () => {
    const plan: DuePlan = { ...base, frequency: "DAILY" };
    expect(isDueOn(plan, { year: 2026, month: 5, day: 31 })).toBe(false);
    expect(isDueOn(plan, { year: 2026, month: 7, day: 1 })).toBe(false);
  });

  it("EVERY_N_DAYS: cada 3 días desde el inicio", () => {
    const plan: DuePlan = { ...base, frequency: "EVERY_N_DAYS", everyNDays: 3 };
    expect(isDueOn(plan, { year: 2026, month: 6, day: 1 })).toBe(true); // día 0
    expect(isDueOn(plan, { year: 2026, month: 6, day: 2 })).toBe(false);
    expect(isDueOn(plan, { year: 2026, month: 6, day: 4 })).toBe(true); // día 3
  });

  it("WEEKDAYS: solo los días marcados", () => {
    // 2026-06-01 es lunes (1). Marcamos lun(1) y mié(3).
    const plan: DuePlan = { ...base, frequency: "WEEKDAYS", weekdays: [1, 3] };
    expect(isDueOn(plan, { year: 2026, month: 6, day: 1 })).toBe(true); // lun
    expect(isDueOn(plan, { year: 2026, month: 6, day: 2 })).toBe(false); // mar
    expect(isDueOn(plan, { year: 2026, month: 6, day: 3 })).toBe(true); // mié
  });
});

describe("parseReply", () => {
  it("escala 1-10 acepta números válidos y rechaza el resto", () => {
    expect(parseReply("SCALE_1_10", "7")).toEqual({ ok: true, value: 7 });
    expect(parseReply("SCALE_1_10", "hoy estuve en 9")).toEqual({ ok: true, value: 9 });
    expect(parseReply("SCALE_1_10", "11")).toEqual({ ok: false, value: null });
    expect(parseReply("SCALE_1_10", "nada")).toEqual({ ok: false, value: null });
  });

  it("sí/no entiende variantes", () => {
    expect(parseReply("YES_NO", "Sí").value).toBe(1);
    expect(parseReply("YES_NO", "si claro").value).toBe(1);
    expect(parseReply("YES_NO", "No").value).toBe(0);
    expect(parseReply("YES_NO", "tal vez").ok).toBe(false);
  });

  it("opción múltiple valida el rango de opciones", () => {
    expect(parseReply("CHOICE", "2", 3)).toEqual({ ok: true, value: 2 });
    expect(parseReply("CHOICE", "4", 3)).toEqual({ ok: false, value: null });
  });
});

describe("formato y descripción", () => {
  it("formatQuestion numera las opciones de CHOICE", () => {
    const msg = formatQuestion("¿Cómo dormiste?", "CHOICE", ["Bien", "Regular", "Mal"]);
    expect(msg).toContain("1) Bien");
    expect(msg).toContain("3) Mal");
  });
  it("describeValue traduce el valor a texto legible", () => {
    expect(describeValue("SCALE_1_10", 8)).toBe("8/10");
    expect(describeValue("YES_NO", 0)).toBe("No");
    expect(describeValue("CHOICE", 2, ["Bien", "Regular", "Mal"])).toBe("Regular");
  });
});

describe("buildMessage", () => {
  it("YES_NO arma dos botones con ids que parseReply entiende", () => {
    const m = buildMessage("¿Dormiste bien?", "YES_NO");
    expect(m.kind).toBe("buttons");
    if (m.kind !== "buttons") return;
    const ids = m.buttons.map((b) => b.id);
    expect(ids).toEqual(["si", "no"]);
    expect(parseReply("YES_NO", ids[0])).toEqual({ ok: true, value: 1 });
    expect(parseReply("YES_NO", ids[1])).toEqual({ ok: true, value: 0 });
  });

  it("CHOICE con ≤3 opciones usa botones; el id es el número de opción", () => {
    const m = buildMessage("¿Cómo dormiste?", "CHOICE", ["Bien", "Regular", "Mal"]);
    expect(m.kind).toBe("buttons");
    if (m.kind !== "buttons") return;
    expect(m.buttons.map((b) => b.id)).toEqual(["1", "2", "3"]);
    expect(parseReply("CHOICE", "2", 3)).toEqual({ ok: true, value: 2 });
  });

  it("con greet=false no incluye el saludo (mensaje del flujo híbrido)", () => {
    const con = buildMessage("¿Ánimo?", "YES_NO", [], {
      professional: "Lic. Marcos",
      patient: "Juan",
    });
    const sin = buildMessage("¿Ánimo?", "YES_NO", [], {
      professional: "Lic. Marcos",
      patient: "Juan",
      greet: false,
    });
    if (con.kind !== "buttons" || sin.kind !== "buttons") throw new Error("esperaba botones");
    expect(con.body).toContain("Lic. Marcos");
    expect(con.body).toContain("Juan");
    expect(sin.body).not.toContain("Lic. Marcos");
    expect(sin.body).toContain("¿Ánimo?");
  });

  it("CHOICE con >3 opciones cae a lista", () => {
    const m = buildMessage("Elegí", "CHOICE", ["a", "b", "c", "d"]);
    expect(m.kind).toBe("list");
    if (m.kind !== "list") return;
    expect(m.rows).toHaveLength(4);
  });

  it("SCALE_1_10 arma una lista de 10 filas con ids 1..10", () => {
    const m = buildMessage("¿Tu ánimo?", "SCALE_1_10");
    expect(m.kind).toBe("list");
    if (m.kind !== "list") return;
    expect(m.rows.map((r) => r.id)).toEqual(["1","2","3","4","5","6","7","8","9","10"]);
    expect(parseReply("SCALE_1_10", m.rows[6].id)).toEqual({ ok: true, value: 7 });
  });
});

describe("ackMessage (acuse de recibo)", () => {
  it("si entendió la respuesta, confirma con el valor", () => {
    const m = ackMessage("¿Ánimo?", "SCALE_1_10", [], { ok: true, value: 8 });
    expect(m.kind).toBe("text");
    if (m.kind !== "text") return;
    expect(m.body).toContain("8/10");
    expect(m.body.toLowerCase()).toContain("gracias");
  });
  it("si no entendió, re-pregunta con la instrucción", () => {
    const m = ackMessage("¿Ánimo?", "SCALE_1_10", [], { ok: false, value: null });
    expect(m.kind).toBe("text");
    if (m.kind !== "text") return;
    expect(m.body).toContain("no entendí");
    expect(m.body).toContain("1 (mínimo) al 10");
  });
});

describe("formatQuestionLine (variable de template)", () => {
  it("nunca tiene saltos de línea ni tabs (restricción de Meta)", () => {
    const cases: [string, Parameters<typeof formatQuestionLine>[1], string[]][] = [
      ["¿Cómo\nestuvo tu\tánimo?", "SCALE_1_10", []],
      ["¿Ansiedad hoy?", "YES_NO", []],
      ["¿Cómo dormiste?", "CHOICE", ["Bien", "Regular", "Mal"]],
    ];
    for (const [q, type, opts] of cases) {
      const line = formatQuestionLine(q, type, opts);
      expect(line).not.toMatch(/[\n\t]/);
    }
  });
  it("incluye la pregunta y la instrucción según el tipo", () => {
    expect(formatQuestionLine("¿Ánimo?", "SCALE_1_10")).toContain("1 (mínimo) al 10");
    expect(formatQuestionLine("¿Ansiedad?", "YES_NO")).toContain("SÍ o NO");
    expect(formatQuestionLine("¿Sueño?", "CHOICE", ["Bien", "Mal"])).toContain("1) Bien, 2) Mal");
  });
});

describe("timezone", () => {
  it("zonedInstant ubica la hora local en UTC (AR = -3)", () => {
    // 09:00 en Buenos Aires = 12:00 UTC
    const utc = zonedInstant(
      { year: 2026, month: 6, day: 15 },
      "09:00",
      "America/Argentina/Buenos_Aires",
    );
    expect(utc.toISOString()).toBe("2026-06-15T12:00:00.000Z");
  });
  it("localDateInTz devuelve el día local correcto", () => {
    // 2026-06-15T02:00:00Z es aún 23:00 del día 14 en AR
    const d = localDateInTz(
      new Date("2026-06-15T02:00:00.000Z"),
      "America/Argentina/Buenos_Aires",
    );
    expect(d).toEqual({ year: 2026, month: 6, day: 14 });
  });
});
