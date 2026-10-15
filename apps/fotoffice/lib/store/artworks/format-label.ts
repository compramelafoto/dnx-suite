/** Cómo se nombra un formato de impresión en el carrito y el pedido. Módulo PURO (lo usa el navegador). */
export function printFormatSize(f: { widthCm: number; heightCm: number }): string {
  return `${f.widthCm} × ${f.heightCm} cm`;
}

/** "Copia (30 × 45 cm)". */
export function printFormatLabel(f: { name: string; widthCm: number; heightCm: number }): string {
  return `${f.name} (${printFormatSize(f)})`;
}
