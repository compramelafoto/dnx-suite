import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { coordenadasDelEstudio, puntoValido } from "@/lib/impresiones/envio";
import { lugarDelPunto, MAX_DIRECCION, textoLimpio } from "@/lib/impresiones/direccion-servidor";
import { saldoDelPedido } from "@/lib/pedidos/candado-saldo";
import { agregarCargoEnTransaccion, mensajeDeCorte, quitarCargoEnTransaccion } from "@/lib/pedidos/cargos";
import { OPCIONES_TRANSACCION_PEDIDO } from "@/lib/pedidos/constantes";
import { enlaceDelPedidoDelSistema, type DepsEnlace } from "@/lib/pedidos/enlace";
import { imputadoPorCuota } from "@/lib/pedidos/estado";
import { bloquearPedido, pesosDeBase, planesDe } from "@/lib/pedidos/plan";
import { aCentavos } from "@/lib/pedidos/plan-cuotas";
import { extrasDelWorkspace } from "@/lib/presupuestos/perfil-cobro";
import { tokenConForma, hashDeToken } from "@/lib/presupuestos/enlace";
import { ID_VALIDO } from "../claves";
import {
  conceptoDeCargo, cotizarEnvioCassettes, precioDescargaExtra, precioExtension, precioUnitarioDelTrabajo, puedeComprarDescarga, puedeExtender,
  puedePedirEnvio, saldoParaVideos, totalOriginal, vencimientoExtendido, type TipoCargo,
} from "../cargos";
import { fechaArgentina, leerFranjas, pesos, tituloDeVideo } from "../entrega";

/**
 * Cargos extra de la entrega de videos (spec 2026-10-22, E6, E7 y E9), del lado del servidor.
 *
 * - **Pedir** ("Comprar otra descarga", "Extender 30 días", "Pedir envío de los cassettes") suma un
 *   cargo al pedido (`agregarCargoEnTransaccion`: renglón, total y cuota nueva que vence hoy) y lo
 *   registra en `DigitalizacionCargo` PENDIENTE, en la MISMA transacción. Un cargo igual (mismo tipo
 *   y video) todavía sin pagar se reusa: dos clics no cobran dos veces.
 * - **Aplicar** (`aplicarCargosPagados`): cuando la cuota del cargo queda paga, +1 descarga, +30 días
 *   o envío confirmado. Idempotente (`updateMany` condicionado a PENDIENTE). Lo llaman los cobros
 *   después del commit y, por si eso falló, los dos crons de Digitalización.
 * - **Candados:** primero el pedido (`bloquearPedido`) y después la entrega (`FOR UPDATE`), el mismo
 *   orden que la descarga contada: dos caminos nunca se esperan entre sí.
 * - Los cargos sin pagar no traban los videos ya pagados (`saldoDeVideosMinor`).
 *
 * Todo filtra por `workspaceId`. Nunca loguea datos personales.
 */

type Tx = Prisma.TransactionClient;

export type DepsCargos = DepsEnlace & { ahora?: () => Date };

export const MENSAJES_CARGOS = {
  noExiste: "No encontramos esa entrega.",
  cancelado: "Este pedido fue cancelado.",
  videoNoExiste: "No encontramos ese video.",
  borrados: "Los videos ya se borraron: no se pueden extender ni comprar descargas.",
  videoBorrado: "Ese video ya se borró.",
  cassettesVencidos: "Ya pasó la fecha para retirar los cassettes: escribinos.",
  envioYaConfirmado: "El envío de los cassettes ya está confirmado.",
  envioConPago: "Ya hay un pago registrado para el envío: escribinos para cambiar la dirección.",
  direccion: "Elegí la dirección de la lista.",
  sinEnlace: "No pudimos armar el enlace para pagar. Escribinos.",
  fallo: "No pudimos registrar el pedido. Probá de nuevo en un rato.",
} as const;

export const A_COORDINAR_TEXTO = "Te vamos a escribir para coordinar el envío.";

class Corte extends Error {
  constructor(readonly mensaje: string) {
    super(mensaje);
  }
}

function codigo(e: unknown): string {
  const c = e as { code?: unknown; name?: unknown } | null;
  return typeof c?.code === "string" ? c.code : typeof c?.name === "string" ? c.name : "desconocido";
}

const bloquearEntrega = (tx: Tx, entregaId: string) => tx.$queryRaw`SELECT id FROM "DigitalizacionEntrega" WHERE id = ${entregaId} FOR UPDATE`;

const SELECT_ENTREGA = {
  id: true, workspaceId: true, pedidoId: true, videosVencenAt: true, cassettesVencenAt: true, videosBorradosAt: true,
  envioEstado: true, envioDireccion: true, envioPrecioArs: true,
} as const;

async function entregaDelToken(workspaceId: string, token: unknown) {
  if (!tokenConForma(token)) return null;
  return prisma.digitalizacionEntrega.findFirst({
    where: { workspaceId, accessTokenHash: hashDeToken(token), enviadoAt: { not: null } },
    select: SELECT_ENTREGA,
  });
}

