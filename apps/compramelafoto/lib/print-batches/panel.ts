/**
 * Piezas puras del panel «Impresiones» del fotógrafo: forma de los datos que manda la API, en qué
 * columna va cada lote, qué botones muestra, cómo se agrupa «Para imprimir» y qué confirmar.
 * Sin Prisma ni `server-only`: lo usan la ruta y los componentes, y se prueba con node:test.
 */

import { ESPEJO_ENTREGADO, estadoDelPedidoEnElTramo, puedeMover, type EntregaLote, type EstadoLote } from "./reglas";
import { ESTADOS_DEL_PEDIDO } from "./entrega-del-pedido";

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
  /** Lote de pedidos que el fotógrafo marcó «ya impresos» sin pasar por un laboratorio. */
  porFuera: boolean;
  entradas: EntradaDelPanel[];
};

export type LaboratorioDelPanel = { id: number; nombre: string; esPredeterminado: boolean; puntoDeRetiro: boolean };

export type DatosDelPanel = { paraImprimir: PedidoDelPanel[]; lotes: LoteDelPanel[]; laboratorios: LaboratorioDelPanel[] };

/** Días que se muestran los lotes cerrados en «Entregados». */
export const DIAS_DE_ENTREGADOS = 30;

/** «Para imprimir» muestra los pedidos pagados de estos últimos días (los que ya están en un lote se ven en su lote). */
export const DIAS_PARA_IMPRIMIR = 60;
/** Tope de pedidos en «Para imprimir», del más nuevo al más viejo. */
export const MAX_PARA_IMPRIMIR = 300;
export const NOTA_PARA_IMPRIMIR = `Se muestran los pedidos pagados de los últimos ${DIAS_PARA_IMPRIMIR} días.`;

export type Columna = "PARA_IMPRIMIR" | "EN_LABORATORIO" | "LISTOS" | "ENTREGADOS";

/**
 * Columna de la tarjeta de un lote: armado (sin enviar) va con «Para imprimir»; recibido, abajo de
 * «Listos para entregar» (esa columna lista pedido por pedido, ver `pedidosListosParaEntregar`);
 * a «Entregados» va sólo el cerrado (todo entregado); anulado no se muestra.
 */
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

/** Nombre de los lotes de pedidos marcados «ya impresos» sin laboratorio. */
export const NOMBRE_IMPRESOS_POR_FUERA = "Impresos por fuera";

/**
 * Un lote «impreso por fuera» nunca se envió, no tiene laboratorio y ya está recibido o cerrado:
 * así lo crea `marcarImpresosPorFuera` (no hay columna propia en la base).
 */
export function esImpresoPorFuera(b: { estado: EstadoLote; enviadoAt: Date | string | null; labContactId: number | null }): boolean {
  return b.enviadoAt == null && b.labContactId == null && (b.estado === "RECIBIDO" || b.estado === "CERRADO");
}

export type FaseDelLote =
  | "ARMADO" | "SIN_ABRIR" | "ABIERTO" | "DESCARGADO" | "EN_PRODUCCION" | "LISTO" | "DESPACHADO"
  | "RECIBIDO" | "POR_FUERA" | "CERRADO" | "ANULADO";

const TEXTO_DE_LA_FASE: Record<FaseDelLote, string> = {
  ARMADO: "Armado, sin enviar",
  SIN_ABRIR: "Enviado, el laboratorio todavía no lo abrió",
  ABIERTO: "El laboratorio lo abrió, todavía no lo descargó",
  DESCARGADO: "Descargado por el laboratorio",
  EN_PRODUCCION: "En producción",
  LISTO: "Listo en el laboratorio",
  DESPACHADO: "Despachado",
  RECIBIDO: "Recibido",
  POR_FUERA: "Impreso por fuera",
  CERRADO: "Entregado",
  ANULADO: "Anulado",
};

/**
 * La fase que se muestra del lote. Entre «Enviado» y «En producción» hay dos pasos intermedios que
 * no son estados del lote sino registros del laboratorio: que abrió el enlace y que descargó el ZIP.
 */
export function faseDelLote(l: Pick<LoteDelPanel, "estado" | "labAbrioAt" | "labDescargoAt" | "porFuera">): FaseDelLote {
  if (l.estado === "ENVIADO") return l.labDescargoAt ? "DESCARGADO" : l.labAbrioAt ? "ABIERTO" : "SIN_ABRIR";
  if (l.estado === "RECIBIDO" && l.porFuera) return "POR_FUERA";
  return l.estado;
}
export function textoDeLaFase(f: FaseDelLote): string {
  return TEXTO_DE_LA_FASE[f];
}

