import type { ErrorType, Item, Resource } from "@/lib/schemas/content";

/** Tipos de error que la rúbrica asocia con las opciones incorrectas que eligió la alumna. */
export function errorTypesFor(item: Item, wrongOptionIds: readonly string[]): ErrorType[] {
  const types = new Set<ErrorType>();
  for (const optionId of wrongOptionIds) {
    if (optionId === item.correctOptionId) continue;
    for (const entry of item.rubric ?? []) {
      if (entry.optionIds.includes(optionId)) types.add(entry.errorType);
    }
  }
  return [...types];
}

/**
 * Recursos del caso con los que atienden sus errores primero (orden estable dentro de cada grupo).
 * Sin errores (acierto al primer intento) se conserva el orden del banco.
 */
export function orderResources(
  resources: readonly Resource[],
  errorTypes: readonly ErrorType[],
): Resource[] {
  const relevant = (r: Resource) => r.errorTypes.some((t) => errorTypes.includes(t));
  return [...resources.filter(relevant), ...resources.filter((r) => !relevant(r))];
}
