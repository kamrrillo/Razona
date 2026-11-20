import { Progress as Bar } from "@/components/ui/progress";
import type { Progress } from "@/lib/schemas/api";

export function SpecialtyBars({ items }: { items: Progress["bySpecialty"] }) {
  return (
    <ul className="space-y-3">
      {items.map((s) => (
        <li key={s.specialtyId} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{s.name}</span>
            <span className="tabular-nums text-muted-foreground">
              {s.total === 0 ? "—" : `${Math.round(s.accuracy * 100)} % · ${s.correct}/${s.total}`}
            </span>
          </div>
          <Bar value={s.total === 0 ? 0 : Math.round(s.accuracy * 100)} aria-label={s.name} />
        </li>
      ))}
    </ul>
  );
}
