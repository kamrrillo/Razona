import "server-only";
import {
  type Item,
  ItemSchema,
  type PublicItem,
  type Specialty,
  type Topic,
  type TopicGroup,
} from "@/lib/schemas/content";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Catálogo de contenido clínico.
 *
 * Fuente: el banco de casos (json/casos) cargado en Supabase. Se lee de la vista
 * `v_casos_app` con la service role (las tablas del banco no son legibles para usuarios:
 * la rúbrica revela la respuesta). Se guarda en memoria unos minutos.
 */
export type Catalog = {
  specialties: Specialty[];
  groups: TopicGroup[];
  topics: Topic[];
  /** Todos los casos vigentes (índices y variantes). */
  items: Item[];
  /** Casos de práctica: los índices. Las variantes se reservan para transferencia y examen. */
  cases: Item[];
  byId: Map<string, Item>;
};

const CACHE_MS = Number(process.env.CONTENT_CACHE_MS ?? 5 * 60 * 1000);
let cache: { catalog: Catalog; at: number } | null = null;
let pending: Promise<Catalog> | null = null;

export function buildCatalog(input: {
  specialties: Specialty[];
  groups: TopicGroup[];
  topics: Topic[];
  items: Item[];
}): Catalog {
  const items = [...input.items].sort((a, b) => a.id.localeCompare(b.id));
  const usedSpecialties = new Set(items.map((i) => i.specialtyId));
  return {
    specialties: input.specialties.filter((s) => usedSpecialties.has(s.id)),
    groups: input.groups,
    topics: input.topics,
    items,
    cases: items.filter((i) => i.kind === "case" && i.tipo !== "variante"),
    byId: new Map(items.map((i) => [i.id, i])),
  };
}

async function loadCatalog(): Promise<Catalog> {
  const db = createAdminClient();
  const [specialties, groups, topics, items] = await Promise.all([
    db.from("specialties").select("id, name, sort_order").order("sort_order"),
    db.from("temas_grupos").select("id, nombre, especialidad_id, orden").order("orden"),
    db.from("temas").select("sindrome, nombre, grupo_id").order("nombre"),
    db.from("v_casos_app").select("id, payload").order("id"),
  ]);
  for (const r of [specialties, groups, topics, items]) if (r.error) throw r.error;
  return buildCatalog({
    specialties: (specialties.data ?? []).map((s) => ({ id: s.id, name: s.name })),
    groups: (groups.data ?? []).map((g) => ({
      id: g.id,
      name: g.nombre,
      specialtyId: g.especialidad_id,
    })),
    topics: (topics.data ?? []).map((t) => ({
      sindrome: t.sindrome,
      name: t.nombre,
      groupId: t.grupo_id,
    })),
    items: (items.data ?? []).map((row) => {
      const parsed = ItemSchema.safeParse(row.payload);
      if (!parsed.success) {
        throw new Error(
          `v_casos_app: el caso ${row.id} no cumple ItemSchema: ${parsed.error.message}`,
        );
      }
      return parsed.data;
    }),
  });
}

/** Catálogo vigente (en caché por CONTENT_CACHE_MS; 5 min por defecto). */
export async function getCatalog(): Promise<Catalog> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.catalog;
  pending ??= loadCatalog()
    .then((catalog) => {
      cache = { catalog, at: Date.now() };
      return catalog;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Solo pruebas: fija el catálogo sin consultar la base. */
export function setCatalogForTests(catalog: Catalog | null) {
  cache = catalog ? { catalog, at: Number.POSITIVE_INFINITY } : null;
}

export async function getItem(id: string): Promise<Item | undefined> {
  return (await getCatalog()).byId.get(id);
}

/** Nombre de la especialidad del ítem (viene en el propio ítem del banco). */
export function specialtyName(item: Pick<Item, "specialtyId" | "specialtyName">): string {
  return item.specialtyName ?? item.specialtyId;
}

export function toPublicItem(item: Item): PublicItem {
  return {
    id: item.id,
    kind: item.kind,
    specialtyId: item.specialtyId,
    specialtyName: specialtyName(item),
    topic: item.topic,
    title: item.title,
    vignette: item.vignette,
    question: item.question,
    options: item.options,
    isSample: item.isSample,
  };
}

/** Temas que tienen al menos un caso de práctica. */
export function practiceTopics(catalog: Catalog): string[] {
  return [...new Set(catalog.cases.map((c) => c.topic))];
}
