import { createHash } from "node:crypto";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crearDepsConsentimiento } from "@/lib/split-1n-consentimiento/deps";
import { actualizarEstado, type EstadoConsentimiento } from "@/lib/split-1n-consentimiento/servicio";
import { ANEXO_COBRO_DIVIDIDO_TEXTO, ANEXO_COBRO_DIVIDIDO_VERSION } from "./anexo";
import { resolveAceptacionConfig } from "./config";
import { decidirAceptacion, type DecisionAceptacion } from "./regla";

const HASH_ANEXO = createHash("sha256").update(ANEXO_COBRO_DIVIDIDO_TEXTO).digest("hex");

async function anexoAceptado(userId: number): Promise<boolean> {
  const fila = await prisma.termsAcceptance.findFirst({
    where: { userId, termsVersion: ANEXO_COBRO_DIVIDIDO_VERSION },
    select: { id: true },
  });
  return fila != null;
}

/** Estado del consentimiento en Mercado Pago, o null si no se pudo saber (no se bloquea). */
async function estadoMercadoPago(userId: number): Promise<EstadoConsentimiento | null> {
  try {
    const vista = await actualizarEstado(crearDepsConsentimiento(), { userId });
    return vista.estado;
  } catch (err: unknown) {
    console.error("[split-1n-aceptacion] estado_mp_fallido", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** ¿Qué cartel ve esta persona? Ante cualquier error, ninguno. */
export async function decisionPara(user: { id: number; role: string }): Promise<DecisionAceptacion> {
  const config = resolveAceptacionConfig();
  if (!config.enabled) return { mostrar: false };
  try {
    const [terminosAceptados, estadoMp] = await Promise.all([anexoAceptado(user.id), estadoMercadoPago(user.id)]);
    return decidirAceptacion({ config, ahora: new Date(), rol: user.role, terminosAceptados, estadoMp });
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
