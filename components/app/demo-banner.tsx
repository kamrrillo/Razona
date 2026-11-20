export const DEMO_DISCLAIMER = "Demo — uso educativo, no sustituye el criterio clínico";

export function DemoBanner() {
  return (
    <div
      role="note"
      className="fixed inset-x-0 top-0 z-50 bg-amber-100 pt-safe text-center text-xs font-medium text-amber-950 shadow-sm"
    >
      <p className="px-4 py-1.5">{DEMO_DISCLAIMER}</p>
    </div>
  );
}
