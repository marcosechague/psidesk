export type StorageDriverName = "local" | "r2";

/** Abstracción mínima de storage de archivos (driver intercambiable). */
export interface StorageDriver {
  name: StorageDriverName;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  getBytes(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
