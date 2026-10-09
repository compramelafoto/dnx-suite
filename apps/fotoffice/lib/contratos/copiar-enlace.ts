import "server-only";
import { prisma } from "@repo/db";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { MENSAJES_CONTRATO as M, puedeGestionarContratos, type CtxContratos } from "./acceso";
import { hashDeToken, resolverClaveDeEnlace, tokenDeFirmante, urlDelContrato } from "./enlace";

export type ResultadoEnlace = { ok: true; url: string } | { ok: false; error: string };

const no = (error: string): ResultadoEnlace => ({ ok: false, error });

/**
 * El enlace vigente de un firmante, para copiarlo y mandarlo por otro medio (WhatsApp, por ejemplo).
 * Sólo con "Gestionar", sólo para un firmante que no firmó ni rechazó, de la versión vigente de un
 * contrato ENVIADO o FIRMADO_PARCIAL y con el enlace sin vencer. El token se rearma en el servidor
 * (no se guarda en claro) y se comprueba contra el hash guardado. No registra ni devuelve nada más.
 */
export async function enlaceDeFirmante(
  ctx: CtxContratos,
  firmanteId: unknown,
  deps: { ahora?: Date; clave?: string | null; appOrigin?: string } = {},
): Promise<ResultadoEnlace> {
  if (!puedeGestionarContratos(ctx)) return no(M.sinPermiso);
  if (typeof firmanteId !== "string" || firmanteId.length === 0 || firmanteId.length > 64) return no(M.datosInvalidos);
  const { workspaceId } = ctx;
  const ahora = deps.ahora ?? new Date();
  const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
  if (!clave) return no(M.sinClaveEnlace);
  const f = await prisma.fotofficeContratoFirmante.findFirst({
    where: { id: firmanteId, workspaceId },
    select: { id: true, versionId: true, tokenHash: true, tokenExpiresAt: true, signedAt: true, rejectedAt: true },
  });
  if (!f) return no(M.firmanteNoExiste);
  const version = await prisma.fotofficeContratoVersion.findFirst({ where: { id: f.versionId, workspaceId }, select: { contratoId: true, revokedAt: true } });
  const contrato = version ? await prisma.fotofficeContrato.findFirst({ where: { id: version.contratoId, workspaceId }, select: { status: true, currentVersionId: true } }) : null;
  if (
    !version || !contrato || f.signedAt || f.rejectedAt || version.revokedAt || contrato.currentVersionId !== f.versionId ||
    (contrato.status !== "ENVIADO" && contrato.status !== "FIRMADO_PARCIAL") || f.tokenExpiresAt.getTime() <= ahora.getTime()
  ) {
    return no(M.noSeReenvia);
  }
  const token = tokenDeFirmante(f.id, f.tokenExpiresAt, clave);
  if (hashDeToken(token) !== f.tokenHash) return no(M.noSeReenvia);
  const sitio = await sitioDelWorkspace(workspaceId);
  if (!sitio) return no(M.sinSitio);
  const appOrigin = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
  const url = urlDelContrato({ ...sitio, appOrigin, token });
  return url ? { ok: true, url } : no(M.sinSitio);
}
