import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Middleware edge-safe (sin Prisma): solo decodifica el JWT y aplica
// la regla `authorized` para proteger rutas.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