/** Los trabajos del pedido que tienen grabaciones (donde se dejan las notas para el equipo). */
async function trabajosConVideos(workspaceId: string, pedidoId: string): Promise<string[]> {
  const gs = await prisma.digitalizacionGrabacion.findMany({
    where: { workspaceId, proyecto: { pedidoId, workspaceId } },
    select: { proyectoId: true },
  });
  return [...new Set(gs.map((g) => g.proyectoId).filter((p): p is string => p !== null))];
}

/** Deja la nota en cada trabajo del pedido con videos. Nunca lanza. */
async function anotar(workspaceId: string, pedidoId: string, body: string): Promise<void> {
  try {
    const ids = await trabajosConVideos(workspaceId, pedidoId);
    if (ids.length === 0) return;
    await prisma.fotofficeProyectoNota.createMany({ data: ids.map((proyectoId) => ({ workspaceId, proyectoId, body, authorUserId: null })) });
  } catch (e) {
    console.error("[digitalizacion][cargos] no se pudo dejar la nota", { codigo: codigo(e) });
  }
}

/** La dirección del pedido con la cuota preseleccionada (`?pagar=`), donde ya están Mercado Pago y transferencia. */
async function urlParaPagar(workspaceId: string, pedidoId: string, cuotaId: string, deps: DepsEnlace): Promise<string | null> {
  const r = await enlaceDelPedidoDelSistema(workspaceId, pedidoId, {}, deps).catch(() => null);
  if (!r?.ok) return null;
  const u = new URL(r.url);
  u.searchParams.set("pagar", cuotaId);
  return u.toString();
}

/** Cuánto le falta a cada cuota (centavos), con los cobros vigentes. */
async function saldosDeCuotas(db: Tx, workspaceId: string, pedidoId: string): Promise<Map<string, number>> {
  const plan = (await planesDe(workspaceId, [pedidoId], db)).get(pedidoId) ?? { cuotas: [], imputaciones: [] };
  const imputado = imputadoPorCuota(plan.imputaciones);
  return new Map(plan.cuotas.map((c) => [c.id, Math.max(0, aCentavos(c.amountArs) - (imputado.get(c.id) ?? 0))]));
}

/**
 * El saldo que traba los videos (E4): el del pedido sin lo que les falta a las cuotas de los cargos
 * extra PENDIENTES. Con `db` = la transacción, se lee con los candados del llamador.
 */
export async function saldoDeVideosMinor(db: Tx, workspaceId: string, pedidoId: string): Promise<{ numero: string; saldoMinor: number } | null> {
  const saldo = await saldoDelPedido(db, workspaceId, pedidoId);
  if (!saldo) return null;
  const pendientes = await db.digitalizacionCargo.findMany({ where: { workspaceId, pedidoId, estado: "PENDIENTE" }, select: { cuotaId: true } });
  if (pendientes.length === 0) return saldo;
  const saldos = await saldosDeCuotas(db, workspaceId, pedidoId);
  return { numero: saldo.numero, saldoMinor: saldoParaVideos(saldo.saldoMinor, pendientes.map((c) => saldos.get(c.cuotaId) ?? 0)) };
}

// --- Pedir un cargo ---------------------------------------------------------------------------

export type ResultadoPedirCargo = { ok: true; urlPagar: string; reusado: boolean } | { ok: false; error: string };

type EntregaEnTx = { id: string; pedidoId: string; videosVencenAt: Date | null; cassettesVencenAt: Date | null; videosBorradosAt: Date | null; envioEstado: string | null };

/**
 * Dentro de la transacción (candados ya tomados): reusa el cargo PENDIENTE del mismo tipo y video
 * si su cuota sigue en el plan; si no, suma uno nuevo. Un pendiente cuya cuota ya no existe (alguien
 * rehízo el plan a mano) se da por anulado.
 */
