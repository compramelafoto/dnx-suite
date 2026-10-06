import "server-only";
import { prisma } from "@repo/db";
import { clientDisplayName } from "@/lib/clients/display";
import { soloDigitos } from "@/lib/clients/match";
import { responsablesDe } from "@/lib/circuitos/tablero";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import type { DepsAjustes } from "./ajustes";
import { esGrupoConsulta, type GrupoConsulta } from "./constantes";
import { fechasSuperpuestas, type ConsultaSuperpuesta } from "./fechas";

/**
 * Lecturas de Consultas para las pantallas de la etapa 1: el buscador de contactos, las opciones
 * de los formularios (categorías, orígenes, roles y responsables) y los datos de la ficha.
 * Todo acotado al `workspaceId` que pasa quien llama (siempre el de la sesión, después de su
 * guarda). Las fechas viajan como texto: van a componentes de cliente.
 */

/** Largo mínimo del texto del buscador y resultados como mucho (regla del buscador de contactos). */
export const MIN_BUSQUEDA_CONTACTO = 2;
export const MAX_RESULTADOS_CONTACTO = 20;

export type ContactoEncontrado = { id: string; nombre: string; email: string | null; telefono: string | null };

const SELECT_CONTACTO = {
  id: true, kind: true, firstName: true, lastName: true, businessName: true, email: true, phone: true,
} as const;

type FilaContacto = {
  id: string; kind: string; firstName: string | null; lastName: string | null; businessName: string | null;
  email: string | null; phone: string | null;
};

function aContacto(c: FilaContacto): ContactoEncontrado {
  return { id: c.id, nombre: clientDisplayName(c), email: c.email, telefono: c.phone };
}

/**
 * Contactos del workspace por nombre, apellido, razón social, correo o teléfono. Cada palabra
 * tiene que aparecer en alguno de esos datos ("ana perez" encuentra a "Pérez, Ana" si se escribió
 * con la tilde igual). Menos de 2 caracteres no busca. Como mucho 20.
 */
