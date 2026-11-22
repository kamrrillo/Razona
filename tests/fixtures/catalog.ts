import { buildCatalog, type Catalog } from "@/lib/content";
import {
  type Item,
  ItemSchema,
  SpecialtySchema,
  TopicGroupSchema,
  TopicSchema,
} from "@/lib/schemas/content";
import raw from "./catalog.json";

/** Catálogo pequeño con casos reales del banco (salida de v_casos_app). */
export function fixtureCatalog(): Catalog {
  return buildCatalog({
    specialties: raw.specialties.map((s) => SpecialtySchema.parse(s)),
    groups: raw.groups.map((g) => TopicGroupSchema.parse(g)),
    topics: raw.topics.map((t) => TopicSchema.parse(t)),
    items: raw.items.map((i) => ItemSchema.parse(i)),
  });
}

export function fixtureItem(id: string): Item {
  const item = fixtureCatalog().byId.get(id);
  if (!item) throw new Error(`Falta ${id} en tests/fixtures/catalog.json`);
  return item;
}

/** Bronquiolitis aguda (caso índice). */
export const BRONQUIOLITIS = "RZ-PED-032-I";
