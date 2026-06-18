"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Botón "Volver" que regresa a la pantalla anterior (historial del navegador).
 * Si no hay historial (se entró por link directo), va al `fallback`.
 */
export function BackButton({
  fallback,
  label = "Volver",
}: {
  fallback: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
