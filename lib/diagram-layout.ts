/**
 * Geometría pura (sin React) de los diagramas conceptuales: árbol, flujo, escala y comparación.
 * Todo se calcula en un lienzo de 340 px de ancho mínimo, pensado para el teléfono.
 */
import { countLeaves, wrapText } from "@/lib/ai/concept-diagram";
import type { ConceptDiagram, NodeRole, TreeNode } from "@/lib/schemas/explanation";

export const MIN_W = 340;
const CHAR_W = 6.9; // ancho medio de un carácter a 12.5 px
const LINE_H = 15;

export type LaidNode = {
  id: string;
  x: number; // esquina superior izquierda
  y: number;
  w: number;
  h: number;
  lines: string[];
  role: NodeRole;
  label: string;
  note?: string;
};
export type LaidEdge = {
  id: string;
  d: string;
  label?: string;
  /** Centro y ancho de la etiqueta (ya recortada para no encimarse ni salirse del lienzo). */
  lx: number;
  ly: number;
  lw: number;
};

const EDGE_CHAR_W = 6.1;

/** Recorta la etiqueta de una arista al ancho disponible y la mantiene dentro del lienzo. */
function fitEdgeLabel(text: string | undefined, maxW: number, cx: number, canvasW: number) {
  if (!text) return { label: undefined, lx: cx, lw: 0 };
  const chars = Math.max(4, Math.floor((maxW - 14) / EDGE_CHAR_W));
  const label = text.length <= chars ? text : `${text.slice(0, chars - 1).trimEnd()}…`;
  const lw = label.length * EDGE_CHAR_W + 14;
  const lx = Math.min(Math.max(cx, lw / 2 + 2), canvasW - lw / 2 - 2);
  return { label, lx, lw };
}
export type Layout = { width: number; height: number; nodes: LaidNode[]; edges: LaidEdge[] };

const charsFor = (w: number) => Math.max(6, Math.floor((w - 16) / CHAR_W));
const heightFor = (lines: number) => 16 + lines * LINE_H;

