import { Info } from "lucide-react";

export const DEMO_DISCLAIMER = "Demo — uso educativo, no sustituye el criterio clínico";

export function DemoBanner() {
  return (
    <div
      role="note"
      className="fixed inset-x-0 top-0 z-50 bg-brand-950 pt-safe text-center text-xs font-medium text-brand-100"
    >
      <p className="flex items-center justify-center gap-1.5 px-4 py-1.5">
        <Info className="size-3.5 text-aqua-300" aria-hidden />
        {DEMO_DISCLAIMER}
      </p>
    </div>
  );
}
