import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  confidence?: number | null;
  consensus?: number | null;
  sourceDiversity?: number | null;
  size?: "sm" | "default" | "lg";
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/**
 * Landscape score meter — replaces the old verdict badge. Shows three 0-1
 * scores side-by-side: confidence (how strong the evidence is), consensus
 * (how much sources agree), and source diversity (how spread the sources are).
 *
 * None of these are hard verdicts. A high-confidence, low-consensus result
 * means "strong evidence, but contested" — which is often the most valuable
 * signal in R&D work.
 */
export function ConfidenceMeter({
  confidence,
  consensus,
  sourceDiversity,
  size = "default",
  orientation = "horizontal",
  className,
}: ConfidenceMeterProps) {
  const items: Array<{ label: string; value: number | null | undefined; tone: string }> = [
    { label: "Confidence", value: confidence, tone: "amber" },
    { label: "Consensus", value: consensus, tone: "emerald" },
    { label: "Diversity", value: sourceDiversity, tone: "violet" },
  ];

  const sizeClasses = {
    sm: { wrap: "gap-2 text-[10px]", bar: "h-1", label: "text-[9px]" },
    default: { wrap: "gap-3 text-[11px]", bar: "h-1.5", label: "text-[10px]" },
    lg: { wrap: "gap-4 text-xs", bar: "h-2", label: "text-[11px]" },
  }[size];

  return (
    <div
      className={cn(
        "flex",
        orientation === "vertical" ? "flex-col" : "flex-row flex-wrap items-center",
        sizeClasses.wrap,
        className,
      )}
    >
      {items.map(({ label, value, tone }) => (
        <ScoreChip key={label} label={label} value={value} tone={tone} size={size} />
      ))}
    </div>
  );
}

interface ScoreChipProps {
  label: string;
  value: number | null | undefined;
  tone: string;
  size: "sm" | "default" | "lg";
}

function ScoreChip({ label, value, tone, size }: ScoreChipProps) {
  const pct = value == null ? null : Math.round((value <= 1 ? value : value / 100) * 100);
  const barWidth = pct == null ? 0 : Math.max(0, Math.min(100, pct));

  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500 ring-emerald-500/20"
      : tone === "violet"
      ? "bg-violet-500 ring-violet-500/20"
      : "bg-amber-500 ring-amber-500/20";

  const sizeClasses = {
    sm: { bar: "h-1", px: "px-2 py-1", label: "text-[9px]", value: "text-[10px]" },
    default: { bar: "h-1.5", px: "px-2.5 py-1.5", label: "text-[10px]", value: "text-xs" },
    lg: { bar: "h-2", px: "px-3 py-2", label: "text-[11px]", value: "text-sm" },
  }[size];

  return (
    <div
      className={cn(
        "inline-flex flex-col items-stretch gap-1 rounded-md border border-obs-border bg-white",
        sizeClasses.px,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "font-mono font-bold uppercase tracking-widest text-text-muted",
            sizeClasses.label,
          )}
        >
          {label}
        </span>
        <span className={cn("font-mono font-semibold text-text", sizeClasses.value)}>
          {pct == null ? "—" : `${pct}%`}
        </span>
      </div>
      <div className={cn("relative w-full overflow-hidden rounded-full bg-obs-border/40", sizeClasses.bar)}>
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all", toneClass)}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
