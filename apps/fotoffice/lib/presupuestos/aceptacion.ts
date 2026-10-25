import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { ganarConsultaPorSistema, notificarEvento, reabrirComoGanadaPorSistema } from "@/lib/circuitos/eventos";
import { OPCIONES_TRANSACCION } from "@/lib/circuitos/recorridos";
import { numeroDe } from "@/lib/numeracion/asignar";
import { avisarAceptacion, crearTareaDeConsulta, destinatarioDelPresupuesto, TITULO_TAREA_PEDIR_NUEVO, type DepsAvisos } from "./avisos";
import { ENTIDAD_NUMERACION, esEstadoPresupuesto } from "./constantes";
import { pesos } from "./editor";
import { hashDeToken, tokenConForma } from "./enlace";
import { estadoEfectivo } from "./estados";
import { opcionElegida } from "./opciones-pago";
import { pasarEstado } from "./presupuestos";
import { buscarEnlace } from "./publico";
import { bloquearPresupuesto, type TotalesGuardados } from "./versiones";
import { alternativaAceptada, fijarAlternativa, pagoDeAlternativa } from "./alternativas";
import { leerAjustesCobro } from "@/lib/cobro-ajustes/ajustes";
import { puedeCobrarConMercadoPago } from "@/lib/payments/connect/collector";
import { confirmarPedidoPorSistema } from "@/lib/pedidos/confirmar";
import { enlaceDelPedidoDelSistema } from "@/lib/pedidos/enlace";

/**
 * "Acepto" desde el enlace público (spec etapa 2 §2 A.9, §5). Sin sesión: el token es la llave y
 * el workspace sale del slug de la dirección.
 *
 * - Una sola aceptación por versión: con el candado del presupuesto y la escritura condicional
 *   (`UPDATE … WHERE acceptedAt IS NULL AND revokedAt IS NULL`). La segunda ve "Ya fue aceptado".
 * - Sólo la versión vigente, enviada, sin vencer y no rechazada. Una vieja (reemplazada) o vencida
 *   se rechaza con un mensaje claro.
 * - Evidencia en la versión: fecha, nombre, IP con hash y navegador.
 * - La forma de pago elegida (etapa 3) se guarda en la MISMA escritura condicional, validada contra
 *   la instantánea congelada de esa versión: sin elección, la primera; un id que no está, error.
 * - Presupuesto con opciones (spec 2026-10-25): el cliente elige UNA (`datos.alternativa`). La forma
 *   de pago se valida contra las de ESA opción y, en la misma escritura, totales, opciones de pago y
 *   costos de la versión pasan a ser los de la elegida (`fijarAlternativa`): la seña y el pedido salen
 *   de ahí. Sin opciones, todo como antes.
 * - El presupuesto pasa a ACEPTADO con la versión aceptada y "Pedido por confirmar".
 * - Después (fuera de la transacción, sin poder romper la aceptación): el motor recibe
 *   `PRESUPUESTO_ACEPTADO` (la consulta avanza según las reglas de su circuito); después la
 *   consulta se GANA: con recorrido de venta abierto, se cierra como Ganada como Sistema
 *   (`ganarConsultaPorSistema`, idempotente); si estaba perdida, se reabre como ganada; sin
 *   recorrido, pasa a WON (`reabrirComoGanadaPorSistema`). En los tres casos el contacto pasa a
 *   Cliente (el adaptador del motor). Y se avisa al responsable (tarea + correo interno con tope).
 *
 * Nunca loguea datos personales (ni el nombre que se escribió).
 */

export const MENSAJES_ACEPTACION = {
  enlaceInvalido: "Este enlace ya no es válido. Pedile uno nuevo a quien te lo mandó.",
  nombre: "Escribí tu nombre y apellido.",
  condiciones: "Para aceptar, marcá que leíste y aceptás las condiciones.",
  yaAceptado: "Este presupuesto ya fue aceptado.",
  reemplazado: "Esta versión del presupuesto fue reemplazada por una más nueva. Abrí el último enlace que te mandaron.",
  vencido: "Este presupuesto venció y ya no se puede aceptar. Podés pedir uno nuevo desde esta misma página.",
  rechazado: "Este presupuesto ya no está disponible. Escribile a quien te lo mandó.",
  fallo: "No pudimos registrar tu aceptación. Probá de nuevo en un rato.",
  noVencido: "Este presupuesto todavía está vigente: lo podés aceptar desde esta misma página.",
} as const;

export const MAX_NOMBRE_ACEPTACION = 120;

class Corte extends Error {
  constructor(readonly mensaje: string) {
    super("corte");
  }
}

/** Nombre de quien acepta: una línea, 2 a 120 caracteres. */
export function nombreDeAceptacion(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length >= 2 && t.length <= MAX_NOMBRE_ACEPTACION ? t : null;
}

/** `pedidoUrl`: el enlace del pedido creado al aceptar (etapa B), para pagar la seña; null si no se creó. */
export type ResultadoAceptacion = { ok: true; fecha: Date; pedidoUrl: string | null } | { ok: false; error: string };

