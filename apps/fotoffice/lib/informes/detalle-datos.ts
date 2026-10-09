import "server-only";
import { prisma } from "@repo/db";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { decimalArsToMinor } from "@/lib/membership/money";
import { esEstadoPedido } from "@/lib/pedidos/constantes";
import { resumenDePlan } from "@/lib/pedidos/estado";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { fechaDeBase, fechaParaBase, pesosDeBase, planesDe } from "@/lib/pedidos/plan";
import { puedeVerInformes, type CtxInformes } from "./acceso";
import { AVISO_DEMASIADOS_DATOS, MAX_FILAS_CUOTAS_Y_CUENTAS, MODULOS_CAJA_DE_PEDIDOS } from "./constantes";
import {
  asientoEnCelda, fechaDeInstante, leerFiltroCelda, leerFiltroFlujo, MAX_FILAS_DETALLE, ordenarFilas, totalDeFilas,
  type FilaDetalle, type FiltroCeldaResultados, type FiltroFlujo,
} from "./detalle";
import { ESTADOS_A_COBRAR, hastaDeHorizonte } from "./flujo-datos";
import { etiquetaMes, inicioDeMes, inicioDelMesSiguiente, periodoInforme, type PeriodoInforme } from "./periodos";
import { baseElegida, diasDeMeses, leerMovimientosConOriginales, leerRubros, type BaseResultados, ETIQUETAS_BASE } from "./resultados-datos";
import {
  asientoDeCuenta, asientoDeMovimiento, asientoDePedido, mapaDeOriginales,
  type CuentaPagarFila, type PedidoFila, type RubroInfo,
} from "./resultados";

/**
 * Lectura del desglose (etapa 6): las filas que forman UNA celda de Resultados o del Flujo. Usa las
 * mismas reglas y los mismos topes que los informes (transferencias fuera, anulación en el rubro del
 * original, fuentes de la base devengada). El total suma todas las filas; se dibujan las primeras 500.
 */

const NOMBRES_CLIENTE = { firstName: true, lastName: true, businessName: true } as const;

export const ETIQUETAS_ORIGEN_CAJA: Record<string, string> = {
  manual: "Movimiento manual",
  membership: "Cuota de socio",
  bookings: "Reserva",
  sales: "Venta",
  "work-orders": "Orden de trabajo",
  pedidos: "Cobro de pedido",
  "pedidos-pagos": "Pago a proveedor",
};

export type DetalleCargado = {
  titulo: string;
  filas: FilaDetalle[];
  /** Todas las filas de la celda (el CSV las trae completas; la pantalla dibuja `filas`). */
  todas: FilaDetalle[];
  /** Cuántas filas forman la celda (puede ser más que las dibujadas). */
  cantidad: number;
  total: number;
  truncado: boolean;
  /** `null` si se pasó el tope de datos. */
  avisos: string[];
};

const vacioConAviso = (titulo: string): DetalleCargado => ({ titulo, filas: [], todas: [], cantidad: 0, total: 0, truncado: false, avisos: [AVISO_DEMASIADOS_DATOS] });

function recortar(filas: FilaDetalle[], titulo: string, avisos: string[] = []): DetalleCargado {
  const orden = ordenarFilas(filas);
  return {
    titulo,
    filas: orden.slice(0, MAX_FILAS_DETALLE),
    todas: orden,
    cantidad: orden.length,
    total: totalDeFilas(orden),
    truncado: orden.length > MAX_FILAS_DETALLE,
    avisos,
  };
}

// --- Resultados -----------------------------------------------------------------------------------

export type DetalleResultados = DetalleCargado & {
  periodo: PeriodoInforme;
  base: BaseResultados;
  filtro: FiltroCeldaResultados;
  /** Para el enlace "volver" y el CSV. */
  volver: string;
};

function tituloDeCelda(f: FiltroCeldaResultados, rubros: ReadonlyMap<string, RubroInfo>, periodo: PeriodoInforme): string {
  const bloques: Record<string, string> = {
    INGRESOS: "Ingresos", COSTOS: "Costos", GASTOS: "Gastos",
    SIN_CLASIFICAR_INGRESO: "Sin clasificar (ingresos)", SIN_CLASIFICAR_EGRESO: "Sin clasificar (egresos)",
  };
  const rubro = f.rubro.tipo === "sin" ? "Sin rubro" : f.rubro.tipo === "id" ? (rubros.get(f.rubro.id)?.nombre ?? "Rubro no encontrado") : null;
  const cuando = f.mes ? etiquetaMes(f.mes) : periodo.etiqueta;
  return [bloques[f.bloque], rubro, cuando].filter(Boolean).join(" · ");
}

