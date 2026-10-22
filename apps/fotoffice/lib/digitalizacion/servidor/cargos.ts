import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { checkRateLimit } from "@/lib/geocode/rate-limit";
import { coordenadasDelEstudio, puntoValido } from "@/lib/impresiones/envio";
import { lugarDelPunto, MAX_DIRECCION, textoLimpio } from "@/lib/impresiones/direccion-servidor";
import { saldoSinExtrasOpcionales } from "@/lib/pedidos/candado-saldo";
import {
  MENSAJES_CARGO, agregarCargoEnTransaccion, avisarCargoParaRevisar, cambiarMontoDelCargoEnTransaccion, hayRevisionAbierta, mensajeDeCorte, tituloDeRevision,
  quitarCargoAManoEnTransaccion, quitarCargoEnTransaccion, type ResultadoTocarCargo,
} from "@/lib/pedidos/cargos";
import { itemDeCargo, precioDelRenglonDeCargo, sumaDeRenglonesDeCargo } from "@/lib/pedidos/cargos-puro";
import { OPCIONES_TRANSACCION_PEDIDO } from "@/lib/pedidos/constantes";
import { enlaceDelPedidoDelSistema, type DepsEnlace } from "@/lib/pedidos/enlace";
import { imputadoPorCuota } from "@/lib/pedidos/estado";
import { bloquearPedido, pesosDeBase, planesDe } from "@/lib/pedidos/plan";
import { aCentavos } from "@/lib/pedidos/plan-cuotas";
import { extrasDelWorkspace } from "@/lib/presupuestos/perfil-cobro";
import { tokenConForma, hashDeToken } from "@/lib/presupuestos/enlace";
import { decimalArsToMinor } from "@/lib/membership/money";
import { ID_VALIDO } from "../claves";
import {
  conceptoDeCargo, cotizarEnvioCassettes, precioDescargaExtra, precioExtension, precioUnitarioDelTrabajo, puedeComprarDescarga, puedeExtender,
  puedePedirEnvio, vencimientoExtendido, type TipoCargo,
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
 * - **Plata ajena, nunca:** quitar o cambiar un cargo sólo pasa si sigue intacto (`lib/pedidos/cargos`):
 *   si alguien editó el plan a mano, no se toca y queda una tarea en el pedido para revisarlo.
 * - **Cargo "a revisar":** no hay un estado propio para "el plan se editó a mano y la cuota del cargo
 *   desapareció", así que se usa ANULADO más una nota y una tarea. Se lo reconoce porque su renglón
 *   `cargo-<cuotaId>` sigue en los ítems del pedido (un cargo anulado por el sistema siempre saca su
 *   renglón). Mientras esté así, ese mismo cargo (tipo y video) no se reusa ni se vuelve a crear:
 *   primero lo tiene que resolver una persona.
 * - **Candados:** primero el pedido (`bloquearPedido`) y después la entrega (`FOR UPDATE`), el mismo
 *   orden que la descarga contada: dos caminos nunca se esperan entre sí.
 * - Los extras sin pagar no traban los videos ya pagados (`saldoSinExtrasOpcionales`).
 *
 * Todo filtra por `workspaceId`. Nunca loguea datos personales.
 */

type Tx = Prisma.TransactionClient;

export type DepsCargos = DepsEnlace & { ahora?: () => Date };

/** Todos los errores que puede ver el cliente (la página los muestra por su clave, `?motivo=`). */
export const MENSAJES_CARGOS = {
  noExiste: "No encontramos esa entrega.",
  cancelado: "Este pedido fue cancelado.",
  videoNoExiste: "No encontramos ese video.",
  borrados: "Los videos ya se borraron: no se pueden extender ni comprar descargas.",
  videoBorrado: "Ese video ya se borró.",
  cassettesVencidos: "Ya pasó la fecha para retirar los cassettes: escribinos.",
  envioYaConfirmado: "El envío de los cassettes ya está confirmado.",
  envioConPago: "Ya iniciaste un pago del envío: escribinos para cambiar la dirección.",
  direccion: "Elegí la dirección de la lista.",
  sinVerificar: "No pudimos verificar la dirección, probá de nuevo en unos minutos.",
  revisar: "Tenemos que revisar un pedido anterior de este extra: escribinos y lo resolvemos.",
  muchosItems: "No podemos sumar más extras a este pedido: escribinos.",
  sinEnlace: "No pudimos armar el enlace para pagar. Escribinos.",
  limite: "Hubo demasiados pedidos desde tu conexión. Esperá unos minutos y probá de nuevo.",
  demasiados: "Hiciste muchos pedidos seguidos desde este enlace. Esperá un rato y probá de nuevo.",
  fallo: "No pudimos registrar el pedido. Probá de nuevo en un rato.",
} as const;

export type ClaveMensajeCargo = keyof typeof MENSAJES_CARGOS;

export const A_COORDINAR_TEXTO = "Te vamos a escribir para coordinar el envío.";

/** Corta la transacción con un mensaje para el cliente; con `revisar`, además deja la tarea al equipo. */
class Corte extends Error {
  constructor(readonly mensaje: string, readonly revisar: { pedidoId: string; concepto: string } | null = null) {
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

// --- Freno por enlace -------------------------------------------------------------------------

const HORA_MS = 60 * 60 * 1000;
/** Pedidos por hora y por enlace de entrega (además del freno por IP de las acciones). */
export const TOPE_POR_TOKEN = { ENVIO: 10, OTRO: 20 } as const;

/**
 * ¿Este enlace de entrega puede pedir otro cargo? Un cupo por hora por enlace (la clave es el hash
 * del token: no se guarda el token). Frena a quien cambia de IP para pedir envíos en bucle.
 */
export function pasaElFrenoDelEnlace(token: unknown, tipo: "ENVIO" | "OTRO"): boolean {
  if (!tokenConForma(token)) return true;
  return checkRateLimit({ key: `videos-cargo:${tipo}:${hashDeToken(token)}`, limit: TOPE_POR_TOKEN[tipo], windowMs: HORA_MS }).allowed;
}

// --- Notas para el equipo ---------------------------------------------------------------------

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

/** Plan editado a mano: tarea en el pedido y, sólo la primera vez, nota en los trabajos. Nunca lanza. */
async function avisarParaRevisar(workspaceId: string, pedidoId: string, concepto: string): Promise<void> {
  if (!(await avisarCargoParaRevisar(workspaceId, pedidoId, concepto))) return;
  await anotar(workspaceId, pedidoId, `El plan de pagos se editó a mano y el cargo «${concepto}» no cuadra: el sistema no lo tocó. Revisalo en el pedido.`);
}

// --- Enlaces y saldo --------------------------------------------------------------------------

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
 * El saldo que traba los videos (E4): el del pedido sin los extras opcionales de Digitalización,
 * en cualquier estado del cargo (`saldoSinExtrasOpcionales`). Con `db` = la transacción, se lee con
 * los candados del llamador.
 */
export function saldoDeVideosMinor(db: Tx, workspaceId: string, pedidoId: string): Promise<{ numero: string; saldoMinor: number } | null> {
  return saldoSinExtrasOpcionales(db, workspaceId, pedidoId);
}

// --- Pedir un cargo ---------------------------------------------------------------------------

export type ResultadoPedirCargo = { ok: true; urlPagar: string; reusado: boolean } | { ok: false; error: string };

type EntregaEnTx = { id: string; pedidoId: string; videosVencenAt: Date | null; cassettesVencenAt: Date | null; videosBorradosAt: Date | null; envioEstado: string | null };

/**
 * ¿Hay un cargo de este tipo y video "a revisar"? ANULADO con su renglón todavía en los ítems: el
 * plan se editó a mano y la plata del cargo puede seguir en el total. No se pide otro hasta resolverlo.
 */
async function hayCargoParaRevisar(tx: Tx, workspaceId: string, entregaId: string, tipo: TipoCargo, grabacionId: string | null, items: unknown): Promise<boolean> {
  const anulados = await tx.digitalizacionCargo.findMany({
    where: { workspaceId, entregaId, tipo, grabacionId, estado: "ANULADO" },
    select: { cuotaId: true },
  });
  if (anulados.length === 0 || !Array.isArray(items)) return false;
  const ids = new Set(items.map((x) => (x && typeof x === "object" ? (x as { id?: unknown }).id : null)));
  return anulados.some((c) => ids.has(itemDeCargo(c.cuotaId)));
}

/**
 * Dentro de la transacción (candados ya tomados): reusa el cargo PENDIENTE del mismo tipo y video
 * si su cuota sigue en el plan; si no, suma uno nuevo. Un pendiente cuya cuota ya no existe o un
 * cargo "a revisar" frenan: el plan se editó a mano y lo resuelve una persona.
 */
async function reusarOAgregar(
  tx: Tx,
  a: { workspaceId: string; entrega: EntregaEnTx; items: unknown; tipo: TipoCargo; grabacionId: string | null; concepto: string; montoArs: number; ahora: Date },
): Promise<{ cuotaId: string; reusado: boolean }> {
  const previo = await tx.digitalizacionCargo.findFirst({
    where: { workspaceId: a.workspaceId, entregaId: a.entrega.id, tipo: a.tipo, grabacionId: a.grabacionId, estado: "PENDIENTE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, cuotaId: true },
  });
  if (previo) {
    const cuota = await tx.fotofficePedidoCuota.findFirst({ where: { id: previo.cuotaId, workspaceId: a.workspaceId, pedidoId: a.entrega.pedidoId }, select: { id: true } });
    if (cuota) return { cuotaId: previo.cuotaId, reusado: true };
    throw new Corte(MENSAJES_CARGOS.revisar, { pedidoId: a.entrega.pedidoId, concepto: a.concepto });
  }
  if (await hayCargoParaRevisar(tx, a.workspaceId, a.entrega.id, a.tipo, a.grabacionId, a.items)) {
    throw new Corte(MENSAJES_CARGOS.revisar, { pedidoId: a.entrega.pedidoId, concepto: a.concepto });
  }
  const { cuotaId } = await agregarCargoEnTransaccion(tx, {
    workspaceId: a.workspaceId, pedidoId: a.entrega.pedidoId, concepto: a.concepto, montoArs: a.montoArs, origen: `digitalizacion:${a.tipo}`, ahora: a.ahora,
  });
  await tx.digitalizacionCargo.create({
    data: {
      workspaceId: a.workspaceId, entregaId: a.entrega.id, pedidoId: a.entrega.pedidoId, cuotaId, tipo: a.tipo, grabacionId: a.grabacionId,
      montoArs: a.montoArs.toFixed(2), estado: "PENDIENTE", createdAt: a.ahora,
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

/** El mensaje para el cliente de un error: siempre uno de `MENSAJES_CARGOS`. */
async function mensajeDe(workspaceId: string, e: unknown, donde: string): Promise<string> {
  if (e instanceof Corte) {
    if (e.revisar) await avisarParaRevisar(workspaceId, e.revisar.pedidoId, e.revisar.concepto);
    return e.mensaje;
  }
  const corte = mensajeDeCorte(e);
  if (corte === MENSAJE_CANCELADO) return MENSAJES_CARGOS.cancelado;
  if (corte === MENSAJES_CARGO.muchosItems) return MENSAJES_CARGOS.muchosItems;
  if (corte !== null) return MENSAJES_CARGOS.fallo;
  console.error(`[digitalizacion][cargos] ${donde} falló`, { codigo: codigo(e) });
  return MENSAJES_CARGOS.fallo;
}
const MENSAJE_CANCELADO: string = MENSAJES_CARGO.cancelado;

type Leido = { items: unknown; totalArs: { toString(): string } };

/** El total del pedido sin los renglones de cargos extra que están en los ítems (pesos). */
function totalOriginalDe(p: Leido): number {
  return Math.max(0, Math.round((pesosDeBase(p.totalArs) - sumaDeRenglonesDeCargo(p.items)) * 100)) / 100;
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
        totalOriginal: totalOriginalDe(p),
        videosListos: listos,
      });
      return reusarOAgregar(tx, {
        workspaceId, entrega: e, items: p.items, tipo: "DESCARGA_EXTRA", grabacionId: g.id, concepto: conceptoDeCargo("DESCARGA_EXTRA", tituloDeVideo(g)),
        montoArs: precioDescargaExtra(precio), ahora,
      });
    });
  } catch (e) {
    return { ok: false, error: await mensajeDe(workspaceId, e, "pedirDescargaExtra") };
  }
  const urlPagar = await urlParaPagar(workspaceId, ent.pedidoId, hecho.cuotaId, deps);
  return urlPagar ? { ok: true, urlPagar, reusado: hecho.reusado } : { ok: false, error: MENSAJES_CARGOS.sinEnlace };
}

/** "Extender 30 días" (E6/E7): 50 % del total original del pedido (sin los renglones de cargos). */
export async function pedirExtension(workspaceId: string, token: unknown, deps: DepsCargos = {}): Promise<ResultadoPedirCargo> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const ent = await entregaDelToken(workspaceId, token);
  if (!ent) return { ok: false, error: MENSAJES_CARGOS.noExiste };
  let hecho: { cuotaId: string; reusado: boolean };
  try {
    hecho = await conCandados(workspaceId, ent.id, ent.pedidoId, async (tx, e) => {
      if (e.cancelado) throw new Corte(MENSAJES_CARGOS.cancelado);
      if (!puedeExtender(e, ahora)) throw new Corte(MENSAJES_CARGOS.borrados);
      const p = await tx.fotofficePedido.findFirst({ where: { id: e.pedidoId, workspaceId }, select: { items: true, totalArs: true } });
      if (!p) throw new Corte(MENSAJES_CARGOS.noExiste);
      return reusarOAgregar(tx, {
        workspaceId, entrega: e, items: p.items, tipo: "EXTENSION", grabacionId: null, concepto: conceptoDeCargo("EXTENSION", null),
        montoArs: precioExtension(totalOriginalDe(p)), ahora,
      });
    });
  } catch (e) {
    return { ok: false, error: await mensajeDe(workspaceId, e, "pedirExtension") };
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

/** Un pedido de envío anterior sin pagar que no se pudo cambiar: con pago iniciado o con el plan editado. */
function corteDelEnvioPrevio(r: Exclude<ResultadoTocarCargo, { ok: true }>, pedidoId: string): Corte {
  if (r.motivo === "CON_COBROS") return new Corte(MENSAJES_CARGOS.envioConPago);
  return new Corte(MENSAJES_CARGOS.revisar, { pedidoId, concepto: conceptoDeCargo("ENVIO", null) });
}

/**
 * "Pedir envío de los cassettes": el servidor verifica la dirección (geocodificación inversa: si
 * Nominatim no responde, no se acepta) y recalcula los km desde el punto elegido y el estudio (línea
 * recta × 1,3) y busca la franja. Con precio, suma el cargo ENVIO (estado A_PAGAR) y manda a pagar;
 * con una franja de 0 pesos, lo confirma sin cargo; sin franja, sin franjas o sin coordenadas del
 * estudio, queda A_COORDINAR.
 *
 * Un pedido de envío anterior sin pagar NO se borra: su cuota se cambia en el lugar al precio nuevo
 * (así un pago de Mercado Pago ya abierto sigue apuntando a una cuota que existe), o se quita si el
 * envío nuevo no tiene precio. Con un pago iniciado (cobro o transferencia esperada), frena.
 * Guarda la dirección verificada en la entrega, deja una nota (salvo que no haya cambiado nada) y
 * completa la ficha del cliente sólo en lo que estaba vacío.
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

  const verificado = await lugarDelPunto(punto);
  // Sin verificar no se acepta: no se guarda ni se cobra un texto que nadie confirmó.
  if (!verificado.lugar) return { ok: false, error: MENSAJES_CARGOS.sinVerificar };
  const [extras, ajustes] = await Promise.all([
    extrasDelWorkspace(workspaceId).catch(() => null),
    prisma.digitalizacionAjustes.findUnique({ where: { workspaceId }, select: { enviosFranjas: true } }),
  ]);
  const cot = cotizarEnvioCassettes({ estudio: coordenadasDelEstudio(extras), destino: punto, franjas: leerFranjas(ajustes?.enviosFranjas ?? null) });
  const km = cot.km;
  const precio = cot.estado === "A_COORDINAR" ? null : cot.precioArs;

  let hecho: { cuotaId: string | null; sinCambios: boolean };
  let cambioDeMonto: { antes: number; despues: number } | null = null;
  try {
    hecho = await conCandados(workspaceId, ent.id, ent.pedidoId, async (tx, e) => {
      cambioDeMonto = null;
      if (e.cancelado) throw new Corte(MENSAJES_CARGOS.cancelado);
      if (!puedePedirEnvio(e, ahora)) throw new Corte(e.envioEstado === "CONFIRMADO" || e.envioEstado === "ENTREGADO" ? MENSAJES_CARGOS.envioYaConfirmado : MENSAJES_CARGOS.cassettesVencidos);
      const actual = await tx.digitalizacionEntrega.findFirst({ where: { id: e.id, workspaceId }, select: { envioDireccion: true, envioEstado: true } });
      const p = await tx.fotofficePedido.findFirst({ where: { id: e.pedidoId, workspaceId }, select: { items: true } });
      const previos = await tx.digitalizacionCargo.findMany({
        where: { workspaceId, entregaId: e.id, tipo: "ENVIO", estado: "PENDIENTE" },
        orderBy: { createdAt: "desc" },
        select: { id: true, cuotaId: true, montoArs: true },
      });
      const mismaDireccion = actual?.envioDireccion === verificado.direccion && actual?.envioEstado === cot.estado;
      let cuotaId: string | null = null;
      let sinCambios = false;
      for (const c of previos) {
        const monto = pesosDeBase(c.montoArs);
        if (cot.estado === "A_PAGAR" && cuotaId === null) {
          // El mismo pedido de envío se conserva: misma cuota, al precio nuevo si cambió.
          if (monto !== cot.precioArs) {
            const r = await cambiarMontoDelCargoEnTransaccion(tx, { workspaceId, pedidoId: e.pedidoId, cuotaId: c.cuotaId, montoArs: monto, montoNuevoArs: cot.precioArs });
            if (!r.ok) throw corteDelEnvioPrevio(r, e.pedidoId);
            await tx.digitalizacionCargo.updateMany({ where: { id: c.id, workspaceId, estado: "PENDIENTE" }, data: { montoArs: cot.precioArs.toFixed(2) } });
            cambioDeMonto = { antes: monto, despues: cot.precioArs };
          } else {
            const cuota = await tx.fotofficePedidoCuota.findFirst({ where: { id: c.cuotaId, workspaceId }, select: { id: true } });
            if (!cuota) throw new Corte(MENSAJES_CARGOS.revisar, { pedidoId: e.pedidoId, concepto: conceptoDeCargo("ENVIO", null) });
            sinCambios = mismaDireccion;
          }
          cuotaId = c.cuotaId;
          continue;
        }
        // El envío nuevo no tiene precio (o hay un pendiente de más): ese cargo sale del pedido.
        const r = await quitarCargoEnTransaccion(tx, { workspaceId, pedidoId: e.pedidoId, cuotaId: c.cuotaId, montoArs: monto });
        if (!r.ok) throw corteDelEnvioPrevio(r, e.pedidoId);
        await tx.digitalizacionCargo.updateMany({ where: { id: c.id, workspaceId, estado: "PENDIENTE" }, data: { estado: "ANULADO" } });
      }
      if (cot.estado === "A_PAGAR" && cuotaId === null) {
        if (await hayCargoParaRevisar(tx, workspaceId, e.id, "ENVIO", null, p?.items ?? null)) {
          throw new Corte(MENSAJES_CARGOS.revisar, { pedidoId: e.pedidoId, concepto: conceptoDeCargo("ENVIO", null) });
        }
        const r = await agregarCargoEnTransaccion(tx, {
          workspaceId, pedidoId: e.pedidoId, concepto: conceptoDeCargo("ENVIO", null), montoArs: cot.precioArs, origen: "digitalizacion:ENVIO", ahora,
        });
        cuotaId = r.cuotaId;
        await tx.digitalizacionCargo.create({
          data: { workspaceId, entregaId: e.id, pedidoId: e.pedidoId, cuotaId, tipo: "ENVIO", grabacionId: null, montoArs: cot.precioArs.toFixed(2), estado: "PENDIENTE", createdAt: ahora },
          select: { id: true },
        });
      }
      if (cot.estado !== "A_PAGAR") sinCambios = mismaDireccion && previos.length === 0;
      if (!sinCambios) {
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
      }
      return { cuotaId, sinCambios };
    });
  } catch (e) {
    return { ok: false, error: await mensajeDe(workspaceId, e, "pedirEnvioCassettes") };
  }

  // Un segundo clic con la misma dirección no deja otra nota ni vuelve a tocar la ficha.
  if (!hecho.sinCambios) {
    const ficha = await completarFichaDelCliente(workspaceId, ent.pedidoId, verificado.lugar);
    const kmTexto = km === null ? "" : ` · ${String(km).replace(".", ",")} km`;
    const estadoTexto =
      cot.estado === "A_PAGAR" ? `${pesos(cot.precioArs * 100)}, pendiente de pago` : cot.estado === "CONFIRMADO" ? "sin cargo, confirmado" : "a coordinar con el cliente";
    await anotar(workspaceId, ent.pedidoId, `El cliente pidió el envío de los cassettes a ${verificado.direccion}${kmTexto} (${estadoTexto}).${textoDeFicha(ficha)}`);
  }
  const cambio = cambioDeMonto as { antes: number; despues: number } | null;
  if (cambio) {
    await anotar(workspaceId, ent.pedidoId, `El envío de los cassettes cambió de importe: de ${pesos(cambio.antes * 100)} a ${pesos(cambio.despues * 100)} (misma cuota del pedido).`);
  }

  if (cot.estado === "A_COORDINAR") return { ok: true, estado: "A_COORDINAR", mensaje: A_COORDINAR_TEXTO };
  if (cot.estado === "CONFIRMADO") return { ok: true, estado: "CONFIRMADO", km: cot.km };
  const urlPagar = hecho.cuotaId ? await urlParaPagar(workspaceId, ent.pedidoId, hecho.cuotaId, deps) : null;
  if (!urlPagar) return { ok: false, error: MENSAJES_CARGOS.sinEnlace };
  return { ok: true, estado: "A_PAGAR", urlPagar, precioArs: cot.precioArs, km: cot.km };
}

type Ficha = { guardados: string[]; yaTenia: boolean };

function textoDeFicha(f: Ficha | null): string {
  if (!f) return "";
  const guardado = f.guardados.length > 0 ? ` Se completó en la ficha del contacto: ${f.guardados.join(", ")}.` : "";
  const ya = f.yaTenia ? " La ficha ya tenía otros datos de dirección: no se cambiaron." : "";
  return guardado + ya;
}

const CAMPOS_FICHA: Record<string, string> = { address: "dirección", city: "ciudad", province: "provincia", postalCode: "código postal" };

/**
 * Completa la ficha del cliente con el lugar verificado, SÓLO en lo que está vacío (nunca pisa lo
 * que cargó el equipo): `Client.address` / `city` y, en el perfil del contacto, `province` /
 * `postalCode` (el mismo upsert por `clientId` que `guardarPerfil`). Las escrituras son condicionales
 * sobre lo leído y se mira el `count`: si alguien la completó en el medio, gana lo suyo y no se
 * cuenta como guardado. Deja el rastro en `ClientAudit` como cualquier cambio de la ficha.
 * null si no hay nada que mirar. Nunca lanza.
 */
async function completarFichaDelCliente(
  workspaceId: string,
  pedidoId: string,
  lugar: { address: string | null; city: string | null; province: string | null; postalCode: string | null },
): Promise<Ficha | null> {
  const limpio = (v: string | null, max: number) => (v?.trim() ? v.trim().slice(0, max) : null);
  const nuevo = { address: limpio(lugar.address, 200), city: limpio(lugar.city, 120), province: limpio(lugar.province, 120), postalCode: limpio(lugar.postalCode, 20) };
  if (!nuevo.address && !nuevo.city && !nuevo.province && !nuevo.postalCode) return null;
  try {
    const p = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { clientId: true } });
    if (!p) return null;
    const c = await prisma.client.findFirst({ where: { id: p.clientId, workspaceId }, select: { id: true, address: true, city: true } });
    if (!c) return null;
    const perfil = await prisma.fotofficeContactoPerfil.findFirst({ where: { clientId: c.id, workspaceId }, select: { province: true, postalCode: true } });
    const cambios: Record<string, { before: string | null; after: string }> = {};
    let yaTenia = false;

    const deCliente: { address?: string; city?: string } = {};
    for (const k of ["address", "city"] as const) {
      if (!nuevo[k]) continue;
      if (c[k]?.trim()) { yaTenia ||= c[k]!.trim() !== nuevo[k]; continue; }
      deCliente[k] = nuevo[k]!;
    }
    if (Object.keys(deCliente).length > 0) {
      const r = await prisma.client.updateMany({
        where: { id: c.id, workspaceId, ...(deCliente.address ? { address: c.address } : {}), ...(deCliente.city ? { city: c.city } : {}) },
        data: deCliente,
      });
      if (r.count === 1) for (const [k, v] of Object.entries(deCliente)) cambios[k] = { before: c[k as "address" | "city"] ?? null, after: v };
    }

    const dePerfil: { province?: string; postalCode?: string } = {};
    for (const k of ["province", "postalCode"] as const) {
      if (!nuevo[k]) continue;
      if (perfil?.[k]?.trim()) { yaTenia ||= perfil[k]!.trim() !== nuevo[k]; continue; }
      dePerfil[k] = nuevo[k]!;
    }
    if (Object.keys(dePerfil).length > 0) {
      if (perfil) {
        const r = await prisma.fotofficeContactoPerfil.updateMany({
          where: { clientId: c.id, workspaceId, ...(dePerfil.province ? { province: perfil.province } : {}), ...(dePerfil.postalCode ? { postalCode: perfil.postalCode } : {}) },
          data: dePerfil,
        });
        if (r.count === 1) for (const [k, v] of Object.entries(dePerfil)) cambios[k] = { before: perfil[k as "province" | "postalCode"] ?? null, after: v };
      } else {
        // Sin perfil: se crea con lo nuevo; si otra pestaña lo creó en el medio, no se pisa nada.
        await prisma.fotofficeContactoPerfil.upsert({ where: { clientId: c.id }, create: { workspaceId, clientId: c.id, ...dePerfil }, update: {}, select: { id: true } });
        const creado = await prisma.fotofficeContactoPerfil.findFirst({ where: { clientId: c.id, workspaceId }, select: { province: true, postalCode: true } });
        for (const [k, v] of Object.entries(dePerfil)) if (creado?.[k as "province" | "postalCode"] === v) cambios[k] = { before: null, after: v };
      }
    }

    if (Object.keys(cambios).length > 0) {
      await prisma.clientAudit.create({
        data: { workspaceId, clientId: c.id, action: "UPDATED", actorUserId: null, actorLabel: "Sistema (envío de cassettes)", changesJson: cambios as Prisma.InputJsonValue },
      });
    }
    return { guardados: Object.keys(cambios).map((k) => CAMPOS_FICHA[k] ?? k), yaTenia };
  } catch (e) {
    console.error("[digitalizacion][cargos] no se pudo completar la ficha del cliente", { codigo: codigo(e) });
    return null;
  }
}

// --- Aplicar los cargos pagos -----------------------------------------------------------------

export type ReporteCargos = { revisados: number; aplicados: number; anulados: number; fallidos: number };

/** De a cuántos se leen los pendientes (paginados por id: ninguno queda afuera por ser nuevo). */
const PAGINA_CARGOS = 200;
/** Tope de páginas por corrida (10.000 cargos): un freno de seguridad, no un límite de diseño. */
const MAX_PAGINAS = 50;

/**
 * Aplica los cargos PENDIENTES cuya cuota quedó paga (saldo de la cuota ≤ 0). Con `filtro`, sólo los
 * de ese pedido (lo llama el cobro después del commit); sin filtro, todos (los crons), paginados por
 * id. Cada cargo va en su transacción, con los dos candados, y vuelve a mirar la cuota adentro (un
 * cobro anulado en el medio no aplica nada). Idempotente. Nunca lanza.
 */
export async function aplicarCargosPagados(filtro: { workspaceId: string; pedidoId: string } | null = null, deps: { ahora?: () => Date } = {}): Promise<ReporteCargos> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const reporte: ReporteCargos = { revisados: 0, aplicados: 0, anulados: 0, fallidos: 0 };
  try {
    const saldos = new Map<string, Map<string, number>>();
    let desde: string | null = null;
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const pendientes: { id: string; workspaceId: string; pedidoId: string; entregaId: string; cuotaId: string }[] = await prisma.digitalizacionCargo.findMany({
        where: {
          estado: "PENDIENTE",
          ...(filtro ? { workspaceId: filtro.workspaceId, pedidoId: filtro.pedidoId } : {}),
          ...(desde ? { id: { gt: desde } } : {}),
        },
        orderBy: { id: "asc" },
        take: PAGINA_CARGOS,
        select: { id: true, workspaceId: true, pedidoId: true, entregaId: true, cuotaId: true },
      });
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
      if (pendientes.length < PAGINA_CARGOS) break;
      desde = pendientes[pendientes.length - 1]!.id;
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
  const hecho = await prisma.$transaction(async (tx): Promise<{ r: "APLICADO" | "ANULADO" | "NADA"; nota: string | null; revisar: string | null }> => {
    await bloquearPedido(tx, c.pedidoId);
    await bloquearEntrega(tx, c.entregaId);
    const cargo = await tx.digitalizacionCargo.findFirst({ where: { id: c.id, workspaceId }, select: { tipo: true, grabacionId: true, montoArs: true, estado: true } });
    if (!cargo || cargo.estado !== "PENDIENTE") return { r: "NADA", nota: null, revisar: null };
    const video = cargo.grabacionId
      ? await tx.digitalizacionGrabacion.findFirst({ where: { id: cargo.grabacionId, workspaceId }, select: { titulo: true, tipo: true, cassetteNumero: true } })
      : null;
    const concepto = conceptoDeCargo(cargo.tipo as TipoCargo, video ? tituloDeVideo(video) : null);
    const saldos = await saldosDeCuotas(tx, workspaceId, c.pedidoId);
    const falta = saldos.get(c.cuotaId);
    if (falta === undefined) {
      // La cuota ya no está (se rehízo el plan a mano): no se aplica ni se recrea. Queda ANULADO
      // "a revisar" (con su renglón todavía en los ítems) y una tarea para que lo resuelva alguien.
      const a = await tx.digitalizacionCargo.updateMany({ where: { id: c.id, workspaceId, estado: "PENDIENTE" }, data: { estado: "ANULADO" } });
      return { r: a.count === 1 ? "ANULADO" : "NADA", nota: null, revisar: a.count === 1 ? concepto : null };
    }
    if (falta > 0) return { r: "NADA", nota: null, revisar: null };
    const marcado = await tx.digitalizacionCargo.updateMany({ where: { id: c.id, workspaceId, estado: "PENDIENTE" }, data: { estado: "APLICADO", aplicadoAt: ahora } });
    if (marcado.count !== 1) return { r: "NADA", nota: null, revisar: null };
    const e = await tx.digitalizacionEntrega.findFirst({ where: { id: c.entregaId, workspaceId }, select: { videosVencenAt: true, videosBorradosAt: true, envioDireccion: true } });
    if (!e) return { r: "APLICADO", nota: null, revisar: null };
    const monto = pesos(Math.round(pesosDeBase(cargo.montoArs) * 100));
    if (cargo.tipo === "DESCARGA_EXTRA") {
      if (cargo.grabacionId) await tx.digitalizacionGrabacion.updateMany({ where: { id: cargo.grabacionId, workspaceId }, data: { descargasExtra: { increment: 1 } } });
      const titulo = video ? tituloDeVideo(video) : "un video";
      return { r: "APLICADO", nota: `Pago acreditado (${monto}): una descarga extra de «${titulo}».`, revisar: null };
    }
    if (cargo.tipo === "EXTENSION") {
      if (e.videosBorradosAt) {
        return { r: "APLICADO", nota: `Pago acreditado (${monto}) de la extensión de 30 días, pero los videos ya se habían borrado: revisar con el cliente.`, revisar: null };
      }
      const vence = vencimientoExtendido(e.videosVencenAt, ahora);
      await tx.digitalizacionEntrega.updateMany({
        where: { id: c.entregaId, workspaceId },
        data: { videosVencenAt: vence, extensiones: { increment: 1 }, recordatorios: [] },
      });
      return { r: "APLICADO", nota: `Pago acreditado (${monto}): los videos se extendieron 30 días, hasta el ${fechaArgentina(vence)}.`, revisar: null };
    }
    if (cargo.tipo === "ENVIO") {
      await tx.digitalizacionEntrega.updateMany({ where: { id: c.entregaId, workspaceId }, data: { envioEstado: "CONFIRMADO" } });
      return { r: "APLICADO", nota: `Pago acreditado (${monto}): envío de los cassettes confirmado${e.envioDireccion ? ` a ${e.envioDireccion}` : ""}. Coordinar la entrega.`, revisar: null };
    }
    return { r: "APLICADO", nota: null, revisar: null };
  }, OPCIONES_TRANSACCION_PEDIDO);
  if (hecho.nota) await anotar(workspaceId, c.pedidoId, hecho.nota);
  if (hecho.revisar) await avisarParaRevisar(workspaceId, c.pedidoId, hecho.revisar);
  return hecho.r;
}

/** Un pedido abandonado (clic sin pagar) sale del pedido pasados estos días. */
export const DIAS_CARGO_ABANDONADO = 7;

/** El concepto de un cargo, como su renglón ("Descarga extra · Cassette 1"). */
async function conceptoDe(workspaceId: string, c: { tipo: string; grabacionId: string | null }): Promise<string> {
  const video = c.grabacionId
    ? await prisma.digitalizacionGrabacion.findFirst({ where: { id: c.grabacionId, workspaceId }, select: { titulo: true, tipo: true, cassetteNumero: true } })
    : null;
  return conceptoDeCargo(c.tipo as TipoCargo, video ? tituloDeVideo(video) : null);
}

/**
 * La limpieza diaria de los cargos PENDIENTES que nadie va a pagar:
 * - los abandonados: más de 7 días sin pagar;
 * - los que perdieron sentido: descargas extra y extensiones con los videos ya borrados, y envíos
 *   con los cassettes vencidos.
 * Salen del pedido con la regla de `anularCargo` (sólo si siguen intactos: sin cobros, sin
 * transferencia anunciada y con el plan sin tocar). Los que ya están "a revisar" (con su tarea sin
 * hacer) se saltean sin hacer nada. Cada uno que sale deja una nota en el pedido.
 */
export async function anularCargosSinSentido(deps: { ahora?: () => Date } = {}): Promise<number> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const viejo = new Date(ahora.getTime() - DIAS_CARGO_ABANDONADO * 24 * HORA_MS);
  let anulados = 0;
  try {
    const candidatos = await prisma.digitalizacionCargo.findMany({
      where: {
        estado: "PENDIENTE",
        OR: [
          { createdAt: { lt: viejo } },
          { tipo: { in: ["DESCARGA_EXTRA", "EXTENSION"] }, entrega: { videosBorradosAt: { not: null } } },
          { tipo: "ENVIO", entrega: { cassettesVencenAt: { lt: ahora } } },
        ],
      },
      orderBy: { id: "asc" },
      take: PAGINA_CARGOS * 5,
      select: { id: true, workspaceId: true, pedidoId: true, tipo: true, grabacionId: true, montoArs: true },
    });
    for (const c of candidatos) {
      const concepto = await conceptoDe(c.workspaceId, c);
      if (await hayRevisionAbierta(c.workspaceId, c.pedidoId, concepto)) continue;
      const r = await anularCargo(c.workspaceId, c.id);
      if (!r.ok) continue;
      anulados++;
      await anotar(c.workspaceId, c.pedidoId, `Se quitó el extra «${concepto}» sin pagar (${pesos(Math.round(pesosDeBase(c.montoArs) * 100))}).`);
    }
  } catch (e) {
    console.error("[digitalizacion][cargos] falló la limpieza de cargos", { codigo: codigo(e) });
  }
  return anulados;
}

// --- Equipo: anular un cargo y marcar el envío entregado --------------------------------------

/**
 * "Anular" un cargo PENDIENTE (desde la lista de Digitalización o la limpieza diaria): sale del
 * pedido (renglón, total y cuota) y queda ANULADO. Sólo si sigue intacto: con un cobro imputado (aun
 * anulado) no se puede; con el plan editado a mano no se toca y queda una tarea en el pedido. Si era
 * el envío pendiente de pago, el envío vuelve a "sin pedir".
 */
export async function anularCargo(workspaceId: string, cargoId: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof cargoId !== "string" || !ID_VALIDO.test(cargoId)) return { ok: false, error: "No encontramos ese cargo." };
  const c = await prisma.digitalizacionCargo.findFirst({
    where: { id: cargoId, workspaceId },
    select: { id: true, pedidoId: true, entregaId: true, cuotaId: true, tipo: true, estado: true, montoArs: true, grabacionId: true },
  });
  if (!c) return { ok: false, error: "No encontramos ese cargo." };
  if (c.estado !== "PENDIENTE") return { ok: false, error: "Ese cargo ya no está pendiente." };
  try {
    const r = await prisma.$transaction(async (tx): Promise<ResultadoTocarCargo> => {
      await bloquearPedido(tx, c.pedidoId);
      await bloquearEntrega(tx, c.entregaId);
      const sigue = await tx.digitalizacionCargo.findFirst({ where: { id: c.id, workspaceId, estado: "PENDIENTE" }, select: { id: true } });
      if (!sigue) throw new Corte("Ese cargo ya no está pendiente.");
      const q = await quitarCargoEnTransaccion(tx, { workspaceId, pedidoId: c.pedidoId, cuotaId: c.cuotaId, montoArs: pesosDeBase(c.montoArs) });
      if (!q.ok) return q;
      await tx.digitalizacionCargo.updateMany({ where: { id: c.id, workspaceId, estado: "PENDIENTE" }, data: { estado: "ANULADO" } });
      if (c.tipo === "ENVIO") {
        await tx.digitalizacionEntrega.updateMany({ where: { id: c.entregaId, workspaceId, envioEstado: "A_PAGAR" }, data: { envioEstado: null } });
      }
      return { ok: true };
    }, OPCIONES_TRANSACCION_PEDIDO);
    if (r.ok) return r;
    if (r.motivo === "PLAN_EDITADO") await avisarParaRevisar(workspaceId, c.pedidoId, await conceptoDe(workspaceId, c));
    return { ok: false, error: r.error };
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    console.error("[digitalizacion][cargos] anularCargo falló", { codigo: codigo(e) });
    return { ok: false, error: MENSAJES_CARGOS.fallo };
  }
}

