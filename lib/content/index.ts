import examJson from "@/content/exam.json";
import itemsJson from "@/content/items.json";
import tutorFallbackJson from "@/content/tutor-fallback.json";
import {
  type ExamFile,
  ExamFileSchema,
  type Item,
  type ItemsFile,
  ItemsFileSchema,
  type PublicItem,
  type TutorFallbackFile,
  TutorFallbackFileSchema,
} from "@/lib/schemas/content";

// Se valida al cargar el módulo: si el equipo reemplaza el JSON con un error, falla el build/test.
export const itemsFile: ItemsFile = ItemsFileSchema.parse(itemsJson);
export const examFile: ExamFile = ExamFileSchema.parse(examJson);
export const tutorFallbackFile: TutorFallbackFile = TutorFallbackFileSchema.parse(tutorFallbackJson);

export const specialties = itemsFile.specialties;
export const cases: Item[] = itemsFile.items.filter((i) => i.kind === "case");
export const examItems: Item[] = examFile.items;

const allItems = new Map<string, Item>(
  [...itemsFile.items, ...examFile.items].map((item) => [item.id, item]),
);

export function getItem(id: string): Item | undefined {
  return allItems.get(id);
}

export function getAllItems(): Item[] {
  return [...allItems.values()];
}

export function specialtyName(id: string): string {
  return specialties.find((s) => s.id === id)?.name ?? id;
}

export function toPublicItem(item: Item): PublicItem {
  return {
    id: item.id,
    kind: item.kind,
    specialtyId: item.specialtyId,
    specialtyName: specialtyName(item.specialtyId),
    topic: item.topic,
    title: item.title,
    vignette: item.vignette,
    question: item.question,
    options: item.options,
    isSample: item.isSample,
  };
}

/** Temas que tienen al menos un caso de práctica. */
export function practiceTopics(): string[] {
  return [...new Set(cases.map((c) => c.topic))];
}
