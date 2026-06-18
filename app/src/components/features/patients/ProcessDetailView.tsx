"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  FileText,
  MessageCircle,
  ArrowUpRight,
  Check,
  Clock,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PatientTestCharts } from "@/components/features/charts/PatientTestCharts";
import type { TestChartData } from "@/lib/charts";

export type ActivityKind = "session" | "test" | "checkin";
export type ActivityState = "done" | "pending" | "canceled";

export interface TimelineActivity {
  id: string;
  kind: ActivityKind;
  /** instante que ordena la actividad (más reciente primero) */
  when: Date | string;
  state: ActivityState;
  title: string;
  subtitle: string | null;
  /** badge de estado a la derecha */
  badgeLabel: string;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  /** clases de tono para resultados de tests (TONE_BADGE) */
  toneClass: string | null;
  /** dato extra bajo el título (ej. "3/5 respondidas") */
  detail: string | null;
  href: string | null;
}

export interface TreatmentSummary {
  sessions: { done: number; total: number };
  tests: { done: number; total: number };
  checkins: { done: number; total: number };
}

const KIND_ICON: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  session: CalendarClock,
  test: FileText,
  checkin: MessageCircle,
};

/** Punto del riel: verde = hecho, ámbar = asignado/pendiente, gris = cancelado. */
const NODE_STYLE: Record<ActivityState, string> = {
  done: "bg-level-ok/15 text-level-ok",
  pending: "bg-level-low/15 text-level-low",
  canceled: "bg-muted text-muted-foreground",
};

const STATE_BADGE: Record<ActivityState, React.ComponentType<{ className?: string }>> = {
  done: Check,
  pending: Clock,
  canceled: X,
};

function fmtWhen(d: Date | string) {
  return new Date(d).toLocaleString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProcessDetailView({
  timeline,
  summary,
  charts,
}: {
  timeline: TimelineActivity[];
  summary: TreatmentSummary;
  charts: TestChartData[];
}) {
  const tabs: { key: "timeline" | "charts"; label: string }[] = [
    { key: "timeline", label: "Línea de tiempo" },
    ...(charts.length > 0
      ? [{ key: "charts" as const, label: "Estadísticas" }]
      : []),
  ];
  const [tab, setTab] = useState<"timeline" | "charts">("timeline");

  return (
    <div className="space-y-4">
      <div className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-3 py-1 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "timeline" && (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <SummaryPanel summary={summary} />
          <Timeline timeline={timeline} />
        </div>
      )}

      {tab === "charts" && charts.length > 0 && (
        <PatientTestCharts data={charts} />
      )}
    </div>
  );
}

/** Panel izquierdo: lo trabajado en el tratamiento por tipo de actividad. */
function SummaryPanel({ summary }: { summary: TreatmentSummary }) {
  const rows: {
    kind: ActivityKind;
    label: string;
    done: number;
    total: number;
  }[] = [
    {
      kind: "session",
      label: "Sesiones",
      done: summary.sessions.done,
      total: summary.sessions.total,
    },
    {
      kind: "test",
      label: "Tests",
      done: summary.tests.done,
      total: summary.tests.total,
    },
    {
      kind: "checkin",
      label: "Seguimientos",
      done: summary.checkins.done,
      total: summary.checkins.total,
    },
  ];

  return (
    <Card className="h-fit lg:sticky lg:top-4">
      <CardContent className="space-y-4 py-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Lo trabajado
        </p>
        {rows.map((r) => {
          const Icon = KIND_ICON[r.kind];
          const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
          return (
            <div key={r.kind} className="space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="flex-1 font-medium">{r.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {r.total === 0 ? "—" : `${r.done}/${r.total}`}
                </span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-level-ok h-full rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="bg-level-ok inline-block h-2 w-2 rounded-full" />
            Hecho
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-level-low inline-block h-2 w-2 rounded-full" />
            Pendiente
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Riel vertical con cada actividad, de la más reciente a la más antigua. */
function Timeline({ timeline }: { timeline: TimelineActivity[] }) {
  if (timeline.length === 0) {
    return (
      <EmptyState>
        Todavía no hay sesiones, tests ni seguimientos en este tratamiento.
      </EmptyState>
    );
  }

  return (
    <ol className="relative space-y-1">
      {/* riel continuo: pasa por el centro de los nodos
          (fila p-2 = 8px + radio nodo h-9/2 = 18px → 26px) */}
      <span
        aria-hidden
        className="bg-border absolute top-5 bottom-5 left-[26px] w-0.5 rounded-full"
      />
      {timeline.map((a) => (
        <TimelineRow key={`${a.kind}-${a.id}`} a={a} />
      ))}
    </ol>
  );
}

function TimelineRow({ a }: { a: TimelineActivity }) {
  const Icon = KIND_ICON[a.kind];
  const StateIcon = STATE_BADGE[a.state];
  const inner = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg p-2 transition-colors",
        a.href && "hover:bg-muted/60",
        a.state === "canceled" && "opacity-70",
      )}
    >
      {/* nodo del riel */}
      <span
        className={cn(
          "relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-4",
          "ring-background", // separa el nodo del riel
          NODE_STYLE[a.state],
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="bg-background absolute -right-0.5 -bottom-0.5 grid h-4 w-4 place-items-center rounded-full">
          <StateIcon
            className={cn(
              "h-3 w-3",
              a.state === "done" && "text-level-ok",
              a.state === "pending" && "text-level-low",
              a.state === "canceled" && "text-muted-foreground",
            )}
          />
        </span>
      </span>

      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium">{a.title}</span>
          <Badge variant={a.badgeVariant} className={cn(a.toneClass)}>
            {a.badgeLabel}
          </Badge>
          {a.href && (
            <ArrowUpRight className="text-muted-foreground ml-auto h-4 w-4 shrink-0" />
          )}
        </div>
        <p className="text-muted-foreground text-xs tabular-nums">
          {fmtWhen(a.when)}
          {a.subtitle ? ` · ${a.subtitle}` : ""}
          {a.detail ? ` · ${a.detail}` : ""}
        </p>
      </div>
    </div>
  );

  return (
    <li className="relative">
      {a.href ? (
        <Link href={a.href} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}
