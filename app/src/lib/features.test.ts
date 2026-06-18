import { describe, it, expect } from "vitest";
import {
  isEntitled,
  featureEnabled,
  entitledKeys,
  FEATURE_KEYS,
} from "./features";

describe("feature flags", () => {
  it("default ON cuando no hay datos (beta)", () => {
    expect(isEntitled(null, "whatsappReminders")).toBe(true);
    expect(featureEnabled(null, null, "whatsappReminders")).toBe(true);
    expect(entitledKeys(null)).toEqual([...FEATURE_KEYS]);
  });

  it("el admin apaga el entitlement → no disponible aunque el psicólogo no lo toque", () => {
    const ent = { whatsappReminders: false };
    expect(isEntitled(ent, "whatsappReminders")).toBe(false);
    expect(featureEnabled(ent, null, "whatsappReminders")).toBe(false);
    expect(entitledKeys(ent)).not.toContain("whatsappReminders");
  });

  it("habilitada por admin pero apagada por el psicólogo → no efectiva", () => {
    expect(featureEnabled(null, { whatsappReminders: false }, "whatsappReminders")).toBe(
      false,
    );
  });

  it("habilitada por admin y prendida por el psicólogo → efectiva", () => {
    expect(
      featureEnabled(
        { whatsappReminders: true },
        { whatsappReminders: true },
        "whatsappReminders",
      ),
    ).toBe(true);
  });

  it("entitlement gana sobre la preferencia: si el admin apaga, da igual la pref", () => {
    expect(
      featureEnabled(
        { whatsappReminders: false },
        { whatsappReminders: true },
        "whatsappReminders",
      ),
    ).toBe(false);
  });

  it("la plataforma manda: si la apaga, queda off aunque entitlement y pref estén ON", () => {
    expect(
      featureEnabled(
        { whatsappCheckins: true },
        { whatsappCheckins: true },
        "whatsappCheckins",
        { whatsappCheckins: false },
      ),
    ).toBe(false);
  });

  it("plataforma ON (o sin dato) no bloquea", () => {
    expect(featureEnabled(null, null, "whatsappCheckins", null)).toBe(true);
    expect(
      featureEnabled(null, null, "whatsappCheckins", { whatsappCheckins: true }),
    ).toBe(true);
  });

  it("entitledKeys oculta lo que la plataforma apagó", () => {
    expect(entitledKeys(null, { whatsappCheckins: false })).not.toContain(
      "whatsappCheckins",
    );
  });
});
