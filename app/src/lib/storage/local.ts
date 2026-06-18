import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageDriver } from "./types";

// Carpeta local (gitignored). Solo para desarrollo: en Vercel el FS es efímero.
const ROOT = path.join(process.cwd(), "uploads");

export function localDriver(): StorageDriver {
  return {
    name: "local",
    async put(key, body) {
      const full = path.join(ROOT, key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, body);
    },
    async getBytes(key) {
      return fs.readFile(path.join(ROOT, key));
    },
    async delete(key) {
      await fs.rm(path.join(ROOT, key), { force: true });
    },
  };
}
