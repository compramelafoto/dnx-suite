import "server-only";
import { prisma } from "@repo/db";
import { diaDeCalendario } from "@/lib/consultas/fechas";
import { numeroDe } from "@/lib/numeracion/asignar";
import type { CtxPresupuestos } from "@/lib/presupuestos/acceso";
import { ENTIDAD_NUMERACION } from "@/lib/presupuestos/constantes";
import { TIPO_CONSULTA } from "@/lib/service-leads/numero";
import { redactarMensajeDelCliente } from "./redactar";

/**
 * Consultas para DNX Bot (spec §6.2 y §9). Al modelo va lo mínimo para reconocer la consulta y
 * nada para contactar: el NOMBRE DE PILA (nunca apellido, correo ni teléfono), número, categoría,
 * fecha del evento y estado. Todo dentro del workspace del contexto (la sesión).
 */

export type PresupuestoDeConsulta = { id: string; numero: string | null; estado: string; tieneBorrador: boolean };

export type ConsultaBot = {
  leadId: string;
  numero: string | null;
  nombreDePila: string | null;
  categoria: string | null;
  tipoEvento: string;
  /** dd/mm/aaaa, o null. */
  fechaEvento: string | null;
  estado: string;
  /** Sin ficha con contacto no se puede presupuestar (`consultaSinContacto`). */
  tieneFicha: boolean;
  presupuestos: PresupuestoDeConsulta[];
};

export type FiltrosConsultasBot = {
  texto?: string;
  /** aaaa-mm-dd, fecha del evento. */
  desde?: string;
  hasta?: string;
  soloSinPresupuesto?: boolean;
};

const MAX_RESULTADOS = 10;
/** Se buscan entre las más recientes: un fotógrafo con más consultas abiertas las encuentra por texto o fecha. */
const MAX_REVISADAS = 300;

const primera = (s: string | null | undefined) => s?.trim().split(/\s+/)[0] || null;
const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function fecha(d: Date | null): { dia: string | null; texto: string | null } {
  if (!d) return { dia: null, texto: null };
  const dia = diaDeCalendario(d);
  return { dia, texto: `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}` };
}

async function presupuestosDe(workspaceId: string, leadIds: string[]): Promise<Map<string, PresupuestoDeConsulta[]>> {
  const out = new Map<string, PresupuestoDeConsulta[]>();
  if (leadIds.length === 0) return out;
  const filas = await prisma.fotofficePresupuesto.findMany({
    where: { workspaceId, consultaLeadId: { in: leadIds } },
    select: { id: true, consultaLeadId: true, status: true },
    orderBy: [{ createdAt: "asc" }],
  });
  if (filas.length === 0) return out;
  const ids = filas.map((f) => f.id);
  const [borradores, numeros] = await Promise.all([
    prisma.fotofficePresupuestoVersion.findMany({ where: { workspaceId, presupuestoId: { in: ids }, sentAt: null }, select: { presupuestoId: true } }),
    numeroDe(workspaceId, ENTIDAD_NUMERACION, ids),
  ]);
  const conBorrador = new Set(borradores.map((b) => b.presupuestoId));
  for (const f of filas) {
    const lista = out.get(f.consultaLeadId) ?? [];
    lista.push({ id: f.id, numero: numeros.get(f.id) ?? null, estado: f.status, tieneBorrador: f.status !== "ACEPTADO" && conBorrador.has(f.id) });
    out.set(f.consultaLeadId, lista);
  }
  return out;
}

async function armar(workspaceId: string, leads: { id: string; name: string; eventType: string; eventDate: Date | null; status: string }[]) {
  const ids = leads.map((l) => l.id);
  const fichas = ids.length
    ? await prisma.fotofficeConsulta.findMany({ where: { workspaceId, leadId: { in: ids } }, select: { leadId: true, clientId: true, categoryId: true } })
    : [];
  const [clientes, categorias, numeros, presupuestos] = await Promise.all([
    fichas.length
      ? prisma.client.findMany({ where: { workspaceId, id: { in: fichas.map((f) => f.clientId) } }, select: { id: true, firstName: true, businessName: true } })
      : Promise.resolve([] as { id: string; firstName: string | null; businessName: string | null }[]),
    fichas.length
      ? prisma.fotofficeConsultaCategoria.findMany({ where: { workspaceId, id: { in: fichas.map((f) => f.categoryId) } }, select: { id: true, name: true } })
      : Promise.resolve([] as { id: string; name: string }[]),
    numeroDe(workspaceId, TIPO_CONSULTA, ids),
    presupuestosDe(workspaceId, ids),
  ]);
  const fichaDe = new Map(fichas.map((f) => [f.leadId, f]));
  const clienteDe = new Map(clientes.map((c) => [c.id, c]));
  const categoriaDe = new Map(categorias.map((c) => [c.id, c.name]));
  return leads.map((l) => {
    const ficha = fichaDe.get(l.id);
    const cliente = ficha ? clienteDe.get(ficha.clientId) : undefined;
    const f = fecha(l.eventDate);
    const consulta: ConsultaBot = {
      leadId: l.id,
      numero: numeros.get(l.id) ?? null,
      nombreDePila: primera(cliente?.firstName) ?? cliente?.businessName?.trim() ?? primera(l.name),
      categoria: ficha ? (categoriaDe.get(ficha.categoryId) ?? null) : null,
      tipoEvento: l.eventType,
      fechaEvento: f.texto,
      estado: l.status,
      tieneFicha: !!ficha,
      presupuestos: presupuestos.get(l.id) ?? [],
    };
    // Para buscar sí se mira el nombre completo; al modelo no va.
    return { consulta, dia: f.dia, buscable: normal([l.name, l.eventType, consulta.categoria ?? "", consulta.numero ?? ""].join(" ")) };
  });
}