export async function buscarContactos(workspaceId: string, texto: unknown): Promise<ContactoEncontrado[]> {
  if (typeof texto !== "string") return [];
  const q = texto.trim().replace(/\s+/g, " ").slice(0, 100);
  if (q.length < MIN_BUSQUEDA_CONTACTO) return [];
  const palabras = q.split(" ").slice(0, 4);
  const digitos = soloDigitos(q);
  const porPalabra = palabras.map((p) => ({
    OR: [
      { firstName: { contains: p, mode: "insensitive" as const } },
      { lastName: { contains: p, mode: "insensitive" as const } },
      { businessName: { contains: p, mode: "insensitive" as const } },
      { email: { contains: p, mode: "insensitive" as const } },
    ],
  }));
  const filas = await prisma.client.findMany({
    where: {
      workspaceId,
      OR: [
        { AND: porPalabra },
        // El teléfono se guarda con sólo dígitos: "341 555-0000" lo encuentra igual.
        ...(digitos.length >= 3 ? [{ phone: { contains: digitos } }] : []),
      ],
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: MAX_RESULTADOS_CONTACTO,
    select: SELECT_CONTACTO,
  });
  return filas.map(aContacto);
}

/** Un contacto del workspace (null si no existe o es de otro). */
export async function contactoDelWorkspace(workspaceId: string, clientId: unknown): Promise<ContactoEncontrado | null> {
  if (typeof clientId !== "string" || !clientId || clientId.length > 100) return null;
  const c = await prisma.client.findFirst({ where: { id: clientId, workspaceId }, select: SELECT_CONTACTO });
  return c ? aContacto(c) : null;
}

/**
 * Quiénes pueden ser responsables: del equipo y con "Gestionar" en Consultas (la misma regla que
 * `puedeSerResponsable`). Ordenados por nombre.
 */
export async function responsablesDeConsultas(
  workspaceId: string,
  deps: DepsAjustes = {},
): Promise<{ id: number; nombre: string }[]> {
  const equipo = (await responsablesDe(workspaceId)).slice(0, 200);
  const tiene = deps.tieneGestionar ?? ((u: number, w: string) => hasModuleLevel(u, w, SERVICE_LEADS_MODULE_KEY, "MANAGE"));
  const marcas = await Promise.all(equipo.map((r) => tiene(r.id, workspaceId)));
  return equipo.filter((_r, i) => marcas[i]);
}

export type OpcionCategoria = { id: string; nombre: string; grupo: GrupoConsulta };
export type Opcion = { id: string; nombre: string };

export type OpcionesConsulta = {
  /** Sólo las activas: una archivada no se ofrece en altas nuevas (spec §5). */
  categorias: OpcionCategoria[];
  origenes: Opcion[];
  roles: Opcion[];
};

/** Categorías, orígenes y roles activos, en su orden. */
export async function opcionesDeConsulta(workspaceId: string): Promise<OpcionesConsulta> {
  const orden = [{ order: "asc" as const }, { createdAt: "asc" as const }];
  const [categorias, origenes, roles] = await Promise.all([
    prisma.fotofficeConsultaCategoria.findMany({
      where: { workspaceId, archivedAt: null }, orderBy: orden, take: 1000, select: { id: true, name: true, group: true },
    }),
    prisma.fotofficeOrigen.findMany({ where: { workspaceId, archivedAt: null }, orderBy: orden, take: 1000, select: { id: true, name: true } }),
    prisma.fotofficeRolParticipante.findMany({ where: { workspaceId, archivedAt: null }, orderBy: orden, take: 1000, select: { id: true, name: true } }),
  ]);
  return {
    categorias: categorias.map((c) => ({ id: c.id, nombre: c.name, grupo: esGrupoConsulta(c.group) ? c.group : "EVENTO" })),
    origenes: origenes.map((o) => ({ id: o.id, nombre: o.name })),
    roles: roles.map((r) => ({ id: r.id, nombre: r.name })),
  };
}

export type ParticipanteFicha = { id: string; contacto: Opcion; rol: Opcion; nota: string | null };

export type DatosConsultaFicha = {
  consultaId: string;
  contacto: ContactoEncontrado;
  categoria: { id: string; nombre: string; grupo: GrupoConsulta; archivada: boolean };
  evento: {
    startsAt: string | null;
    horaConocida: boolean;
    guests: number | null;
    partnerOneName: string | null;
    partnerTwoName: string | null;
    ceremonyVenue: string | null;
    receptionVenue: string | null;
    venue: string | null;
    city: string | null;
  };
  origen: (Opcion & { archivado: boolean }) | null;
  referente: Opcion | null;
  valorEstimado: number | null;
  /** "aaaa-mm-dd". */
  cierrePrevisto: string | null;
  participantes: ParticipanteFicha[];
  /** Otros contactos del workspace con el mismo correo o teléfono (no hay pantalla de fusión: R5). */
  posiblesDuplicados: Opcion[];
  /** Otras consultas abiertas con el evento el mismo día. */
  superpuestas: ConsultaSuperpuesta[];
};

/** Otros contactos con el mismo correo (sin mayúsculas) o el mismo teléfono (sólo dígitos). */
export async function posiblesDuplicadosDe(
  workspaceId: string,
  contacto: { id: string; email: string | null; telefono: string | null },
): Promise<Opcion[]> {
  const mail = contacto.email?.trim().toLowerCase() || null;
  const tel = contacto.telefono ? soloDigitos(contacto.telefono) || null : null;
  if (!mail && !tel) return [];
  const filas = await prisma.client.findMany({
    where: {
      workspaceId,
      id: { not: contacto.id },
      OR: [
        ...(mail ? [{ email: { equals: mail, mode: "insensitive" as const } }] : []),
        ...(tel ? [{ phone: tel }] : []),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5,
    select: SELECT_CONTACTO,
  });
  return filas.map((c) => ({ id: c.id, nombre: clientDisplayName(c) }));
}

/**
 * Los datos de la etapa 1 de una consulta (`FotofficeConsulta`) para su ficha. null si la
 * consulta todavía no se enganchó (las anteriores a la etapa 1 se enganchan en lotes) o si no es
 * del workspace.
 */
export async function cargarDatosConsulta(workspaceId: string, leadId: string): Promise<DatosConsultaFicha | null> {
  const c = await prisma.fotofficeConsulta.findFirst({
    where: { leadId, workspaceId },
    select: {
      id: true, clientId: true, categoryId: true, originId: true, referrerClientId: true, estimatedValue: true,
      expectedCloseDate: true, eventStartsAt: true, eventTimeKnown: true, venue: true, ceremonyVenue: true,
      receptionVenue: true, city: true, guests: true, partnerOneName: true, partnerTwoName: true,
    },
  });
  if (!c) return null;

  const [lead, categoria, origen, participantes] = await Promise.all([
    prisma.serviceSalesLead.findFirst({ where: { id: leadId, workspaceId }, select: { eventDate: true } }),
    prisma.fotofficeConsultaCategoria.findFirst({
      where: { id: c.categoryId, workspaceId }, select: { id: true, name: true, group: true, archivedAt: true },
    }),
    c.originId
      ? prisma.fotofficeOrigen.findFirst({ where: { id: c.originId, workspaceId }, select: { id: true, name: true, archivedAt: true } })
      : Promise.resolve(null),
    prisma.fotofficeConsultaParticipante.findMany({
      where: { consultaId: c.id, workspaceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 200,
      select: { id: true, clientId: true, roleId: true, note: true },
    }),
  ]);
  if (!categoria) return null;

  const idsContactos = [...new Set([c.clientId, ...(c.referrerClientId ? [c.referrerClientId] : []), ...participantes.map((p) => p.clientId)])];
  const [contactos, roles] = await Promise.all([
    prisma.client.findMany({ where: { workspaceId, id: { in: idsContactos } }, select: SELECT_CONTACTO }),
    participantes.length > 0
      ? prisma.fotofficeRolParticipante.findMany({
          where: { workspaceId, id: { in: [...new Set(participantes.map((p) => p.roleId))] } },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);
  const contactoDe = new Map(contactos.map((x) => [x.id, aContacto(x)]));
  const rolDe = new Map(roles.map((r) => [r.id, r.name]));
  const contacto = contactoDe.get(c.clientId);
  if (!contacto) return null;
  const referente = c.referrerClientId ? contactoDe.get(c.referrerClientId) : undefined;

  const [posiblesDuplicados, superpuestas] = await Promise.all([
    posiblesDuplicadosDe(workspaceId, contacto),
    lead?.eventDate ? fechasSuperpuestas(workspaceId, lead.eventDate, leadId) : Promise.resolve([]),
  ]);

  return {
    consultaId: c.id,
    contacto,
    categoria: {
      id: categoria.id,
      nombre: categoria.name,
      grupo: esGrupoConsulta(categoria.group) ? categoria.group : "EVENTO",
      archivada: categoria.archivedAt !== null,
    },
    evento: {
      startsAt: c.eventStartsAt ? c.eventStartsAt.toISOString() : null,
      horaConocida: c.eventTimeKnown,
      guests: c.guests,
      partnerOneName: c.partnerOneName,
      partnerTwoName: c.partnerTwoName,
      ceremonyVenue: c.ceremonyVenue,
      receptionVenue: c.receptionVenue,
      venue: c.venue,
      city: c.city,
    },
    origen: origen ? { id: origen.id, nombre: origen.name, archivado: origen.archivedAt !== null } : null,
    referente: referente ? { id: referente.id, nombre: referente.nombre } : null,
    valorEstimado: c.estimatedValue === null || c.estimatedValue === undefined ? null : Number(String(c.estimatedValue)),
    cierrePrevisto: c.expectedCloseDate ? c.expectedCloseDate.toISOString().slice(0, 10) : null,
    participantes: participantes.map((p) => ({
      id: p.id,
      contacto: { id: p.clientId, nombre: contactoDe.get(p.clientId)?.nombre ?? "Sin nombre" },
      rol: { id: p.roleId, nombre: rolDe.get(p.roleId) ?? "—" },
      nota: p.note,
    })),
    posiblesDuplicados,
    superpuestas,
  };
}
