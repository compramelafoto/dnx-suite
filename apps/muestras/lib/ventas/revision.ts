"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import { activitySalesHref, nextEditionNumber, offerProblems, offerTransition, type OfferTransitionResult } from "@repo/muestras";
import { puede, rolEnMuestra } from "@/lib/equipo/permisos";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { leerConfigDeVentas } from "./config";
import { PEDIDO_PA } from "./evaluar";

/**
 * La organización revisa los formatos que proponen los autores (etapa 8, spec D10, D24): aprueba,
 * pide cambios, pausa, reanuda y emite las pruebas de autor. Sólo `sales` (el dueño o el super
 * admin), leído en la base en cada acción; cada cambio, con la oferta bloqueada.
 */
export type ResultadoRevisionVenta = { ok: true; aviso?: string } | { ok: false; errores: string[] };

const error = (texto: string): ResultadoRevisionVenta => ({ ok: false, errores: [texto] });
const TEXTO_NO_EXISTE = "Ese formato no existe.";
const SIN_SESION = error("Tenés que ingresar.");
const NO_EXISTE = error(TEXTO_NO_EXISTE);
const MUCHOS = error("Hiciste muchos cambios seguidos. Esperá unos minutos.");
const CAMBIO = "El formato cambió mientras tanto. Recargá la página.";
const ES_ID = /^[A-Za-z0-9_-]{1,64}$/;

class Corte extends Error {}

const OFERTA = {
  id: true, activityId: true, activityWorkId: true, authorUserId: true, format: true, editionKind: true, editionSize: true, proofCount: true,
  priceArs: true, approvedPriceArs: true, paper: true, widthCm: true, heightCm: true, status: true, reviewNote: true, firstSoldAt: true,
} as const;
type Oferta = Prisma.CulturalWorkOfferGetPayload<{ select: typeof OFERTA }>;

async function preparar(id: unknown): Promise<{ listo: false; error: ResultadoRevisionVenta } | { listo: true; usuario: Usuario; o: Oferta }> {
  const usuario = await getUsuario();
  if (!usuario) return { listo: false, error: SIN_SESION };
  if (typeof id !== "string" || !ES_ID.test(id)) return { listo: false, error: NO_EXISTE };
  if (!frenarPorUsuario("revisarOfertas", usuario.id).allowed) return { listo: false, error: MUCHOS };
  const o = await prisma.culturalWorkOffer.findUnique({ where: { id }, select: OFERTA });
  if (!o) return { listo: false, error: NO_EXISTE };
  const rol = await rolEnMuestra(o.activityId, usuario);
  if (!rol || !puede(usuario, "sales", rol.role)) return { listo: false, error: NO_EXISTE };
  return { listo: true, usuario, o };
}

async function bloquear(tx: Prisma.TransactionClient, id: string): Promise<Oferta> {
  await tx.$queryRaw`SELECT id FROM "CulturalWorkOffer" WHERE id = ${id} FOR UPDATE`;
  const o = await tx.culturalWorkOffer.findUnique({ where: { id }, select: OFERTA });
  if (!o) throw new Corte(TEXTO_NO_EXISTE);
  return o;
}

function refrescar(activityId: string) {
  revalidatePath(activitySalesHref(activityId), "layout");
  revalidatePath(`/panel/expositor/ventas/${activityId}`);
  revalidatePath("/panel/ventas-muestras");
}

