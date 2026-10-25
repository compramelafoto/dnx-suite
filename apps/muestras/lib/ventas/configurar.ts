"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import { PLATFORM_FEE_BPS, SHIPPING_MAX_ARS, activitySalesHref, saleWindowOpen, splitProblems } from "@repo/muestras";
import { conPermiso, puede, rolEnMuestra } from "@/lib/equipo/permisos";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { leerConfigDeVentas } from "./config";

/**
 * La organización enciende la venta de su muestra (etapa 8, spec D6, D14, D26): reparto entre
 * organización y fotógrafo/a, retiro en la sede, envío optativo y condiciones propias. Sólo quien
 * tiene `sales` (el dueño o el super admin); el permiso se vuelve a leer en la base en cada acción y,
 * dentro de la transacción, con la muestra bloqueada.
 */
export type ResultadoVenta = { ok: true; aviso?: string } | { ok: false; errores: string[] };

const error = (texto: string): ResultadoVenta => ({ ok: false, errores: [texto] });
const TEXTO_NO_EXISTE = "La muestra no existe.";
const SIN_SESION = error("Tenés que ingresar.");
const NO_EXISTE = error(TEXTO_NO_EXISTE);
const MUCHOS = error("Hiciste muchos cambios seguidos. Esperá unos minutos.");
const PENDIENTES = "Hay ventas esperando el pago: probá en unos minutos.";
const ES_ID = /^[A-Za-z0-9_-]{1,64}$/;

const LIMITES_TEXTOS_VENTA = { pickupText: 500, shippingText: 300, extraTerms: 1500 } as const;

class Corte extends Error {}

const MUESTRA = { id: true, slug: true, type: true, reviewStatus: true, isCancelled: true, endsAt: true, proposedByUserId: true } as const;
type Muestra = Prisma.CulturalActivityGetPayload<{ select: typeof MUESTRA }>;

type Preparado = { listo: false; error: ResultadoVenta } | { listo: true; usuario: Usuario; a: Muestra; ownerUserId: number };

async function preparar(activityId: unknown): Promise<Preparado> {
  const usuario = await getUsuario();
  if (!usuario) return { listo: false, error: SIN_SESION };
  if (typeof activityId !== "string" || !ES_ID.test(activityId)) return { listo: false, error: NO_EXISTE };
  if (!frenarPorUsuario("ventaConfig", usuario.id).allowed) return { listo: false, error: MUCHOS };
  const rol = await rolEnMuestra(activityId, usuario);
  if (!rol || !puede(usuario, "sales", rol.role)) return { listo: false, error: NO_EXISTE };
  const a = await prisma.culturalActivity.findUnique({ where: { id: activityId }, select: MUESTRA });
  if (!a || a.type !== "MUESTRA") return { listo: false, error: NO_EXISTE };
  return { listo: true, usuario, a, ownerUserId: rol.ownerUserId };
}

/**
 * Bloquea la muestra y su configuración de venta (en ese orden, siempre) y vuelve a mirar el permiso.
 * La reserva de una copia lee la configuración con `FOR SHARE`: no puede tomar un reparto a medio cambiar.
 */