export type DepsAceptacion = DepsAvisos & {
  ahora?: () => Date;
  /** ¿La organización puede cobrar con Mercado Pago? Sin eso, las opciones de Mercado Pago no se aceptan. */
  mercadoPago?: (workspaceId: string) => Promise<boolean>;
  /** ¿Está encendido «Crear el pedido al aceptar»? */
  autoPedido?: (workspaceId: string) => Promise<boolean>;
  crearPedido?: (workspaceId: string, presupuestoId: string) => Promise<{ ok: true; pedidoId: string } | { ok: false; error: string }>;
  enlaceDelPedido?: (workspaceId: string, pedidoId: string) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
};

async function autoPedidoEncendido(workspaceId: string): Promise<boolean> {
  return (await leerAjustesCobro(workspaceId)).autoConfirmarPedido;
}

export async function aceptarPresupuesto(
  workspaceId: string,
  token: unknown,
  datos: { nombre: unknown; acepta: unknown; opcion?: unknown; alternativa?: unknown },
  evidencia: { ipHash: string | null; userAgent: string | null },
  deps: DepsAceptacion = {},
): Promise<ResultadoAceptacion> {
  if (!tokenConForma(token)) return { ok: false, error: MENSAJES_ACEPTACION.enlaceInvalido };
  const nombre = nombreDeAceptacion(datos?.nombre);
  if (!nombre) return { ok: false, error: MENSAJES_ACEPTACION.nombre };
  if (datos.acepta !== true) return { ok: false, error: MENSAJES_ACEPTACION.condiciones };
  const ahora = (deps.ahora ?? (() => new Date()))();
  const mercadoPago = await (deps.mercadoPago ?? puedeCobrarConMercadoPago)(workspaceId).catch(() => false);

  const v0 = await prisma.fotofficePresupuestoVersion.findFirst({
    where: { tokenHash: hashDeToken(token), workspaceId },
    select: { id: true, presupuestoId: true },
  });
  if (!v0) return { ok: false, error: MENSAJES_ACEPTACION.enlaceInvalido };

  let aceptado: { leadId: string; ownerUserId: number | null; total: number };
  try {
    aceptado = await prisma.$transaction(async (tx) => {
      await bloquearPresupuesto(tx, v0.presupuestoId);
      const v = await tx.fotofficePresupuestoVersion.findFirst({
        where: { id: v0.id, workspaceId },
        select: { sentAt: true, revokedAt: true, tokenExpiresAt: true, acceptedAt: true, totals: true, paymentOptions: true, costSnapshot: true },
      });
      const p = await tx.fotofficePresupuesto.findFirst({
        where: { id: v0.presupuestoId, workspaceId },
        select: { status: true, validUntil: true, currentVersionId: true, consultaLeadId: true, ownerUserId: true },
      });
      if (!v?.sentAt || !p || !esEstadoPresupuesto(p.status)) throw new Corte(MENSAJES_ACEPTACION.enlaceInvalido);
      if (v.tokenExpiresAt && v.tokenExpiresAt.getTime() < ahora.getTime()) throw new Corte(MENSAJES_ACEPTACION.enlaceInvalido);
      if (v.acceptedAt) throw new Corte(MENSAJES_ACEPTACION.yaAceptado);
      if (v.revokedAt || p.currentVersionId !== v0.id) throw new Corte(MENSAJES_ACEPTACION.reemplazado);
      const efectivo = estadoEfectivo(p.status, p.validUntil, ahora);
      if (efectivo === "ACEPTADO") throw new Corte(MENSAJES_ACEPTACION.yaAceptado);
      if (efectivo === "VENCIDO") throw new Corte(MENSAJES_ACEPTACION.vencido);
      if (efectivo === "RECHAZADO" || efectivo === "BORRADOR") throw new Corte(MENSAJES_ACEPTACION.rechazado);
      const alternativa = alternativaAceptada(v.totals, datos.alternativa);
      if (!alternativa.ok) throw new Corte(alternativa.error);
      const pago = alternativa.valor ? pagoDeAlternativa(v.paymentOptions, alternativa.valor) : v.paymentOptions;
      const opcion = opcionElegida(pago, datos.opcion, { mercadoPago });
      if (!opcion.ok) throw new Corte(opcion.error);
      const fijada = alternativa.valor ? fijarAlternativa(v, alternativa.valor) : null;
      if (alternativa.valor && !fijada) throw new Corte(MENSAJES_ACEPTACION.fallo);

      // Una sola vez por versión: si otra aceptación ganó la carrera, esta no escribe nada.
      const r = await tx.fotofficePresupuestoVersion.updateMany({
        where: { id: v0.id, workspaceId, acceptedAt: null, revokedAt: null },
        data: {
          acceptedAt: ahora, acceptedName: nombre, acceptedIpHash: evidencia.ipHash, acceptedUserAgent: evidencia.userAgent,
          chosenPaymentOptionId: opcion.valor,
          ...(fijada
            ? {
                totals: fijada.totals as Prisma.InputJsonValue,
                ...(fijada.paymentOptions != null ? { paymentOptions: fijada.paymentOptions as Prisma.InputJsonValue } : {}),
                ...(fijada.costSnapshot != null ? { costSnapshot: fijada.costSnapshot as Prisma.InputJsonValue } : {}),
              }
            : {}),
        },
      });
      if (r.count !== 1) throw new Corte(MENSAJES_ACEPTACION.yaAceptado);
      const estado = await pasarEstado(tx, {
        workspaceId, presupuestoId: v0.presupuestoId, a: "ACEPTADO", ahora,
        datos: { acceptedVersionId: v0.id, pedidoPorConfirmar: true, updatedAt: ahora },
      });
      if (!estado.ok) throw new Corte(MENSAJES_ACEPTACION.yaAceptado);
      const totales = (fijada ? fijada.totals : v.totals) as TotalesGuardados | null;
      return { leadId: p.consultaLeadId, ownerUserId: p.ownerUserId, total: totales?.total ?? 0 };
    }, OPCIONES_TRANSACCION);
  } catch (e) {
    if (e instanceof Corte) return { ok: false, error: e.mensaje };
    console.error("[presupuestos] aceptarPresupuesto falló", { codigo: typeof (e as { code?: unknown })?.code === "string" ? (e as { code: string }).code : null });
    return { ok: false, error: MENSAJES_ACEPTACION.fallo };
  }

  // Lo que sigue nunca deshace la aceptación (cada paso atrapa sus propios errores).
  const numero = await numeroDe(workspaceId, ENTIDAD_NUMERACION, [v0.presupuestoId])
    .then((m) => m.get(v0.presupuestoId) ?? null)
    .catch(() => null);
  await notificarEvento(workspaceId, { tipo: "CAPTACION", id: aceptado.leadId }, "PRESUPUESTO_ACEPTADO", v0.id);
  const cual = numero ? ` N° ${numero}` : "";
  // Las dos nunca lanzan. La primera cierra el recorrido abierto (si hay); la segunda cubre la
  // consulta perdida o sin recorrido (con el recorrido ya ganado, no hace nada).
  await ganarConsultaPorSistema(workspaceId, aceptado.leadId, `Ganada: el cliente aceptó el presupuesto${cual}.`);
  await reabrirComoGanadaPorSistema(workspaceId, aceptado.leadId, `Se reabrió como ganada: el cliente aceptó el presupuesto${cual}.`);
  await avisarAceptacion(
    { workspaceId, leadId: aceptado.leadId, presupuestoId: v0.presupuestoId, ownerUserId: aceptado.ownerUserId, numero, total: pesos(aceptado.total) },
    { ...deps, ahora: () => ahora },
  );

  // Etapa B: con «Crear el pedido al aceptar» encendido, el pedido nace ahora y el cliente pasa a su
  // enlace para pagar la seña. Si algo falla, la aceptación vale igual: queda «Pedido por confirmar».
  let pedidoUrl: string | null = null;
  try {
    if (await (deps.autoPedido ?? autoPedidoEncendido)(workspaceId)) {
      const crear = deps.crearPedido ?? ((ws: string, id: string) => confirmarPedidoPorSistema(ws, id, { ahora: () => ahora }));
      const p = await crear(workspaceId, v0.presupuestoId);
      if (p.ok) {
        const e = await (deps.enlaceDelPedido ?? ((ws: string, id: string) => enlaceDelPedidoDelSistema(ws, id)))(workspaceId, p.pedidoId);
        // La cuota 1 (la seña) queda resaltada en el enlace del pedido.
        const sena = e.ok ? await prisma.fotofficePedidoCuota.findFirst({ where: { workspaceId, pedidoId: p.pedidoId, position: 1 }, select: { id: true } }) : null;
        pedidoUrl = e.ok ? (sena ? `${e.url}?pagar=${encodeURIComponent(sena.id)}` : e.url) : null;
      }
    }
  } catch (e) {
    console.error("[presupuestos] pedido automático al aceptar falló", { codigo: typeof (e as { code?: unknown })?.code === "string" ? (e as { code: string }).code : null });
  }
  return { ok: true, fecha: ahora, pedidoUrl };
}

/**
 * "Pedir uno nuevo" desde un presupuesto vencido: una tarea para el responsable (una sola abierta
 * por consulta, aunque lo pidan varias veces). Nunca dice nada del presupuesto que no se vea ya.
 */
export async function pedirPresupuestoNuevo(
  workspaceId: string,
  token: unknown,
  deps: { ahora?: () => Date } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const enlace = await buscarEnlace(workspaceId, token, ahora);
  if (!enlace) return { ok: false, error: MENSAJES_ACEPTACION.enlaceInvalido };
  if (enlace.estado !== "VENCIDO") return { ok: false, error: MENSAJES_ACEPTACION.noVencido };
  try {
    const para = await destinatarioDelPresupuesto(workspaceId, enlace.ownerUserId);
    const r = await crearTareaDeConsulta(workspaceId, enlace.leadId, TITULO_TAREA_PEDIR_NUEVO, para, ahora, { unaSolaAbierta: true });
    return r === "ERROR" ? { ok: false, error: MENSAJES_ACEPTACION.fallo } : { ok: true };
  } catch {
    return { ok: false, error: MENSAJES_ACEPTACION.fallo };
  }
}
