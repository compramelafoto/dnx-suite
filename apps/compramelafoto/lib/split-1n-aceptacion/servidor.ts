import { createHash } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crearDepsConsentimiento } from "@/lib/split-1n-consentimiento/deps";
import { actualizarEstado, type EstadoConsentimiento } from "@/lib/split-1n-consentimiento/servicio";
import { ANEXO_COBRO_DIVIDIDO_TEXTO, ANEXO_COBRO_DIVIDIDO_VERSION } from "./anexo";
import { resolveAceptacionConfig, resolveAceptacionEventoConfig, type AceptacionConfig } from "./config";
import { EVENTOS_CON_AVISO_COBRO_DIVIDIDO } from "@/lib/split-1n-consentimiento/aviso-evento";
import { CUENTAS_COMPARTIDAS } from "@/lib/split-1n-piloto/receptores-clf";
import { decidirAceptacion, type DecisionAceptacion } from "./regla";

const HASH_ANEXO = createHash("sha256").update(ANEXO_COBRO_DIVIDIDO_TEXTO).digest("hex");

async function anexoAceptado(userId: number): Promise<boolean> {
  const fila = await prisma.termsAcceptance.findFirst({
    where: { userId, termsVersion: ANEXO_COBRO_DIVIDIDO_VERSION },
    select: { id: true },
  });
  return fila != null;
}

/** Estado del consentimiento (null si no se pudo leer) y si Mercado Pago respondió. */
async function estadoMercadoPago(
  userId: number,
): Promise<{ estadoMp: EstadoConsentimiento | null; mpRespondio: boolean }> {
  try {
    const vista = await actualizarEstado(crearDepsConsentimiento(), { userId });
    return { estadoMp: vista.estado, mpRespondio: vista.consultaFallida !== true };
  } catch (err: unknown) {
    console.error("[split-1n-aceptacion] estado_mp_fallido", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { estadoMp: null, mpRespondio: false };
  }
}

/**
 * ¿Participa en un evento con aviso? Fotógrafo activo, organizador (creador) o referidor activo
 * de un fotógrafo activo: todos cobran una parte de esas ventas.
 */
export async function participaEnEventoConAviso(userId: number): Promise<boolean> {
  const eventos = [...EVENTOS_CON_AVISO_COBRO_DIVIDIDO];
  if (eventos.length === 0) return false;
  const [miembro, organiza] = await Promise.all([
    prisma.eventMember.findFirst({ where: { userId, eventId: { in: eventos }, status: "ACTIVE" }, select: { id: true } }),
    prisma.event.findFirst({ where: { creatorId: userId, id: { in: eventos } }, select: { id: true } }),
  ]);
  if (miembro || organiza) return true;
  const fotografos = await prisma.eventMember.findMany({
    where: { eventId: { in: eventos }, status: "ACTIVE" },
    select: { userId: true },
  });
  if (fotografos.length === 0) return false;
  const referido = await prisma.referralAttribution.findFirst({
    where: {
      referrerUserId: userId,
      referredUserId: { in: fotografos.map((f) => f.userId) },
      status: "ACTIVE",
      endsAt: { gt: new Date() },
    },
    select: { id: true },
  });
  return referido != null;
}

/** Configuración que le corresponde: la general (con fecha límite) o la del evento (sin fecha). */
export async function configPara(userId: number): Promise<AceptacionConfig> {
  const general = resolveAceptacionConfig();
  if (general.enabled) return general;
  const evento = resolveAceptacionEventoConfig();
  if (evento.enabled && (await participaEnEventoConAviso(userId))) return evento;
  return { enabled: false, limite: null };
}

/** ¿Qué cartel ve esta persona? Ante cualquier error, ninguno. */
export async function decisionPara(user: { id: number; role: string }): Promise<DecisionAceptacion> {
  try {
    const config = await configPara(user.id);
    if (!config.enabled) return { mostrar: false };
    // Quien cobra en la cuenta de Mercado Pago de otro usuario usa el permiso de ese usuario.
    const cuentaMp = CUENTAS_COMPARTIDAS.get(user.id) ?? user.id;
    const [terminosAceptados, mp] = await Promise.all([anexoAceptado(user.id), estadoMercadoPago(cuentaMp)]);
    return decidirAceptacion({ config, ahora: new Date(), rol: user.role, terminosAceptados, ...mp });
  } catch (err: unknown) {
    console.error("[split-1n-aceptacion] decision_fallida", {
      userId: user.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { mostrar: false };
  }
}

/**
 * Registra la aceptación del anexo con fecha, IP y navegador. El documento se guarda inactivo
 * para no cambiar la versión de los términos generales que revisa el inicio de sesión.
 * Aceptar dos veces no duplica nada.
 */
export async function registrarAceptacionAnexo(input: {
  userId: number;
  role: Role;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const documento = await prisma.termsDocument.upsert({
    where: { role_version: { role: input.role, version: ANEXO_COBRO_DIVIDIDO_VERSION } },
    create: {
      role: input.role,
      version: ANEXO_COBRO_DIVIDIDO_VERSION,
      contentMd: ANEXO_COBRO_DIVIDIDO_TEXTO,
      isActive: false,
    },
    update: {},
    select: { id: true },
  });
  await prisma.termsAcceptance.upsert({
    where: {
      userId_role_termsVersion: {
        userId: input.userId,
        role: input.role,
        termsVersion: ANEXO_COBRO_DIVIDIDO_VERSION,
      },
    },
    create: {
      userId: input.userId,
      role: input.role,
      termsDocumentId: documento.id,
      termsVersion: ANEXO_COBRO_DIVIDIDO_VERSION,
      acceptedIp: input.ip,
      acceptedUserAgent: input.userAgent,
      documentHash: HASH_ANEXO,
    },
    update: {},
  });
}
