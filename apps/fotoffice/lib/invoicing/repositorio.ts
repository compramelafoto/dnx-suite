import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { CBTE_NOTA_CREDITO_C, type ArcaEnvironment, type CbteTipo, type Concepto, WSFE_SERVICE } from "./constants";
import type { ComprobanteEnBase, PuertoBase, Serie } from "./emision";
import type { DepositoTicket } from "./ticket";
import { decimalArsToMinor } from "@/lib/membership/money";

/**
 * Los puertos de la emisión y del ticket, sobre Prisma. Todas las consultas llevan `workspaceId`
 * y `environment`: un comprobante de pruebas nunca se mezcla con uno de producción.
 */

export type Actor = { userId: number | null; label: string };

export type EmisorSnapshot = {
  cuit: string;
  razonSocial: string;
  ivaCondition: string;
  domicilioFiscal: string;
  ingresosBrutos: string | null;
  inicioActividades: string | null;
};

const VIVOS_CON_NUMERO = ["AUTORIZADA", "ANULADA"];

function json(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue;
}

function esUnico(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

type FilaInvoice = Prisma.FotofficeInvoiceGetPayload<{ include: { relatedInvoice: true } }>;

function aComprobante(f: FilaInvoice): ComprobanteEnBase {
  const emisor = f.emisorSnapshot as unknown as EmisorSnapshot;
  const rel = f.relatedInvoice;
  return {
    id: f.id,
    status: f.status,
    serie: { ptoVta: f.pointOfSale, cbteTipo: f.cbteTipo as CbteTipo },
    numero: f.cbteNumero,
    enviadoEn: f.sentAt,
    datos: {
      cuitEmisor: emisor.cuit,
      ptoVta: f.pointOfSale,
      cbteTipo: f.cbteTipo as CbteTipo,
      concepto: f.concepto as Concepto,
      docTipo: f.receptorDocTipo,
      docNro: f.receptorDocNro,
      condicionIvaReceptorId: f.receptorCondicionIvaId,
      fecha: f.cbteFch,
      totalCentavos: decimalArsToMinor(f.impTotal),
      servicio: f.servDesde && f.servHasta && f.vtoPago ? { desde: f.servDesde, hasta: f.servHasta, vtoPago: f.vtoPago } : null,
      asociado:
        f.cbteTipo === CBTE_NOTA_CREDITO_C && rel && rel.cbteNumero !== null
          ? { tipo: rel.cbteTipo as CbteTipo, ptoVta: rel.pointOfSale, numero: rel.cbteNumero, cuit: (rel.emisorSnapshot as unknown as EmisorSnapshot).cuit, fecha: rel.cbteFch }
          : null,
    },
  };
}

export function puertoBasePrisma(workspaceId: string, environment: ArcaEnvironment, actor: Actor): PuertoBase {
  const evento = (invoiceId: string, type: string, note: string, data?: unknown) =>
    prisma.fotofficeInvoiceEvent.create({
      data: { invoiceId, type, note: note.slice(0, 4000), actorUserId: actor.userId, actorLabel: actor.label, data: data === undefined ? undefined : json(data) },
    });
  const serieWhere = (s: Serie) => ({ workspaceId, environment, pointOfSale: s.ptoVta, cbteTipo: s.cbteTipo });

  return {
    async leer(id) {
      const f = await prisma.fotofficeInvoice.findFirst({ where: { id, workspaceId, environment }, include: { relatedInvoice: true } });
      return f ? aComprobante(f) : null;
    },
    async pendientesDeLaSerie(s) {
      const filas = await prisma.fotofficeInvoice.findMany({ where: { ...serieWhere(s), status: "PENDIENTE" }, include: { relatedInvoice: true }, orderBy: { cbteNumero: "asc" } });
      return filas.map(aComprobante);
    },
    async mayorNumeroAutorizado(s) {
      const r = await prisma.fotofficeInvoice.aggregate({ where: { ...serieWhere(s), status: { in: VIVOS_CON_NUMERO } }, _max: { cbteNumero: true } });
      return r._max.cbteNumero ?? 0;
    },
    async reservarNumero(id, numero, pedidoJson, ahora) {
      try {
        const r = await prisma.fotofficeInvoice.updateMany({
          where: { id, workspaceId, environment, status: "BORRADOR" },
          data: { status: "PENDIENTE", cbteNumero: numero, arcaRequestJson: json(pedidoJson), sentAt: ahora },
        });
        if (r.count !== 1) return false;
      } catch (e) {
        if (esUnico(e)) return false;
        throw e;
      }
      await evento(id, "ENVIADA", `Se pidió el CAE del número ${numero}.`);
      return true;
    },
    async marcarAutorizada(id, r) {
      await prisma.$transaction(async (tx) => {
        const f = await tx.fotofficeInvoice.update({
          where: { id },
          data: { status: "AUTORIZADA", cae: r.cae, caeVto: r.caeVto, arcaResponseJson: json(r.respuestaJson), authorizedAt: new Date() },
        });
        await tx.fotofficeInvoiceEvent.create({ data: { invoiceId: id, type: "AUTORIZADA", note: r.nota, actorUserId: actor.userId, actorLabel: actor.label } });
        // Una nota de crédito autorizada anula la factura que corrige (que no se toca en nada más).
        if (f.cbteTipo === CBTE_NOTA_CREDITO_C && f.relatedInvoiceId) {
          const a = await tx.fotofficeInvoice.updateMany({ where: { id: f.relatedInvoiceId, workspaceId, status: "AUTORIZADA" }, data: { status: "ANULADA" } });
          if (a.count === 1) {
            await tx.fotofficeInvoiceEvent.create({
              data: { invoiceId: f.relatedInvoiceId, type: "ANULADA", note: `Anulada con la nota de crédito número ${f.cbteNumero}.`, actorUserId: actor.userId, actorLabel: actor.label },
            });
          }
        }
      });
    },
    async marcarRechazada(id, r) {
      await prisma.fotofficeInvoice.update({ where: { id }, data: { status: "RECHAZADA", cbteNumero: null, sentAt: null, arcaResponseJson: json(r.respuestaJson) } });
      await evento(id, "RECHAZADA", r.nota || "ARCA rechazó el comprobante.");
    },
    async volverABorrador(id, nota) {
      await prisma.fotofficeInvoice.update({ where: { id }, data: { status: "BORRADOR", cbteNumero: null, sentAt: null } });
      await evento(id, "CONCILIADA", nota);
    },
    async anotar(id, tipo, nota, data) {
      if (data !== undefined) await prisma.fotofficeInvoice.update({ where: { id }, data: { arcaResponseJson: json(data) } });
      await evento(id, tipo, nota);
    },
  };
}

export function depositoTicketPrisma(workspaceId: string, environment: ArcaEnvironment): DepositoTicket {
  const where = { workspaceId_environment_service: { workspaceId, environment, service: WSFE_SERVICE } };
  return {
    async leer() {
      const t = await prisma.fotofficeArcaTicket.findUnique({ where });
      return t ? { token: t.token, sign: t.sign, generationTime: t.generationTime, expirationTime: t.expirationTime } : null;
    },
    async guardar(t) {
      await prisma.fotofficeArcaTicket.upsert({
        where,
        create: { workspaceId, environment, service: WSFE_SERVICE, ...t },
        update: { ...t },
      });
    },
  };
}