const SELECT_LEAD = { id: true, name: true, eventType: true, eventDate: true, status: true } as const;

/** El resumen (sin contacto) de varias consultas del workspace, por id. */
export async function consultasPorId(workspaceId: string, leadIds: readonly string[]): Promise<Map<string, ConsultaBot>> {
  if (leadIds.length === 0) return new Map();
  const leads = await prisma.serviceSalesLead.findMany({ where: { workspaceId, id: { in: [...new Set(leadIds)] } }, select: SELECT_LEAD });
  return new Map((await armar(workspaceId, leads)).map((x) => [x.consulta.leadId, x.consulta]));
}

export async function buscarConsultasDelBot(ctx: CtxPresupuestos, filtros: FiltrosConsultasBot): Promise<ConsultaBot[]> {
  const leads = await prisma.serviceSalesLead.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ createdAt: "desc" }],
    take: MAX_REVISADAS,
    select: SELECT_LEAD,
  });
  const palabras = normal(filtros.texto ?? "").split(/\s+/).filter(Boolean);
  return (await armar(ctx.workspaceId, leads))
    .filter((x) => palabras.every((p) => x.buscable.includes(p)))
    .filter((x) => !filtros.desde || (x.dia !== null && x.dia >= filtros.desde))
    .filter((x) => !filtros.hasta || (x.dia !== null && x.dia <= filtros.hasta))
    .filter((x) => !filtros.soloSinPresupuesto || x.consulta.presupuestos.length === 0)
    .slice(0, MAX_RESULTADOS)
    .map((x) => x.consulta);
}

/** Una consulta del workspace para armar o completar su presupuesto, o null (ajena o inexistente). */
export async function consultaParaBorrador(ctx: CtxPresupuestos, leadId: string): Promise<(ConsultaBot & { categoriaId: string | null }) | null> {
  const lead = await prisma.serviceSalesLead.findFirst({ where: { id: leadId, workspaceId: ctx.workspaceId }, select: SELECT_LEAD });
  if (!lead) return null;
  const [x] = await armar(ctx.workspaceId, [lead]);
  const ficha = await prisma.fotofficeConsulta.findFirst({ where: { workspaceId: ctx.workspaceId, leadId }, select: { categoryId: true } });
  return { ...x!.consulta, categoriaId: ficha?.categoryId ?? null };
}

export type ConsultaParaResponder = ConsultaBot & {
  subtipo: string | null;
  ciudad: string | null;
  lugar: string | null;
  invitados: number | null;
  /** Lo que escribió el cliente, con correos, teléfonos, enlaces y documentos tapados. */
  mensajeDelCliente: string;
  /** dd/mm/aaaa de cuando llegó. */
  recibida: string;
  /** Por dónde se puede contestar; nunca los datos (spec §9). */
  canales: { correo: boolean; whatsapp: boolean };
};

/** La consulta para responderla (spec §6.3, `ver_consulta`), o null si no es del workspace. */
export async function consultaParaResponder(ctx: CtxPresupuestos, leadId: string): Promise<ConsultaParaResponder | null> {
  const lead = await prisma.serviceSalesLead.findFirst({
    where: { id: leadId, workspaceId: ctx.workspaceId },
    select: { ...SELECT_LEAD, eventSubtype: true, eventLocation: true, message: true, email: true, phone: true, createdAt: true },
  });
  if (!lead) return null;
  const [x] = await armar(ctx.workspaceId, [lead]);
  const ficha = await prisma.fotofficeConsulta.findFirst({
    where: { workspaceId: ctx.workspaceId, leadId },
    select: { clientId: true, city: true, venue: true, guests: true },
  });
  const cliente = ficha
    ? await prisma.client.findFirst({ where: { id: ficha.clientId, workspaceId: ctx.workspaceId }, select: { email: true, phone: true } })
    : null;
  const correo = (cliente?.email ?? lead.email ?? "").trim();
  const telefono = (cliente?.phone ?? lead.phone ?? "").trim();
  const recibida = diaDeCalendario(lead.createdAt);
  return {
    ...x!.consulta,
    subtipo: lead.eventSubtype?.trim() || null,
    ciudad: ficha?.city?.trim() || null,
    lugar: ficha?.venue?.trim() || lead.eventLocation?.trim() || null,
    invitados: ficha?.guests ?? null,
    mensajeDelCliente: redactarMensajeDelCliente(lead.message),
    recibida: `${recibida.slice(8, 10)}/${recibida.slice(5, 7)}/${recibida.slice(0, 4)}`,
    canales: { correo: correo.length > 0, whatsapp: telefono.replace(/\D/g, "").length >= 7 },
  };
}
