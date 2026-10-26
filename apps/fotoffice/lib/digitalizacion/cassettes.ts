/**
 * Cuántos cassettes se vendieron y cuántos están hechos, por trabajo y por pedido. Módulo PURO (sin
 * base): lo usan el envío automático, el avance de etapas y las pantallas.
 *
 * **Esperados de un trabajo.** La `cantidad` del ítem del pedido que lo originó
 * (`items[pedidoItemIndex]`), siempre que ese ítem exista, no sea un cargo extra (`cargo-*`), sea de
 * digitalización (su nombre, o el producto o la categoría del trabajo, hablan de digitalizar video)
 * y tenga una cantidad entera ≥ 1. Si no, null (desconocido): trabajo creado a mano, pedido
 * migrado, ítem que no es de video…
 *
 * **Esperados de un pedido.** La suma de sus trabajos de digitalización. Si alguno tiene la cantidad
 * desconocida, el pedido queda desconocido (null). Sin trabajos de digitalización, también null.
 *
 * **Grabados** (lo que se muestra y lo que mueve a «Grabado»): grabaciones COMPLETAS sin descartar,
 * se hayan convertido o no. **Hechos** (lo que habilita el envío y «Listo para retirar»): las
 * COMPLETAS que ya terminaron la conversión, LISTA o SIN_IMAGEN. Las de antes de la conversión
 * (`conversionEstado` null) cuentan como hechas sólo si son sin imagen: el mismo criterio que
 * `estadoDeEntrega`. Las que siguen grabando, en cola, convirtiéndose o con error no cuentan como
 * hechas. Un DVD cuenta como 1, igual que un VHS.
 *
 * **Decisión sobre las grabaciones SIN_IMAGEN** (el cassette estaba vacío o no tenía señal): cuentan
 * como hechas para el envío y como grabadas para «Grabado», siempre que el trabajo tenga al menos
 * una grabación con imagen. Un cassette vacío también es un cassette que se pasó; si no contara, el
 * trabajo no avanzaría nunca. Lo que no se hace es mover a «Grabado» un trabajo que sólo tiene
 * grabaciones sin imagen (como hasta ahora).
 */
import { PREFIJO_ITEM_CARGO } from "@/lib/pedidos/cargos-puro";
import { esNombreDeDigitalizacion, esTrabajoDeDigitalizacion, textoFaltanCassettes } from "./trabajo";

export { textoFaltanCassettes };

export type GrabacionParaContar = { estado: string; conversionEstado: string | null; sinImagen: boolean };

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Los cassettes vendidos para un trabajo: la cantidad de `items[pedidoItemIndex]`, o null si no se
 * puede saber. `textosDelTrabajo` (nombre del producto y de su categoría) sirve cuando el renglón
 * se renombró a mano y su nombre ya no dice «VHS».
 */
export function cassettesEsperados(items: unknown, pedidoItemIndex: number | null, textosDelTrabajo: readonly (string | null | undefined)[] = []): number | null {
  if (pedidoItemIndex === null || !Number.isInteger(pedidoItemIndex) || pedidoItemIndex < 0 || !Array.isArray(items)) return null;
  const it = items[pedidoItemIndex];
  if (!esObjeto(it)) return null;
  if (typeof it.id === "string" && it.id.startsWith(PREFIJO_ITEM_CARGO)) return null;
  const nombre = typeof it.nombre === "string" ? it.nombre : null;
  if (!esNombreDeDigitalizacion(nombre) && !textosDelTrabajo.some(esNombreDeDigitalizacion)) return null;
  const cantidad = it.cantidad;
  if (typeof cantidad !== "number" || !Number.isInteger(cantidad) || cantidad < 1) return null;
  return cantidad;
}

/** COMPLETA y sin descartar: el cassette ya se pasó (aunque todavía se esté convirtiendo). */
export function estaGrabada(g: GrabacionParaContar): boolean {
  return g.estado === "COMPLETA";
}

/** COMPLETA y con la conversión terminada (LISTA o SIN_IMAGEN; las viejas sin imagen, también). */
export function estaHecha(g: GrabacionParaContar): boolean {
  if (g.estado !== "COMPLETA") return false;
  if (g.conversionEstado === "LISTA" || g.conversionEstado === "SIN_IMAGEN") return true;
  return g.conversionEstado === null && g.sinImagen === true;
}

export type CuentaTrabajo = {
  /** Cassettes vendidos; null = desconocido. */
  esperados: number | null;
  /** Completas sin descartar (con o sin imagen). */
  grabados: number;
  /** Completas con imagen. */
  grabadosConImagen: number;
  /** Completas con la conversión terminada (LISTA o SIN_IMAGEN). */
  hechos: number;
};

