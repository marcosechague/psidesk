import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { impersonatedUserId } from "./impersonation";

/**
 * Devuelve el id del psicólogo "efectivo" o redirige a /login. Si un super admin
 * está impersonando, devuelve el id del psicólogo objetivo (toda la app opera
 * como él); si no, el id del propio usuario.
 */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const target = await impersonatedUserId(session.user.role === "SUPER_ADMIN");
  return target ?? session.user.id;
}

/** Devuelve el usuario logueado (o null). */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Exige que el usuario logueado sea super admin. Redirige a "/" si no hay
 * sesión o el rol no es SUPER_ADMIN. Devuelve el id del admin.
 */
export async function requireSuperAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "SUPER_ADMIN") redirect("/");
  return session.user.id;
}