export type CargoARevisar = { id: string; concepto: string; montoMinor: number; tieneCobros: boolean };

/**
 * Los cargos "a revisar" de unas entregas: los que no están aplicados, cuyo renglón sigue en el
 * pedido pero ya no cuadran (ANULADO con el renglón todavía ahí, o PENDIENTE con la cuota borrada o
 * con otro importe). `tieneCobros`: su cuota existe y tiene imputaciones (entonces no hay "Quitar a
 * mano": se revisa en el pedido).
 */
export async function cargosARevisar(workspaceId: string, entregas: readonly { id: string; pedidoId: string }[]): Promise<Map<string, CargoARevisar[]>> {
  const mapa = new Map<string, CargoARevisar[]>();
  if (entregas.length === 0) return mapa;
  const filas = await prisma.digitalizacionCargo.findMany({
    where: { workspaceId, entregaId: { in: entregas.map((e) => e.id) }, estado: { in: ["PENDIENTE", "ANULADO"] } },
    orderBy: { createdAt: "asc" },
    select: { id: true, entregaId: true, pedidoId: true, cuotaId: true, tipo: true, grabacionId: true, montoArs: true, estado: true },
  });
  if (filas.length === 0) return mapa;
  const pedidos = await prisma.fotofficePedido.findMany({ where: { workspaceId, id: { in: [...new Set(filas.map((f) => f.pedidoId))] } }, select: { id: true, items: true } });
  const itemsDe = new Map(pedidos.map((p) => [p.id, p.items]));
  const cuotas = await prisma.fotofficePedidoCuota.findMany({ where: { workspaceId, id: { in: filas.map((f) => f.cuotaId) } }, select: { id: true, amountArs: true } });
  const cuotaDe = new Map(cuotas.map((c) => [c.id, decimalArsToMinor(c.amountArs)]));
  for (const f of filas) {
    const precio = precioDelRenglonDeCargo(itemsDe.get(f.pedidoId) ?? null, f.cuotaId);
    if (precio === null) continue;
    const monto = decimalArsToMinor(f.montoArs);
    const cuota = cuotaDe.get(f.cuotaId);
    const trabado = f.estado === "ANULADO" || cuota === undefined || cuota !== monto || aCentavos(precio) !== monto;
    if (!trabado) continue;
    const tieneCobros = cuota !== undefined && (await prisma.fotofficeCobroImputacion.count({ where: { workspaceId, cuotaId: f.cuotaId } })) > 0;
    const lista = mapa.get(f.entregaId) ?? [];
    lista.push({ id: f.id, concepto: await conceptoDe(workspaceId, f), montoMinor: aCentavos(precio), tieneCobros });
    mapa.set(f.entregaId, lista);
  }
  return mapa;
}

