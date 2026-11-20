import type { Item } from "@/lib/schemas/content";
import {
  type ConceptDiagram,
  ConceptDiagramSchema,
  type ModelExplanation,
  type NodeRole,
  type TreeNode,
} from "@/lib/schemas/explanation";

export function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Corta en oraciones (". " o "; "), sin partir decimales como 37.8. */
export function sentences(text: string): string[] {
  return text
    .split(/[.;]\s+/)
    .map((s) => s.trim().replace(/[.;]$/, ""))
    .filter(Boolean)
    .map((s) => `${s}.`);
}

/** Parte un texto en líneas de máximo `maxChars`, con a lo sumo `maxLines` (la última con …). */
export function wrapText(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    // Palabras más largas que la línea se parten con guion.
    let rest = word;
    while (rest.length > maxChars) {
      lines.push(`${rest.slice(0, maxChars - 1)}-`);
      rest = rest.slice(maxChars - 1);
    }
    current = rest;
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] =
    last.length >= maxChars ? `${last.slice(0, maxChars - 1).trimEnd()}…` : `${last}…`;
  return kept;
}

const MAX_TREE_DEPTH = 3; // raíz + 2 niveles
const MAX_TREE_LEAVES = 5;

export function countLeaves(node: TreeNode): number {
  return node.children.length === 0 ? 1 : node.children.reduce((sum, c) => sum + countLeaves(c), 0);
}

export function treeDepth(node: TreeNode): number {
  return 1 + Math.max(0, ...node.children.map(treeDepth));
}

/** Recorta el árbol para que quepa en un teléfono: profundidad ≤ 3, ≤ 4 hijos, ≤ 5 hojas. */
function pruneTree(node: TreeNode, depth = 1): TreeNode {
  const children =
    depth >= MAX_TREE_DEPTH ? [] : node.children.slice(0, 4).map((c) => pruneTree(c, depth + 1));
  const pruned: TreeNode = { ...node, children };
  while (countLeaves(pruned) > MAX_TREE_LEAVES && pruned.children.length > 0) {
    const last = pruned.children[pruned.children.length - 1];
    if (last.children.length > 1) last.children = last.children.slice(0, -1);
    else pruned.children = pruned.children.slice(0, -1);
  }
  return pruned;
}

const text = (s: string | undefined, max: number) => clamp(s ?? "", max);
const optional = (s: string | undefined, max: number) => text(s, max) || undefined;

/** Convierte la salida plana del modelo en un diagrama tipado; lanza si no es utilizable. */
export function normalizeModelDiagram(raw: ModelExplanation["diagram"]): ConceptDiagram {
  const title = text(raw.title, 80) || "Diagrama";
  let diagram: ConceptDiagram;

  if (raw.kind === "arbol") {
    const nodes = raw.nodes.filter((n) => n.id && n.label.trim());
    const ids = new Set(nodes.map((n) => n.id));
    const roots = nodes.filter((n) => !n.parentId || !ids.has(n.parentId) || n.parentId === n.id);
    if (roots.length === 0) throw new Error("Árbol sin raíz");
    const build = (id: string, seen: Set<string>): TreeNode[] =>
      nodes
        .filter((n) => n.parentId === id && n.id !== id && !seen.has(n.id))
        .map((n) => toTree(n, new Set([...seen, n.id])));
    const toTree = (n: (typeof nodes)[number], seen: Set<string>): TreeNode => ({
      label: text(n.label, 40),
      note: optional(n.note, 180),
      edge: optional(n.edge, 28),
      role: n.role,
      children: build(n.id, seen),
    });
    const root =
      roots.length === 1
        ? toTree(roots[0], new Set([roots[0].id]))
        : {
            label: text(raw.title, 40) || "Concepto",
            role: "raiz" as NodeRole,
            children: roots.map((r) => toTree(r, new Set([r.id]))),
          };
    const pruned = pruneTree(root);
    if (pruned.children.length === 0) throw new Error("Árbol demasiado pequeño");
    diagram = { kind: "arbol", title, root: pruned };
  } else if (raw.kind === "flujo") {
    const nodes = raw.nodes
      .filter((n) => n.label.trim())
      .slice(0, 6)
      .map((n) => ({
        label: text(n.label, 40),
        note: optional(n.note, 180),
        edge: optional(n.edge, 28),
        role: n.role,
      }));
    diagram = { kind: "flujo", title, nodes };
  } else if (raw.kind === "escala") {
    const s = raw.scale;
    if (!(s.max > s.min)) throw new Error("Escala inválida");
    const ranges = s.ranges
      .map((r) => ({
        from: Math.max(s.min, Math.min(r.from, r.to)),
        to: Math.min(s.max, Math.max(r.from, r.to)),
        label: text(r.label, 32),
        role: r.role,
      }))
      .filter((r) => r.to > r.from && r.label)
      .sort((a, b) => a.from - b.from)
      .slice(0, 5);
    const markerOk = s.markerLabel.trim() && s.markerValue >= s.min && s.markerValue <= s.max;
    diagram = {
      kind: "escala",
      title,
      unit: text(s.unit, 16),
      min: s.min,
      max: s.max,
      ranges,
      marker: markerOk ? { value: s.markerValue, label: text(s.markerLabel, 32) } : undefined,
    };
  } else {
    const columns = raw.columns
      .filter((c) => c.label.trim())
      .slice(0, 3)
      .map((c) => ({ label: text(c.label, 28), role: c.role }));
    const rows = raw.rows
      .filter((r) => r.label.trim())
      .slice(0, 5)
      .map((r) => ({
        label: text(r.label, 28),
        cells: columns.map((_, i) => text(r.cells[i], 70) || "—"),
      }));
    diagram = { kind: "comparacion", title, columns, rows };
  }

  return ConceptDiagramSchema.parse(diagram);
}

/**
 * Diagrama de respaldo (sin LLM, solo con campos del ítem): mapa conceptual en árbol
 * tema → pregunta → respuesta, opciones que eligió la estudiante y la GPC.
 */
export function buildFallbackConceptDiagram(item: Item, wrongOptionIds: string[]): ConceptDiagram {
  const correct = item.options.find((o) => o.id === item.correctOptionId);
  const why = sentences(item.explanation)[0] ?? item.explanation;
  const chosen = [...new Set(wrongOptionIds)]
    .filter((id) => id !== item.correctOptionId)
    .map((id) => item.options.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o))
    .slice(0, 2);

  const children: TreeNode[] = [
    {
      label: "Respuesta",
      role: "clave",
      note: clamp(item.question, 180),
      children: [
        {
          label: clamp(`${item.correctOptionId}) ${correct?.text ?? ""}`, 40),
          role: "respuesta",
          note: clamp(why, 180),
          children: [],
        },
      ],
    },
  ];
  if (chosen.length > 0) {
    children.push({
      label: "Tu elección",
      role: "normal",
      children: chosen.map((o) => ({
        label: clamp(`${o.id}) ${o.text}`, 40),
        role: "elegida" as NodeRole,
        note: "No es la conducta que respalda la explicación ni la GPC para este caso.",
        children: [],
      })),
    });
  }
  children.push({
    label: clamp(`GPC · ${item.citation.section}`, 40),
    role: "normal",
    note: clamp(item.citation.snippet, 180),
    children: [],
  });

  return ConceptDiagramSchema.parse({
    kind: "arbol",
    title: clamp(item.topic, 80),
    root: { label: clamp(item.topic, 40), role: "raiz", children },
  });
}