export function layoutTree(root: TreeNode): Layout {
  const leaves = countLeaves(root);
  const width = Math.max(MIN_W, leaves * 108);
  const slot = width / leaves;
  const GAP_Y = 46;

  type Tmp = {
    node: TreeNode;
    id: string;
    depth: number;
    cx: number;
    w: number;
    lines: string[];
    parent?: Tmp;
  };
  const all: Tmp[] = [];
  let leafIndex = 0;
  const visit = (node: TreeNode, depth: number, id: string, parent?: Tmp): Tmp => {
    const span = countLeaves(node);
    const w = Math.min(depth === 0 ? 230 : 200, Math.max(84, span * slot - 12));
    const tmp: Tmp = {
      node,
      id,
      depth,
      cx: 0,
      w,
      lines: wrapText(node.label, charsFor(w), 3),
      parent,
    };
    all.push(tmp);
    if (node.children.length === 0) {
      tmp.cx = (leafIndex + 0.5) * slot;
      leafIndex += 1;
    } else {
      const kids = node.children.map((c, i) => visit(c, depth + 1, `${id}.${i}`, tmp));
      tmp.cx = (kids[0].cx + kids[kids.length - 1].cx) / 2;
    }
    return tmp;
  };
  visit(root, 0, "n0");

  const depths = Math.max(...all.map((t) => t.depth)) + 1;
  const rowH = Array.from({ length: depths }, (_, d) =>
    Math.max(...all.filter((t) => t.depth === d).map((t) => heightFor(t.lines.length))),
  );
  const rowY: number[] = [];
  let y = 8;
  for (let d = 0; d < depths; d++) {
    rowY.push(y);
    y += rowH[d] + GAP_Y;
  }

  const nodes: LaidNode[] = all.map((t) => {
    const h = heightFor(t.lines.length);
    return {
      id: t.id,
      x: t.cx - t.w / 2,
      y: rowY[t.depth] + (rowH[t.depth] - h) / 2,
      w: t.w,
      h,
      lines: t.lines,
      role: t.node.role,
      label: t.node.label,
      note: t.node.note,
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: LaidEdge[] = all
    .filter((t) => t.parent)
    .map((t) => {
      const p = byId.get(t.parent?.id ?? "") as LaidNode;
      const c = byId.get(t.id) as LaidNode;
      const px = p.x + p.w / 2;
      const py = p.y + p.h;
      const cx = c.x + c.w / 2;
      const cy = c.y;
      const mid = py + 14;
      return {
        id: t.id,
        d: `M ${px} ${py} V ${mid} H ${cx} V ${cy - 4}`,
        ...fitEdgeLabel(t.node.edge, Math.min(150, c.w + 10), cx, width),
        ly: (mid + cy) / 2 + 2,
      };
    });
  return { width, height: y - GAP_Y + 10, nodes, edges };
}

export function layoutFlow(
  items: { label: string; note?: string; edge?: string; role: NodeRole }[],
): Layout {
  const width = MIN_W;
  const w = 250;
  const x = (width - w) / 2;
  const GAP_Y = 44;
  let y = 8;
  const nodes: LaidNode[] = items.map((n, i) => {
    const lines = wrapText(n.label, charsFor(w), 2);
    const h = heightFor(lines.length) + 4;
    const laid = { id: `f${i}`, x, y, w, h, lines, role: n.role, label: n.label, note: n.note };
    y += h + GAP_Y;
    return laid;
  });
  const edges: LaidEdge[] = nodes.slice(1).map((c, i) => {
    const p = nodes[i];
    const cx = width / 2;
    return {
      id: c.id,
      d: `M ${cx} ${p.y + p.h} V ${c.y - 4}`,
      ...fitEdgeLabel(items[i].edge, 200, cx, width),
      ly: (p.y + p.h + c.y) / 2 + 2,
    };
  });
  return { width, height: y - GAP_Y + 10, nodes, edges };
}

export type ScaleLayout = {
  width: number;
  height: number;
  x0: number;
  x1: number;
  barY: number;
  barH: number;
  segments: {
    x: number;
    w: number;
    role: NodeRole;
    label: string;
    lines: string[];
    labelY: number;
  }[];
  ticks: { x: number; value: string; anchor: "start" | "middle" | "end" }[];
  marker?: { x: number; label: string };
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function layoutScale(d: Extract<ConceptDiagram, { kind: "escala" }>): ScaleLayout {
  const width = MIN_W;
  const x0 = 22;
  const x1 = width - 22;
  const toX = (v: number) => x0 + ((v - d.min) / (d.max - d.min)) * (x1 - x0);
  const barY = d.marker ? 84 : 44;
  const barH = 26;
  const segments = d.ranges.map((r, i) => {
    const x = toX(r.from);
    const w = Math.max(2, toX(r.to) - x);
    const narrow = w < 70;
    const lines = wrapText(
      r.label,
      Math.max(7, Math.floor((narrow ? Math.max(w, 64) : w) / 6.3)),
      3,
    );
    return {
      x,
      w,
      role: r.role,
      label: r.label,
      lines,
      labelY: barY + barH + 20 + (narrow && i % 2 ? 44 : 0),
    };
  });
  const values = new Set<number>([d.min, d.max, ...d.ranges.flatMap((r) => [r.from, r.to])]);
  const ticks = [...values]
    .sort((a, b) => a - b)
    .map((v) => ({ x: toX(v), value: fmt(v), anchor: "middle" as "start" | "middle" | "end" }))
    .filter((t, i, arr) => i === 0 || t.x - arr[i - 1].x > 22)
    .map((t, i, arr) => {
      if (i === 0) return { ...t, anchor: "start" as const };
      // La unidad va en la última marca, alineada al borde para que no se corte.
      if (i === arr.length - 1)
        return { ...t, value: `${t.value} ${d.unit}`.trim(), anchor: "end" as const };
      return t;
    });
  const lowest = Math.max(...segments.map((s) => s.labelY + s.lines.length * 14));
  return {
    width,
    height: lowest + 10,
    x0,
    x1,
    barY,
    barH,
    segments,
    ticks,
    marker: d.marker
      ? {
          x: toX(d.marker.value),
          // Si el modelo ya puso el valor en la etiqueta, no se repite.
          label: /\d/.test(d.marker.label)
            ? d.marker.label
            : `${d.marker.label}: ${fmt(d.marker.value)} ${d.unit}`.trim(),
        }
      : undefined,
  };
}

export type TableLayout = {
  width: number;
  height: number;
  labelW: number;
  colW: number;
  header: { x: number; lines: string[]; role: NodeRole }[];
  headerH: number;
  rows: { y: number; h: number; label: string[]; cells: string[][] }[];
};

export function layoutCompare(d: Extract<ConceptDiagram, { kind: "comparacion" }>): TableLayout {
  const width = MIN_W;
  const labelW = 96;
  const colW = (width - labelW) / d.columns.length;
  const colChars = Math.max(8, Math.floor((colW - 12) / 6.1));
  const header = d.columns.map((c, i) => ({
    x: labelW + i * colW,
    lines: wrapText(c.label, colChars, 2),
    role: c.role,
  }));
  const headerH = 14 + Math.max(...header.map((h) => h.lines.length)) * 14 + 4;
  let y = headerH;
  const rows = d.rows.map((r) => {
    const label = wrapText(r.label, 13, 3);
    const cells = r.cells.map((c) => wrapText(c, colChars, 4));
    const h = 14 + Math.max(label.length, ...cells.map((c) => c.length)) * 14;
    const row = { y, h, label, cells };
    y += h;
    return row;
  });
  return { width, height: y + 2, labelW, colW, header, headerH, rows };
}
