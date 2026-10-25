import "server-only";
import { prisma } from "@repo/db";
import { nombreDeContacto } from "@/lib/pedidos/nombre-contacto";
import { puedeVerContratos, type CtxContratos } from "./acceso";
import { esEstadoContrato, ETIQUETA_EVENTO, type EstadoContrato, type TipoEventoContrato } from "./constantes";
import { listarEventos } from "./eventos";
import { estadoDeFirmante, type FirmanteFicha } from "./ficha-etiquetas";

export { ETIQUETA_ESTADO_FIRMANTE, estadoDeFirmante, type EstadoFirmante, type FirmanteFicha } from "./ficha-etiquetas";

/**
 * Lectura de la ficha de un contrato (sólo "Ver"). Todo acotado al workspace de la sesión: un
 * contrato de otro workspace o inexistente devuelve null. Entrega datos planos y serializables
 * (fechas en ISO): la pantalla los pasa tal cual a los componentes del navegador.
 *
 * Nunca devuelve el token, su hash, el hash del código, la IP ni el user-agent de un firmante.
 */

export type EventoFicha = {
  id: string;
  tipo: string;
  etiqueta: string;
  fecha: string;
  actor: string | null;
  firmante: string | null;
  detalle: string | null;
};

export type FichaContrato = {
  id: string;
  numero: string;
  nombre: string;
  estado: EstadoContrato;
  pedido: { id: string; numero: string };
  contacto: { id: string; nombre: string };
  plantilla: string | null;
  creadoEn: string;
  enviadoEn: string | null;
  firmadoEn: string | null;
  rechazadoEn: string | null;
  anuladoEn: string | null;
  motivoAnulacion: string | null;
  firmadoEnPapelEn: string | null;
  respaldoPapel: { id: string; nombre: string } | null;
  /** Texto editable (borrador) o el último guardado. */
  textoBorrador: string;
  version: { id: string; numero: number; texto: string; huella: string; enviadaEn: string; revocada: boolean } | null;
  versiones: number;
  firmantes: FirmanteFicha[];
  eventos: EventoFicha[];
  /** El PDF final con las firmas ya existe (lo genera la Tarea 6). */
  tienePdf: boolean;
  huellaPdf: string | null;
};

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

function textoDelDato(tipo: string, data: unknown): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  if (tipo === "ENVIADO") {
    const v = num(d.version);
    const n = num(d.firmantes);
    const partes = [v !== null ? `versión ${v}` : null, n !== null ? `${n} ${n === 1 ? "firmante" : "firmantes"}` : null, d.correccion === true ? "corrección" : null];
    return partes.filter(Boolean).join(" · ") || null;
  }
  if (tipo === "VERSION_REVOCADA") {
    const v = num(d.version);
    return v !== null ? `versión ${v}` : null;
  }
  if (tipo === "CODIGO_ENVIADO") {
    const n = num(d.nro);
    return n !== null ? `código ${n} de la hora` : null;
  }
  return null;
}

