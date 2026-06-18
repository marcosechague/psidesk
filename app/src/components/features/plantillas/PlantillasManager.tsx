"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, MessageSquareText, Pencil, Plus, Star, Copy, Trash2 } from "lucide-react";

import {
  deleteNoteTemplate,
  setDefaultNoteTemplate,
  duplicateNoteTemplate,
  deleteWritingVoice,
  setDefaultWritingVoice,
  duplicateWritingVoice,
} from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ManagerTemplate {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isDefault: boolean;
}
export interface ManagerVoice {
  id: string;
  name: string;
  description: string | null;
  rules: string[];
  isSystem: boolean;
  isDefault: boolean;
}

type Tab = "plantillas" | "voces";

export function PlantillasManager({
  templates,
  voices,
}: {
  templates: ManagerTemplate[];
  voices: ManagerVoice[];
}) {
  const [tab, setTab] = useState<Tab>("plantillas");

  return (
    <div className="space-y-5">
      <div className="border-border flex gap-1 border-b">
        <TabButton active={tab === "plantillas"} onClick={() => setTab("plantillas")}>
          <FileText className="h-4 w-4" />
          Plantillas
          <span className="text-muted-foreground">{templates.length}</span>
        </TabButton>
        <TabButton active={tab === "voces"} onClick={() => setTab("voces")}>
          <MessageSquareText className="h-4 w-4" />
          Voz / estilo
          <span className="text-muted-foreground">{voices.length}</span>
        </TabButton>
      </div>

      {tab === "plantillas" ? (
        <Section
          intro="Definen las secciones del resumen clínico. Las del sistema podés duplicarlas para tener tu propia versión."
          newHref="/plantillas/nuevo"
          newLabel="Crear plantilla"
        >
          {templates.map((t) => (
            <TemplateRow key={t.id} t={t} />
          ))}
        </Section>
      ) : (
        <Section
          intro="Definen cómo se redacta (tono, largo, forma). La voz se aplica a todo lo generado: resumen, próximos pasos y mensaje al paciente."
          newHref="/plantillas/voz/nuevo"
          newLabel="Nueva voz"
        >
          {voices.map((v) => (
            <VoiceRow key={v.id} v={v} />
          ))}
        </Section>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 border-b-2 px-4 py-2.5 text-base font-medium transition-colors",
        active
          ? "border-primary text-foreground"
          : "text-muted-foreground hover:text-foreground border-transparent",
      )}
    >
      {children}
    </button>
  );
}

function Section({
  intro,
  newHref,
  newLabel,
  children,
}: {
  intro: string;
  newHref: string;
  newLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-base">{intro}</p>
        <Button asChild>
          <Link href={newHref}>
            <Plus className="h-4 w-4" />
            {newLabel}
          </Link>
        </Button>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function TemplateRow({ t }: { t: ManagerTemplate }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run(fn: () => Promise<{ error?: string }>, ok?: string) {
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else {
        if (ok) toast.success(ok);
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">{t.name}</span>
            {t.isSystem && <Badge variant="secondary">Sistema</Badge>}
            {t.isDefault && (
              <Badge variant="outline">
                <Star className="h-3 w-3" />
                Predeterminada
              </Badge>
            )}
          </div>
          {t.description && (
            <p className="text-muted-foreground mt-0.5 text-sm">{t.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {t.isSystem ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => run(() => duplicateNoteTemplate(t.id))}
              disabled={isPending}
            >
              <Copy className="h-4 w-4" />
              Duplicar
            </Button>
          ) : (
            <>
              {!t.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    run(() => setDefaultNoteTemplate(t.id), "Plantilla predeterminada")
                  }
                  disabled={isPending}
                >
                  <Star className="h-4 w-4" />
                  Predeterminar
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/plantillas/${t.id}`}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Link>
              </Button>
              {confirming ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => run(() => deleteNoteTemplate(t.id), "Plantilla eliminada")}
                  disabled={isPending}
                >
                  Confirmar
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(true)}
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VoiceRow({ v }: { v: ManagerVoice }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run(fn: () => Promise<{ error?: string }>, ok?: string) {
    start(async () => {
      const res = await fn();
      if (res?.error) toast.error(res.error);
      else {
        if (ok) toast.success(ok);
        router.refresh();
      }
    });
  }

  const preview = v.description || v.rules.slice(0, 2).join(" · ");

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium">{v.name}</span>
            {v.isSystem && <Badge variant="secondary">Sistema</Badge>}
            {v.isDefault && (
              <Badge variant="outline">
                <Star className="h-3 w-3" />
                Predeterminada
              </Badge>
            )}
            <span className="text-muted-foreground text-sm">
              {v.rules.length} {v.rules.length === 1 ? "regla" : "reglas"}
            </span>
          </div>
          {preview && (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
              {preview}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {v.isSystem ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => run(() => duplicateWritingVoice(v.id))}
              disabled={isPending}
            >
              <Copy className="h-4 w-4" />
              Duplicar
            </Button>
          ) : (
            <>
              {!v.isDefault && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    run(() => setDefaultWritingVoice(v.id), "Voz predeterminada")
                  }
                  disabled={isPending}
                >
                  <Star className="h-4 w-4" />
                  Predeterminar
                </Button>
              )}
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/plantillas/voz/${v.id}`}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Link>
              </Button>
              {confirming ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => run(() => deleteWritingVoice(v.id), "Voz eliminada")}
                  disabled={isPending}
                >
                  Confirmar
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(true)}
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