/** Cómo se agrupan los lotes del paso «En el laboratorio», en orden; los grupos vacíos no se muestran. */
export const GRUPOS_EN_EL_LABORATORIO: ReadonlyArray<{ titulo: string; fases: readonly FaseDelLote[] }> = [
  { titulo: "Esperando que el laboratorio lo descargue", fases: ["SIN_ABRIR", "ABIERTO"] },
  { titulo: "Descargados por el laboratorio", fases: ["DESCARGADO"] },
  { titulo: "En producción", fases: ["EN_PRODUCCION"] },
  { titulo: "Listos en el laboratorio o despachados", fases: ["LISTO", "DESPACHADO"] },
];
export function agruparEnElLaboratorio<L extends Pick<LoteDelPanel, "estado" | "labAbrioAt" | "labDescargoAt" | "porFuera">>(lotes: readonly L[]): Array<{ titulo: string; lotes: L[] }> {
  return GRUPOS_EN_EL_LABORATORIO
    .map((g) => ({ titulo: g.titulo, lotes: lotes.filter((l) => g.fases.includes(faseDelLote(l))) }))
    .filter((g) => g.lotes.length > 0);
}

/** El registro de lo que pasó con el lote, en orden (sólo lo que ya pasó), con fecha y hora. */
export function seguimientoDelLote(l: Pick<LoteDelPanel, "enviadoAt" | "labAbrioAt" | "labDescargoAt" | "listoAt" | "recibidoAt" | "cerradoAt" | "porFuera">): Array<{ texto: string; cuando: string }> {
  const pasos: Array<[string, string | null]> = l.porFuera
    ? [["Marcado como ya impreso", l.recibidoAt], ["Todo entregado", l.cerradoAt]]
    : [
        ["Enviado al laboratorio", l.enviadoAt],
        ["El laboratorio abrió el enlace", l.labAbrioAt],
        ["El laboratorio descargó las fotos", l.labDescargoAt],
        ["Listo en el laboratorio", l.listoAt],
        ["Lo recibiste", l.recibidoAt],
        ["Todo entregado", l.cerradoAt],
      ];
  return pasos.filter((p): p is [string, string] => p[1] != null).map(([texto, cuando]) => ({ texto, cuando: fechaYHoraDelPanel(cuando) }));
}

/**
 * Lo que se pregunta antes de sacar un pedido de un lote. Si el lote ya salió, avisa que el
 * laboratorio puede haberlo impreso (y si ya descargó las fotos, cuándo).
 */
export function confirmacionAlSacar(l: Pick<LoteDelPanel, "nombre" | "estado" | "enviadoAt" | "labDescargoAt" | "porFuera">, albumOrderId: number | null): string {
  const pedido = albumOrderId != null ? `el pedido #${albumOrderId}` : "este pedido";
  if (l.estado === "ARMADO") return `¿Sacar ${pedido} del ${l.nombre}? Vuelve a «Para imprimir».`;
  if (l.porFuera) return `¿Sacar ${pedido} de «${l.nombre}»? Deja de figurar como impreso y vuelve a «Para imprimir».`;
  const descargo = l.labDescargoAt ? ` y descargó las fotos el ${fechaYHoraDelPanel(l.labDescargoAt)}` : "";
  return [
    `Atención: el ${l.nombre} ya se envió al laboratorio${l.enviadoAt ? ` el ${fechaDelPanel(l.enviadoAt)}` : ""}${descargo}. Puede que ya lo hayan impreso.`,
    "",
    `¿Sacar ${pedido} del lote igual? Vuelve a «Para imprimir» y le avisamos al laboratorio por correo que no lo imprima.`,
  ].join("\n");
}

export type PedidoListo = { lote: Pick<LoteDelPanel, "id" | "nombre">; entrada: EntradaDelPanel };

/**
 * «Listos para entregar»: cada pedido (retire quien retire) cuyo espejo está «Listo para retirar» y
 * todavía no se entregó, de lotes que ya salieron y no se cerraron. El lote pasa a «Entregados»
 * recién cuando se cierra (todos entregados).
 */
export function pedidosListosParaEntregar(lotes: readonly LoteDelPanel[]): PedidoListo[] {
  const salida: PedidoListo[] = [];
  for (const l of lotes) {
    if (l.estado === "ARMADO" || l.estado === "CERRADO" || l.estado === "ANULADO") continue;
    for (const e of l.entradas) {
      if (e.entregadoAt == null && e.estadoPedido === "READY_TO_PICKUP") salida.push({ lote: { id: l.id, nombre: l.nombre }, entrada: e });
    }
  }
  return salida;
}