async function reusarOAgregar(
  tx: Tx,
  a: { workspaceId: string; entrega: EntregaEnTx; tipo: TipoCargo; grabacionId: string | null; concepto: string; montoArs: number; ahora: Date },
): Promise<{ cuotaId: string; reusado: boolean }> {
  const previo = await tx.digitalizacionCargo.findFirst({
    where: { workspaceId: a.workspaceId, entregaId: a.entrega.id, tipo: a.tipo, grabacionId: a.grabacionId, estado: "PENDIENTE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, cuotaId: true },
  });
  if (previo) {
    const cuota = await tx.fotofficePedidoCuota.findFirst({ where: { id: previo.cuotaId, workspaceId: a.workspaceId, pedidoId: a.entrega.pedidoId }, select: { id: true } });
    if (cuota) return { cuotaId: previo.cuotaId, reusado: true };
    await tx.digitalizacionCargo.updateMany({ where: { id: previo.id, workspaceId: a.workspaceId, estado: "PENDIENTE" }, data: { estado: "ANULADO" } });
  }
  const { cuotaId } = await agregarCargoEnTransaccion(tx, {
    workspaceId: a.workspaceId, pedidoId: a.entrega.pedidoId, concepto: a.concepto, montoArs: a.montoArs, origen: `digitalizacion:${a.tipo}`, ahora: a.ahora,
  });
  await tx.digitalizacionCargo.create({
    data: {
      workspaceId: a.workspaceId, entregaId: a.entrega.id, pedidoId: a.entrega.pedidoId, cuotaId, tipo: a.tipo, grabacionId: a.grabacionId,
      montoArs: a.montoArs.toFixed(2), estado: "PENDIENTE",
    },
    select: { id: true },
  });
  return { cuotaId, reusado: false };
}

/** Abre la transacción con los dos candados y relee la entrega y el estado del pedido. */
async function conCandados<T>(workspaceId: string, entregaId: string, pedidoId: string, fn: (tx: Tx, e: EntregaEnTx & { cancelado: boolean }) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await bloquearPedido(tx, pedidoId);
    await bloquearEntrega(tx, entregaId);
    const e = await tx.digitalizacionEntrega.findFirst({
      where: { id: entregaId, workspaceId },
      select: { id: true, pedidoId: true, videosVencenAt: true, cassettesVencenAt: true, videosBorradosAt: true, envioEstado: true },
    });
    if (!e) throw new Corte(MENSAJES_CARGOS.noExiste);
    const p = await tx.fotofficePedido.findFirst({ where: { id: e.pedidoId, workspaceId }, select: { status: true } });
    if (!p) throw new Corte(MENSAJES_CARGOS.noExiste);
    return fn(tx, { ...e, cancelado: p.status === "CANCELADO" });
  }, OPCIONES_TRANSACCION_PEDIDO);
}

function mensajeDe(e: unknown, donde: string): string {
  if (e instanceof Corte) return e.mensaje;
  const corte = mensajeDeCorte(e);
  if (corte) return corte;
  console.error(`[digitalizacion][cargos] ${donde} falló`, { codigo: codigo(e) });
  return MENSAJES_CARGOS.fallo;
}

type Leido = { items: unknown; totals: unknown; totalArs: { toString(): string } };

async function totalOriginalDe(tx: Tx, workspaceId: string, pedidoId: string, p: Leido): Promise<number> {
  const cargos = await tx.digitalizacionCargo.findMany({ where: { workspaceId, pedidoId }, select: { montoArs: true, estado: true } });
  return totalOriginal(pesosDeBase(p.totalArs), cargos.map((c) => ({ montoArs: pesosDeBase(c.montoArs), estado: c.estado })));
}

/** "Comprar otra descarga" de un video (E6/E7): 25 % del precio del trabajo del video. */
export async function pedirDescargaExtra(workspaceId: string, token: unknown, grabacionId: unknown, deps: DepsCargos = {}): Promise<ResultadoPedirCargo> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  if (typeof grabacionId !== "string" || !ID_VALIDO.test(grabacionId)) return { ok: false, error: MENSAJES_CARGOS.videoNoExiste };
  const ent = await entregaDelToken(workspaceId, token);
  if (!ent) return { ok: false, error: MENSAJES_CARGOS.noExiste };
  let hecho: { cuotaId: string; reusado: boolean };
  try {
    hecho = await conCandados(workspaceId, ent.id, ent.pedidoId, async (tx, e) => {
      const g = await tx.digitalizacionGrabacion.findFirst({
        where: { id: grabacionId, workspaceId, estado: "COMPLETA", conversionEstado: "LISTA", proyecto: { pedidoId: e.pedidoId, workspaceId } },
        select: { id: true, titulo: true, tipo: true, cassetteNumero: true, videoBorradoAt: true, proyectoId: true },
      });
      if (!g) throw new Corte(MENSAJES_CARGOS.videoNoExiste);
      const trabajo = g.proyectoId ? await tx.fotofficeProyecto.findFirst({ where: { id: g.proyectoId, workspaceId }, select: { pedidoItemIndex: true } }) : null;
      if (e.cancelado) throw new Corte(MENSAJES_CARGOS.cancelado);
      if (!puedeComprarDescarga(e, g, ahora)) throw new Corte(g.videoBorradoAt ? MENSAJES_CARGOS.videoBorrado : MENSAJES_CARGOS.borrados);
      const p = await tx.fotofficePedido.findFirst({ where: { id: e.pedidoId, workspaceId }, select: { items: true, totals: true, totalArs: true } });
      if (!p) throw new Corte(MENSAJES_CARGOS.noExiste);
      const listos = await tx.digitalizacionGrabacion.count({ where: { workspaceId, estado: "COMPLETA", conversionEstado: "LISTA", proyecto: { pedidoId: e.pedidoId, workspaceId } } });
      const renglones = ((p.totals as { renglones?: unknown } | null)?.renglones ?? {}) as Record<string, { neto?: unknown }>;
      const { precio } = precioUnitarioDelTrabajo({
        items: Array.isArray(p.items) ? (p.items as { id: unknown; cantidad: unknown; precioUnitario: unknown }[]) : [],
        renglones: typeof renglones === "object" && renglones !== null ? renglones : {},
        pedidoItemIndex: trabajo?.pedidoItemIndex ?? null,
        totalOriginal: await totalOriginalDe(tx, workspaceId, e.pedidoId, p),
        videosListos: listos,
      });
      return reusarOAgregar(tx, {
        workspaceId, entrega: e, tipo: "DESCARGA_EXTRA", grabacionId: g.id, concepto: conceptoDeCargo("DESCARGA_EXTRA", tituloDeVideo(g)),
        montoArs: precioDescargaExtra(precio), ahora,
      });
    });
  } catch (e) {
    return { ok: false, error: mensajeDe(e, "pedirDescargaExtra") };
  }
  const urlPagar = await urlParaPagar(workspaceId, ent.pedidoId, hecho.cuotaId, deps);
  return urlPagar ? { ok: true, urlPagar, reusado: hecho.reusado } : { ok: false, error: MENSAJES_CARGOS.sinEnlace };
}

