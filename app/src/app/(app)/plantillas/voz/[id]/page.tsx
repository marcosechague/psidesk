import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireUserId } from "@/server/session";
import { getOwnWritingVoice } from "@/server/queries";
import { Button } from "@/components/ui/button";
import { WritingVoiceBuilder } from "@/components/features/plantillas/WritingVoiceBuilder";

export default async function EditarVozPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const voice = await getOwnWritingVoice(userId, id);
  if (!voice) notFound();

  const rules = Array.isArray(voice.rulesJson)
    ? (voice.rulesJson as unknown[]).filter(
        (r): r is string => typeof r === "string",
      )
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/plantillas">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl">Editar voz</h1>
        <p className="text-muted-foreground">Ajustá las reglas de redacción.</p>
      </div>

      <WritingVoiceBuilder
        mode="edit"
        id={voice.id}
        initial={{
          name: voice.name,
          description: voice.description ?? "",
          rules,
          isDefault: voice.isDefault,
        }}
      />
    </div>
  );
}
