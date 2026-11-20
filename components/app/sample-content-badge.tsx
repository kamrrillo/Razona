import { SAMPLE_NOTICE } from "@/lib/schemas/content";
import { cn } from "@/lib/utils";

export function SampleContentBadge({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900",
        className,
      )}
    >
      {SAMPLE_NOTICE}
    </p>
  );
}
