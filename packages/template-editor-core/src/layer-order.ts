import type { TemplateV2Block } from "@/lib/template-v2/render-core";

/** Orden de panel: arriba = al frente del lienzo (zIndex mayor). */
export function sortBlocksByZIndexDesc(blocks: TemplateV2Block[]): TemplateV2Block[] {
  return [...blocks].sort((a, b) => {
    const dz = b.layout.zIndex - a.layout.zIndex;
    if (dz !== 0) return dz;
    return a.id.localeCompare(b.id);
  });
}

function swapZIndexBetween(blocks: TemplateV2Block[], idA: string, idB: string): TemplateV2Block[] {
  const a = blocks.find((b) => b.id === idA);
  const b = blocks.find((b) => b.id === idB);
  if (!a || !b) return blocks;
  const za = a.layout.zIndex;
  const zb = b.layout.zIndex;
  return blocks.map((block) => {
    if (block.id === idA) return { ...block, layout: { ...block.layout, zIndex: zb } };
    if (block.id === idB) return { ...block, layout: { ...block.layout, zIndex: za } };
    return block;
  });
}

/** Subir: un paso hacia el frente (intercambia zIndex con la capa inmediatamente superior en el panel). */
export function swapLayerTowardFront(blocks: TemplateV2Block[], blockId: string): TemplateV2Block[] {
  const sorted = sortBlocksByZIndexDesc(blocks);
  const i = sorted.findIndex((b) => b.id === blockId);
  if (i <= 0) return blocks;
  return swapZIndexBetween(blocks, sorted[i].id, sorted[i - 1].id);
}

/** Bajar: un paso hacia atrás (intercambia zIndex con la capa inmediatamente inferior en el panel). */
export function swapLayerTowardBack(blocks: TemplateV2Block[], blockId: string): TemplateV2Block[] {
  const sorted = sortBlocksByZIndexDesc(blocks);
  const i = sorted.findIndex((b) => b.id === blockId);
  if (i < 0 || i >= sorted.length - 1) return blocks;
  return swapZIndexBetween(blocks, sorted[i].id, sorted[i + 1].id);
}

function mergeBlockUpdates(base: TemplateV2Block[], updatedSubset: TemplateV2Block[]): TemplateV2Block[] {
  const byId = new Map(updatedSubset.map((b) => [b.id, b]));
  return base.map((b) => byId.get(b.id) ?? b);
}

export function swapLayerTowardFrontForPage(blocks: TemplateV2Block[], pageIndex: number, blockId: string): TemplateV2Block[] {
  const onPage = blocks.filter((b) => (b.pageIndex ?? 0) === pageIndex);
  const reordered = swapLayerTowardFront(onPage, blockId);
  return mergeBlockUpdates(blocks, reordered);
}

export function swapLayerTowardBackForPage(blocks: TemplateV2Block[], pageIndex: number, blockId: string): TemplateV2Block[] {
  const onPage = blocks.filter((b) => (b.pageIndex ?? 0) === pageIndex);
  const reordered = swapLayerTowardBack(onPage, blockId);
  return mergeBlockUpdates(blocks, reordered);
}

/**
 * Reordena capas según el orden del panel (índice 0 = al frente, arriba en la lista).
 * Reasigna zIndex de 0..n-1 para mantener un orden total consistente.
 */
export function reorderLayersByPanelIndex(blocks: TemplateV2Block[], fromIndex: number, toIndex: number): TemplateV2Block[] {
  const sorted = sortBlocksByZIndexDesc(blocks);
  if (sorted.length === 0) return blocks;
  if (fromIndex === toIndex) return blocks;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= sorted.length || toIndex >= sorted.length) return blocks;
  const reordered = [...sorted];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  const n = reordered.length;
  const idToZ = new Map(reordered.map((b, i) => [b.id, n - 1 - i]));
  return blocks.map((b) => {
    const z = idToZ.get(b.id);
    if (z === undefined) return b;
    return { ...b, layout: { ...b.layout, zIndex: z } };
  });
}

/** Reordenar capas solo dentro de una hoja (índices del panel = solo bloques de esa página). */
export function reorderLayersByPanelIndexForPage(
  blocks: TemplateV2Block[],
  pageIndex: number,
  fromIndex: number,
  toIndex: number
): TemplateV2Block[] {
  const onPage = blocks.filter((b) => (b.pageIndex ?? 0) === pageIndex);
  const sorted = sortBlocksByZIndexDesc(onPage);
  if (sorted.length === 0) return blocks;
  if (fromIndex === toIndex) return blocks;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= sorted.length || toIndex >= sorted.length) return blocks;
  const reordered = [...sorted];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  const n = reordered.length;
  const idToZ = new Map(reordered.map((b, i) => [b.id, n - 1 - i]));
  return blocks.map((b) => {
    if ((b.pageIndex ?? 0) !== pageIndex) return b;
    const z = idToZ.get(b.id);
    if (z === undefined) return b;
    return { ...b, layout: { ...b.layout, zIndex: z } };
  });
}
