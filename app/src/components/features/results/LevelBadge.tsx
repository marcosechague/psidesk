import { cn } from "@/lib/utils";
import { levelTone, TONE_BADGE, type LevelTone } from "@/lib/levels";

interface LevelBadgeProps {
  level: string;
  label: string;
  tone?: LevelTone;
  className?: string;
}

/** Etiqueta de nivel de severidad coloreada según el tono. */
export function LevelBadge({ level, label, tone: toneProp, className }: LevelBadgeProps) {
  const tone = toneProp ?? levelTone(level);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_BADGE[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