/** "Extender 30 días" (E6/E7): 50 % del total original del pedido. */
export async function pedirExtension(workspaceId: string, token: unknown, deps: DepsCargos = {}): Promise<ResultadoPedirCargo> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const ent = await entregaDelToken(workspaceId, token);
  if (!ent) return { ok: false, error: MENSAJES_CARGOS.noExiste };
  let hecho: { cuotaId: string; reusado: boolean };
  try {
    hecho = await conCandados(workspaceId, ent.id, ent.pedidoId, async (tx, e) => {
      if (e.cancelado) throw new Corte(MENSAJES_CARGOS.cancelado);
      if (!puedeExtender(e, ahora)) throw new Corte(MENSAJES_CARGOS.borrados);
      const p = await tx.fotofficePedido.findFirst({ where: { id: e.pedidoId, workspaceId }, select: { items: true, totals: true, totalArs: true } });
      if (!p) throw new Corte(MENSAJES_CARGOS.noExiste);
      const monto = precioExtension(await totalOriginalDe(tx, workspaceId, e.pedidoId, p));
      return reusarOAgregar(tx, { workspaceId, entrega: e, tipo: "EXTENSION", grabacionId: null, concepto: conceptoDeCargo("EXTENSION", null), montoArs: monto, ahora });
    });
  } catch (e) {
    return { ok: false, error: mensajeDe(e, "pedirExtension") };
  }
  const urlPagar = await urlParaPagar(workspaceId, ent.pedidoId, hecho.cuotaId, deps);
  return urlPagar ? { ok: true, urlPagar, reusado: hecho.reusado } : { ok: false, error: MENSAJES_CARGOS.sinEnlace };
}

// --- Envío de los cassettes (E9) --------------------------------------------------------------

const MAX_DETALLES = 100;

export type ResultadoEnvioCassettes =
  | { ok: true; estado: "A_PAGAR"; urlPagar: string; precioArs: number; km: number }
  | { ok: true; estado: "CONFIRMADO"; km: number }
  | { ok: true; estado: "A_COORDINAR"; mensaje: string }
  | { ok: false; error: string };

function leerPunto(raw: unknown): { lat: number; lon: number; direccion: string; detalles: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!puntoValido(r.lat, r.lon)) return null;
  return { lat: r.lat as number, lon: r.lon as number, direccion: textoLimpio(r.direccion, MAX_DIRECCION), detalles: textoLimpio(r.detalles, MAX_DETALLES) };
}

/**
 * "Pedir envío de los cassettes": el servidor recalcula los km desde el punto elegido y el estudio
 * (línea recta × 1,3) y busca la franja. Con precio, suma el cargo ENVIO (estado A_PAGAR) y manda a
 * pagar; con una franja de 0 pesos, lo confirma sin cargo; sin franja, sin franjas o sin coordenadas
 * del estudio, queda A_COORDINAR. Un pedido de envío anterior sin pagar se reemplaza (o se reusa si
 * es la misma dirección y el mismo precio). Guarda la dirección verificada en la entrega, deja una
 * nota para el equipo y completa la dirección de la ficha del cliente sólo si estaba vacía.
 */
