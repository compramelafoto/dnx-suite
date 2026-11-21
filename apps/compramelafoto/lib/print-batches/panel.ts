/**
 * Piezas puras del panel «Impresiones» del fotógrafo: forma de los datos que manda la API, en qué
 * columna va cada lote, qué botones muestra, cómo se agrupa «Para imprimir» y qué confirmar.
 * Sin Prisma ni `server-only`: lo usan la ruta y los componentes, y se prueba con node:test.
 */

import { estadoDelPedidoEnElTramo, puedeMover, type EntregaLote, type EstadoLote } from "./reglas";

export type CopiaDelPanel = { medida: string; acabado: string; cantidad: number };

/** Un pedido de «Para imprimir» (fechas como texto ISO: viajan en JSON). */
export type PedidoDelPanel = {
  albumOrderId: number;
  cliente: string;
  album: string;
  copias: CopiaDelPanel[];
  totalCopias: number;
  retiraCliente: boolean;
  pickupLabContactId: number | null;
  pagadoAt: string;
  motivo: string | null;
};

/** Un pedido dentro de un lote. `codigoQr` es el del sobre (para abrir /pedido/entrega/<codigo>). */
export type EntradaDelPanel = {
  id: number;
  albumOrderId: number | null;
  cliente: string;
  album: string;
  copias: CopiaDelPanel[];
  totalCopias: number;
  retiraCliente: boolean;
  pickupLabContactId: number | null;
  estadoPedido: string | null;
  entregadoAt: string | null;
  codigoQr: string | null;
};

export type LoteDelPanel = {
  id: number;
  nombre: string;
  estado: EstadoLote;
  entregaPreferida: EntregaLote;
  labContactId: number | null;
  laboratorio: string | null;
  mensajeAlLab: string | null;
  fechaPrometida: string | null;
  createdAt: string;
  enviadoAt: string | null;
  labAbrioAt: string | null;
  labDescargoAt: string | null;
  listoAt: string | null;
  recibidoAt: string | null;
  cerradoAt: string | null;
  pagadoAlLabAt: string | null;
  entradas: EntradaDelPanel[];
};

export type LaboratorioDelPanel = { id: number; nombre: string; esPredeterminado: boolean; puntoDeRetiro: boolean };

export type DatosDelPanel = { paraImprimir: PedidoDelPanel[]; lotes: LoteDelPanel[]; laboratorios: LaboratorioDelPanel[] };

/** Días que se muestran los lotes cerrados en «Entregados». */
export const DIAS_DE_ENTREGADOS = 30;

export type Columna = "PARA_IMPRIMIR" | "EN_LABORATORIO" | "LISTOS" | "ENTREGADOS";

/** Columna de un lote: armado (sin enviar) va con «Para imprimir»; anulado no se muestra. */
export function columnaDelLote(estado: EstadoLote): Columna | null {
  switch (estado) {
    case "ARMADO":
      return "PARA_IMPRIMIR";
    case "ENVIADO":
    case "EN_PRODUCCION":
    case "LISTO":
    case "DESPACHADO":
      return "EN_LABORATORIO";
    case "RECIBIDO":
      return "LISTOS";
    case "CERRADO":
      return "ENTREGADOS";
    default:
      return null;
  }
}

const TEXTO_DEL_ESTADO: Record<EstadoLote, string> = {
  ARMADO: "Armado, sin enviar",
  ENVIADO: "Enviado al laboratorio",
  EN_PRODUCCION: "En producción",
  LISTO: "Listo en el laboratorio",
  DESPACHADO: "Despachado",
  RECIBIDO: "Recibido",
  CERRADO: "Entregado",
  ANULADO: "Anulado",
};
export function textoDelEstadoDelLote(estado: EstadoLote): string {
  return TEXTO_DEL_ESTADO[estado] ?? estado;
}

export type GrupoParaImprimir = { labContactId: number | null; titulo: string; pedidos: PedidoDelPanel[] };

/**
 * «Para imprimir» agrupado por laboratorio de retiro: primero los que no tienen (retira el
 * fotógrafo), después uno por laboratorio en el orden de `laboratorios`. Dentro de cada grupo,
 * los que no pueden entrar (con `motivo`) van al final.
 */
