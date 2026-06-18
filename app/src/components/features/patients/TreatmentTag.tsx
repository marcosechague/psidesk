/** Datos mínimos de un proceso terapéutico para identificarlo en encabezados. */
export interface ProcessHeaderData {
  id: string | null;
  motivo: string | null;
  motivoCategory: string | null;
  status: string | null;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
}
