"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ShareLinkProps {
  token: string;
  patientName?: string;
  testName?: string;
  /** teléfono del paciente (para compartir por WhatsApp) */
  patientPhone?: string | null;
}

/** Muestra el link público del paciente: copiar, abrir y compartir por WhatsApp. */
export function ShareLink({
  token,
  patientName,
  testName,
  patientPhone,
}: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/r/${token}`
      : `/r/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  const phoneDigits = (patientPhone ?? "").replace(/\D/g, "");
  const waText = `Hola ${patientName ?? ""}, te comparto el link para responder${
    testName ? ` ${testName}` : " el cuestionario"
  }: ${url}`;
  const waUrl = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(waText)}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={url} className="font-mono text-sm" />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={copy}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copiar
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Abrir
            </a>
          </Button>
        </div>
      </div>

      {phoneDigits ? (
        <Button type="button" asChild>
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" />
            Compartir por WhatsApp
          </a>
        </Button>
      ) : (
        <p className="text-muted-foreground text-xs">
          Cargá el teléfono del paciente para compartir el link por WhatsApp.
        </p>
      )}
    </div>
  );
}
