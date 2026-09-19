import "server-only";

import { prisma } from "@/lib/admin/db";
import { FINANCE_SEED_EMAILS } from "@/lib/admin/edition-finance/constants";
import type {
  ConsignaDeEdicion,
  EstadoDeConsigna,
  FotoDeEdicion,
} from "../domain/types";

/**
 * Lee una edición de la base y arma la foto que consumen las reglas del
 * chequeo y del ensayo.
 *
 * Es el único lugar del módulo que conoce Prisma: todo lo demás trabaja sobre
 * `FotoDeEdicion`, que no sabe de la base.
 */

const ESTADOS_DE_CONSIGNA: EstadoDeConsigna[] = [
  "DRAFT",
  "READY",
  "RELEASED",
  "CLOSED",
  "CANCELLED",
];

function estadoDeConsigna(valor: string): EstadoDeConsigna {
  return ESTADOS_DE_CONSIGNA.includes(valor as EstadoDeConsigna)
    ? (valor as EstadoDeConsigna)
    : "DRAFT";
}

/**
 * ¿Hay una cuenta de cobro activa para Clickatón?
 *
 * Se resuelve igual que en el diagnóstico de integraciones: la identidad
 * financiera del owner y el estado de su cuenta de pago.
 */
async function hayCuentaDeCobroActiva(): Promise<boolean> {
  try {
    const identidad = await prisma.dnxFinancialIdentity.findFirst({
      where: { organizationRef: "clickaton:partners-production:mp-owner" },
      include: {
        paymentAccounts: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    if (identidad && identidad.paymentAccounts.length > 0) return true;

    // La cuenta puede estar a nombre de la persona que cobra, no del owner.
    const persona = await prisma.user.findFirst({
      where: { email: { equals: FINANCE_SEED_EMAILS.tammy, mode: "insensitive" } },
      select: { id: true },
    });
    if (!persona) return false;

    const identidadPersonal = await prisma.dnxFinancialIdentity.findFirst({
      where: { ownerUserId: persona.id, subjectType: "PERSON", status: "ACTIVE" },
      include: { paymentAccounts: { where: { status: "ACTIVE" }, take: 1 } },
    });
    return Boolean(identidadPersonal && identidadPersonal.paymentAccounts.length > 0);
  } catch {
    // No poder responder no es lo mismo que estar desconectado; el chequeo lo
    // trata como desconectado y el detalle del hallazgo explica qué mirar.
    return false;
  }
}

export async function cargarFotoDeEdicion(editionId: string): Promise<FotoDeEdicion | null> {
  const edicion = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: {
      id: true,
      slug: true,
      name: true,
      isPublished: true,
      registrationEnabled: true,
      timezone: true,
      startAt: true,
      endAt: true,
      registrationOpenAt: true,
      registrationCloseAt: true,
      pricePhases: {
        where: { isActive: true },
        select: { id: true, name: true, startsAt: true, endsAt: true },
        orderBy: { startsAt: "asc" },
      },
      ticketTypes: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          priceAmount: true,
          capacity: true,
          _count: { select: { registrations: true } },
        },
        orderBy: { priceAmount: "asc" },
      },
      prompts: {
        select: {
          id: true,
          status: true,
          captureStartsAt: true,
          captureEndsAt: true,
          uploadStartsAt: true,
          uploadEndsAt: true,
        },
        orderBy: { sequence: "asc" },
      },
      timelines: {
        where: { status: "ACTIVE" },
        take: 1,
        select: {
          id: true,
          events: {
            select: { id: true, eventType: true, startsAt: true, status: true },
            orderBy: { sequence: "asc" },
          },
        },
      },
      uploadConfig: {
        select: {
          id: true,
          uploadsEnabled: true,
          captureWindowStartsAt: true,
          captureWindowEndsAt: true,
          uploadWindowStartsAt: true,
          uploadWindowEndsAt: true,
        },
      },
      accreditationConfig: { select: { id: true, accreditationEnabled: true } },
      admissionConfig: { select: { id: true, admissionEnabled: true } },
    },
  });

  if (!edicion) return null;

  const config = edicion.uploadConfig;

  /**
   * Una consigna sin horario propio hereda el de la edición. Al resolverlo acá,
   * las reglas ven la ventana que de verdad va a regir el día del evento.
   */
  const consignas: ConsignaDeEdicion[] = edicion.prompts.map((p) => ({
    id: p.id,
    estado: estadoDeConsigna(p.status),
    capturaAbreEl: p.captureStartsAt ?? config?.captureWindowStartsAt ?? null,
    capturaCierraEl: p.captureEndsAt ?? config?.captureWindowEndsAt ?? null,
    subidaAbreEl: p.uploadStartsAt ?? config?.uploadWindowStartsAt ?? null,
    subidaCierraEl: p.uploadEndsAt ?? config?.uploadWindowEndsAt ?? null,
  }));

  const mercadoPagoConectado = edicion.ticketTypes.some((t) => t.priceAmount > 0)
    ? await hayCuentaDeCobroActiva()
    : true;

  return {
    id: edicion.id,
    slug: edicion.slug,
    nombre: edicion.name,
    publicada: edicion.isPublished,
    inscripcionHabilitada: edicion.registrationEnabled,
    zonaHoraria: edicion.timezone ?? "America/Argentina/Buenos_Aires",
    comienzaEl: edicion.startAt,
    terminaEl: edicion.endAt,
    inscripcionAbreEl: edicion.registrationOpenAt,
    inscripcionCierraEl: edicion.registrationCloseAt,
    fasesDePrecio: edicion.pricePhases.map((f) => ({
      id: f.id,
      nombre: f.name,
      comienzaEl: f.startsAt,
      terminaEl: f.endsAt,
    })),
    entradas: edicion.ticketTypes.map((t) => ({
      id: t.id,
      nombre: t.name,
      precio: t.priceAmount,
      cupo: t.capacity,
      agotada: t.capacity !== null && t._count.registrations >= t.capacity,
    })),
    tieneCronogramaActivo: edicion.timelines.length > 0,
    eventos: (edicion.timelines[0]?.events ?? []).map((e) => ({
      id: e.id,
      tipo: e.eventType,
      comienzaEl: e.startsAt,
      estado: e.status,
    })),
    consignas,
    hayConfiguracionDeAcreditacion: Boolean(edicion.accreditationConfig),
    acreditacionHabilitada: edicion.accreditationConfig?.accreditationEnabled ?? false,
    hayConfiguracionDeSubida: Boolean(config),
    subidaHabilitada: config?.uploadsEnabled ?? false,
    hayConfiguracionDeAdmision: Boolean(edicion.admissionConfig),
    admisionHabilitada: edicion.admissionConfig?.admissionEnabled ?? false,
    mercadoPagoConectado,
  };
}
