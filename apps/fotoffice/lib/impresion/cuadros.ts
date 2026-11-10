/**
 * Cuadros (canvas y MDF) en el «Pedido para laboratorio»: se eligen como una medida más
 * («Canvas 30x40», «MDF 50x75») y el archivo lleva un doblez de 5 cm por lado para armar el
 * cuadro. Cómo se rellena ese doblez lo elige la cajera en cada foto. Módulo PURO.
 */
import type { ProductoCopia, ProductoDelCatalogo } from "@/lib/impresiones/catalogo-copias";

export type TipoCuadro = "CANVAS" | "MDF";
export type ModoDoblez = "ESPEJO" | "DESENFOCADO" | "COLOR" | "ENVOLVENTE";

/** Lo que se agrega en cada lateral para doblar sobre el bastidor o la placa. */
export const DOBLEZ_CM = 5;
export const MODO_DOBLEZ_POR_OMISION: ModoDoblez = "ESPEJO";
export const MODOS_DOBLEZ: readonly ModoDoblez[] = ["ESPEJO", "DESENFOCADO", "COLOR", "ENVOLVENTE"];

export const TEXTO_DOBLEZ: Record<ModoDoblez, { nombre: string; ayuda: string }> = {
  ESPEJO: { nombre: "Espejo", ayuda: "Repite en espejo el borde de la foto: parece que sigue y no se pierde nada del frente." },
  DESENFOCADO: { nombre: "Desenfocado", ayuda: "La foto agrandada y borrosa: toma los colores de la foto." },
  COLOR: { nombre: "Color liso", ayuda: "Un color parejo (blanco, negro o el que elijas)." },
  ENVOLVENTE: { nombre: "Foto envolvente", ayuda: "La foto dobla sobre el lateral: se pierden 5 cm de cada borde del frente." },
};

const PREFIJO: Record<TipoCuadro, string> = { CANVAS: "Canvas", MDF: "MDF" };
const MEDIDA_CUADRO = /^(Canvas|MDF) (\d{1,3})x(\d{1,3})$/;
const NOMBRE_PRODUCTO = /^cuadro (canvas|mdf) (\d{1,3}) ?x ?(\d{1,3})$/;

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** «Canvas 30x40» → { tipo, base: "30x40" }; null si la medida es de una copia común. */
export function cuadroDeMedida(medida: string): { tipo: TipoCuadro; base: string } | null {
  const m = medida.match(MEDIDA_CUADRO);
  if (!m) return null;
  return { tipo: m[1] === "MDF" ? "MDF" : "CANVAS", base: `${Number(m[2])}x${Number(m[3])}` };
}

export function esMedidaDeCuadro(medida: string): boolean {
  return cuadroDeMedida(medida) !== null;
}

/**
 * Los cuadros del catálogo («Cuadro canvas 30x40», «Cuadro MDF 50x75») como productos del pedido
 * para laboratorio: la medida lleva el tipo adelante, plazo «próxima semana» y precio por unidad.
 * Sólo el laboratorio los usa: el bot de pedidos sigue leyendo nada más que copias.
 */
export function leerProductosDeCuadro(productos: readonly ProductoDelCatalogo[]): ProductoCopia[] {
  const salida: ProductoCopia[] = [];
  for (const p of productos) {
    if (!(p.priceArs > 0)) continue;
    const m = normalizar(p.name).match(NOMBRE_PRODUCTO);
    if (!m) continue;
    const tipo: TipoCuadro = m[1] === "mdf" ? "MDF" : "CANVAS";
    salida.push({
      id: p.id,
      medida: `${PREFIJO[tipo]} ${Number(m[2])}x${Number(m[3])}`,
      plazo: "SEMANA",
      desde: 0,
      precio: p.priceArs,
      costo: p.costArs,
      proveedorId: p.preferredProveedorId,
    });
  }
  return salida;
}

/** Píxeles del doblez para un frente de `anchoPx` que representa `anchoMm` del papel. */
export function doblezEnPx(anchoPx: number, anchoMm: number): number {
  return Math.max(1, Math.round((anchoPx * DOBLEZ_CM * 10) / anchoMm));
}

/** Cómo se nombra el cuadro para el laboratorio (carpeta del ZIP y resumen del correo). */
export function etiquetaDeCuadro(medida: string, modo: ModoDoblez | undefined): string | null {
  const c = cuadroDeMedida(medida);
  if (!c) return null;
  return `${PREFIJO[c.tipo]} ${c.base} + doblez ${DOBLEZ_CM} cm (${TEXTO_DOBLEZ[modo ?? MODO_DOBLEZ_POR_OMISION].nombre.toLowerCase()})`;
}
