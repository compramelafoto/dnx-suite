/**
 * Texto legible del pack comprado a partir de los ítems de preventa (PackDefinition).
 */
export function buildPreCompraPackSummary(
  items: Array<{ packDefinition: { name: string } | null }>
): string {
  const counts = new Map<string, number>();
  for (const it of items) {
    const name = it.packDefinition?.name?.trim() || "Pack";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return "—";
  return [...counts.entries()]
    .map(([name, n]) => (n > 1 ? `${name} × ${n}` : name))
    .join(" · ");
}
