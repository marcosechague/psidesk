import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireUserId, getCurrentUser } from "@/server/session";
import { impersonatedUserId } from "@/server/impersonation";
import { getActiveSession, mustChangePassword } from "@/server/queries";
import { professionalName } from "@/lib/users";
import { Sidebar } from "@/components/layout/Sidebar";
import { ActiveSessionBanner } from "@/components/layout/ActiveSessionBanner";
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const impersonatedId = await impersonatedUserId(user?.role === "SUPER_ADMIN");
  const userId = await requireUserId();
  // Alta/reset del admin: forzar el cambio de contraseña antes de usar la app.
  // No aplica si el admin está impersonando (no es su cuenta).
  if (!impersonatedId && (await mustChangePassword(userId))) {
    redirect("/cambiar-password");
  }
  const activeSession = await getActiveSession(userId);

  let impersonatedName: string | null = null;
  if (impersonatedId) {
    const target = await prisma.user.findUnique({
      where: { id: impersonatedId },
      select: { name: true, firstName: true, lastName: true, prefix: true },
    });
    impersonatedName = target ? professionalName(target) : "psicólogo";
  }

  return (
    <>
      {impersonatedName && <ImpersonationBanner name={impersonatedName} />}
      <div className="md:flex">
        <Sidebar
          user={{ name: user?.name, email: user?.email, role: user?.role }}
          impersonating={Boolean(impersonatedId)}
        />
        <main className="min-w-0 flex-1">
          {/* Casi todo el ancho en desktop (tope alto para monitores enormes);
              en mobile el contenido ocupa el ancho completo menos el padding. */}
          <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-10">
            {children}
          </div>
        </main>
        <ActiveSessionBanner session={activeSession} />
      </div>
    </>
  );
}
