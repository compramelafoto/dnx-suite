import "server-only";
import { prisma } from "@repo/db";
import { buildWhatsappUrl } from "@/lib/contact/whatsapp";
import { numeroDe } from "@/lib/numeracion/asignar";
import { ENTIDAD_NUMERACION, esEstadoPresupuesto, type EstadoPresupuesto } from "./constantes";
import { hashDeToken, resolverClaveDeEnlace, tokenConForma, tokenDeVersion, urlDelPresupuesto } from "./enlace";
import { estadoEfectivo } from "./estados";
import { sitioDelWorkspace } from "./sitio";
import { itemsGuardados, type TotalesGuardados } from "./versiones";
import { armarVistaPublica, esRobot, type EstadoDeLaVista, type EstadoDelEnlace, type VistaPublica } from "./vista-publica";
import { registrarVista } from "./vistas";

/**
 * El enlace público `/<slug>/presupuesto/<token>` (spec etapa 2 §3.3, §5), sin sesión: el token
 * es la llave y el workspace sale del slug de la dirección (el token tiene que ser de ESE
 * workspace).
 *
 * - Token sin forma, desconocido, de otro workspace, de una versión sin enviar o vencido (validez
 *   + 30 días): null, y la página responde el 404 genérico.
 * - Versión reemplazada (revocada al enviar una nueva): NUNCA se muestran sus ítems ni sus
 *   precios. La página redirige al enlace de la vigente (`redirigir`); si la vigente no sirve, o
 *   si quien abre es la vista para imprimir (`permitirReemplazo: false`), 404.
 * - Nunca se lee `costSnapshot` ni nada interno del presupuesto: sólo lo que arma la vista.
 */

export type EnlaceEncontrado = {
  workspaceId: string;
  presupuestoId: string;
  versionId: string;
  leadId: string;
  ownerUserId: number | null;
  estadoGuardado: EstadoPresupuesto;
  estado: EstadoDelEnlace;
  validUntil: Date | null;
  currentVersionId: string | null;
  version: {
    number: number;
    items: unknown;
    totals: unknown;
    terms: string | null;
    paymentProposal: string | null;
    acceptedAt: Date | null;
    acceptedName: string | null;
  };
};

/** Lo que se lee de una versión para el público: sin `costSnapshot`. */
const SELECT_VERSION_PUBLICA = {
  id: true,
  presupuestoId: true,
  number: true,
  items: true,
  totals: true,
  terms: true,
  paymentProposal: true,
  sentAt: true,
  revokedAt: true,
  tokenExpiresAt: true,
  acceptedAt: true,
  acceptedName: true,
} as const;

export function estadoDelEnlace(args: {
  versionId: string;
  revokedAt: Date | null;
  acceptedAt: Date | null;
  currentVersionId: string | null;
  status: EstadoPresupuesto;
  validUntil: Date | null;
  ahora: Date;
}): EstadoDelEnlace | null {
  if (args.acceptedAt) return "ACEPTADO";
  if (args.revokedAt || args.currentVersionId !== args.versionId) return "REEMPLAZADO";
  const e = estadoEfectivo(args.status, args.validUntil, args.ahora);
  if (e === "ENVIADO" || e === "VISTO") return "ACTIVO";
  if (e === "VENCIDO" || e === "RECHAZADO" || e === "ACEPTADO") return e;
  return null;
}