/** El desglose de una celda de Resultados. `null` si no hay permiso o la celda de la dirección no es válida. */
export async function cargarDetalleResultados(
  ctx: CtxInformes,
  params: Record<string, string | string[] | undefined>,
  ahora: Date = new Date(),
): Promise<DetalleResultados | null> {
  if (!puedeVerInformes(ctx)) return null;
  const { workspaceId } = ctx;
  const pe = params.periodo;
  const periodo = periodoInforme({ periodo: Array.isArray(pe) ? pe[0] : pe, hoy: hoyEnBuenosAires(ahora) });
  const be = params.base;
  const base = baseElegida(Array.isArray(be) ? be[0] : be);
  const filtro = leerFiltroCelda(params, periodo.meses);
  if (!filtro) return null;

  const rubros = await leerRubros(workspaceId);
  const rubrosPorId = new Map(rubros.map((r) => [r.id, r]));
  const titulo = tituloDeCelda(filtro, rubrosPorId, periodo);
  const volver = `/informes/resultados?${new URLSearchParams({ base, periodo: periodo.valor }).toString()}`;
  const salida = (d: DetalleCargado): DetalleResultados => ({ ...d, periodo, base, filtro, volver });

  // Con un mes elegido sólo se lee ese mes: la celda no puede traer otra cosa.
  const desde = filtro.mes ?? periodo.desde;
  const hasta = filtro.mes ?? periodo.hasta;
  const lectura = await leerMovimientosConOriginales(workspaceId, desde, hasta);
  if (!lectura) return salida(vacioConAviso(titulo));

  const excluidos = new Set<string>(base === "devengado" ? MODULOS_CAJA_DE_PEDIDOS : []);
  const originales = mapaDeOriginales(lectura.movs, lectura.originales);
  const delPeriodo = lectura.movs.flatMap((m) => {
    const a = asientoDeMovimiento(m, originales, excluidos);
    return a && asientoEnCelda(a, filtro, rubrosPorId) ? [{ m, signo: a.signo }] : [];
  });

  const filas: FilaDetalle[] = [];

  // Datos de cada movimiento de la celda (descripción, cuenta, contacto, cobro de origen), por lotes.
  const ordenados = delPeriodo;
  const aDibujar = ordenados;
  const detalleMov = new Map<string, { description: string; sourceRef: string | null; account: { name: string }; client: { firstName: string | null; lastName: string | null; businessName: string | null } | null }>();
  for (let i = 0; i < aDibujar.length; i += 1000) {
    const lote = await prisma.cashMovement.findMany({
      where: { workspaceId, id: { in: aDibujar.slice(i, i + 1000).map((x) => x.m.id) } },
      select: { id: true, description: true, sourceRef: true, account: { select: { name: true } }, client: { select: NOMBRES_CLIENTE } },
    });
    for (const l of lote) detalleMov.set(l.id, l);
  }
  const cobrosIds = [...new Set(aDibujar.flatMap((x) => (x.m.sourceModule === "pedidos" && detalleMov.get(x.m.id)?.sourceRef ? [detalleMov.get(x.m.id)!.sourceRef!] : [])))];
  const pedidoDeCobro = new Map<string, string>();
  if (cobrosIds.length > 0) {
    const cobros = await prisma.fotofficeCobro.findMany({ where: { workspaceId, id: { in: cobrosIds } }, select: { id: true, pedidoId: true } });
    for (const c of cobros) pedidoDeCobro.set(c.id, c.pedidoId);
  }
  for (const { m, signo } of ordenados) {
    const d = detalleMov.get(m.id);
    const etiqueta = ETIQUETAS_ORIGEN_CAJA[m.sourceModule] ?? m.sourceModule;
    const pedidoId = d?.sourceRef && m.sourceModule === "pedidos" ? pedidoDeCobro.get(d.sourceRef) : undefined;
    filas.push({
      clave: `m:${m.id}`,
      fecha: fechaDeInstante(m.occurredAt),
      origen: `${m.reversesMovementId ? "Anulación · " : ""}${etiqueta}${d ? ` (${d.account.name})` : ""}`,
      contacto: d?.client ? nombreDeContacto(d.client) : null,
      descripcion: d?.description ?? "",
      centavos: m.centavos * signo,
      href: pedidoId ? `/pedidos/${pedidoId}` : null,
    });
  }

  if (base === "devengado") {
    const { primero, ultimo } = diasDeMeses(desde, hasta);
    const [pedidos, cuentas] = await Promise.all([
      prisma.fotofficePedido.findMany({
        where: {
          workspaceId,
          status: { not: "CANCELADO" },
          OR: [
            { eventDate: { gte: fechaParaBase(primero), lte: fechaParaBase(ultimo) } },
            { eventDate: null, createdAt: { gte: inicioDeMes(desde), lt: inicioDelMesSiguiente(hasta) } },
          ],
        },
        select: { id: true, number: true, status: true, eventDate: true, eventLabel: true, createdAt: true, totalArs: true, incomeCategoryId: true, client: { select: NOMBRES_CLIENTE } },
        take: MAX_FILAS_CUOTAS_Y_CUENTAS + 1,
      }),
      prisma.fotofficeCuentaPagar.findMany({
        where: {
          workspaceId,
          OR: [
            { dueDate: { gte: fechaParaBase(primero), lte: fechaParaBase(ultimo) } },
            { dueDate: null, createdAt: { gte: inicioDeMes(desde), lt: inicioDelMesSiguiente(hasta) } },
          ],
        },
        select: { id: true, pedidoId: true, concept: true, dueDate: true, createdAt: true, amountArs: true, costCategoryId: true, supplier: { select: NOMBRES_CLIENTE }, pedido: { select: { number: true } } },
        take: MAX_FILAS_CUOTAS_Y_CUENTAS + 1,
      }),
    ]);
    if (pedidos.length > MAX_FILAS_CUOTAS_Y_CUENTAS || cuentas.length > MAX_FILAS_CUOTAS_Y_CUENTAS) return salida(vacioConAviso(titulo));

    for (const p of pedidos) {
      const fila: PedidoFila = { status: p.status, eventDate: p.eventDate ? fechaDeBase(p.eventDate) : null, createdAt: p.createdAt, centavos: decimalArsToMinor(p.totalArs), incomeCategoryId: p.incomeCategoryId };
      const a = asientoDePedido(fila);
      if (!a || !asientoEnCelda(a, filtro, rubrosPorId)) continue;
      filas.push({
        clave: `p:${p.id}`,
        fecha: fila.eventDate ?? fechaDeInstante(p.createdAt),
        origen: `Pedido ${p.number}`,
        contacto: nombreDeContacto(p.client),
        descripcion: p.eventLabel?.trim() || "Pedido",
        centavos: fila.centavos,
        href: `/pedidos/${p.id}`,
      });
    }
    for (const c of cuentas) {
      const fila: CuentaPagarFila = { dueDate: c.dueDate ? fechaDeBase(c.dueDate) : null, createdAt: c.createdAt, centavos: decimalArsToMinor(c.amountArs), costCategoryId: c.costCategoryId };
      if (!asientoEnCelda(asientoDeCuenta(fila), filtro, rubrosPorId)) continue;
      filas.push({
        clave: `c:${c.id}`,
        fecha: fila.dueDate ?? fechaDeInstante(c.createdAt),
        origen: c.pedido ? `Cuenta a pagar · pedido ${c.pedido.number}` : "Cuenta a pagar",
        contacto: c.supplier ? nombreDeContacto(c.supplier) : null,
        descripcion: c.concept,
        centavos: fila.centavos,
        href: c.pedidoId ? `/pedidos/${c.pedidoId}` : "/pedidos/a-pagar",
      });
    }
  }

  return salida(recortar(filas, titulo));
}