export async function pedirEnvioCassettes(workspaceId: string, token: unknown, datos: unknown, deps: DepsCargos = {}): Promise<ResultadoEnvioCassettes> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const punto = leerPunto(datos);
  if (!punto) return { ok: false, error: MENSAJES_CARGOS.direccion };
  const ent = await entregaDelToken(workspaceId, token);
  if (!ent) return { ok: false, error: MENSAJES_CARGOS.noExiste };
  if (!puedePedirEnvio({ cancelado: false, cassettesVencenAt: ent.cassettesVencenAt, envioEstado: ent.envioEstado }, ahora)) {
    return { ok: false, error: ent.envioEstado === "CONFIRMADO" || ent.envioEstado === "ENTREGADO" ? MENSAJES_CARGOS.envioYaConfirmado : MENSAJES_CARGOS.cassettesVencidos };
  }

  const [extras, ajustes, verificado] = await Promise.all([
    extrasDelWorkspace(workspaceId).catch(() => null),
    prisma.digitalizacionAjustes.findUnique({ where: { workspaceId }, select: { enviosFranjas: true } }),
    lugarDelPunto(punto),
  ]);
  const cot = cotizarEnvioCassettes({ estudio: coordenadasDelEstudio(extras), destino: punto, franjas: leerFranjas(ajustes?.enviosFranjas ?? null) });
  const km = cot.km;
  const precio = cot.estado === "A_COORDINAR" ? null : cot.precioArs;

  let hecho: { cuotaId: string | null };
  try {
    hecho = await conCandados(workspaceId, ent.id, ent.pedidoId, async (tx, e) => {
      if (e.cancelado) throw new Corte(MENSAJES_CARGOS.cancelado);
      if (!puedePedirEnvio(e, ahora)) throw new Corte(e.envioEstado === "CONFIRMADO" || e.envioEstado === "ENTREGADO" ? MENSAJES_CARGOS.envioYaConfirmado : MENSAJES_CARGOS.cassettesVencidos);
      const previos = await tx.digitalizacionCargo.findMany({
        where: { workspaceId, entregaId: e.id, tipo: "ENVIO", estado: "PENDIENTE" },
        select: { id: true, cuotaId: true, montoArs: true },
      });
      const actual = await tx.digitalizacionEntrega.findFirst({ where: { id: e.id, workspaceId }, select: { envioDireccion: true } });
      let cuotaId: string | null = null;
      for (const c of previos) {
        // La misma dirección al mismo precio: se reusa (un segundo clic no cambia nada).
        const cuota = await tx.fotofficePedidoCuota.findFirst({ where: { id: c.cuotaId, workspaceId }, select: { id: true } });
        if (cot.estado === "A_PAGAR" && cuota && cuotaId === null && actual?.envioDireccion === verificado.direccion && pesosDeBase(c.montoArs) === cot.precioArs) {
          cuotaId = c.cuotaId;
          continue;
        }
        try {
          await quitarCargoEnTransaccion(tx, { workspaceId, pedidoId: e.pedidoId, cuotaId: c.cuotaId });
        } catch (err) {
          if (mensajeDeCorte(err)) throw new Corte(MENSAJES_CARGOS.envioConPago);
          throw err;
        }
        await tx.digitalizacionCargo.updateMany({ where: { id: c.id, workspaceId, estado: "PENDIENTE" }, data: { estado: "ANULADO" } });
      }
      if (cot.estado === "A_PAGAR" && cuotaId === null) {
        const r = await agregarCargoEnTransaccion(tx, {
          workspaceId, pedidoId: e.pedidoId, concepto: conceptoDeCargo("ENVIO", null), montoArs: cot.precioArs, origen: "digitalizacion:ENVIO", ahora,
        });
        cuotaId = r.cuotaId;
        await tx.digitalizacionCargo.create({
          data: { workspaceId, entregaId: e.id, pedidoId: e.pedidoId, cuotaId, tipo: "ENVIO", grabacionId: null, montoArs: cot.precioArs.toFixed(2), estado: "PENDIENTE" },
          select: { id: true },
        });
      }
      await tx.digitalizacionEntrega.updateMany({
        where: { id: e.id, workspaceId },
        data: {
          envioEstado: cot.estado,
          envioDireccion: verificado.direccion,
          envioLat: punto.lat,
          envioLng: punto.lon,
          envioKm: km,
          envioPrecioArs: precio === null ? null : precio.toFixed(2),
          envioPedidoAt: ahora,
        },
      });
      return { cuotaId };
    });
  } catch (e) {
    return { ok: false, error: mensajeDe(e, "pedirEnvioCassettes") };
  }

  const ficha = await completarFichaDelCliente(workspaceId, ent.pedidoId, verificado.lugar);
  const kmTexto = km === null ? "" : ` · ${String(km).replace(".", ",")} km`;
  const fichaTexto = ficha === "GUARDADA" ? " Se guardó en la ficha del contacto." : ficha === "YA_TENIA" ? " La ficha del contacto ya tenía otra dirección: no se cambió." : "";
  const estadoTexto =
    cot.estado === "A_PAGAR" ? `${pesos(cot.precioArs * 100)}, pendiente de pago` : cot.estado === "CONFIRMADO" ? "sin cargo, confirmado" : "a coordinar con el cliente";
  await anotar(workspaceId, ent.pedidoId, `El cliente pidió el envío de los cassettes a ${verificado.direccion}${kmTexto} (${estadoTexto}).${fichaTexto}`);

  if (cot.estado === "A_COORDINAR") return { ok: true, estado: "A_COORDINAR", mensaje: A_COORDINAR_TEXTO };
  if (cot.estado === "CONFIRMADO") return { ok: true, estado: "CONFIRMADO", km: cot.km };
  const urlPagar = hecho.cuotaId ? await urlParaPagar(workspaceId, ent.pedidoId, hecho.cuotaId, deps) : null;
  if (!urlPagar) return { ok: false, error: MENSAJES_CARGOS.sinEnlace };
  return { ok: true, estado: "A_PAGAR", urlPagar, precioArs: cot.precioArs, km: cot.km };
}

