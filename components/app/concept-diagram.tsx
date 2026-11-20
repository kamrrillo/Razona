"use client";

import { GitBranch, Rows3, Ruler, Workflow } from "lucide-react";
import { useId, useState } from "react";
import {
  type LaidEdge,
  type LaidNode,
  layoutCompare,
  layoutFlow,
  layoutScale,
  layoutTree,
} from "@/lib/diagram-layout";
import type { ConceptDiagram as Diagram, NodeRole } from "@/lib/schemas/explanation";

export const ROLE: Record<
  NodeRole,
  { fill: string; stroke: string; text: string; legend?: string }
> = {
  raiz: { fill: "#0b2a3c", stroke: "#0b2a3c", text: "#ffffff" },
  normal: { fill: "#f3f8fa", stroke: "#a9cfdb", text: "#0b2a3c" },
  clave: { fill: "#e6f8fb", stroke: "#0f9bb8", text: "#0b2a3c", legend: "Dato clave" },
  respuesta: { fill: "#e5f8ee", stroke: "#10b981", text: "#064e3b", legend: "Respuesta" },
  elegida: { fill: "#fff1f2", stroke: "#f43f5e", text: "#881337", legend: "Tu elección" },
};

const KIND_META = {
  arbol: { icon: GitBranch, label: "Árbol" },
  flujo: { icon: Workflow, label: "Flujo" },
  escala: { icon: Ruler, label: "Escala" },
  comparacion: { icon: Rows3, label: "Comparación" },
} as const;

/** Aparición escalonada (CSS `.concept-pop`, se desactiva con prefers-reduced-motion). */
const pop = (i: number) => ({ animationDelay: `${Math.min(i, 10) * 55}ms` });

function EdgeLabel({ edge }: { edge: LaidEdge }) {
  if (!edge.label) return null;
  const w = edge.lw;
  return (
    <g>
      <rect
        x={edge.lx - w / 2}
        y={edge.ly - 10}
        width={w}
        height={18}
        rx={9}
        fill="#ffffff"
        stroke="#9fd8e6"
      />
      <text
        x={edge.lx}
        y={edge.ly + 3}
        textAnchor="middle"
        fontSize="10.5"
        fontWeight="700"
        fill="#0d647d"
      >
        {edge.label}
      </text>
    </g>
  );
}

function Nodes({ nodes, selected }: { nodes: LaidNode[]; selected: string | null }) {
  return nodes.map((n, i) => {
    const r = ROLE[n.role];
    const active = selected === n.id;
    return (
      <g
        key={n.id}
        className="concept-pop"
        style={pop(i)}
        data-testid="concept-node"
        data-role={n.role}
      >
        {active && (
          <rect
            x={n.x - 4}
            y={n.y - 4}
            width={n.w + 8}
            height={n.h + 8}
            rx={14}
            fill="none"
            stroke="#2dd4bf"
            strokeWidth={3}
          />
        )}
        <rect x={n.x} y={n.y + 3} width={n.w} height={n.h} rx={11} fill={r.stroke} opacity={0.3} />
        <rect
          x={n.x}
          y={n.y}
          width={n.w}
          height={n.h}
          rx={11}
          fill={r.fill}
          stroke={r.stroke}
          strokeWidth={2}
        />
        {n.lines.map((line, li) => (
          <text
            // biome-ignore lint/suspicious/noArrayIndexKey: líneas estáticas de un texto ya partido
            key={li}
            x={n.x + n.w / 2}
            y={n.y + 8 + LINE_OFFSET + li * 15}
            textAnchor="middle"
            fontSize="12.5"
            fontWeight="700"
            fill={r.text}
          >
            {line}
          </text>
        ))}
        {n.note && (
          <circle cx={n.x + n.w - 8} cy={n.y + 8} r={3} fill={active ? "#2dd4bf" : r.stroke} />
        )}
      </g>
    );
  });
}

/** Botones HTML invisibles sobre cada nodo con nota (accesibles con teclado y lector de pantalla). */
function NodeButtons({
  nodes,
  width,
  height,
  selected,
  onSelect,
}: {
  nodes: LaidNode[];
  width: number;
  height: number;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return nodes
    .filter((n) => n.note)
    .map((n) => (
      <button
        key={n.id}
        type="button"
        aria-pressed={selected === n.id}
        aria-label={`${n.label}: ver explicación`}
        onClick={() => onSelect(n.id)}
        className="absolute cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        style={{
          left: `${(n.x / width) * 100}%`,
          top: `${(n.y / height) * 100}%`,
          width: `${(n.w / width) * 100}%`,
          height: `${(n.h / height) * 100}%`,
        }}
        data-testid="concept-node-button"
      />
    ));
}
const LINE_OFFSET = 15;

