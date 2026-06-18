import "server-only";
import type { StorageDriver, StorageDriverName } from "./types";
import { localDriver } from "./local";
import { r2Driver } from "./r2";

/**
 * Devuelve el driver de storage. Si se pasa `driver` (ej. el guardado en el
 * Attachment) usa ese; sino lee STORAGE_DRIVER del entorno (default "local").
 */
export function getStorage(driver?: StorageDriverName): StorageDriver {
  const name =
    driver ?? (process.env.STORAGE_DRIVER as StorageDriverName) ?? "local";
  return name === "r2" ? r2Driver() : localDriver();
}

export type { StorageDriver, StorageDriverName } from "./types";