export async function cargarFichaContrato(ctx: CtxContratos, contratoId: string, ahora: Date = new Date()): Promise<FichaContrato | null> {
  if (!puedeVerContratos(ctx) || typeof contratoId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(contratoId)) return null;
  const { workspaceId } = ctx;
  const c = await prisma.fotofficeContrato.findFirst({
    where: { id: contratoId, workspaceId },
    select: {
      id: true, number: true, name: true, status: true, bodyText: true, currentVersionId: true, createdAt: true, sentAt: true,
      signedAt: true, rejectedAt: true, voidedAt: true, voidReason: true, pdfKey: true, pdfHash: true, manualSignedAt: true,
      manualAttachmentId: true, clientId: true, pedidoId: true,
      client: { select: { firstName: true, lastName: true, businessName: true } },
      pedido: { select: { number: true } },
      template: { select: { name: true } },
    },
  });
  if (!c) return null;

  const [versiones, eventos, adjunto] = await Promise.all([
    prisma.fotofficeContratoVersion.findMany({
      where: { workspaceId, contratoId },
      orderBy: [{ number: "asc" }],
      select: { id: true, number: true, bodyText: true, contentHash: true, sentAt: true, revokedAt: true },
    }),
    listarEventos(workspaceId, contratoId),
    c.manualAttachmentId
      ? prisma.fotofficeAttachment.findFirst({ where: { id: c.manualAttachmentId, workspaceId }, select: { id: true, fileName: true } })
      : Promise.resolve(null),
  ]);
  const vigente = c.currentVersionId ? versiones.find((v) => v.id === c.currentVersionId) ?? null : null;
  const versionIds = versiones.map((v) => v.id);
  const firmantes = versionIds.length
    ? await prisma.fotofficeContratoFirmante.findMany({
        where: { workspaceId, versionId: { in: versionIds } },
        orderBy: [{ orden: "asc" }],
        select: {
          id: true, versionId: true, orden: true, name: true, email: true, docNumber: true, viewedAt: true, verifiedAt: true,
          signedAt: true, rejectedAt: true, rejectReason: true, tokenExpiresAt: true,
        },
      })
    : [];
  const nombreDeFirmante = new Map(firmantes.map((f) => [f.id, f.name]));
  const actorIds = [...new Set(eventos.map((e) => e.actorUserId).filter((x): x is number => x !== null))];
  const usuarios = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const nombreDeUsuario = new Map(usuarios.map((u) => [u.id, (u.name as string | null) || (u.email as string)]));

  const abierto = c.status === "ENVIADO" || c.status === "FIRMADO_PARCIAL";
  const delaVigente = vigente ? firmantes.filter((f) => f.versionId === vigente.id) : [];
  return {
    id: c.id,
    numero: c.number,
    nombre: c.name,
    estado: esEstadoContrato(c.status) ? c.status : "BORRADOR",
    pedido: { id: c.pedidoId, numero: c.pedido.number },
    contacto: { id: c.clientId, nombre: nombreDeContacto(c.client) },
    plantilla: c.template?.name ?? null,
    creadoEn: c.createdAt.toISOString(),
    enviadoEn: iso(c.sentAt),
    firmadoEn: iso(c.signedAt),
    rechazadoEn: iso(c.rejectedAt),
    anuladoEn: iso(c.voidedAt),
    motivoAnulacion: c.voidReason,
    firmadoEnPapelEn: iso(c.manualSignedAt),
    respaldoPapel: adjunto ? { id: adjunto.id, nombre: adjunto.fileName as string } : null,
    textoBorrador: c.bodyText,
    version: vigente
      ? { id: vigente.id, numero: vigente.number, texto: vigente.bodyText, huella: vigente.contentHash, enviadaEn: vigente.sentAt.toISOString(), revocada: vigente.revokedAt !== null }
      : null,
    versiones: versiones.length,
    firmantes: delaVigente.map((f) => {
      const estado = estadoDeFirmante(f);
      const pendiente = f.signedAt === null && f.rejectedAt === null;
      return {
        id: f.id,
        orden: f.orden,
        nombre: f.name,
        email: f.email,
        documento: f.docNumber,
        estado,
        motivoRechazo: f.rejectReason,
        firmadoEn: iso(f.signedAt),
        rechazadoEn: iso(f.rejectedAt),
        vistoEn: iso(f.viewedAt),
        vencido: pendiente && f.tokenExpiresAt.getTime() <= ahora.getTime(),
        puedeEnlace: pendiente && abierto && !(vigente?.revokedAt),
      };
    }),
    eventos: eventos.map((e) => ({
      id: e.id,
      tipo: e.type,
      etiqueta: ETIQUETA_EVENTO[e.type as TipoEventoContrato] ?? e.type,
      fecha: e.createdAt.toISOString(),
      actor: e.actorUserId !== null ? (nombreDeUsuario.get(e.actorUserId) ?? null) : null,
      firmante: e.firmanteId ? (nombreDeFirmante.get(e.firmanteId) ?? null) : null,
      detalle: textoDelDato(e.type, e.data),
    })),
    tienePdf: c.pdfKey !== null,
    huellaPdf: c.pdfHash,
  };
}