export function confirmacionDeEntrega(albumOrderId: number | null): string {
  return albumOrderId != null ? `¿Marcar entregado el pedido #${albumOrderId}?` : "¿Marcar entregado este pedido?";
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
  /** Se puede sacar cualquier pedido sin entregar mientras el lote no esté cerrado. */
  quitar: "SACAR" | null;
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
export function accionesDelLote(lote: Pick<LoteDelPanel, "estado" | "entregaPreferida" | "pagadoAlLabAt"> & { porFuera?: boolean }): AccionesDelLote {
  const { estado, entregaPreferida } = lote;
  if (lote.porFuera) return { enviar: false, deshacer: false, mover: [], pagadoAlLab: false, quitar: estado === "CERRADO" ? null : "SACAR" };
  if (estado === "ARMADO") return { enviar: true, deshacer: true, mover: [], pagadoAlLab: false, quitar: "SACAR" };
  if (estado === "CERRADO" || estado === "ANULADO") {
    return { enviar: false, deshacer: false, mover: [], pagadoAlLab: estado === "CERRADO" && !lote.pagadoAlLabAt, quitar: null };
  }
  const posibles = BOTONES_DE_MOVER.filter((b) => puedeMover(estado, b.hacia, "FOTOGRAFO", entregaPreferida));
  const recibir = estado === "LISTO" || estado === "DESPACHADO";
  const mover = posibles.map((b, i) => ({ ...b, principal: recibir ? b.hacia === "RECIBIDO" : i === 0 }));
  return { enviar: false, deshacer: false, mover, pagadoAlLab: !lote.pagadoAlLabAt, quitar: "SACAR" };
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

/** «Enviado al laboratorio · Lote 3»: el estado de impresión de un pedido, para su ficha. */
export function textoDeImpresion(p: { loteEstado: EstadoLote; loteNombre: string; estadoPedido: string | null; entregado: boolean }): string {
  let estado: string;
  if (p.entregado) estado = "Entregado";
  else if (p.loteEstado === "ARMADO") estado = "En lote, sin enviar";
  else if (p.loteEstado === "ENVIADO") estado = "Enviado al laboratorio";
  else estado = (p.estadoPedido && ESTADOS_DEL_PEDIDO[p.estadoPedido]) || textoDelEstadoDelLote(p.loteEstado);
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

/** «23/11 14:05» en hora argentina. */
export function fechaYHoraDelPanel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const z = { timeZone: "America/Argentina/Buenos_Aires" } as const;
  const dia = d.toLocaleDateString("es-AR", { ...z, day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("es-AR", { ...z, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dia} ${hora}`;
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

/** Los pasos del panel, en el orden de la barra (la misma barra que «Pedidos escolares»). */
export const PASOS_DEL_PANEL: ReadonlyArray<{ clave: Columna; numero: number; titulo: string; ayuda: string }> = [
  { clave: "PARA_IMPRIMIR", numero: 1, titulo: "Para imprimir", ayuda: "Elegí los pedidos, armá el lote y mandalo al laboratorio." },
  { clave: "EN_LABORATORIO", numero: 2, titulo: "En el laboratorio", ayuda: "El laboratorio lo está imprimiendo. Seguí cada lote acá." },
  { clave: "LISTOS", numero: 3, titulo: "Listos para entregar", ayuda: "Ya están impresos: entregalos y marcalos con el QR del sobre." },
  { clave: "ENTREGADOS", numero: 4, titulo: "Entregados", ayuda: `Los pedidos entregados de los últimos ${DIAS_DE_ENTREGADOS} días.` },
];

/**
 * Paso en el que cuenta un pedido de un lote: el mismo paso donde se lo ve. Los lotes armados se ven
 * en «Para imprimir», los cerrados en «Entregados»; un pedido listo para retirar se ve en la tabla de
 * «Listos», y el resto, en la tarjeta de su lote. Un pedido ya entregado de un lote que sigue abierto
 * no cuenta en ningún paso (no queda nada por hacer con él). null = no cuenta.
 */
export function pasoDeLaEntrada(lote: Pick<LoteDelPanel, "estado">, e: Pick<EntradaDelPanel, "entregadoAt" | "estadoPedido">): Columna | null {
  const columna = columnaDelLote(lote.estado);
  if (columna === null || columna === "PARA_IMPRIMIR" || columna === "ENTREGADOS") return columna;
  if (e.entregadoAt != null || (e.estadoPedido != null && ESPEJO_ENTREGADO.includes(e.estadoPedido))) return null;
  if (e.estadoPedido === "READY_TO_PICKUP") return "LISTOS";
  return columna;
}

/**
 * Cuántos pedidos hay en cada paso, una sola vez cada uno. En «Para imprimir» cuentan los que se
 * pueden imprimir (los que tienen un motivo para no entrar se ven en gris) más los de lotes armados.
 */
export function conteoDelPanel(datos: Pick<DatosDelPanel, "paraImprimir" | "lotes">): Record<Columna, number> {
  const conteo: Record<Columna, number> = { PARA_IMPRIMIR: datos.paraImprimir.filter((p) => p.motivo == null).length, EN_LABORATORIO: 0, LISTOS: 0, ENTREGADOS: 0 };
  for (const l of datos.lotes) {
    for (const e of l.entradas) {
      const paso = pasoDeLaEntrada(l, e);
      if (paso) conteo[paso] += 1;
    }
  }
  return conteo;
}

/** Abre en el primer paso con pedidos; «Entregados» nunca es el de arranque. */
export function pasoInicialDelPanel(conteo: Record<Columna, number>): Columna {
  return PASOS_DEL_PANEL.find((p) => p.clave !== "ENTREGADOS" && conteo[p.clave] > 0)?.clave ?? "PARA_IMPRIMIR";
}