/**
 * "Quitar del pedido a mano" de un cargo "a revisar" (lo decide una persona con MANAGE): saca su
 * renglón y su monto del total con los candados, aunque la cuota ya no exista
 * (`quitarCargoAManoEnTransaccion`). El cargo queda ANULADO, la tarea "a revisar" se da por hecha y
 * queda una nota. `planCuadra` false: hay que terminar de ajustar el plan con "Editar plan".
 */
export async function quitarCargoAMano(workspaceId: string, cargoId: unknown, userId: number | null): Promise<{ ok: true; planCuadra: boolean } | { ok: false; error: string }> {
  if (typeof cargoId !== "string" || !ID_VALIDO.test(cargoId)) return { ok: false, error: "No encontramos ese cargo." };
  const c = await prisma.digitalizacionCargo.findFirst({
    where: { id: cargoId, workspaceId },
    select: { id: true, pedidoId: true, entregaId: true, cuotaId: true, tipo: true, grabacionId: true, estado: true },
  });
  if (!c || c.estado === "APLICADO") return { ok: false, error: "Ese cargo ya se aplicó: no se quita." };
  const concepto = await conceptoDe(workspaceId, c);
  try {
    const r = await prisma.$transaction(async (tx) => {
      await bloquearPedido(tx, c.pedidoId);
      await bloquearEntrega(tx, c.entregaId);
      const q = await quitarCargoAManoEnTransaccion(tx, { workspaceId, pedidoId: c.pedidoId, cuotaId: c.cuotaId });
      if (!q.ok) return q;
      await tx.digitalizacionCargo.updateMany({ where: { id: c.id, workspaceId, estado: { in: ["PENDIENTE", "ANULADO"] } }, data: { estado: "ANULADO" } });
      if (c.tipo === "ENVIO") await tx.digitalizacionEntrega.updateMany({ where: { id: c.entregaId, workspaceId, envioEstado: "A_PAGAR" }, data: { envioEstado: null } });
      await tx.fotofficePedidoTarea.updateMany({
        where: { workspaceId, pedidoId: c.pedidoId, title: tituloDeRevision(concepto), doneAt: null },
        data: { doneAt: new Date(), doneByUserId: userId },
      });
      return q;
    }, OPCIONES_TRANSACCION_PEDIDO);
    if (!r.ok) return r;
    await anotar(
      workspaceId,
      c.pedidoId,
      `Se quitó a mano del pedido el extra «${concepto}» (${pesos(aCentavos(r.montoArs))}).${r.planCuadra ? "" : " Revisá el plan de pagos: no suma el total nuevo."}`,
    );
    return { ok: true, planCuadra: r.planCuadra };
  } catch (e) {
    console.error("[digitalizacion][cargos] quitarCargoAMano falló", { codigo: codigo(e) });
    return { ok: false, error: MENSAJES_CARGOS.fallo };
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
