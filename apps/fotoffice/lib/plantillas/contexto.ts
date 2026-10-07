import "server-only";
import { prisma } from "@repo/db";
import { listarCampos } from "@/lib/campos/definiciones";
import { valoresDe } from "@/lib/campos/valores";
import { textoLegible } from "@/lib/campos/validacion";
import { normalizeWhatsappNumber } from "@/lib/contact/whatsapp";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { ETIQUETA_SALIDA } from "@/lib/circuitos/constantes";
import { resolverPersonaPorCliente, resolverPersonaPorSocio } from "@/lib/ficha/persona";
import { numeroDe } from "@/lib/numeracion/asignar";
import { listaDePrecios } from "@/lib/presupuestos/lista-precios";
import { SERVICE_LEAD_EVENT_TYPE_LABELS } from "@/lib/service-leads/form-definitions";
import type { ContextoVariables } from "./variables";

/** Fichas desde las que se envía un mensaje (GENERAL es sólo un tipo de plantilla). */
export const TIPOS_FICHA_MENSAJE = ["CLIENTE", "SOCIO", "CONSULTA"] as const;
export type TipoFichaMensaje = (typeof TIPOS_FICHA_MENSAJE)[number];

export function esTipoFichaMensaje(v: unknown): v is TipoFichaMensaje {
  return typeof v === "string" && (TIPOS_FICHA_MENSAJE as readonly string[]).includes(v);
}

export type UsuarioQueEnvia = { nombre: string | null; email: string | null };

/** Todo lo que necesita un envío desde una ficha, leído en lote y acotado al workspace. */
export type ContextoMensaje = {
  variables: ContextoVariables;
  /** Firma de la organización ("" si no tiene branding). */
  firma: { html: string; texto: string };
  /** Adónde puede ir el mensaje: sólo los datos de la persona. */
  destino: { email: string | null; telefono: string | null };
  /** Nombre visible del remitente y "responder a" (correo de contacto de la organización). */
  remitente: { nombre: string; replyTo: string | null };
  /** Claves de los campos personalizados activos del tipo de ficha (para validar `[campo:…]`). */
  camposActivos: { clave: string; nombre: string }[];
};