export { ETIQUETAS_BASE };

// --- Flujo ----------------------------------------------------------------------------------------

export type DetalleFlujo = DetalleCargado & { filtro: FiltroFlujo };

function tituloDeFlujo(f: FiltroFlujo): string {
  const larga = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  if (f.tipo === "sinfecha") return "Por pagar sin fecha";
  const que = f.tipo === "cobrar" ? "Por cobrar" : "Por pagar";
  if (f.desde === null) return `${que} vencido (hasta el ${larga(f.hasta!)})`;
  return f.desde === f.hasta ? `${que} el ${larga(f.desde)}` : `${que} del ${larga(f.desde)} al ${larga(f.hasta!)}`;
}

/** El desglose de una fila del flujo: las cuotas por cobrar o las cuentas por pagar que la forman. */
export async function cargarDetalleFlujo(
  ctx: CtxInformes,
  params: Record<string, string | string[] | undefined>,
  ahora: Date = new Date(),
): Promise<DetalleFlujo | null> {
  if (!puedeVerInformes(ctx)) return null;
  const { workspaceId } = ctx;
  const hoy = hoyEnBuenosAires(ahora);
  const filtro = leerFiltroFlujo(params, hastaDeHorizonte(hoy, "12m"));
  if (!filtro) return null;
  const titulo = tituloDeFlujo(filtro);
  const salida = (d: DetalleCargado): DetalleFlujo => ({ ...d, filtro });
  const filas: FilaDetalle[] = [];

  if (filtro.tipo === "cobrar") {
    const hasta = filtro.hasta!;
    const pedidos = await prisma.fotofficePedido.findMany({
      where: {
        workspaceId,
        status: { in: ESTADOS_A_COBRAR },
        cuotas: { some: { workspaceId, dueDate: { lte: fechaParaBase(hasta), ...(filtro.desde ? { gte: fechaParaBase(filtro.desde) } : {}) } } },
      },
      select: { id: true, number: true, status: true, totalArs: true, client: { select: NOMBRES_CLIENTE } },
      take: MAX_FILAS_CUOTAS_Y_CUENTAS + 1,
    });
    if (pedidos.length > MAX_FILAS_CUOTAS_Y_CUENTAS) return salida(vacioConAviso(titulo));
    for (let i = 0; i < pedidos.length; i += 1000) {
      const lote = pedidos.slice(i, i + 1000);
      const planes = await planesDe(workspaceId, lote.map((p) => p.id));
      for (const p of lote) {
        if (!esEstadoPedido(p.status)) continue;
        const plan = planes.get(p.id) ?? { cuotas: [], imputaciones: [] };
        const r = resumenDePlan(plan.cuotas, plan.imputaciones, { hoy, estadoPedido: p.status, total: pesosDeBase(p.totalArs) });
        for (const c of r.cuotas) {
          const centavos = Math.round(c.saldo * 100);
          if (centavos <= 0 || c.dueDate > hasta || (filtro.desde !== null && c.dueDate < filtro.desde)) continue;
          filas.push({
            clave: `q:${c.id}`,
            fecha: c.dueDate,
            origen: `Pedido ${p.number}`,
            contacto: nombreDeContacto(p.client),
            descripcion: `Cuota ${c.position} (saldo)`,
            centavos,
            href: `/pedidos/${p.id}`,
          });
        }
      }
    }
    return salida(recortar(filas, titulo));
  }

  const cuentas = await prisma.fotofficeCuentaPagar.findMany({
    where: {
      workspaceId,
      paidAt: null,
      dueDate: filtro.tipo === "sinfecha" ? null : { lte: fechaParaBase(filtro.hasta!), ...(filtro.desde ? { gte: fechaParaBase(filtro.desde) } : {}) },
    },
    select: { id: true, pedidoId: true, concept: true, dueDate: true, createdAt: true, amountArs: true, supplier: { select: NOMBRES_CLIENTE }, pedido: { select: { number: true } } },
    take: MAX_FILAS_CUOTAS_Y_CUENTAS + 1,
  });
  if (cuentas.length > MAX_FILAS_CUOTAS_Y_CUENTAS) return salida(vacioConAviso(titulo));
  for (const c of cuentas) {
    filas.push({
      clave: `c:${c.id}`,
      fecha: c.dueDate ? fechaDeBase(c.dueDate) : fechaDeInstante(c.createdAt),
      origen: c.pedido ? `Cuenta a pagar · pedido ${c.pedido.number}` : "Cuenta a pagar",
      contacto: c.supplier ? nombreDeContacto(c.supplier) : null,
      descripcion: c.dueDate ? c.concept : `${c.concept} (sin fecha de vencimiento)`,
      centavos: decimalArsToMinor(c.amountArs),
      href: c.pedidoId ? `/pedidos/${c.pedidoId}` : "/pedidos/a-pagar",
    });
  }
  return salida(recortar(filas, titulo));
}
