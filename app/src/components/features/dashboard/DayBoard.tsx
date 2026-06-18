"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Loader2, Clock } from "lucide-react";

import { startSession } from "@/server/actions";
import { fixIcuSpaces } from "@/lib/utils";
import { statusLabel, statusBadgeVariant } from "@/lib/sessionLabels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DaySession {
  id: string;
  startsAt: Date | string;
  durationMin: number;
  status: string;
  topic: string | null;
  topicOther: string | null;
  participants: { id: string; fullName: string }[];
}

function label(s: DaySession) {
  return s.participants.map((p) => p.fullName).join(", ") || "Bloque";
}
function fmtTime(d: Date | string) {
  return fixIcuSpaces(
    new Date(d).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
}

export function DayBoard({
  today,
  stats,
}: {
  today: DaySession[];
  stats?: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [startingId, setStartingId] = useState<string | null>(null);

  function startAndOpen(id: string) {
    setStartingId(id);
    startTransition(async () => {
      const res = await startSession(id);
      setStartingId(null);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      router.push(`/sesiones/${id}`);
    });
  }

  return (
    <div className="space-y-6">
      {stats}

      {/* Sesiones de hoy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Sesiones de hoy
          </CardTitle>
        </CardHeader>
        <CardContent>
          {today.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No tenés sesiones hoy.{" "}
              <Link href="/agenda" className="text-primary hover:underline">
                Agendá una
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {today.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <Link
                    href={`/sesiones/${s.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span className="text-muted-foreground tabular-nums">
                      {fmtTime(s.startsAt)}
                    </span>
                    <span className="min-w-0 truncate font-medium">{label(s)}</span>
                    <Badge variant={statusBadgeVariant(s.status)}>
                      {statusLabel(s.status)}
                    </Badge>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    {s.status === "SCHEDULED" && (
                      <Button
                        size="sm"
                        onClick={() => startAndOpen(s.id)}
                        disabled={isPending}
                      >
                        {startingId === s.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Iniciar
                      </Button>
                    )}
                    {s.status === "IN_PROGRESS" && (
                      <Button asChild size="sm">
                        <Link href={`/sesiones/${s.id}`}>Continuar</Link>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
