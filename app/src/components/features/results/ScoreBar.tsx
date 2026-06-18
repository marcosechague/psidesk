import { cn } from "@/lib/utils";
import { levelTone, TONE_BAR } from "@/lib/levels";
import { LevelBadge } from "./LevelBadge";
import type { SubscaleScore } from "@/lib/scoring/types";

interface ScoreBarProps {
  score: SubscaleScore;
}

/** Barra de puntaje de una subescala (presentación pura). */
export function ScoreBar({ score }: ScoreBarProps) {
  const tone = score.tone ?? levelTone(score.level);
  const pct = score.max > 0 ? Math.round((score.raw / score.max) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{score.label}</span>
        <span className="text-muted-foreground text-sm tabular-nums">
          {score.raw} / {score.max}
        </span>
      </div>
      <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all", TONE_BAR[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <LevelBadge level={score.level} label={score.levelLabel} tone={tone} />
    </div>
  );
}