function GraphDiagram({
  layout,
  markerId,
}: {
  layout: ReturnType<typeof layoutTree>;
  markerId: string;
}) {
  const initial =
    layout.nodes.find((n) => n.role === "respuesta" && n.note) ?? layout.nodes.find((n) => n.note);
  const [selected, setSelected] = useState<string | null>(initial?.id ?? null);
  const current = layout.nodes.find((n) => n.id === selected);
  return (
    <>
      <div className="relative">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="mx-auto block w-full"
          role="img"
          aria-label={layout.nodes
            .map((n) => (n.note ? `${n.label}: ${n.note}` : n.label))
            .join(". ")}
        >
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="#5fb9cf" />
            </marker>
          </defs>
          {layout.edges.map((e, i) => (
            <path
              key={e.id}
              d={e.d}
              fill="none"
              stroke="#5fb9cf"
              strokeWidth={2.5}
              strokeLinejoin="round"
              markerEnd={`url(#${markerId})`}
              className="concept-pop"
              style={pop(i)}
            />
          ))}
          {layout.edges.map((e) => (
            <EdgeLabel key={`l-${e.id}`} edge={e} />
          ))}
          <Nodes nodes={layout.nodes} selected={selected} />
        </svg>
        <NodeButtons
          nodes={layout.nodes}
          width={layout.width}
          height={layout.height}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
      {current?.note && (
        <div
          className="rounded-xl border-l-4 bg-white px-3 py-2 text-sm leading-relaxed shadow-xs"
          style={{ borderColor: ROLE[current.role].stroke }}
          aria-live="polite"
          data-testid="concept-note"
        >
          <span className="font-bold text-brand-950">{current.label}: </span>
          {current.note}
        </div>
      )}
    </>
  );
}

