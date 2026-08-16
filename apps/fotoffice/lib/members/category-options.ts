export type CategoryOption = { id: string; name: string };

/**
 * Opciones de categoría para el form de edición de un socio: las activas
 * del workspace, más la categoría actual del socio aunque esté desactivada
 * (regla: "una categoría desactivada no se ofrece para socios NUEVOS, pero
 * los socios existentes la conservan" — si no la incluyéramos acá, guardar
 * el form sin tocar el campo perdería la categoría del socio).
 */
export function resolveCategoryOptionsForEdit<T extends CategoryOption>(
  activeCategories: readonly T[],
  currentCategoryId: string | null | undefined,
  currentCategory: T | null | undefined,
): T[] {
  if (!currentCategoryId || !currentCategory) return [...activeCategories];
  if (activeCategories.some((c) => c.id === currentCategoryId)) return [...activeCategories];
  return [...activeCategories, currentCategory];
}