/** El enlace dentro del workspace, o null (404). */
export async function buscarEnlace(workspaceId: string, token: unknown, ahora: Date): Promise<EnlaceEncontrado | null> {
  if (!tokenConForma(token)) return null;
  const v = await prisma.fotofficePresupuestoVersion.findFirst({
    where: { tokenHash: hashDeToken(token), workspaceId },
    select: SELECT_VERSION_PUBLICA,
  });
  if (!v || !v.sentAt) return null;
  if (v.tokenExpiresAt && v.tokenExpiresAt.getTime() < ahora.getTime()) return null;
  const p = await prisma.fotofficePresupuesto.findFirst({
    where: { id: v.presupuestoId, workspaceId },
    select: { status: true, validUntil: true, currentVersionId: true, consultaLeadId: true, ownerUserId: true },
  });
  if (!p || !esEstadoPresupuesto(p.status)) return null;
  const estado = estadoDelEnlace({
    versionId: v.id, revokedAt: v.revokedAt, acceptedAt: v.acceptedAt, currentVersionId: p.currentVersionId,
    status: p.status, validUntil: p.validUntil, ahora,
  });
  if (!estado) return null;
  return {
    workspaceId,
    presupuestoId: v.presupuestoId,
    versionId: v.id,
    leadId: p.consultaLeadId,
    ownerUserId: p.ownerUserId,
    estadoGuardado: p.status,
    estado,
    validUntil: p.validUntil,
    currentVersionId: p.currentVersionId,
    version: {
      number: v.number, items: v.items, totals: v.totals, terms: v.terms, paymentProposal: v.paymentProposal,
      acceptedAt: v.acceptedAt, acceptedName: v.acceptedName,
    },
  };
}

export type DepsPublico = {
  ahora?: () => Date;
  clave?: string | null;
  appOrigin?: string;
};

/**
 * Abre el enlace: arma la vista y, si `registrar` (la página, no la vista de impresión) y no es
 * un robot de vista previa, registra la visita (ver `registrarVista`). null = 404.
 */
export type AperturaPublica = { vista: VistaPublica } | { redirigir: string };

export async function abrirPresupuestoPublico(
  workspaceId: string,
  token: unknown,
  visita: { registrar: boolean; ipHash: string | null; userAgent: string | null; permitirReemplazo?: boolean },
  deps: DepsPublico = {},
): Promise<AperturaPublica | null> {
  const ahora = (deps.ahora ?? (() => new Date()))();
  const enlace = await buscarEnlace(workspaceId, token, ahora);
  if (!enlace) return null;
  const sitio = await sitioDelWorkspace(workspaceId);
  if (!sitio) return null;

  if (enlace.estado === "REEMPLAZADO") {
    // Sin vista: el contenido de una versión reemplazada no sale nunca.
    if (visita.permitirReemplazo === false) return null;
    const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
    const vigente = enlace.currentVersionId
      ? await prisma.fotofficePresupuestoVersion.findFirst({
          where: { id: enlace.currentVersionId, workspaceId, presupuestoId: enlace.presupuestoId },
          select: { id: true, sentAt: true, revokedAt: true, tokenExpiresAt: true },
        })
      : null;
    const sirve = vigente?.sentAt && !vigente.revokedAt && !(vigente.tokenExpiresAt && vigente.tokenExpiresAt.getTime() < ahora.getTime());
    const origen = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
    const enlaceVigente = sirve && clave ? urlDelPresupuesto({ ...sitio, appOrigin: origen, token: tokenDeVersion(vigente.id, clave) }) : null;
    return enlaceVigente ? { redirigir: enlaceVigente } : null;
  }

  const numero = (await numeroDe(workspaceId, ENTIDAD_NUMERACION, [enlace.presupuestoId])).get(enlace.presupuestoId) ?? null;
  const vista = armarVistaPublica({
    estado: enlace.estado as EstadoDeLaVista,
    organizacion: {
      nombre: sitio.nombre,
      logoUrl: sitio.logoUrl && /^https:\/\//i.test(sitio.logoUrl) ? sitio.logoUrl : null,
      whatsappUrl: buildWhatsappUrl(sitio.whatsapp, `Hola, tengo dudas sobre el presupuesto${numero ? ` N° ${numero}` : ""}.`),
      email: sitio.email,
    },
    numero,
    version: {
      number: enlace.version.number,
      items: itemsGuardados(enlace.version.items),
      totals: (enlace.version.totals as TotalesGuardados | null) ?? null,
      terms: enlace.version.terms,
      paymentProposal: enlace.version.paymentProposal,
      acceptedAt: enlace.version.acceptedAt,
      acceptedName: enlace.version.acceptedName,
    },
    validUntil: enlace.validUntil,
  });

  if (visita.registrar && !esRobot(visita.userAgent)) {
    await registrarVista(enlace, { ipHash: visita.ipHash, userAgent: visita.userAgent }, ahora);
  }
  return { vista };
}
