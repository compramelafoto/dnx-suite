"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import { normalizeEmail, type ConsentStatus } from "@repo/muestras";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario } from "@/lib/usuario";
import { leerConfigDeVentas } from "./config";
import { estadoDeConsentimiento } from "./cuentas";
import { invitarAReparto, leerConsentimiento } from "./mp";

/**
 * "Cobros" (etapa 8, spec D13): la persona da el email de su cuenta de Mercado Pago, la plataforma
 * pide el consentimiento de reparto y guarda la respuesta por persona y ambiente. Nunca se guarda un
 * token de la persona. Cada acción vuelve a leer la sesión: sólo se toca la fila propia.
 */
export type ResultadoCobro = { ok: true; estado?: ConsentStatus; aviso?: string } | { ok: false; errores: string[] };

const error = (texto: string): ResultadoCobro => ({ ok: false, errores: [texto] });
const SIN_SESION = error("Tenés que ingresar.");
const MUCHOS = error("Hiciste muchos pedidos seguidos. Esperá unos minutos.");
const PENDIENTES = "Tenés ventas esperando el pago: probá en unos minutos.";

class Corte extends Error {}

/** Pedidos esperando el pago donde esta persona cobra (organización o fotógrafo/a), en ese ambiente. */
function pendientesDondeCobra(tx: Prisma.TransactionClient, userId: number, isTest: boolean) {
  return tx.culturalSaleOrder.count({
    where: {
      status: "PENDING_PAYMENT",
      isTest,
      OR: [
        { splitSnapshot: { path: ["organizer", "userId"], equals: userId } },
        { splitSnapshot: { path: ["photographer", "userId"], equals: userId } },
      ],
    },
  });
}

/** Guardar (o cambiar) el email de la cuenta de Mercado Pago y pedir el consentimiento. */
export async function guardarCuentaDeCobro(fd: FormData): Promise<ResultadoCobro> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const crudo = fd.get("email");
  const email = typeof crudo === "string" ? normalizeEmail(crudo) : null;
  if (!email) return error("Escribí el email de tu cuenta de Mercado Pago.");
  if (!frenarPorUsuario("invitarCobro", usuario.id).allowed) return MUCHOS;
  const ambiente = leerConfigDeVentas().ambienteCuenta;
  const isTest = ambiente === "SANDBOX";
  const clave = { userId_environment: { userId: usuario.id, environment: ambiente } };

  // Antes de pedirle nada a Mercado Pago: cambiar de cuenta con cobros en vuelo no se permite.
  const previa = await prisma.culturalPayoutAccount.findUnique({ where: clave, select: { mpEmail: true } });
  const cambiaEmail = previa != null && previa.mpEmail !== email;
  if (cambiaEmail && (await pendientesDondeCobra(prisma, usuario.id, isTest)) > 0) return error(PENDIENTES);

  const r = await invitarAReparto(email);
  if ("error" in r) return error(r.error);
  const estado = estadoDeConsentimiento(r.status);
  const datos = { mpEmail: email, receiverId: r.receiverId, consentStatus: estado, inviteUrl: r.inviteUrl, lastCheckedAt: new Date() };
  try {
    await prisma.$transaction(async (tx) => {
      // Con la fila bloqueada se vuelve a mirar: una reserva no puede tomar la cuenta vieja en el medio.
      await tx.$queryRaw`SELECT id FROM "CulturalPayoutAccount" WHERE "userId" = ${usuario.id} AND environment = ${ambiente} FOR UPDATE`;
      if (cambiaEmail && (await pendientesDondeCobra(tx, usuario.id, isTest)) > 0) throw new Corte(PENDIENTES);
      await tx.culturalPayoutAccount.upsert({
        where: clave,
        create: { userId: usuario.id, environment: ambiente, ...datos },
        update: datos,
      });
    }, { timeout: 15_000, maxWait: 5_000 });
  } catch (err) {
    if (err instanceof Corte) return error(err.message);
    throw err;
  }
  revalidatePath("/panel/cobros");
  return { ok: true };
}

/** "Ya lo acepté, verificar": pregunta a Mercado Pago y guarda lo que dice. */
export async function verificarCuentaDeCobro(): Promise<ResultadoCobro> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (!frenarPorUsuario("verificarCobro", usuario.id).allowed) return MUCHOS;
  const ambiente = leerConfigDeVentas().ambienteCuenta;
  const c = await prisma.culturalPayoutAccount.findUnique({
    where: { userId_environment: { userId: usuario.id, environment: ambiente } },
    select: { id: true, receiverId: true },
  });
  if (!c?.receiverId) return error("Primero escribí el email de tu cuenta de Mercado Pago.");
  const leido = await leerConsentimiento(c.receiverId);
  if (!leido) return error("No pudimos consultar a Mercado Pago. Probá de nuevo en unos minutos.");
  const estado = estadoDeConsentimiento(leido.status);
  await prisma.culturalPayoutAccount.updateMany({
    where: { id: c.id, userId: usuario.id },
    data: { consentStatus: estado, lastCheckedAt: new Date(), ...(leido.inviteUrl ? { inviteUrl: leido.inviteUrl } : {}) },
  });
  revalidatePath("/panel/cobros");
  return { ok: true, estado };
}
