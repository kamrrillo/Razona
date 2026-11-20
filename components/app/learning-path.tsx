"use client";

import {
  Baby,
  BookOpen,
  Check,
  ClipboardList,
  Flower2,
  HeartPulse,
  type LucideIcon,
  Scissors,
  Sparkles,
  Stethoscope,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { type PathNode, type PathUnit, zigzagOffset } from "@/lib/learning/path";
import { cn } from "@/lib/utils";

const COLUMN = 300;
const ROW = 128;
const NODE = 72;

const SPECIALTY_ICON: Record<string, LucideIcon> = {
  "medicina-interna": HeartPulse,
  pediatria: Baby,
  "ginecologia-obstetricia": Flower2,
  "cirugia-general": Scissors,
};

const UNIT_STYLES = [
  "from-brand-600 to-brand-500",
  "from-aqua-600 to-aqua-500",
  "from-brand-800 to-brand-600",
  "from-aqua-700 to-brand-500",
];

const STATE_LABEL: Record<PathNode["state"], string> = {
  mastered: "Dominado",
  current: "Tu tema débil",
  "in-progress": "En progreso",
  new: "Nuevo",
};

function nodeIcon(node: PathNode): LucideIcon {
  if (node.state === "mastered") return Check;
  if (!node.hasCase) return ClipboardList;
  if (node.state === "current") return Stethoscope;
  if (node.state === "in-progress") return BookOpen;
  return Sparkles;
}

function Connectors({ offsets }: { offsets: number[] }) {
  if (offsets.length < 2) return null;
  const points = offsets.map((o, i) => ({ x: COLUMN / 2 + o, y: i * ROW + NODE / 2 }));
  const d = points
    .slice(1)
    .map((p, i) => {
      const prev = points[i];
      const mid = (p.y - prev.y) / 2;
      return `C ${prev.x} ${prev.y + mid}, ${p.x} ${p.y - mid}, ${p.x} ${p.y}`;
    })
    .join(" ");
  return (
    <svg
      width={COLUMN}
      height={(offsets.length - 1) * ROW + NODE}
      className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2"
      aria-hidden="true"
    >
      <title>Camino</title>
      <path
        d={`M ${points[0].x} ${points[0].y} ${d}`}
        fill="none"
        stroke="var(--color-brand-200)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray="1 20"
      />
    </svg>
  );
}

function NodeButton({
  node,
  open,
  onToggle,
}: {
  node: PathNode;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = nodeIcon(node);
  const pct = Math.round(node.mastery * 100);
  const ring = node.total > 0 ? pct : 0;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${node.topic}: ${STATE_LABEL[node.state]}`}
      data-testid={node.state === "current" ? "path-node-current" : "path-node"}
      className="relative flex size-[84px] items-center justify-center rounded-full"
      style={{
        background:
          node.total > 0
            ? `conic-gradient(var(--color-aqua-400) ${ring}%, var(--color-brand-100) 0)`
            : "transparent",
      }}
    >
      <span
        className={cn(
          "flex size-[72px] items-center justify-center rounded-full border-4 border-white transition-transform active:translate-y-1",
          node.state === "mastered" &&
            "bg-aqua-500 text-white shadow-[0_6px_0_0_var(--color-aqua-700)]",
          node.state === "current" &&
            "animate-node-pulse bg-brand-gradient text-white shadow-[0_6px_0_0_var(--color-brand-800)]",
          node.state === "in-progress" &&
            "bg-brand-500 text-white shadow-[0_6px_0_0_var(--color-brand-700)]",
          node.state === "new" &&
            "bg-muted text-brand-400 shadow-[0_6px_0_0_var(--color-brand-100)]",
        )}
      >
        <Icon className="size-8" strokeWidth={2.5} aria-hidden />
      </span>
    </button>
  );
}

function NodePopover({
  node,
  unitName,
  offset,
}: {
  node: PathNode;
  unitName: string;
  offset: number;
}) {
  const pct = Math.round(node.mastery * 100);
  const cta = !node.hasCase
    ? "Repasar en el simulacro"
    : node.state === "current"
      ? "Practicar mi tema débil"
      : node.state === "mastered"
        ? "Repasar"
        : "Practicar";
  return (
    <div
      role="dialog"
      aria-label={node.topic}
      className="absolute top-[92px] left-1/2 z-20 w-64 rounded-2xl bg-brand-gradient p-4 text-white shadow-xl"
      // Centrado en la columna (no en el nodo) para no salirse de la pantalla.
      style={{ transform: `translateX(calc(-50% - ${offset}px))` }}
    >
      <span
        className="absolute -top-2 size-4 -translate-x-1/2 rotate-45 bg-brand-600"
        style={{ left: `calc(50% + ${offset}px)` }}
      />
      <p className="text-xs font-semibold tracking-wide text-brand-100 uppercase">
        {unitName} · {STATE_LABEL[node.state]}
      </p>
      <p className="mt-1 text-lg font-bold leading-tight">{node.topic}</p>
      <p className="mt-1 text-sm text-brand-50">
        {node.total === 0
          ? "Aún no lo has practicado."
          : `Dominio ${pct} % · ${node.correct}/${node.total} aciertos`}
      </p>
      {!node.hasCase && (
        <p className="mt-1 text-xs text-brand-100">Este tema aparece en el examen simulado.</p>
      )}
      <Link
        href={node.href}
        data-testid={node.state === "current" ? "path-practice-weak" : undefined}
        className={cn(
          buttonVariants({ variant: "secondary" }),
          "mt-3 w-full bg-white font-bold text-brand-700 shadow-[0_4px_0_0_var(--color-brand-200)] hover:bg-brand-50",
        )}
      >
        {cta}
      </Link>
    </div>
  );
}

export function LearningPath({ units }: { units: PathUnit[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  let globalIndex = 0;

  return (
    <div className="space-y-6">
      {units.map((unit, u) => {
        const UnitIcon = SPECIALTY_ICON[unit.specialtyId] ?? Stethoscope;
        const offsets = unit.nodes.map(() => zigzagOffset(globalIndex++));
        const pct = Math.round(unit.accuracy * 100);
        return (
          <section key={unit.specialtyId} aria-label={`Unidad ${unit.index}: ${unit.name}`}>
            <header
              className={cn(
                "flex items-center gap-3 rounded-2xl bg-gradient-to-r p-4 text-white shadow-[0_4px_0_0_rgb(8_44_59/0.25)]",
                UNIT_STYLES[u % UNIT_STYLES.length],
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-wide text-white/80 uppercase">
                  Unidad {unit.index}
                </p>
                <h3 className="text-lg font-bold leading-tight">{unit.name}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-white/25"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Aciertos en ${unit.name}`}
                  >
                    <div className="h-full rounded-full bg-aqua-200" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold tabular-nums">
                    {unit.total === 0 ? "—" : `${pct} % · ${unit.correct}/${unit.total}`}
                  </span>
                </div>
              </div>
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <UnitIcon className="size-7" aria-hidden />
              </span>
            </header>

            <div
              className="relative mx-auto mt-12"
              style={{ width: COLUMN, height: (unit.nodes.length - 1) * ROW + NODE + 24 }}
            >
              <Connectors offsets={offsets} />
              {unit.nodes.map((node, i) => {
                const key = `${unit.specialtyId}:${node.topic}`;
                const open = openKey === key;
                return (
                  <Fragment key={key}>
                    <div
                      className={cn("absolute", open && "z-20")}
                      style={{
                        top: i * ROW - 6,
                        left: COLUMN / 2 + offsets[i] - 42,
                      }}
                    >
                      {node.state === "current" && !open && (
                        <span className="animate-bob absolute -top-9 left-1/2 z-10 rounded-xl border-2 border-brand-200 bg-white px-3 py-1 text-xs font-extrabold whitespace-nowrap text-brand-700 uppercase shadow">
                          ¡Empieza aquí!
                        </span>
                      )}
                      <NodeButton
                        node={node}
                        open={open}
                        onToggle={() => setOpenKey(open ? null : key)}
                      />
                      <p className="mt-1 w-[84px] text-center text-[11px] leading-tight font-semibold text-brand-900">
                        {node.topic}
                      </p>
                      {open && <NodePopover node={node} unitName={unit.name} offset={offsets[i]} />}
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </section>
        );
      })}

      <section aria-label="Meta final" className="flex flex-col items-center gap-2 pb-4">
        <Link
          href="/examen"
          className="flex size-24 items-center justify-center rounded-full border-4 border-white bg-brand-950 text-aqua-300 shadow-[0_7px_0_0_var(--color-brand-800)] transition-transform active:translate-y-1"
          aria-label="Examen simulado"
        >
          <Trophy className="size-11" strokeWidth={2.2} aria-hidden />
        </Link>
        <p className="font-bold text-brand-900">Simulacro ENARM</p>
        <p className="text-xs text-muted-foreground">10 reactivos · tutor apagado</p>
      </section>
    </div>
  );
}
