import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La config de ESLint generada apunta a una versión distinta; no bloquear
  // el build por lint (el chequeo de tipos de TypeScript sí se mantiene).
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Permitir subir adjuntos vía server actions (default es 1 MB).
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
