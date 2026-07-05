/**
 * Reordena IDs dejando `draggedId` en la posición de `dropTargetId` (antes del target en el orden resultante).
 */
export function reorderIdsAfterDrop(
  orderedIds: number[],
  draggedId: number,
  dropTargetId: number
): number[] {
  if (draggedId === dropTargetId) return orderedIds;
  const without = orderedIds.filter((id) => id !== draggedId);
  const targetIdx = without.indexOf(dropTargetId);
  if (targetIdx === -1) return orderedIds;
  return [...without.slice(0, targetIdx), draggedId, ...without.slice(targetIdx)];
}