export function agruparParaImprimir(pedidos: readonly PedidoDelPanel[], laboratorios: readonly LaboratorioDelPanel[]): GrupoParaImprimir[] {
  const porLab = new Map<number | null, PedidoDelPanel[]>();
  for (const p of pedidos) {
    const clave = p.pickupLabContactId;
    porLab.set(clave, [...(porLab.get(clave) ?? []), p]);
  }
  const orden = (a: PedidoDelPanel, b: PedidoDelPanel) => Number(a.motivo != null) - Number(b.motivo != null);
  const nombre = new Map(laboratorios.map((l) => [l.id, l.nombre]));
  const posicion = new Map(laboratorios.map((l, i) => [l.id, i]));
  const claves = [...porLab.keys()].sort((a, b) => {
    if (a === null) return -1;
    if (b === null) return 1;
    return (posicion.get(a) ?? Number.MAX_SAFE_INTEGER) - (posicion.get(b) ?? Number.MAX_SAFE_INTEGER) || a - b;
  });
  return claves.map((clave) => ({
    labContactId: clave,
    titulo: clave === null ? "Sin retiro en laboratorio" : `Retiran en ${nombre.get(clave) ?? "otro laboratorio"}`,
    pedidos: [...porLab.get(clave)!].sort(orden),
  }));
}

/**
 * El laboratorio de retiro de una selección: null si ninguno tiene; error si mezcla laboratorios
 * (un pedido con retiro elegido sólo entra a un lote de ese laboratorio).
 */
export function laboratorioDeLaSeleccion(pedidos: readonly Pick<PedidoDelPanel, "pickupLabContactId">[]): { ok: true; labContactId: number | null } | { ok: false; error: string } {
  const labs = new Set(pedidos.map((p) => p.pickupLabContactId).filter((x): x is number => x != null));
  if (labs.size > 1) return { ok: false, error: "Elegí pedidos de un solo laboratorio de retiro: armá un lote por laboratorio." };
  return { ok: true, labContactId: labs.size === 1 ? [...labs][0]! : null };
}

export type BotonDeMover = { hacia: EstadoLote; texto: string; principal: boolean };
export type AccionesDelLote = {
  enviar: boolean;
  deshacer: boolean;
  mover: BotonDeMover[];
  pagadoAlLab: boolean;
  /** Qué hacer con cada pedido: sacarlo (lote sin enviar) o reimprimirlo (ya salió). */
  quitar: "SACAR" | "REIMPRIMIR" | null;
};

const BOTONES_DE_MOVER: ReadonlyArray<{ hacia: EstadoLote; texto: string }> = [
  { hacia: "EN_PRODUCCION", texto: "Lo empezaron" },
  { hacia: "LISTO", texto: "Está listo" },
  { hacia: "DESPACHADO", texto: "Lo despacharon" },
  { hacia: "RECIBIDO", texto: "Recibí el lote" },
];

/**
 * Lo que la tarjeta del lote ofrece según su estado. El fotógrafo puede mover todo hacia adelante
 * (por si el laboratorio no usa la plataforma); «Cerrado» no es un botón: se cierra solo al
 * entregarse todo. «Recibí el lote» es el principal cuando el lote está listo o despachado.
 */
export function accionesDelLote(lote: Pick<LoteDelPanel, "estado" | "entregaPreferida" | "pagadoAlLabAt">): AccionesDelLote {
  const { estado, entregaPreferida } = lote;
  if (estado === "ARMADO") return { enviar: true, deshacer: true, mover: [], pagadoAlLab: false, quitar: "SACAR" };
  if (estado === "CERRADO" || estado === "ANULADO") {
    return { enviar: false, deshacer: false, mover: [], pagadoAlLab: estado === "CERRADO" && !lote.pagadoAlLabAt, quitar: null };
  }
  const posibles = BOTONES_DE_MOVER.filter((b) => puedeMover(estado, b.hacia, "FOTOGRAFO", entregaPreferida));
  const recibir = estado === "LISTO" || estado === "DESPACHADO";
  const mover = posibles.map((b, i) => ({ ...b, principal: recibir ? b.hacia === "RECIBIDO" : i === 0 }));
  return { enviar: false, deshacer: false, mover, pagadoAlLab: !lote.pagadoAlLabAt, quitar: "REIMPRIMIR" };
}