/**
 * Completa `Client.address` / `city` con el lugar verificado, sólo los que están vacíos: nunca pisa
 * lo que cargó el equipo. Sin lugar verificado no toca nada (la dirección queda sólo en la nota).
 */
async function completarFichaDelCliente(workspaceId: string, pedidoId: string, lugar: { address: string | null; city: string | null } | null): Promise<"GUARDADA" | "YA_TENIA" | "SIN_DATOS"> {
  if (!lugar?.address && !lugar?.city) return "SIN_DATOS";
  try {
    const p = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { clientId: true } });
    if (!p) return "SIN_DATOS";
    const c = await prisma.client.findFirst({ where: { id: p.clientId, workspaceId }, select: { id: true, address: true, city: true } });
    if (!c) return "SIN_DATOS";
    const data: { address?: string; city?: string } = {};
    if (!c.address?.trim() && lugar.address?.trim()) data.address = lugar.address.trim().slice(0, 200);
    if (!c.city?.trim() && lugar.city?.trim()) data.city = lugar.city.trim().slice(0, 120);
    if (Object.keys(data).length === 0) return "YA_TENIA";
    // Condicional sobre lo leído: si alguien la completó en el medio, gana lo suyo.
    await prisma.client.updateMany({
      where: { id: c.id, workspaceId, ...(data.address ? { address: c.address } : {}), ...(data.city ? { city: c.city } : {}) },
      data,
    });
    return data.address ? "GUARDADA" : "YA_TENIA";
  } catch (e) {
    console.error("[digitalizacion][cargos] no se pudo completar la ficha del cliente", { codigo: codigo(e) });
    return "SIN_DATOS";
  }
}

// --- Aplicar los cargos pagos -----------------------------------------------------------------

export type ReporteCargos = { revisados: number; aplicados: number; anulados: number; fallidos: number };

const CARGOS_POR_CORRIDA = 500;

/**
 * Aplica los cargos PENDIENTES cuya cuota quedó paga (saldo de la cuota ≤ 0). Con `filtro`, sólo los
 * de ese pedido (lo llama el cobro después del commit); sin filtro, todos (los crons). Cada cargo va
 * en su transacción, con los dos candados, y vuelve a mirar la cuota adentro (un cobro anulado en el
 * medio no aplica nada). Idempotente. Nunca lanza.
 */
export async function aplicarCargosPagados(filtro: { workspaceId: string; pedidoId: string } | null = null, deps: { ahora?: () => Date } = {}): Promise<ReporteCargos> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const reporte: ReporteCargos = { revisados: 0, aplicados: 0, anulados: 0, fallidos: 0 };
  try {
    const pendientes = await prisma.digitalizacionCargo.findMany({
      where: { estado: "PENDIENTE", ...(filtro ? { workspaceId: filtro.workspaceId, pedidoId: filtro.pedidoId } : {}) },
      orderBy: { createdAt: "asc" },
      take: CARGOS_POR_CORRIDA,
      select: { id: true, workspaceId: true, pedidoId: true, entregaId: true, cuotaId: true },
    });
    const saldos = new Map<string, Map<string, number>>();
    for (const c of pendientes) {
      reporte.revisados++;
      try {
        const clave = `${c.workspaceId}:${c.pedidoId}`;
        if (!saldos.has(clave)) saldos.set(clave, await saldosDeCuotas(prisma as unknown as Tx, c.workspaceId, c.pedidoId));
        const falta = saldos.get(clave)!.get(c.cuotaId);
        if (falta !== undefined && falta > 0) continue;
        const r = await aplicarUno(c, ahora);
        if (r === "APLICADO") reporte.aplicados++;
        else if (r === "ANULADO") reporte.anulados++;
      } catch (e) {
        reporte.fallidos++;
        console.error("[digitalizacion][cargos] no se pudo aplicar un cargo", { codigo: codigo(e) });
      }
    }
  } catch (e) {
    console.error("[digitalizacion][cargos] falló la conciliación de cargos", { codigo: codigo(e) });
  }
  return reporte;
}