export function contarTrabajo(t: {
  items: unknown;
  pedidoItemIndex: number | null;
  textos?: readonly (string | null | undefined)[];
  grabaciones: readonly GrabacionParaContar[];
}): CuentaTrabajo {
  const vivas = t.grabaciones.filter((g) => g.estado !== "DESCARTADA");
  return {
    esperados: cassettesEsperados(t.items, t.pedidoItemIndex, t.textos ?? []),
    grabados: vivas.filter(estaGrabada).length,
    grabadosConImagen: vivas.filter((g) => estaGrabada(g) && !g.sinImagen).length,
    hechos: vivas.filter(estaHecha).length,
  };
}

/** Cassettes que faltan terminar en un trabajo (0 si la cantidad es desconocida). */
export function faltanEnTrabajo(c: CuentaTrabajo): number {
  return c.esperados === null ? 0 : Math.max(0, c.esperados - c.hechos);
}

/** El trabajo tiene todos sus cassettes hechos (o la cantidad es desconocida: regla de antes). */
export function trabajoCompleto(c: CuentaTrabajo): boolean {
  return faltanEnTrabajo(c) === 0;
}

/**
 * ¿El trabajo pasa a «Grabado»? Con la cantidad conocida, cuando tiene tantas grabaciones completas
 * como cassettes vendidos y al menos una con imagen. Con la cantidad desconocida, con la primera
 * grabación con imagen (la regla de antes).
 */
export function cumpleGrabado(c: CuentaTrabajo): boolean {
  if (c.grabadosConImagen < 1) return false;
  return c.esperados === null || c.grabados >= c.esperados;
}

export type CuentaPedido = {
  /** Suma de los trabajos de digitalización; null si alguno es desconocido (o no hay ninguno). */
  esperados: number | null;
  /** Con la cantidad conocida, cada trabajo suma hasta su cantidad; si no, todas sus grabadas. */
  grabados: number;
  hechos: number;
  /** Cassettes sin terminar de los trabajos con cantidad conocida (aunque el pedido sea desconocido). */
  faltan: number;
};

export const CUENTA_VACIA: CuentaPedido = { esperados: null, grabados: 0, hechos: 0, faltan: 0 };

/** La cuenta de un pedido a partir de la de sus trabajos de digitalización. */
export function contarPedido(trabajos: readonly CuentaTrabajo[]): CuentaPedido {
  if (trabajos.length === 0) return CUENTA_VACIA;
  const conocida = trabajos.every((t) => t.esperados !== null);
  let esperados = 0;
  let grabados = 0;
  let hechos = 0;
  let faltan = 0;
  for (const t of trabajos) {
    esperados += t.esperados ?? 0;
    grabados += conocida ? Math.min(t.grabados, t.esperados!) : t.grabados;
    hechos += t.hechos;
    faltan += faltanEnTrabajo(t);
  }
  return { esperados: conocida ? esperados : null, grabados, hechos, faltan };
}

/** Los trabajos (con sus datos crudos) que son de digitalización y su cuenta. */
export function cuentasDeTrabajos<T extends {
  id: string;
  name: string;
  pedidoItemIndex: number | null;
  product?: { name: string | null; category?: { name: string | null } | null } | null;
  pedido?: { items: unknown } | null;
  grabaciones: readonly GrabacionParaContar[];
}>(trabajos: readonly T[]): { trabajo: T; cuenta: CuentaTrabajo }[] {
  const r: { trabajo: T; cuenta: CuentaTrabajo }[] = [];
  for (const t of trabajos) {
    const textos = [t.name, t.product?.name, t.product?.category?.name];
    if (!esTrabajoDeDigitalizacion({ grabaciones: t.grabaciones.length, textos })) continue;
    r.push({
      trabajo: t,
      cuenta: contarTrabajo({ items: t.pedido?.items ?? null, pedidoItemIndex: t.pedidoItemIndex, textos: [t.product?.name, t.product?.category?.name], grabaciones: t.grabaciones }),
    });
  }
  return r;
}

// --- Textos -----------------------------------------------------------------------------------

const cassettes = (n: number) => (n === 1 ? "cassette" : "cassettes");

/** «1 de 2 cassettes grabados» o, sin la cantidad, «1 cassette grabado». */
export function textoDeCassettes(c: { esperados: number | null; grabados: number }): string {
  if (c.esperados === null) return `${c.grabados} ${c.grabados === 1 ? "cassette grabado" : "cassettes grabados"}`;
  return `${c.grabados} de ${c.esperados} ${c.esperados === 1 ? "cassette grabado" : "cassettes grabados"}`;
}

/** La pregunta del botón manual cuando faltan cassettes; null si no faltan. */
export function confirmacionEnvioIncompleto(c: { esperados: number | null; faltan: number }): string | null {
  if (c.faltan <= 0) return null;
  const de = c.esperados !== null ? ` de ${c.esperados}` : "";
  return `Falta grabar ${c.faltan}${de} ${cassettes(c.esperados ?? c.faltan)}: ¿enviar igual?`;
}