export const AVISO_A_CLIENTES = "Se les avisa por correo a los clientes que ya pueden retirar.";

/**
 * Si mover el lote a `hacia` le manda correo a algún cliente (algún pedido vivo sin entregar pasa a
 * «Listo para retirar»), el texto para confirmar; si no, null.
 */
export function confirmacionAlMover(lote: Pick<LoteDelPanel, "estado" | "entradas">, hacia: EstadoLote): string | null {
  const avisa = lote.entradas.some(
    (e) =>
      e.entregadoAt == null &&
      e.estadoPedido !== "READY_TO_PICKUP" &&
      estadoDelPedidoEnElTramo(lote.estado, hacia, e.retiraCliente) === "READY_TO_PICKUP",
  );
  return avisa ? AVISO_A_CLIENTES : null;
}

/**
 * Laboratorios para el diálogo de envío. Si algún pedido del lote tiene retiro en un laboratorio,
 * el lote va a ése y no se puede cambiar. Si no, viene elegido el del lote, o el predeterminado.
 */
export function laboratorioParaEnviar(
  lote: Pick<LoteDelPanel, "labContactId" | "entradas">,
  laboratorios: readonly LaboratorioDelPanel[],
): { elegido: number | null; bloqueado: boolean } {
  const fijo = lote.entradas.find((e) => e.pickupLabContactId != null)?.pickupLabContactId ?? null;
  if (fijo != null) return { elegido: fijo, bloqueado: true };
  const existe = (id: number | null) => id != null && laboratorios.some((l) => l.id === id);
  if (existe(lote.labContactId)) return { elegido: lote.labContactId, bloqueado: false };
  const pred = laboratorios.find((l) => l.esPredeterminado) ?? laboratorios[0];
  return { elegido: pred?.id ?? null, bloqueado: false };
}

const ESTADO_DEL_PEDIDO: Record<string, string> = {
  CREATED: "En preparación",
  IN_PRODUCTION: "En producción",
  READY: "Listo en el laboratorio",
  READY_TO_PICKUP: "Listo para retirar",
  SHIPPED: "En camino",
  DELIVERED: "Entregado",
  RETIRED: "Entregado",
  CANCELED: "Cancelado",
};

/** «Enviado al laboratorio · Lote 3»: el estado de impresión de un pedido, para su ficha. */
export function textoDeImpresion(p: { loteEstado: EstadoLote; loteNombre: string; estadoPedido: string | null; entregado: boolean }): string {
  let estado: string;
  if (p.entregado) estado = "Entregado";
  else if (p.loteEstado === "ARMADO") estado = "En lote, sin enviar";
  else if (p.loteEstado === "ENVIADO") estado = "Enviado al laboratorio";
  else estado = (p.estadoPedido && ESTADO_DEL_PEDIDO[p.estadoPedido]) || textoDelEstadoDelLote(p.loteEstado);
  return `${estado} · ${p.loteNombre}`;
}

/** dd/mm en hora argentina; una fecha sin hora (00:00 UTC) se muestra tal cual. */
export function fechaDelPanel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sinHora = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
  return d.toLocaleDateString("es-AR", { timeZone: sinHora ? "UTC" : "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit" });
}

/** «3× 13x18 BRILLO · 1× 10x15». */
export function textoDeCopiasDelPanel(copias: readonly CopiaDelPanel[]): string {
  return copias.map((c) => `${c.cantidad}× ${c.medida}${c.acabado ? ` ${c.acabado}` : ""}`).join(" · ");
}

/** Fecha prometida del diálogo («aaaa-mm-dd») como fecha sin hora; vacía o inválida, null. */
export function leerFechaPrometida(valor: unknown): Date | null | "invalida" {
  if (valor == null || valor === "") return null;
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "invalida";
  const d = new Date(`${valor}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor ? "invalida" : d;
}