async function aplicarUno(
  c: { id: string; workspaceId: string; pedidoId: string; entregaId: string; cuotaId: string },
  ahora: Date,
): Promise<"APLICADO" | "ANULADO" | "NADA"> {
  const { workspaceId } = c;
  const hecho = await prisma.$transaction(async (tx): Promise<{ r: "APLICADO" | "ANULADO" | "NADA"; nota: string | null }> => {
    await bloquearPedido(tx, c.pedidoId);
    await bloquearEntrega(tx, c.entregaId);
    const saldos = await saldosDeCuotas(tx, workspaceId, c.pedidoId);
    const falta = saldos.get(c.cuotaId);
    if (falta === undefined) {
      // La cuota ya no está (se rehízo el plan a mano): el cargo no se puede cobrar más.
      const a = await tx.digitalizacionCargo.updateMany({ where: { id: c.id, workspaceId, estado: "PENDIENTE" }, data: { estado: "ANULADO" } });
      return { r: a.count === 1 ? "ANULADO" : "NADA", nota: null };
    }
    if (falta > 0) return { r: "NADA", nota: null };
    const marcado = await tx.digitalizacionCargo.updateMany({ where: { id: c.id, workspaceId, estado: "PENDIENTE" }, data: { estado: "APLICADO", aplicadoAt: ahora } });
    if (marcado.count !== 1) return { r: "NADA", nota: null };
    const cargo = await tx.digitalizacionCargo.findFirst({
      where: { id: c.id, workspaceId },
      select: { tipo: true, grabacionId: true, montoArs: true },
    });
    const video = cargo?.grabacionId
      ? await tx.digitalizacionGrabacion.findFirst({ where: { id: cargo.grabacionId, workspaceId }, select: { titulo: true, tipo: true, cassetteNumero: true } })
      : null;
    const e = await tx.digitalizacionEntrega.findFirst({ where: { id: c.entregaId, workspaceId }, select: { videosVencenAt: true, videosBorradosAt: true, envioDireccion: true } });
    if (!cargo || !e) return { r: "APLICADO", nota: null };
    const monto = pesos(Math.round(pesosDeBase(cargo.montoArs) * 100));
    if (cargo.tipo === "DESCARGA_EXTRA") {
      if (cargo.grabacionId) await tx.digitalizacionGrabacion.updateMany({ where: { id: cargo.grabacionId, workspaceId }, data: { descargasExtra: { increment: 1 } } });
      const titulo = video ? tituloDeVideo(video) : "un video";
      return { r: "APLICADO", nota: `Pago acreditado (${monto}): una descarga extra de «${titulo}».` };
    }
    if (cargo.tipo === "EXTENSION") {
      if (e.videosBorradosAt) {
        return { r: "APLICADO", nota: `Pago acreditado (${monto}) de la extensión de 30 días, pero los videos ya se habían borrado: revisar con el cliente.` };
      }
      const vence = vencimientoExtendido(e.videosVencenAt, ahora);
      await tx.digitalizacionEntrega.updateMany({
        where: { id: c.entregaId, workspaceId },
        data: { videosVencenAt: vence, extensiones: { increment: 1 }, recordatorios: [] },
      });
      return { r: "APLICADO", nota: `Pago acreditado (${monto}): los videos se extendieron 30 días, hasta el ${fechaArgentina(vence)}.` };
    }
    if (cargo.tipo === "ENVIO") {
      await tx.digitalizacionEntrega.updateMany({ where: { id: c.entregaId, workspaceId }, data: { envioEstado: "CONFIRMADO" } });
      return { r: "APLICADO", nota: `Pago acreditado (${monto}): envío de los cassettes confirmado${e.envioDireccion ? ` a ${e.envioDireccion}` : ""}. Coordinar la entrega.` };
    }
    return { r: "APLICADO", nota: null };
  }, OPCIONES_TRANSACCION_PEDIDO);
  if (hecho.nota) await anotar(workspaceId, c.pedidoId, hecho.nota);
  return hecho.r;
}

/**
 * Los cargos que perdieron sentido sin que nadie los pague: descargas extra y extensiones de una
 * entrega con los videos ya borrados, y envíos con los cassettes vencidos. Se sacan del pedido (el
 * saldo vuelve a como estaba) sólo si su cuota no tiene ningún cobro. Lo llama el cron diario.
 */
export async function anularCargosSinSentido(deps: { ahora?: () => Date } = {}): Promise<number> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  let anulados = 0;
  try {
    const candidatos = await prisma.digitalizacionCargo.findMany({
      where: {
        estado: "PENDIENTE",
        OR: [
          { tipo: { in: ["DESCARGA_EXTRA", "EXTENSION"] }, entrega: { videosBorradosAt: { not: null } } },
          { tipo: "ENVIO", entrega: { cassettesVencenAt: { lt: ahora } } },
        ],
      },
      take: CARGOS_POR_CORRIDA,
      select: { id: true, workspaceId: true },
    });
    for (const c of candidatos) {
      const r = await anularCargo(c.workspaceId, c.id);
      if (r.ok) anulados++;
    }
  } catch (e) {
    console.error("[digitalizacion][cargos] falló la limpieza de cargos", { codigo: codigo(e) });
  }
  return anulados;
}

// --- Equipo: anular un cargo y marcar el envío entregado --------------------------------------

/**
 * "Anular" un cargo PENDIENTE desde la lista de Digitalización: sale del pedido (renglón, total y
 * cuota) y queda ANULADO. Con un cobro imputado no se puede (primero se anula el cobro). Si era el
 * envío pendiente de pago, el envío vuelve a "sin pedir".
 */