async function bloquear(tx: Prisma.TransactionClient, activityId: string, usuario: Usuario) {
  await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${activityId} FOR UPDATE`;
  if ((await tx.culturalActivity.count({ where: conPermiso({ id: activityId }, usuario, "sales") })) === 0) throw new Corte(TEXTO_NO_EXISTE);
  await tx.$queryRaw`SELECT id FROM "CulturalSaleSetup" WHERE "activityId" = ${activityId} FOR UPDATE`;
  return tx.culturalSaleSetup.findUnique({ where: { activityId } });
}

const pendientesDePago = (tx: Prisma.TransactionClient, activityId: string) =>
  tx.culturalSaleOrder.count({ where: { activityId, status: "PENDING_PAYMENT" } });

function refrescar(a: { id: string; slug: string }) {
  revalidatePath(activitySalesHref(a.id), "layout");
  revalidatePath(`/panel/muestras/${a.id}`);
  revalidatePath("/panel/expositor", "layout");
  revalidatePath(`/m/${a.slug}`, "layout");
}

const texto = (fd: FormData, nombre: string) => {
  const v = fd.get(nombre);
  return typeof v === "string" ? v.trim() : "";
};
/** Entero sin signo de hasta `digitos` cifras, o NaN. */
const entero = (s: string, digitos: number) => (new RegExp(`^\\d{1,${digitos}}$`).test(s) ? Number(s) : Number.NaN);

/** Guardar el reparto, la entrega y las condiciones. Crea la configuración la primera vez. */
export async function guardarVenta(activityId: string, fd: FormData): Promise<ResultadoVenta> {
  const r = await preparar(activityId);
  if (!r.listo) return r.error;
  const { usuario, a } = r;

  const org = entero(texto(fd, "organizacion"), 2);
  const foto = entero(texto(fd, "fotografo"), 2);
  if (Number.isNaN(org) || Number.isNaN(foto)) return error("Poné el porcentaje de la organización y el del fotógrafo, en números enteros.");
  const organizerBps = org * 100;
  const photographerBps = foto * 100;
  const problemas = splitProblems({ organizerBps, photographerBps });
  if (problemas.length) return { ok: false, errores: problemas };

  const pickupText = texto(fd, "retiro");
  const shippingEnabled = fd.get("envio") === "on";
  const costoCrudo = texto(fd, "costoEnvio");
  const shippingText = texto(fd, "textoEnvio");
  const extraTerms = texto(fd, "condiciones");
  if (pickupText.length > LIMITES_TEXTOS_VENTA.pickupText) return error(`El texto del retiro puede tener hasta ${LIMITES_TEXTOS_VENTA.pickupText} caracteres.`);
  if (shippingText.length > LIMITES_TEXTOS_VENTA.shippingText) return error(`El texto del envío puede tener hasta ${LIMITES_TEXTOS_VENTA.shippingText} caracteres.`);
  if (extraTerms.length > LIMITES_TEXTOS_VENTA.extraTerms) return error(`Las condiciones pueden tener hasta ${LIMITES_TEXTOS_VENTA.extraTerms} caracteres.`);
  let shippingCostArs: number | null = null;
  if (shippingEnabled) {
    const costo = entero(costoCrudo, 7);
    if (Number.isNaN(costo) || costo > SHIPPING_MAX_ARS) return error("Poné el costo del envío en pesos enteros (0 si es gratis).");
    shippingCostArs = costo;
  }
  const entrega = {
    pickupText: pickupText || null,
    shippingEnabled,
    shippingCostArs,
    shippingText: shippingEnabled ? shippingText || null : null,
    extraTerms: extraTerms || null,
  };

  let cambioReparto = false;
  try {
    await prisma.$transaction(async (tx) => {
      const s = await bloquear(tx, a.id, usuario);
      // Con la muestra bloqueada: un formato impreso aprobado en el medio también cuenta.
      if (!pickupText) {
        const impresas = await tx.culturalWorkOffer.count({ where: { activityId: a.id, format: "PRINT", status: { in: ["APPROVED", "PAUSED"] } } });
        if (impresas > 0) throw new Corte("Escribí cómo se retiran las impresas en la sede.");
      }
      if (!s) {
        await tx.culturalSaleSetup.create({
          data: {
            activityId: a.id, status: "DRAFT", organizerUserId: r.ownerUserId, platformFeeBps: PLATFORM_FEE_BPS,
            organizerBps, photographerBps, splitVersion: 1, createdByUserId: usuario.id, ...entrega,
          },
        });
        return;
      }
      cambioReparto = s.organizerBps !== organizerBps || s.photographerBps !== photographerBps;
      if (cambioReparto && (await pendientesDePago(tx, a.id)) > 0) throw new Corte(PENDIENTES);
      await tx.culturalSaleSetup.update({
        where: { id: s.id },
        data: { ...entrega, ...(cambioReparto ? { organizerBps, photographerBps, splitVersion: { increment: 1 } } : {}) },
      });
    }, { timeout: 15_000, maxWait: 5_000 });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  refrescar(a);
  return cambioReparto
    ? { ok: true, aviso: "Guardamos el reparto nuevo. Los autores lo tienen que aceptar de nuevo antes de que se venda una obra suya." }
    : { ok: true };
}

/** Abrir o pausar la venta de la muestra. Abrir en prueba o en vivo exige la cuenta de cobro activa. */
export async function cambiarEstadoDeVenta(activityId: string, estado: "OPEN" | "PAUSED"): Promise<ResultadoVenta> {
  if (estado !== "OPEN" && estado !== "PAUSED") return error("Estado inválido.");
  const r = await preparar(activityId);
  if (!r.listo) return r.error;
  const { usuario, a } = r;
  const config = leerConfigDeVentas();
  try {
    await prisma.$transaction(async (tx) => {
      const s = await bloquear(tx, a.id, usuario);
      if (!s) throw new Corte("Primero guardá el reparto y la entrega.");
      if (s.status === estado) return;
      if (s.status === "CLOSED") throw new Corte("La venta de esta muestra ya terminó.");
      if (estado === "PAUSED") {
        if (s.status !== "OPEN") throw new Corte("La venta no está abierta.");
        await tx.culturalSaleSetup.update({ where: { id: s.id }, data: { status: "PAUSED" } });
        return;
      }
      if (splitProblems({ organizerBps: s.organizerBps, photographerBps: s.photographerBps }).length) throw new Corte("Revisá el reparto antes de abrir la venta.");
      const actual = await tx.culturalActivity.findUnique({ where: { id: a.id }, select: { isCancelled: true, endsAt: true } });
      if (!actual) throw new Corte(TEXTO_NO_EXISTE);
      if (actual.isCancelled) throw new Corte("La muestra está cancelada: no se puede vender.");
      if (!saleWindowOpen({ endsAt: actual.endsAt, now: new Date() })) throw new Corte("La muestra cerró hace más de 30 días: la venta terminó.");
      if (config.modo !== "OFF") {
        const cuenta = await tx.culturalPayoutAccount.findUnique({
          where: { userId_environment: { userId: s.organizerUserId, environment: config.ambienteCuenta } },
          select: { consentStatus: true },
        });
        if (cuenta?.consentStatus !== "ACTIVE") {
          throw new Corte(s.organizerUserId === usuario.id
            ? "Primero conectá tu Mercado Pago en Cobros."
            : "Falta que quien cobra por la organización conecte su Mercado Pago en Cobros.");
        }
      }
      await tx.culturalSaleSetup.update({ where: { id: s.id }, data: { status: "OPEN", openedAt: s.openedAt ?? new Date() } });
    }, { timeout: 15_000, maxWait: 5_000 });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  refrescar(a);
  return { ok: true };
}

/** "Cambiar quién cobra": el dueño (o el super admin) pasa el cobro a sí mismo o a la coorganización (D14). */
export async function cambiarQuienCobra(activityId: string, userId: number): Promise<ResultadoVenta> {
  const r = await preparar(activityId);
  if (!r.listo) return r.error;
  const { usuario, a } = r;
  if (r.ownerUserId !== usuario.id && !usuario.esSuperAdmin) return NO_EXISTE;
  if (!Number.isInteger(userId) || userId <= 0) return error("Elegí a una persona del equipo.");
  try {
    await prisma.$transaction(async (tx) => {
      const s = await bloquear(tx, a.id, usuario);
      // La membresía se mira con la muestra bloqueada: si la sacaron del equipo recién, no cobra.
      if (userId !== r.ownerUserId) {
        const enEquipo = await tx.culturalActivityMember.count({ where: { activityId: a.id, userId, status: "ACTIVE", role: "CO_ORGANIZER" } });
        if (enEquipo === 0) throw new Corte("Sólo puede cobrar quien organiza o alguien de la coorganización.");
      }
      if (!s) throw new Corte("Primero guardá el reparto y la entrega.");
      if (s.organizerUserId === userId) return;
      if ((await pendientesDePago(tx, a.id)) > 0) throw new Corte(PENDIENTES);
      await tx.culturalSaleSetup.update({ where: { id: s.id }, data: { organizerUserId: userId } });
    }, { timeout: 15_000, maxWait: 5_000 });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  refrescar(a);
  return { ok: true };
}
