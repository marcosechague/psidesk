import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

/**
 * Config base de Auth.js compartida por el middleware (edge, sin Prisma)
 * y por la config completa (Node, con el provider de credenciales).
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // el provider real se agrega en auth.ts (runtime Node)
  callbacks: {
    // Protección de rutas usada por el middleware.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      // El auto-registro está cerrado: /register ya no es público.
      const isPublic =
        pathname.startsWith("/login") ||
        pathname.startsWith("/r/") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/cron") ||
        pathname.startsWith("/api/whatsapp");

      if (isPublic) {
        // Si ya está logueado y va a login, mandarlo al dashboard.
        if (isLoggedIn && pathname.startsWith("/login")) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) return false; // rutas privadas: redirige a /login

      // El panel de administración es solo para el super admin.
      if (pathname.startsWith("/admin") && auth?.user?.role !== "SUPER_ADMIN") {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.name = user.name;
        token.email = user.email;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token?.id && session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole | undefined) ?? "PSYCHOLOGIST";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