export async function anularCargo(workspaceId: string, cargoId: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof cargoId !== "string" || !ID_VALIDO.test(cargoId)) return { ok: false, error: "No encontramos ese cargo." };
  const c = await prisma.digitalizacionCargo.findFirst({ where: { id: cargoId, workspaceId }, select: { id: true, pedidoId: true, entregaId: true, cuotaId: true, tipo: true, estado: true } });
  if (!c) return { ok: false, error: "No encontramos ese cargo." };
  if (c.estado !== "PENDIENTE") return { ok: false, error: "Ese cargo ya no está pendiente." };
  try {
    await prisma.$transaction(async (tx) => {
      await bloquearPedido(tx, c.pedidoId);
      await bloquearEntrega(tx, c.entregaId);
      const sigue = await tx.digitalizacionCargo.findFirst({ where: { id: c.id, workspaceId, estado: "PENDIENTE" }, select: { id: true } });
      if (!sigue) throw new Corte("Ese cargo ya no está pendiente.");
      await quitarCargoEnTransaccion(tx, { workspaceId, pedidoId: c.pedidoId, cuotaId: c.cuotaId });
      await tx.digitalizacionCargo.updateMany({ where: { id: c.id, workspaceId, estado: "PENDIENTE" }, data: { estado: "ANULADO" } });
      if (c.tipo === "ENVIO") {
        await tx.digitalizacionEntrega.updateMany({ where: { id: c.entregaId, workspaceId, envioEstado: "A_PAGAR" }, data: { envioEstado: null } });
      }
    }, OPCIONES_TRANSACCION_PEDIDO);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: mensajeDe(e, "anularCargo") };
  }
}

/** "Marcar entregado": el envío de los cassettes confirmado (o coordinado) ya llegó. */
export async function marcarEnvioEntregado(workspaceId: string, entregaId: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof entregaId !== "string" || !ID_VALIDO.test(entregaId)) return { ok: false, error: MENSAJES_CARGOS.noExiste };
  const e = await prisma.digitalizacionEntrega.findFirst({ where: { id: entregaId, workspaceId }, select: { id: true, pedidoId: true, envioEstado: true } });
  if (!e) return { ok: false, error: MENSAJES_CARGOS.noExiste };
  if (e.envioEstado !== "CONFIRMADO" && e.envioEstado !== "A_COORDINAR") {
    return { ok: false, error: e.envioEstado === "A_PAGAR" ? "El envío todavía no está pago." : "No hay un envío para marcar." };
  }
  const r = await prisma.digitalizacionEntrega.updateMany({ where: { id: e.id, workspaceId, envioEstado: e.envioEstado }, data: { envioEstado: "ENTREGADO" } });
  if (r.count !== 1) return { ok: false, error: "Alguien acaba de cambiar este envío. Probá de nuevo." };
  await anotar(workspaceId, e.pedidoId, "Cassettes entregados al cliente.");
  return { ok: true };
}

// --- Lecturas para las pantallas --------------------------------------------------------------

export type CargoPendiente = { id: string; tipo: TipoCargo; grabacionId: string | null; montoMinor: number; cuotaId: string };

/** Los cargos PENDIENTES de unas entregas (para la lista interna y la página pública). */
export async function cargosPendientes(workspaceId: string, entregaIds: readonly string[]): Promise<Map<string, CargoPendiente[]>> {
  const mapa = new Map<string, CargoPendiente[]>();
  if (entregaIds.length === 0) return mapa;
  const filas = await prisma.digitalizacionCargo.findMany({
    where: { workspaceId, entregaId: { in: [...entregaIds] }, estado: "PENDIENTE" },
    orderBy: { createdAt: "asc" },
    select: { id: true, entregaId: true, tipo: true, grabacionId: true, montoArs: true, cuotaId: true },
  });
  for (const f of filas) {
    if (f.tipo !== "DESCARGA_EXTRA" && f.tipo !== "EXTENSION" && f.tipo !== "ENVIO") continue;
    const lista = mapa.get(f.entregaId) ?? [];
    lista.push({ id: f.id, tipo: f.tipo, grabacionId: f.grabacionId, montoMinor: Math.round(pesosDeBase(f.montoArs) * 100), cuotaId: f.cuotaId });
    mapa.set(f.entregaId, lista);
  }
  return mapa;
}

/** La dirección para pagar cada cargo pendiente de la página pública (cuota preseleccionada). */
export async function urlsParaPagar(workspaceId: string, pedidoId: string, cuotaIds: readonly string[], deps: DepsEnlace = {}): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (cuotaIds.length === 0) return out;
  const r = await enlaceDelPedidoDelSistema(workspaceId, pedidoId, {}, deps).catch(() => null);
  if (!r?.ok) return out;
  for (const id of cuotaIds) {
    const u = new URL(r.url);
    u.searchParams.set("pagar", id);
    out.set(id, u.toString());
  }
  return out;
}
