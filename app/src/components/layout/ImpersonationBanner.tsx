"use client";

import { useTransition } from "react";
import { UserCog, Loader2 } from "lucide-react";

import { stopImpersonation } from "@/server/actions";

/**
 * Barra visible mientras el super admin ve la app como un psicólogo. Deja claro
 * que no es su cuenta y permite salir (vuelve al panel de administración).
 */
export function ImpersonationBanner({ name }: { name: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <UserCog className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">
        Estás viendo la cuenta de <strong>{name}</strong>
      </span>
      <button
        type="button"
        onClick={() => startTransition(() => stopImpersonation())}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-md bg-amber-950/10 px-2 py-1 font-semibold hover:bg-amber-950/20 disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Salir
      </button>
    </div>
  );
}
