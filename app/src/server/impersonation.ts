import "server-only";
import { cookies } from "next/headers";

// Impersonación: el super admin puede ver la app COMO un psicólogo (soporte).
// Se guarda el id objetivo en una cookie httpOnly. SOLO se honra si el usuario
// real es SUPER_ADMIN (se chequea siempre con la sesión), así que aunque la
// cookie se manipule, lo único que habilita es ver a un psicólogo —cosa que el
// admin ya puede hacer—. Nunca eleva privilegios.

const COOKIE = "impersonate";

/** Id del psicólogo que el admin está viendo, o null. Solo aplica a SUPER_ADMIN. */
export async function impersonatedUserId(
  isSuperAdmin: boolean,
): Promise<string | null> {
  if (!isSuperAdmin) return null;
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export async function setImpersonation(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function clearImpersonation(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