function ScaleDiagram({ diagram }: { diagram: Extract<Diagram, { kind: "escala" }> }) {
  const l = layoutScale(diagram);
  return (
    <svg
      viewBox={`0 0 ${l.width} ${l.height}`}
      className="mx-auto block w-full"
      role="img"
      aria-label={`${diagram.title}. ${diagram.ranges.map((r) => `${r.label}: ${r.from} a ${r.to} ${diagram.unit}`).join("; ")}${l.marker ? `. ${l.marker.label}` : ""}`}
    >
      {l.segments.map((s, i) => {
        const r = ROLE[s.role];
        return (
          <g
            key={`${s.label}-${s.x}`}
            className="concept-pop"
            style={pop(i)}
            data-testid="concept-node"
            data-role={s.role}
          >
            <rect
              x={s.x}
              y={l.barY}
              width={s.w}
              height={l.barH}
              fill={s.role === "normal" ? ["#d9eef4", "#bfe3ed", "#a6d8e6"][i % 3] : r.fill}
              stroke={r.stroke}
              strokeWidth={s.role === "respuesta" || s.role === "elegida" ? 2.5 : 1}
            />
            {s.lines.map((line, li) => (
              <text
                key={`${s.label}-${li}`}
                x={s.x + s.w / 2}
                y={s.labelY + li * 14}
                textAnchor="middle"
                fontSize="11.5"
                fontWeight={s.role === "normal" ? 600 : 800}
                fill={s.role === "normal" ? "#0b2a3c" : r.text}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
      {l.ticks.map((t) => (
        <g key={`t-${t.x}`}>
          <line
            x1={t.x}
            x2={t.x}
            y1={l.barY - 6}
            y2={l.barY + l.barH + 6}
            stroke="#0b2a3c"
            strokeWidth={1.5}
          />
          <text
            x={t.anchor === "start" ? t.x - 2 : t.anchor === "end" ? t.x + 2 : t.x}
            y={l.barY - 10}
            textAnchor={t.anchor}
            fontSize="11"
            fontWeight="700"
            fill="#0d647d"
          >
            {t.value}
          </text>
        </g>
      ))}
      {l.marker && (
        <g className="concept-pop" style={pop(l.segments.length)} data-testid="concept-marker">
          <line
            x1={l.marker.x}
            x2={l.marker.x}
            y1={34}
            y2={l.barY + l.barH + 4}
            stroke="#0b2a3c"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <path
            d={`M ${l.marker.x - 7} ${l.barY - 22} L ${l.marker.x + 7} ${l.barY - 22} L ${l.marker.x} ${l.barY - 12} z`}
            fill="#0b2a3c"
          />
          {(() => {
            const w = Math.min(l.width - 8, l.marker.label.length * 6.6 + 18);
            const x = Math.min(Math.max(4, l.marker.x - w / 2), l.width - w - 4);
            return (
              <>
                <rect x={x} y={8} width={w} height={24} rx={12} fill="#0b2a3c" />
                <text
                  x={x + w / 2}
                  y={24}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="800"
                  fill="#ffffff"
                >
                  {l.marker.label}
                </text>
              </>
            );
          })()}
        </g>
      )}
    </svg>
  );
}

function CompareDiagram({ diagram }: { diagram: Extract<Diagram, { kind: "comparacion" }> }) {
  const l = layoutCompare(diagram);
  return (
    <svg
      viewBox={`0 0 ${l.width} ${l.height}`}
      className="mx-auto block w-full"
      role="img"
      aria-label={`${diagram.title}. ${diagram.rows
        .map(
          (r) =>
            `${r.label}: ${diagram.columns.map((c, i) => `${c.label} ${r.cells[i]}`).join(", ")}`,
        )
        .join(". ")}`}
    >
      <rect
        x={0.5}
        y={0.5}
        width={l.width - 1}
        height={l.height - 1}
        rx={12}
        fill="#ffffff"
        stroke="#cfe6ee"
      />
      {l.header.map((h, i) => {
        const r = ROLE[h.role];
        return (
          <g
            key={`h-${h.x}`}
            className="concept-pop"
            style={pop(i)}
            data-testid="concept-node"
            data-role={h.role}
          >
            <rect
              x={h.x + 3}
              y={3}
              width={l.colW - 6}
              height={l.headerH - 6}
              rx={9}
              fill={r.fill}
              stroke={r.stroke}
              strokeWidth={1.5}
            />
            {h.lines.map((line, li) => (
              <text
                key={`${h.x}-${li}`}
                x={h.x + l.colW / 2}
                y={20 + li * 14}
                textAnchor="middle"
                fontSize="12"
                fontWeight="800"
                fill={r.text}
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}
      {l.rows.map((row, ri) => (
        <g key={`r-${row.y}`} className="concept-pop" style={pop(l.header.length + ri)}>
          <line x1={6} x2={l.width - 6} y1={row.y} y2={row.y} stroke="#e2eff3" />
          {ri % 2 === 1 && (
            <rect x={1} y={row.y} width={l.width - 2} height={row.h} fill="#f7fbfc" />
          )}
          {row.label.map((line, li) => (
            <text
              key={`rl-${row.y + li * 14}`}
              x={10}
              y={row.y + 18 + li * 14}
              fontSize="11.5"
              fontWeight="800"
              fill="#0d647d"
            >
              {line}
            </text>
          ))}
          {row.cells.map((cell, ci) =>
            cell.map((line, li) => (
              <text
                key={`c-${l.labelW + ci * l.colW}-${row.y + li * 14}`}
                x={l.labelW + ci * l.colW + 8}
                y={row.y + 18 + li * 14}
                fontSize="11.5"
                fill="#0b2a3c"
              >
                {line}
              </text>
            )),
          )}
        </g>
      ))}
      {l.header.slice(1).map((h) => (
        <line
          key={`v-${h.x}`}
          x1={h.x}
          x2={h.x}
          y1={l.headerH}
          y2={l.height - 4}
          stroke="#e2eff3"
        />
      ))}
    </svg>
  );
}

/** Diagrama conceptual (árbol, flujo, escala o tabla) dibujado por la app a partir de datos. */
export function ConceptDiagram({ diagram }: { diagram: Diagram }) {
  const id = useId();
  const meta = KIND_META[diagram.kind];
  const Icon = meta.icon;
  const roles = new Set<NodeRole>();
  if (diagram.kind === "arbol") {
    const stack = [diagram.root];
    for (let n = stack.pop(); n; n = stack.pop()) {
      roles.add(n.role);
      stack.push(...n.children);
    }
  } else {
    const items =
      diagram.kind === "flujo"
        ? diagram.nodes
        : diagram.kind === "escala"
          ? diagram.ranges
          : diagram.columns;
    for (const it of items) roles.add(it.role);
  }
  const legend = (["respuesta", "elegida", "clave"] as const).filter((r) => roles.has(r));
  const hasNotes = diagram.kind === "arbol" || diagram.kind === "flujo";

  return (
    <figure className="space-y-2" data-testid="concept-diagram" data-kind={diagram.kind}>
      <figcaption className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-brand-900">
          <Icon className="size-4 text-primary" aria-hidden /> {diagram.title}
        </span>
        <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
          {meta.label}
        </span>
      </figcaption>
      <div className="rounded-2xl border border-brand-100 bg-gradient-to-b from-white to-brand-50/50 p-2">
        {diagram.kind === "arbol" && (
          <GraphDiagram layout={layoutTree(diagram.root)} markerId={`${id}-arrow`} />
        )}
        {diagram.kind === "flujo" && (
          <GraphDiagram layout={layoutFlow(diagram.nodes)} markerId={`${id}-arrow`} />
        )}
        {diagram.kind === "escala" && <ScaleDiagram diagram={diagram} />}
        {diagram.kind === "comparacion" && <CompareDiagram diagram={diagram} />}
      </div>
      {(legend.length > 0 || hasNotes) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {legend.map((r) => (
            <span key={r} className="flex items-center gap-1">
              <span
                className="inline-block size-2.5 rounded-sm border"
                style={{ background: ROLE[r].fill, borderColor: ROLE[r].stroke }}
              />
              {ROLE[r].legend}
            </span>
          ))}
          {hasNotes && <span className="ml-auto">Toca un nodo para ver su explicación</span>}
        </div>
      )}
    </figure>
  );
}
