import { ETIQUETA_PAPEL, type Papel } from "./constantes";

export type ItemParaLab = { itemId: string; proveedorId: string | null; widthCm: number; heightCm: number; quantity: number; sourceName: string };

export function agruparPorLaboratorio<T extends { proveedorId: string | null }>(items: T[]): Map<string | null, T[]> {
  const g = new Map<string | null, T[]>();
  for (const i of items) g.set(i.proveedorId, [...(g.get(i.proveedorId) ?? []), i]);
  return g;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1))));
export function etiquetaTamano(w: number, h: number): string {
  return `${num(Math.min(w, h))}x${num(Math.max(w, h))}`;
}

const limpio = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").trim() || "Cliente";
const baseSinExtension = (n: string) => limpio(n.replace(/\.[^.]+$/, ""));

export function rutasDelZip(numero: number, cliente: string, papel: Papel, items: ItemParaLab[]): { itemId: string; ruta: string }[] {
  const raiz = `Pedido ${numero} - ${limpio(cliente)}`;
  const usados = new Map<string, number>();
  return items.map((i) => {
    const carpeta = `${raiz}/${etiquetaTamano(i.widthCm, i.heightCm)} ${ETIQUETA_PAPEL[papel]}/${i.quantity} ${i.quantity === 1 ? "copia" : "copias"}`;
    let nombre = `${baseSinExtension(i.sourceName)}.jpg`;
    const clave = `${carpeta}/${nombre}`.toLowerCase();
    const n = usados.get(clave) ?? 0;
    usados.set(clave, n + 1);
    if (n > 0) nombre = `${baseSinExtension(i.sourceName)} (${n + 1}).jpg`;
    return { itemId: i.itemId, ruta: `${carpeta}/${nombre}` };
  });
}

export function resumenParaLab(items: ItemParaLab[], papel: Papel) {
  const m = new Map<string, number>();
  for (const i of items) {
    const t = etiquetaTamano(i.widthCm, i.heightCm);
    m.set(t, (m.get(t) ?? 0) + i.quantity);
  }
  return [...m.entries()].map(([tamano, cantidad]) => ({ tamano, papel: ETIQUETA_PAPEL[papel], cantidad }));
}