function limpio(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/** Nombre y apellido en orden natural (no "Apellido, Nombre" como el listado). */
function nombreNatural(nombre: string | null | undefined, apellido: string | null | undefined): string | null {
  return [limpio(nombre), limpio(apellido)].filter(Boolean).join(" ") || null;
}

type DatosPersona = { nombreCompleto: string | null; email: string | null; telefono: string | null };

async function datosDeCliente(workspaceId: string, id: string | null): Promise<DatosPersona | null> {
  if (!id) return null;
  const c = await prisma.client.findFirst({
    where: { id, workspaceId },
    select: { kind: true, firstName: true, lastName: true, businessName: true, email: true, phone: true },
  });
  if (!c) return null;
  return {
    nombreCompleto: c.kind === "EMPRESA" ? limpio(c.businessName) : nombreNatural(c.firstName, c.lastName),
    email: limpio(c.email),
    telefono: limpio(c.phone),
  };
}

async function datosDeSocio(
  workspaceId: string,
  id: string | null,
): Promise<(DatosPersona & { numero: string | null }) | null> {
  if (!id) return null;
  const m = await prisma.member.findFirst({
    where: { id, workspaceId },
    select: { firstName: true, lastName: true, email: true, phone: true, memberNumber: true },
  });
  if (!m) return null;
  return {
    nombreCompleto: nombreNatural(m.firstName, m.lastName),
    email: limpio(m.email),
    telefono: limpio(m.phone),
    numero: limpio(m.memberNumber),
  };
}

/** Correo con forma de dirección (una sola, sin separadores ni `<>`). */
export function correoValido(v: string | null | undefined): v is string {
  return typeof v === "string" && v.length <= 254 && /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/.test(v);
}

/** El primero que sirve; si ninguno sirve, el primero cargado (para mostrarlo). */
function primeroQueSirve(valores: (string | null | undefined)[], sirve: (v: string) => boolean): string | null {
  const cargados = valores.filter((v): v is string => typeof v === "string" && v.length > 0);
  return cargados.find(sirve) ?? cargados[0] ?? null;
}

/**
 * Primero lo de la identidad principal; lo que le falte o no sirva, de la otra (cliente ↔ socio
 * vinculados). El correo es el primero válido; el teléfono, el primero que sirve para WhatsApp.
 */
function combinar(principal: DatosPersona | null, otra: DatosPersona | null): DatosPersona {
  return {
    nombreCompleto: principal?.nombreCompleto ?? otra?.nombreCompleto ?? null,
    email: primeroQueSirve([principal?.email, otra?.email], correoValido),
    telefono: primeroQueSirve([principal?.telefono, otra?.telefono], (t) => normalizeWhatsappNumber(t) !== null),
  };
}

/** Etapa actual de la consulta: la del recorrido abierto; si no hay, cómo terminó el último. */
async function etapaDeConsulta(workspaceId: string, leadId: string): Promise<string | null> {
  const abierto = await prisma.fotofficeJourney.findFirst({
    where: { workspaceId, subjectType: "CAPTACION", subjectId: leadId, closedAt: null },
    select: { stageId: true },
    orderBy: [{ createdAt: "desc" }],
  });
  if (abierto) {
    if (!abierto.stageId) return null;
    const etapa = await prisma.fotofficeStage.findFirst({
      where: { id: abierto.stageId, circuit: { workspaceId } },
      select: { name: true },
    });
    return limpio(etapa?.name);
  }
  const cerrado = await prisma.fotofficeJourney.findFirst({
    where: { workspaceId, subjectType: "CAPTACION", subjectId: leadId, closedAt: { not: null } },
    select: { outcome: true },
    orderBy: [{ closedAt: "desc" }],
  });
  return cerrado?.outcome ? (ETIQUETA_SALIDA[cerrado.outcome] ?? cerrado.outcome) : null;
}

/** Valores legibles de los campos activos del tipo, por clave. */
async function camposDe(workspaceId: string, tipo: TipoFichaMensaje, entityId: string) {
  const [definidos, valores] = await Promise.all([listarCampos(workspaceId, tipo), valoresDe(workspaceId, tipo, [entityId])]);
  const delRegistro = valores.get(entityId);
  const campos: Record<string, string> = {};
  for (const c of definidos) {
    const texto = textoLegible(c.type, delRegistro?.get(c.id) ?? null, c.etiquetas);
    if (texto.trim()) campos[c.key] = texto;
  }
  return { campos, activos: definidos.map((c) => ({ clave: c.key, nombre: c.name })) };
}

/**
 * Arma el contexto real de un registro del workspace, o null si no es del workspace (o no existe).
 * Persona (con `lib/ficha/persona.ts` o la consulta), organización y firma
 * (`loadWorkspaceEmailContext`), número (0.5), campos (0.5) y etapa del recorrido (0.4).
 */
export async function contextoDe(
  workspaceId: string,
  entityType: TipoFichaMensaje,
  entityId: string,
  usuario: UsuarioQueEnvia,
  hoy: Date = new Date(),
): Promise<ContextoMensaje | null> {
  if (!esTipoFichaMensaje(entityType) || typeof entityId !== "string" || !entityId || entityId.length > 100) return null;

  let persona: DatosPersona;
  let consulta: ContextoVariables["consulta"];
  let socio: ContextoVariables["socio"];
  let listaPrecios: string | null = null;

  if (entityType === "CONSULTA") {
    const lead = await prisma.serviceSalesLead.findFirst({
      where: { id: entityId, workspaceId },
      select: { name: true, email: true, phone: true, eventType: true, eventDate: true, eventLocation: true, message: true },
    });
    if (!lead) return null;
    persona = { nombreCompleto: limpio(lead.name), email: limpio(lead.email), telefono: limpio(lead.phone) };
    const [numeros, etapa, lista] = await Promise.all([
      numeroDe(workspaceId, "CONSULTA", [entityId]),
      etapaDeConsulta(workspaceId, entityId),
      listaDePrecios(workspaceId),
    ]);
    listaPrecios = lista;
    consulta = {
      numero: numeros.get(entityId) ?? null,
      tipo: (SERVICE_LEAD_EVENT_TYPE_LABELS as Record<string, string>)[lead.eventType] ?? limpio(lead.eventType),
      fecha: lead.eventDate,
      lugar: limpio(lead.eventLocation),
      mensaje: limpio(lead.message),
      etapa,
    };
  } else if (entityType === "CLIENTE") {
    const ref = await resolverPersonaPorCliente(workspaceId, entityId);
    if (!ref) return null;
    const [cliente, deSocio] = await Promise.all([datosDeCliente(workspaceId, ref.clientId), datosDeSocio(workspaceId, ref.memberId)]);
    if (!cliente) return null;
    persona = combinar(cliente, deSocio);
  } else {
    const ref = await resolverPersonaPorSocio(workspaceId, entityId);
    if (!ref) return null;
    const [deSocio, cliente] = await Promise.all([datosDeSocio(workspaceId, ref.memberId), datosDeCliente(workspaceId, ref.clientId)]);
    if (!deSocio) return null;
    persona = combinar(deSocio, cliente);
    socio = { numero: deSocio.numero };
  }

  const [org, campos] = await Promise.all([loadWorkspaceEmailContext(workspaceId), camposDe(workspaceId, entityType, entityId)]);
  const contacto = org.contact ?? { email: null, phone: null, whatsapp: null, website: null, instagram: null, city: null };

  const variables: ContextoVariables = {
    persona,
    organizacion: {
      nombre: org.organizationName,
      email: contacto.email,
      telefono: contacto.phone,
      whatsapp: contacto.whatsapp,
      web: contacto.website,
      instagram: contacto.instagram,
      ciudad: contacto.city,
    },
    usuario: { nombre: limpio(usuario.nombre), email: limpio(usuario.email) },
    hoy,
    ...(consulta ? { consulta } : {}),
    ...(socio ? { socio } : {}),
    ...(entityType === "CONSULTA" ? { listaPrecios } : {}),
    campos: campos.campos,
  };

  return {
    variables,
    firma: { html: org.signature?.html ?? "", texto: org.signature?.text ?? "" },
    destino: { email: persona.email, telefono: persona.telefono },
    remitente: { nombre: org.organizationName, replyTo: contacto.email },
    camposActivos: campos.activos,
  };
}

/**
 * Sólo adónde puede ir un mensaje (correo y teléfono de la persona), con la misma regla que
 * `contextoDe` pero sin cargar organización, firma ni campos: lo usa la ficha para habilitar o
 * no cada canal. null si el registro no es del workspace.
 */
export async function destinoDe(
  workspaceId: string,
  entityType: TipoFichaMensaje,
  entityId: string,
): Promise<ContextoMensaje["destino"] | null> {
  if (!esTipoFichaMensaje(entityType) || typeof entityId !== "string" || !entityId || entityId.length > 100) return null;
  if (entityType === "CONSULTA") {
    const lead = await prisma.serviceSalesLead.findFirst({ where: { id: entityId, workspaceId }, select: { email: true, phone: true } });
    return lead ? { email: limpio(lead.email), telefono: limpio(lead.phone) } : null;
  }
  const ref = entityType === "CLIENTE"
    ? await resolverPersonaPorCliente(workspaceId, entityId)
    : await resolverPersonaPorSocio(workspaceId, entityId);
  if (!ref) return null;
  const [cliente, socio] = await Promise.all([datosDeCliente(workspaceId, ref.clientId), datosDeSocio(workspaceId, ref.memberId)]);
  const principal = entityType === "CLIENTE" ? cliente : socio;
  if (!principal) return null;
  const persona = combinar(principal, entityType === "CLIENTE" ? socio : cliente);
  return { email: persona.email, telefono: persona.telefono };
}
