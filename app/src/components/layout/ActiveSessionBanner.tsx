"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Indicador flotante de "sesión en curso": aparece en cualquier pantalla mientras
 * haya una sesión IN_PROGRESS, con un botón para volver a su consola. Se oculta
 * cuando ya estás en la consola de esa misma sesión.
 */
export function ActiveSessionBanner({
  session,
}: {
  session: { id: string; label: string } | null;
}) {
  const pathname = usePathname();

  // Mientras haya una sesión en curso, pedir confirmación antes de cerrar/recargar
  // la pestaña (en cualquier pantalla), para no abandonarla por accidente.
  useEffect(() => {
    if (!session) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // requerido por los navegadores para mostrar el aviso
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  if (!session) return null;
  if (pathname === `/sesiones/${session.id}`) return null;

  return (
    // El elemento se monta recién al salir de la consola (antes devuelve null),
    // así la animación de entrada corre justo cuando aparece. `key` fuerza el
    // remontaje por sesión para que reanime si cambia la sesión en curso.
    <div
      key={session.id}
      className="animate-in fade-in slide-in-from-bottom-6 zoom-in-95 fixed right-4 bottom-4 z-50 max-w-[calc(100vw-2rem)] duration-500 ease-out"
    >
      <div className="bg-background flex items-center gap-3.5 rounded-full border py-2.5 pr-2.5 pl-5 shadow-lg transition-transform duration-200 hover:scale-[1.03]">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="bg-level-high absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
          <span className="bg-level-high relative inline-flex h-3 w-3 rounded-full" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="text-muted-foreground text-sm leading-none">
            Sesión en curso
          </p>
          <p className="truncate text-base font-semibold">{session.label}</p>
        </div>
        <Button asChild className="shrink-0 rounded-full text-base">
          <Link href={`/sesiones/${session.id}`}>
            Volver
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
