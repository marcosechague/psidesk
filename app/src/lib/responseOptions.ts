import type { ResponseType } from "@prisma/client";

export interface ResponseOption {
  value: number;
  label: string;
  hint?: string;
}

/**
 * Opciones que ve el paciente según el tipo de respuesta del test.
 * Centralizado acá para no duplicar etiquetas en la UI.
 */
export const RESPONSE_OPTIONS: Record<ResponseType, ResponseOption[]> = {
  BOOLEAN: [
    { value: 0, label: "No" },
    { value: 1, label: "Sí" },
  ],
  // DASS: frecuencia "me aplicó durante la última semana"
  SCALE_0_3_FREQ: [
    { value: 0, label: "No me aplicó" },
    { value: 1, label: "Me aplicó en algún grado / algunas veces" },
    { value: 2, label: "Me aplicó en buena parte / bastantes veces" },
    { value: 3, label: "Me aplicó mucho / la mayoría del tiempo" },
  ],
  // PHQ-9 / GAD-7: "durante las últimas 2 semanas, con qué frecuencia..."
  SCALE_0_3: [
    { value: 0, label: "Nunca" },
    { value: 1, label: "Varios días" },
    { value: 2, label: "Más de la mitad de los días" },
    { value: 3, label: "Casi todos los días" },
  ],
  // Rosenberg: nivel de acuerdo con cada afirmación
  SCALE_AGREE_4: [
    { value: 0, label: "Muy en desacuerdo" },
    { value: 1, label: "En desacuerdo" },
    { value: 2, label: "De acuerdo" },
    { value: 3, label: "Muy de acuerdo" },
  ],
};