/** Aplica una transición de la organización con la oferta bloqueada. */
async function transicion(
  id: string,
  calcular: (o: Oferta) => OfferTransitionResult,
  extra: (o: Oferta, usuario: Usuario) => Prisma.CulturalWorkOfferUpdateManyMutationInput = () => ({}),
): Promise<ResultadoRevisionVenta> {
  const r = await preparar(id);
  if (!r.listo) return r.error;
  try {
    await prisma.$transaction(async (tx) => {
      const o = await bloquear(tx, r.o.id);
      const t = calcular(o);
      if (!t.ok) throw new Corte(t.error);
      const { count } = await tx.culturalWorkOffer.updateMany({
        where: { id: o.id, status: o.status },
        data: {
          status: t.status,
          ...(t.approvedPriceArs !== undefined ? { approvedPriceArs: t.approvedPriceArs } : {}),
          ...(t.reviewNote !== undefined ? { reviewNote: t.reviewNote } : {}),
          ...extra(o, r.usuario),
        },
      });
      if (count === 0) throw new Corte(CAMBIO);
    }, { timeout: 15_000, maxWait: 5_000 });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  refrescar(r.o.activityId);
  return { ok: true };
}

/** Aprobar: se vende al precio propuesto. Un cambio de precio no toca la edición ni las copias vendidas. */
export async function aprobarOferta(id: string): Promise<ResultadoRevisionVenta> {
  return transicion(
    id,
    (o) => {
      const problemas = offerProblems(o, { hasFirstSale: false });
      if (problemas.length) return { ok: false, error: problemas.join(" ") };
      return offerTransition("approve", o, { actor: "ORGANIZER" });
    },
    (_o, usuario) => ({ approvedAt: new Date(), approvedByUserId: usuario.id }),
  );
}

/** Pedir cambios con una nota (hasta 500 caracteres). Un cambio de precio en revisión sigue vendiendo al aprobado. */
export async function pedirCambiosOferta(id: string, nota: string): Promise<ResultadoRevisionVenta> {
  const texto = typeof nota === "string" ? nota.trim() : "";
  if (!texto) return error("Escribí qué hay que cambiar.");
  return transicion(id, (o) => offerTransition("requestChanges", o, { actor: "ORGANIZER", note: texto }));
}

export async function pausarOferta(id: string): Promise<ResultadoRevisionVenta> {
  return transicion(id, (o) => offerTransition("pause", o, { actor: "ORGANIZER" }));
}

export async function reanudarOferta(id: string): Promise<ResultadoRevisionVenta> {
  return transicion(id, (o) => offerTransition("resume", o, { actor: "ORGANIZER" }));
}

/**
 * Emitir la próxima prueba de autor (D24): toma el número libre más bajo de las P/A, sin comprador.
 * El certificado y la etiqueta se generan con el resto de las piezas (tarea 16). En prueba
 * (sandbox) o con la venta apagada, la P/A queda marcada como de prueba (D4).
 */
export async function emitirPruebaDeAutor(offerId: string): Promise<ResultadoRevisionVenta> {
  const r = await preparar(offerId);
  if (!r.listo) return r.error;
  const isTest = leerConfigDeVentas().modo !== "LIVE";
  let numero = 0;
  let total = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const o = await bloquear(tx, r.o.id);
      if (o.proofCount <= 0) throw new Corte("Este formato no tiene pruebas de autor.");
      if (o.status !== "APPROVED" && o.status !== "PAUSED") throw new Corte("Las pruebas de autor se emiten con el formato aprobado.");
      const ahora = new Date();
      const filas = await tx.culturalEditionCopy.findMany({
        where: { offerId: o.id, isTest, kind: "PROOF" },
        select: { id: true, number: true, status: true, reservedUntil: true, kind: true, isTest: true },
      });
      const sig = nextEditionNumber(filas, o.proofCount, ahora, "PROOF", isTest);
      if (!sig) throw new Corte("Ya se emitieron todas las pruebas de autor.");
      const datos = { status: "ISSUED", issuedAt: ahora, reservedUntil: null, orderId: null };
      if ("reuseId" in sig) {
        const { count } = await tx.culturalEditionCopy.updateMany({ where: { id: sig.reuseId, status: { in: ["RELEASED", "RESERVED"] } }, data: datos });
        if (count === 0) throw new Corte(CAMBIO);
      } else {
        await tx.culturalEditionCopy.create({ data: { offerId: o.id, activityId: o.activityId, isTest, kind: "PROOF", number: sig.number, ...datos } });
      }
      numero = sig.number;
      total = o.proofCount;
      // El pedido del autor queda resuelto cuando no quedan P/A por emitir.
      if (sig.number >= o.proofCount && o.reviewNote?.startsWith(PEDIDO_PA)) {
        await tx.culturalWorkOffer.updateMany({ where: { id: o.id }, data: { reviewNote: null } });
      }
    }, { timeout: 15_000, maxWait: 5_000 });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  refrescar(r.o.activityId);
  return { ok: true, aviso: `Emitimos la P/A ${numero}/${total}.` };
}
