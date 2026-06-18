"use client";

import type { ChartSubscale, ChartToma } from "@/lib/charts";
import { levelTone, TONE_COLOR } from "@/lib/levels";

interface Props {
  subscales: ChartSubscale[];
  tomas: ChartToma[];
}

/** Grilla subescalas × fechas coloreada por nivel (trayectoria de un vistazo). */
export function LevelHeatmap({ subscales, tomas }: Props) {
  if (tomas.length < 2) return null;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1 text-center text-xs"
        style={{
          gridTemplateColumns: `minmax(96px, max-content) repeat(${tomas.length}, minmax(40px, 1fr))`,
        }}
      >
        <div />
        {tomas.map((t, i) => (
          <div key={i} className="text-muted-foreground py-1 font-medium">
            {t.date}
          </div>
        ))}

        {subscales.map((s) => {
          const byKey = tomas.map((t) => t.scores.find((x) => x.key === s.key));
          return (
            <div key={s.key} className="contents">
              <div className="text-muted-foreground flex items-center py-1 text-left font-medium">
                {s.label}
              </div>
              {byKey.map((score, i) => {
                if (!score) return <div key={i} />;
                const tone = score.tone ?? levelTone(score.level);
                return (
                  <div
                    key={i}
                    title={`${score.levelLabel} · ${score.raw}`}
                    className="flex items-center justify-center rounded-md py-2 font-medium"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${TONE_COLOR[tone]} 55%, transparent)`,
                    }}
                  >
                    {score.raw}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
