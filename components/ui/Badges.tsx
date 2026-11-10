import { INDUSTRY_BY_KEY, INDUSTRY_ICONS, INDUSTRY_TONES, PLAN_BADGE, PLAN_BY_KEY, STATUS_META } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { IndustryKey, PlanKey, TenantStatus } from "@/lib/types";

export function StatusBadge({
  status,
  className,
}: {
  status: TenantStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium tracking-[0.02em]",
        meta.className,
        className,
      )}
      title={meta.description}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function PlanBadge({ plan, className }: { plan: PlanKey; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium tracking-[0.02em]",
        PLAN_BADGE[plan],
        className,
      )}
      title={`${PLAN_BY_KEY[plan].name} · $${PLAN_BY_KEY[plan].price}/mo`}
    >
      {PLAN_BY_KEY[plan].name}
    </span>
  );
}

export function IndustryGlyph({
  industry,
  size = "md",
}: {
  industry: IndustryKey;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = INDUSTRY_ICONS[industry] ?? INDUSTRY_ICONS.electronics;
  const industryModule = INDUSTRY_BY_KEY[industry] ?? INDUSTRY_BY_KEY.electronics;
  const tone = INDUSTRY_TONES[industryModule.tone] ?? INDUSTRY_TONES.violet;
  const sizes = {
    sm: "h-7 w-7 rounded-md",
    md: "h-9 w-9 rounded-lg",
    lg: "h-11 w-11 rounded-xl",
  } as const;
  const icons = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-5 w-5" } as const;

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", sizes[size], tone.icon)}
      aria-hidden
    >
      <Icon className={icons[size]} strokeWidth={1.9} />
    </span>
  );
}
