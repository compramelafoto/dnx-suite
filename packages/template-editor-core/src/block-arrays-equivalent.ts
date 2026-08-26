import type { TemplateV2Block } from "./render-core";

function configJsonEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function layoutEqual(a: TemplateV2Block["layout"], b: TemplateV2Block["layout"]): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.rotation === b.rotation &&
    a.zIndex === b.zIndex &&
    a.visible === b.visible &&
    (a.locked ?? false) === (b.locked ?? false) &&
    (a.opacity ?? 1) === (b.opacity ?? 1)
  );
}

function sameBlockData(a: TemplateV2Block, b: TemplateV2Block): boolean {
  if (a.id !== b.id || a.type !== b.type) return false;
  if ((a.name ?? null) !== (b.name ?? null)) return false;
  if (!layoutEqual(a.layout, b.layout)) return false;
  return configJsonEqual(a.configJson, b.configJson);
}

/**
 * Indica si dos listas de bloques representan el mismo estado persistible (mismos ids y datos por bloque).
 * Ignora el orden del array (coherente con que `setBlocks` reordena por zIndex).
 */
export function areTemplateV2BlockArraysEquivalent(
  prev: TemplateV2Block[],
  next: TemplateV2Block[]
): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  const byId = new Map(next.map((b) => [b.id, b]));
  for (const block of prev) {
    const other = byId.get(block.id);
    if (!other || !sameBlockData(block, other)) return false;
  }
  return true;
}
