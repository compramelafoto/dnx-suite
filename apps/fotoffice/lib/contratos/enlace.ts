import "server-only";
import { createHmac } from "node:crypto";
import { prisma } from "@repo/db";
import { hashDeToken, resolverClaveDeEnlace, tokenConForma } from "@/lib/presupuestos/enlace";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";

/**
 * El enlace personal de cada firmante de un contrato (etapa 5). Mismo criterio que el del presupuesto
 * (`lib/presupuestos/enlace.ts`): el token es un HMAC-SHA256 en base64url (43 caracteres) que no se puede
 * adivinar sin la clave y el servidor puede rearmar sin guardarlo en claro; en la base va sólo su hash
 * SHA-256 (`FotofficeContratoFirmante.tokenHash`, único). Dos diferencias:
 *
 * - Hay un token por FIRMANTE (cada uno firma por su cuenta), no uno por versión.
 * - Se puede ROTAR ("Reenviar enlace"): el token se calcula con el id del firmante y su vencimiento
 *   (`tokenExpiresAt`); al reenviar cambia el vencimiento y, con él, el token. El anterior deja de servir
 *   porque su hash ya no está en la base. Como las versiones nuevas crean firmantes nuevos, un enlace de
 *   una versión reemplazada tampoco sirve: `resolverTokenFirmante` lo informa como `REEMPLAZADO`.
 */
export { hashDeToken, resolverClaveDeEnlace, tokenConForma };

const PREFIJO = "fotoffice-contrato:v1:";

/** El token de un firmante con ese vencimiento. */
export function tokenDeFirmante(firmanteId: string, vence: Date, clave: string): string {
  return createHmac("sha256", clave).update(`${PREFIJO}${firmanteId}:${vence.getTime()}`).digest("base64url");
}

/** Ruta del enlace dentro del sitio de la organización. */
export function rutaDelContrato(token: string): string {
  return `/contrato/${encodeURIComponent(token)}`;
}

/** Dirección completa: dominio propio conectado o `/w/<slug>` bajo el origen de FOTOFFICE. null si no hay cómo armarla. */
export function urlDelContrato(input: { customDomain: string | null; appOrigin: string; slug: string | null; token: string }): string | null {
  const ruta = rutaDelContrato(input.token);
  if (input.customDomain) return `https://${input.customDomain}${ruta}`;
  if (!input.appOrigin || !input.slug) return null;
  return `${input.appOrigin}/w/${encodeURIComponent(input.slug)}${ruta}`;
}

// --- Resolver el token (lo usa la página pública de la tarea 4) ----------------------------------

export type MotivoTokenContrato = "NO_ENCONTRADO" | "VENCIDO" | "REEMPLAZADO" | "ANULADO" | "FIRMADO_EN_PAPEL";

export type FirmanteDeToken = {
  id: string;
  orden: number;
  clientId: string | null;
  name: string;
  docNumber: string | null;
  email: string;
  tokenExpiresAt: Date;
  viewedAt: Date | null;
  verifiedAt: Date | null;
  signedAt: Date | null;
  rejectedAt: Date | null;
  typedName: string | null;
};

export type ContratoDeToken = {
  id: string;
  number: string;
  name: string;
  status: string;
  signedAt: Date | null;
  rejectedAt: Date | null;
};

export type VersionDeToken = { id: string; number: number; bodyText: string; contentHash: string; sentAt: Date };

export type ResultadoTokenContrato =
  | { ok: true; workspaceId: string; firmante: FirmanteDeToken; contrato: ContratoDeToken; version: VersionDeToken }
  | { ok: false; motivo: MotivoTokenContrato };

const NO = (motivo: MotivoTokenContrato): ResultadoTokenContrato => ({ ok: false, motivo });

/**
 * Qué firmante, contrato y versión corresponden a un token dentro de un workspace (el del dominio propio
 * o el del slug). Sólo sirve el token de un firmante de la versión VIGENTE de un contrato que no esté
 * anulado ni firmado en papel, y que no haya vencido (salvo que ese firmante ya haya firmado: puede seguir
 * viendo lo suyo). Un contrato ya firmado, parcialmente firmado o rechazado SÍ se resuelve: la página
 * decide qué mostrar según `contrato.status` y `firmante`.
 */
export async function resolverTokenFirmantePorWorkspace(
  workspaceId: string,
  token: unknown,
  ahora: Date = new Date(),
): Promise<ResultadoTokenContrato> {
  if (!tokenConForma(token)) return NO("NO_ENCONTRADO");
  const f = await prisma.fotofficeContratoFirmante.findFirst({
    where: { workspaceId, tokenHash: hashDeToken(token) },
    select: {
      id: true, versionId: true, orden: true, clientId: true, name: true, docNumber: true, email: true, tokenExpiresAt: true,
      viewedAt: true, verifiedAt: true, signedAt: true, rejectedAt: true, typedName: true,
    },
  });
  if (!f) return NO("NO_ENCONTRADO");
  const v = await prisma.fotofficeContratoVersion.findFirst({
    where: { id: f.versionId, workspaceId },
    select: { id: true, contratoId: true, number: true, bodyText: true, contentHash: true, sentAt: true, revokedAt: true },
  });
  if (!v) return NO("NO_ENCONTRADO");
  const c = await prisma.fotofficeContrato.findFirst({
    where: { id: v.contratoId, workspaceId },
    select: { id: true, number: true, name: true, status: true, currentVersionId: true, signedAt: true, rejectedAt: true, manualSignedAt: true },
  });
  if (!c) return NO("NO_ENCONTRADO");
  if (c.status === "ANULADO") return NO("ANULADO");
  if (c.manualSignedAt) return NO("FIRMADO_EN_PAPEL");
  if (v.revokedAt || c.currentVersionId !== v.id) return NO("REEMPLAZADO");
  if (!f.signedAt && f.tokenExpiresAt.getTime() <= ahora.getTime()) return NO("VENCIDO");
  return {
    ok: true,
    workspaceId,
    firmante: {
      id: f.id, orden: f.orden, clientId: f.clientId, name: f.name, docNumber: f.docNumber, email: f.email,
      tokenExpiresAt: f.tokenExpiresAt, viewedAt: f.viewedAt, verifiedAt: f.verifiedAt, signedAt: f.signedAt,
      rejectedAt: f.rejectedAt, typedName: f.typedName,
    },
    contrato: { id: c.id, number: c.number, name: c.name, status: c.status, signedAt: c.signedAt, rejectedAt: c.rejectedAt },
    version: { id: v.id, number: v.number, bodyText: v.bodyText, contentHash: v.contentHash, sentAt: v.sentAt },
  };
}

/** Lo mismo desde la dirección `/w/<slug>/contrato/<token>`: el slug se traduce al workspace primero. */
export async function resolverTokenFirmante(slug: unknown, token: unknown, ahora: Date = new Date()): Promise<ResultadoTokenContrato> {
  if (!tokenConForma(token)) return NO("NO_ENCONTRADO");
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return NO("NO_ENCONTRADO");
  return resolverTokenFirmantePorWorkspace(workspaceId, token, ahora);
}
