import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { altaDeConsulta, type DatosAlta } from "@/lib/consultas/alta";
import type { DatosContacto } from "@/lib/consultas/contacto";
import { puedeEnContexto } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { asignarNumero, numeroDe, type NumeroAsignado } from "@/lib/numeracion/asignar";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import {
  MENSAJES_PRESUPUESTO,
  puedeGestionarPresupuestos,
  puedeVerPresupuestos,
  QUOTES_MODULE_KEY,
  veCostos,
  type CtxPresupuestos,
} from "./acceso";
import { leerAjustes, type AjustesPresupuestos } from "./ajustes";
import { entradaGuardada, validarOpcionesPago } from "./opciones-pago";
import { ENTIDAD_NUMERACION, esEstadoPresupuesto, type EstadoPresupuesto } from "./constantes";
import { itemsDeLaPropuesta } from "./items-de-la-propuesta";
import { leerPropuestaModelo } from "./propuestas-modelo";
import { estadoEfectivo, ESTADOS_QUE_VENCEN, hoyEnBuenosAires, puedePasar, textoDeFecha, vencimientoDesde, vencio } from "./estados";
import {
  bloquearPresupuesto,
  costosVacios,
  entradasGuardadas,
  normalizarBorrador,
  SELECT_VERSION,
  totalesVacios,
  versionParaVista,
  type BorradorNormalizado,
  type CostosVersion,
  type EntradaBorrador,
  type TotalesGuardados,
  type VersionVista,
} from "./versiones";

/**
 * Presupuestos (spec §2 A.2, §3.2): crear, editar el borrador, rechazar, vencer y leer.
 *
 * Reglas comunes:
 * - el `workspaceId` sale del contexto (la sesión); cada id que llega se busca DENTRO del
 *   workspace y, si no está, "no existe" (no se distingue de uno de otro workspace);
 * - los cambios de estado pasan por `puedePasar` y se escriben condicionales (`status` = el
 *   leído), así dos personas a la vez no pisan un estado que cambió;
 * - costo y margen sólo salen con `veCostos` (R1).
 *
 * Nunca loguea datos personales.
 */

type Tx = Prisma.TransactionClient;

export type Resultado = { ok: true } | { ok: false; error: string };

export type DepsPresupuestos = {
  /** ¿Tiene "Gestionar" en Presupuestos? Inyectable en las pruebas; por omisión, los niveles de main. */
  tieneGestionar?: (userId: number, workspaceId: string) => Promise<boolean>;
  ahora?: () => Date;
};

const tieneGestionarPorDefecto = (userId: number, workspaceId: string) =>
  hasModuleLevel(userId, workspaceId, QUOTES_MODULE_KEY, "MANAGE");

function falla(donde: string, error: unknown): void {
  // Sólo el código del error: ni ids, ni mensajes (pueden traer datos personales).
  const e = error as { code?: unknown } | null;
  console.error(`[presupuestos] ${donde} falló`, { codigo: typeof e?.code === "string" ? e.code : null });
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

// --- Crear ---------------------------------------------------------------------------------------

export type DatosNuevoPresupuesto = {
  /** Una consulta del workspace (`ServiceSalesLead.id`). */
  consultaLeadId?: string | null;
  /** Sin consulta: se crea una (alta MANUAL) con este contacto y esta categoría. */
  nuevaConsulta?: { contacto: { clientId: string } | DatosContacto; categoriaId: string } | null;
  /** Responsable; por omisión, quien lo crea. */
  ownerUserId?: number | null;
};

/**
 * `leadId` en el error: la consulta que el alta SÍ creó (sin consulta elegida) cuando después
 * falló el presupuesto. La consulta queda (es un alta completa: número, circuito, aviso) y la
 * pantalla puede llevar a ella en vez de crear otra al reintentar.
 */
export type ResultadoCreacion =
  | { ok: true; presupuestoId: string; versionId: string; leadId: string }
  | { ok: false; error: string; leadId?: string };

async function puedeSerResponsable(workspaceId: string, userId: unknown, deps: DepsPresupuestos): Promise<boolean> {
  if (typeof userId !== "number" || !Number.isSafeInteger(userId) || userId <= 0) return false;
  const miembro = await prisma.workspaceMembership.findFirst({ where: { userId, workspaceId }, select: { id: true } });
  if (!miembro) return false;
  return (deps.tieneGestionar ?? tieneGestionarPorDefecto)(userId, workspaceId);
}

/** La consulta (y su contacto) dentro del workspace, o null. */
async function consultaDelWorkspace(workspaceId: string, leadId: string): Promise<{ leadId: string; clientId: string } | null | "sinContacto"> {
  const lead = await prisma.serviceSalesLead.findFirst({ where: { id: leadId, workspaceId }, select: { id: true } });
  if (!lead) return null;
  const ficha = await prisma.fotofficeConsulta.findFirst({ where: { leadId, workspaceId }, select: { clientId: true } });
  return ficha ? { leadId, clientId: ficha.clientId } : "sinContacto";
}

/**
 * Los ítems, totales y costos de la propuesta modelo de la categoría de la consulta, o null (sin
 * categoría, sin propuesta, producto inactivo, sin perfil para un cálculo, ítems inválidos o
 * cualquier error): crear el presupuesto nunca falla por la propuesta. Sólo se registra un código.
 */
async function precargarConPropuesta(
  workspaceId: string,
  leadId: string,
  ajustes: AjustesPresupuestos,
  ahora: Date,
): Promise<BorradorNormalizado | null> {
  try {
    const ficha = await prisma.fotofficeConsulta.findFirst({ where: { workspaceId, leadId }, select: { categoryId: true } });
    if (!ficha) return null;
    const propuesta = await leerPropuestaModelo(workspaceId, ficha.categoryId);
    if (!propuesta || propuesta.items.length === 0) return null;
    const instanciada = await itemsDeLaPropuesta(workspaceId, propuesta.items, ahora);
    if (!instanciada.ok) {
      console.error("[presupuestos] la propuesta modelo no precargó el presupuesto", { codigo: instanciada.motivo });
      return null;
    }
    const borrador = await normalizarBorrador(
      workspaceId,
      { items: instanciada.items, condiciones: propuesta.condiciones ?? ajustes.condiciones, propuestaPago: ajustes.propuestaPago },
      new Map(),
      ahora,
    );
    if (!borrador.ok) {
      console.error("[presupuestos] la propuesta modelo no precargó el presupuesto", { codigo: "ITEMS_INVALIDOS" });
      return null;
    }
    return borrador.valor;
  } catch (e) {
    falla("precargarConPropuesta", e);
    return null;
  }
}

/**
 * "Nuevo presupuesto" de una consulta. Si no se eligió consulta, se crea una con el alta de
 * siempre (`altaDeConsulta`, origen MANUAL: número, circuito y aviso como cualquier alta), lo que
 * además pide "Gestionar" en Consultas. Crea el presupuesto en BORRADOR con su V1 vacía (las
 * condiciones y la propuesta de pago salen de los ajustes) y la validez desde los ajustes.
 */
export async function crearPresupuesto(
  ctx: CtxPresupuestos,
  datos: DatosNuevoPresupuesto,
  deps: DepsPresupuestos = {},
): Promise<ResultadoCreacion> {
  if (!puedeGestionarPresupuestos(ctx) || ctx.userId === null) return { ok: false, error: MENSAJES_PRESUPUESTO.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: MENSAJES_PRESUPUESTO.datosInvalidos };
  const { workspaceId } = ctx;
  const ahora = deps.ahora?.() ?? new Date();

  const owner = datos.ownerUserId ?? ctx.userId;
  if (owner !== ctx.userId && !(await puedeSerResponsable(workspaceId, owner, deps))) {
    return { ok: false, error: MENSAJES_PRESUPUESTO.responsable };
  }

  let consulta: { leadId: string; clientId: string };
  /** La consulta la creó esta llamada (para devolverla si el presupuesto falla). */
  let consultaCreada = false;
  if (datos.consultaLeadId !== undefined && datos.consultaLeadId !== null) {
    if (!idValido(datos.consultaLeadId)) return { ok: false, error: MENSAJES_PRESUPUESTO.consulta };
    const c = await consultaDelWorkspace(workspaceId, datos.consultaLeadId);
    if (c === null) return { ok: false, error: MENSAJES_PRESUPUESTO.consulta };
    if (c === "sinContacto") return { ok: false, error: MENSAJES_PRESUPUESTO.consultaSinContacto };
    consulta = c;
  } else if (datos.nuevaConsulta && typeof datos.nuevaConsulta === "object") {
    const { contacto, categoriaId } = datos.nuevaConsulta;
    if (!contacto || typeof contacto !== "object" || !idValido(categoriaId)) return { ok: false, error: MENSAJES_PRESUPUESTO.elegirConsulta };
    // Un contacto existente sólo con "Ver" en Clientes (R10 de la etapa 1), como el alta de consultas.
    if ("clientId" in contacto && !puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)) return { ok: false, error: MENSAJES_PRESUPUESTO.sinContactos };
    // El responsable de la consulta lo decide el alta (sus ajustes): el de Presupuestos puede no gestionar Consultas.
    const alta: DatosAlta = { contacto, categoriaId };
    const r = await altaDeConsulta(ctx, alta, { origenDelAlta: "MANUAL" });
    if (!r.ok) return r;
    if (r.clientId === null) return { ok: false, error: MENSAJES_PRESUPUESTO.consultaSinContacto };
    consulta = { leadId: r.leadId, clientId: r.clientId };
    consultaCreada = true;
  } else {
    return { ok: false, error: MENSAJES_PRESUPUESTO.elegirConsulta };
  }

  const ajustes = await leerAjustes(workspaceId);
  // La propuesta modelo de la categoría, ANTES de la transacción: si algo falla, V1 vacía como siempre.
  const precargado = await precargarConPropuesta(workspaceId, consulta.leadId, ajustes, ahora);
  try {
    return await prisma.$transaction(async (tx) => {
      const p = await tx.fotofficePresupuesto.create({
        data: {
          workspaceId,
          consultaLeadId: consulta.leadId,
          clientId: consulta.clientId,
          status: "BORRADOR",
          ownerUserId: owner,
          validUntil: vencimientoDesde(ahora, ajustes.validezDias),
        },
        select: { id: true },
      });
      const v = await tx.fotofficePresupuestoVersion.create({
        data: {
          workspaceId,
          presupuestoId: p.id,
          number: 1,
          items: (precargado?.items ?? []) as unknown as Prisma.InputJsonValue,
          totals: (precargado?.totals ?? totalesVacios()) as unknown as Prisma.InputJsonValue,
          terms: precargado ? precargado.terms : ajustes.condiciones,
          paymentProposal: precargado ? precargado.paymentProposal : ajustes.propuestaPago,
          // Las opciones de pago de la organización, para editarlas en este presupuesto.
          ...(ajustes.opcionesPago ? { paymentOptions: ajustes.opcionesPago as unknown as Prisma.InputJsonValue } : {}),
          costSnapshot: (precargado?.costSnapshot ?? costosVacios()) as unknown as Prisma.InputJsonValue,
          createdByUserId: ctx.userId,
        },
        select: { id: true },
      });
      await tx.fotofficePresupuesto.update({ where: { id: p.id }, data: { currentVersionId: v.id }, select: { id: true } });
      return { ok: true as const, presupuestoId: p.id, versionId: v.id, leadId: consulta.leadId };
    });
  } catch (e) {
    // Sólo el código del error en el registro (sin ids ni datos personales).
    falla("crearPresupuesto", e);
    if (consultaCreada) return { ok: false, error: MENSAJES_PRESUPUESTO.falloConConsulta, leadId: consulta.leadId };
    return { ok: false, error: MENSAJES_PRESUPUESTO.fallo };
  }
}

// --- Borrador --------------------------------------------------------------------------------------

/** Los ítems sin la instantánea del cálculo (y por lo tanto sin entradas del motor). */
export function sinEntradasDeCalculo(entrada: EntradaBorrador): EntradaBorrador {
  if (!entrada || typeof entrada !== "object" || !Array.isArray(entrada.items)) return entrada;
  return {
    ...entrada,
    items: entrada.items.map((x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? { ...(x as Record<string, unknown>), calculo: null } : x)),
  };
}

/**
 * Guarda el borrador: ítems (validados; los de ¿Cuánto Cobro? recalculados en el servidor),
 * descuentos, condiciones, propuesta de pago y opciones de pago. Sólo hay borrador si la última versión no se
 * envió: para cambiar uno enviado primero se crea la versión siguiente (`crearNuevaVersion`).
 *
 * La escritura es condicional (`sentAt IS NULL`, con el candado del presupuesto): si mientras se
 * guardaba alguien la envió, no se toca la versión enviada.
 */
export async function guardarBorrador(
  ctx: CtxPresupuestos,
  presupuestoId: unknown,
  entrada: EntradaBorrador,
  deps: DepsPresupuestos = {},
): Promise<Resultado> {
  if (!puedeGestionarPresupuestos(ctx)) return { ok: false, error: MENSAJES_PRESUPUESTO.sinPermiso };
  if (!idValido(presupuestoId)) return { ok: false, error: MENSAJES_PRESUPUESTO.datosInvalidos };
  const { workspaceId } = ctx;
  const ahora = deps.ahora?.() ?? new Date();

  const p = await prisma.fotofficePresupuesto.findFirst({ where: { id: presupuestoId, workspaceId }, select: { id: true, status: true } });
  if (!p) return { ok: false, error: MENSAJES_PRESUPUESTO.noExiste };
  if (p.status === "ACEPTADO") return { ok: false, error: MENSAJES_PRESUPUESTO.aceptado };
  const borrador = await prisma.fotofficePresupuestoVersion.findFirst({
    where: { workspaceId, presupuestoId, sentAt: null },
    select: { id: true, items: true, paymentOptions: true },
  });
  if (!borrador) return { ok: false, error: MENSAJES_PRESUPUESTO.yaEnviado };

  // Opciones de pago (etapa 3): sólo si llegaron. Sin el campo, las guardadas quedan.
  let paymentOptions: Prisma.InputJsonValue | undefined;
  if (entrada && typeof entrada === "object" && entrada.opcionesPago !== undefined) {
    const o = validarOpcionesPago(entrada.opcionesPago, entradaGuardada(borrador.paymentOptions));
    if (!o.ok) return o;
    paymentOptions = o.valor as unknown as Prisma.InputJsonValue;
  }

  // R4 (Task 4): sin `configurar`, el cálculo no se carga ni se cambia. Las entradas que lleguen
  // del navegador se ignoran y cada ítem de ¿Cuánto Cobro? se recalcula con la que ya estaba
  // guardada para ese renglón; uno nuevo, sin entrada guardada, no pasa.
  const n = await normalizarBorrador(workspaceId, veCostos(ctx) ? entrada : sinEntradasDeCalculo(entrada), entradasGuardadas(borrador.items), ahora);
  if (!n.ok) return n;

  try {
    return await prisma.$transaction(async (tx): Promise<Resultado> => {
      await bloquearPresupuesto(tx, presupuestoId);
      const actual = await tx.fotofficePresupuesto.findFirst({ where: { id: presupuestoId, workspaceId }, select: { status: true } });
      if (!actual) return { ok: false, error: MENSAJES_PRESUPUESTO.noExiste };
      if (actual.status === "ACEPTADO") return { ok: false, error: MENSAJES_PRESUPUESTO.aceptado };
      const r = await tx.fotofficePresupuestoVersion.updateMany({
        where: { id: borrador.id, workspaceId, presupuestoId, sentAt: null },
        data: {
          items: n.valor.items as unknown as Prisma.InputJsonValue,
          totals: n.valor.totals as unknown as Prisma.InputJsonValue,
          terms: n.valor.terms,
          paymentProposal: n.valor.paymentProposal,
          ...(paymentOptions !== undefined ? { paymentOptions } : {}),
          costSnapshot: n.valor.costSnapshot as unknown as Prisma.InputJsonValue,
        },
      });
      if (r.count !== 1) return { ok: false, error: MENSAJES_PRESUPUESTO.yaEnviado };
      await tx.fotofficePresupuesto.update({ where: { id: presupuestoId }, data: { updatedAt: ahora }, select: { id: true } });
      return { ok: true };
    });
  } catch (e) {
    falla("guardarBorrador", e);
    return { ok: false, error: MENSAJES_PRESUPUESTO.fallo };
  }
}

// --- Estados -------------------------------------------------------------------------------------

/**
 * Lo que se escribe en el presupuesto al ENVIAR (cada envío, también el de la V2 o el reenvío de
 * uno vencido o rechazado): la validez se cuenta de nuevo desde hoy con los ajustes. La Task 5
 * lo pasa como `datos` de `pasarEstado(…, a: "ENVIADO")`, junto con `currentVersionId`.
 */
export function datosDeEnvio(ahora: Date, ajustes: Pick<AjustesPresupuestos, "validezDias">): { validUntil: Date } {
  return { validUntil: vencimientoDesde(ahora, ajustes.validezDias) };
}

/**
 * Cambia el estado de un presupuesto validando la transición contra el estado EFECTIVO (un
 * enviado que venció cuenta como vencido) y escribiendo condicional sobre el guardado. Lo usan
 * rechazar (acá) y enviar, ver y aceptar (Task 5).
 */
export async function pasarEstado(
  cliente: Pick<Tx, "fotofficePresupuesto">,
  args: {
    workspaceId: string;
    presupuestoId: string;
    a: EstadoPresupuesto;
    ahora: Date;
    datos?: Prisma.FotofficePresupuestoUncheckedUpdateManyInput;
    /** Condiciones extra de la escritura (p. ej. VISTO sólo si la vigente sigue siendo la que se vio). */
    donde?: Prisma.FotofficePresupuestoWhereInput;
  },
): Promise<Resultado> {
  const p = await cliente.fotofficePresupuesto.findFirst({
    where: { id: args.presupuestoId, workspaceId: args.workspaceId },
    select: { status: true, validUntil: true },
  });
  if (!p || !esEstadoPresupuesto(p.status)) return { ok: false, error: MENSAJES_PRESUPUESTO.noExiste };
  const de = estadoEfectivo(p.status, p.validUntil, args.ahora);
  if (!puedePasar(de, args.a)) return { ok: false, error: MENSAJES_PRESUPUESTO.transicion };
  // Enviar exige la validez renovada (`datosDeEnvio`): sin ella, un vencido o rechazado que se
  // reenvía quedaría ENVIADO con la fecha vieja y se vería vencido de nuevo al instante.
  if (args.a === "ENVIADO") {
    const v = args.datos?.validUntil;
    if (!(v instanceof Date) || vencio(v, args.ahora)) return { ok: false, error: MENSAJES_PRESUPUESTO.transicion };
  }
  const r = await cliente.fotofficePresupuesto.updateMany({
    where: { ...args.donde, id: args.presupuestoId, workspaceId: args.workspaceId, status: p.status },
    data: { ...args.datos, status: args.a },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: MENSAJES_PRESUPUESTO.cambio };
}

/** "Rechazado": desde enviado, visto o vencido. */
export async function rechazarPresupuesto(ctx: CtxPresupuestos, presupuestoId: unknown, deps: DepsPresupuestos = {}): Promise<Resultado> {
  if (!puedeGestionarPresupuestos(ctx)) return { ok: false, error: MENSAJES_PRESUPUESTO.sinPermiso };
  if (!idValido(presupuestoId)) return { ok: false, error: MENSAJES_PRESUPUESTO.datosInvalidos };
  return pasarEstado(prisma, { workspaceId: ctx.workspaceId, presupuestoId, a: "RECHAZADO", ahora: deps.ahora?.() ?? new Date() });
}

/**
 * Lote "marcar vencidos": escribe VENCIDO en los enviados o vistos cuyo último día de validez ya
 * pasó (Buenos Aires). Con `ids`, sólo entre esos (los que se tildaron en la lista; los de otro
 * workspace no coinciden). Devuelve cuántos marcó.
 */
export async function marcarVencidos(
  ctx: CtxPresupuestos,
  ids?: unknown,
  deps: DepsPresupuestos = {},
): Promise<{ ok: true; marcados: number } | { ok: false; error: string }> {
  if (!puedeGestionarPresupuestos(ctx)) return { ok: false, error: MENSAJES_PRESUPUESTO.sinPermiso };
  let filtro: string[] | undefined;
  if (ids !== undefined && ids !== null) {
    if (!Array.isArray(ids) || ids.length > 500 || !ids.every(idValido)) return { ok: false, error: MENSAJES_PRESUPUESTO.datosInvalidos };
    filtro = [...new Set(ids)];
  }
  const hoy = hoyEnBuenosAires(deps.ahora?.() ?? new Date());
  const r = await prisma.fotofficePresupuesto.updateMany({
    where: {
      workspaceId: ctx.workspaceId,
      status: { in: [...ESTADOS_QUE_VENCEN] },
      validUntil: { lt: hoy },
      ...(filtro ? { id: { in: filtro } } : {}),
    },
    data: { status: "VENCIDO" },
  });
  return { ok: true, marcados: r.count };
}

// --- Número -----------------------------------------------------------------------------------------

/**
 * Número PRESUPUESTO del presupuesto, dentro de la transacción del primer envío (Task 5). Si ya
 * tenía, devuelve ése sin consumir otro.
 */
export function numerarPresupuesto(tx: Tx, args: { workspaceId: string; presupuestoId: string; fecha: Date }): Promise<NumeroAsignado> {
  return asignarNumero(tx, {
    workspaceId: args.workspaceId,
    key: "PRESUPUESTO",
    entityType: ENTIDAD_NUMERACION,
    entityId: args.presupuestoId,
    fecha: args.fecha,
  });
}

// --- Lectura ----------------------------------------------------------------------------------------

export type FilaPresupuesto = {
  id: string;
  numero: string | null;
  estado: EstadoPresupuesto;
  consultaLeadId: string;
  clientId: string;
  contacto: string;
  ownerUserId: number | null;
  /** "aaaa-mm-dd". */
  validUntil: string | null;
  total: number;
  /** Versión vigente y si hay un borrador más nuevo. */
  version: number;
  tieneBorrador: boolean;
  pedidoPorConfirmar: boolean;
  updatedAt: Date;
  /** Sólo con permiso de costos; si no, null. */
  costo: number | null;
  margen: number | null;
};

export type FiltrosPresupuestos = {
  estado?: EstadoPresupuesto | null;
  consultaLeadId?: string | null;
  clientId?: string | null;
};

function nombreDeContacto(c: { firstName: string | null; lastName: string | null; businessName: string | null } | undefined): string {
  if (!c) return "Sin nombre";
  return c.businessName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(" ").trim() || "Sin nombre";
}

const TOPE_LISTA = 500;

/**
 * Lista (y tarjetas de la consulta y del contacto): estado efectivo, total de la vigente, vence,
 * número y contacto. El filtro VENCIDO incluye los que vencieron sin marcar; ENVIADO y VISTO
 * excluyen los vencidos.
 */
export async function listarPresupuestos(
  ctx: CtxPresupuestos,
  filtros: FiltrosPresupuestos = {},
  deps: DepsPresupuestos = {},
): Promise<FilaPresupuesto[]> {
  if (!puedeVerPresupuestos(ctx)) return [];
  const { workspaceId } = ctx;
  const ahora = deps.ahora?.() ?? new Date();
  const conCostos = veCostos(ctx);
  const estado = filtros.estado && esEstadoPresupuesto(filtros.estado) ? filtros.estado : null;
  const guardados: EstadoPresupuesto[] | null = estado === null
    ? null
    : estado === "VENCIDO" ? ["VENCIDO", ...ESTADOS_QUE_VENCEN] : [estado];

  const filas = await prisma.fotofficePresupuesto.findMany({
    where: {
      workspaceId,
      ...(guardados ? { status: { in: guardados } } : {}),
      ...(idValido(filtros.consultaLeadId) ? { consultaLeadId: filtros.consultaLeadId } : {}),
      ...(idValido(filtros.clientId) ? { clientId: filtros.clientId } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: TOPE_LISTA,
    select: {
      id: true, status: true, consultaLeadId: true, clientId: true, ownerUserId: true, validUntil: true,
      currentVersionId: true, pedidoPorConfirmar: true, updatedAt: true,
    },
  });
  if (filas.length === 0) return [];
  const ids = filas.map((f) => f.id);
  const [versiones, contactos, numeros] = await Promise.all([
    prisma.fotofficePresupuestoVersion.findMany({
      where: { workspaceId, presupuestoId: { in: ids } },
      select: { id: true, presupuestoId: true, number: true, sentAt: true, totals: true, ...(conCostos ? { costSnapshot: true } : {}) },
    }),
    prisma.client.findMany({
      where: { workspaceId, id: { in: [...new Set(filas.map((f) => f.clientId))] } },
      select: { id: true, firstName: true, lastName: true, businessName: true },
    }),
    numeroDe(workspaceId, ENTIDAD_NUMERACION, ids),
  ]);
  const porId = new Map(versiones.map((v) => [v.id, v]));
  const conBorrador = new Set(versiones.filter((v) => v.sentAt === null).map((v) => v.presupuestoId));
  const contactoPorId = new Map(contactos.map((c) => [c.id, c]));

  const out: FilaPresupuesto[] = [];
  for (const f of filas) {
    if (!esEstadoPresupuesto(f.status)) continue;
    const efectivo = estadoEfectivo(f.status, f.validUntil, ahora);
    if (estado !== null && efectivo !== estado) continue;
    const vigente = f.currentVersionId ? porId.get(f.currentVersionId) : undefined;
    const totales = vigente?.totals as TotalesGuardados | undefined;
    const costos = conCostos ? ((vigente as { costSnapshot?: unknown } | undefined)?.costSnapshot as CostosVersion | null | undefined) : null;
    out.push({
      id: f.id,
      numero: numeros.get(f.id) ?? null,
      estado: efectivo,
      consultaLeadId: f.consultaLeadId,
      clientId: f.clientId,
      contacto: nombreDeContacto(contactoPorId.get(f.clientId)),
      ownerUserId: f.ownerUserId,
      validUntil: textoDeFecha(f.validUntil),
      total: totales?.total ?? 0,
      version: vigente?.number ?? 1,
      // La V1 sin enviar es borrador y vigente a la vez: no es "un borrador más nuevo".
      tieneBorrador: conBorrador.has(f.id) && vigente?.sentAt !== null,
      pedidoPorConfirmar: f.pedidoPorConfirmar,
      updatedAt: f.updatedAt,
      costo: costos ? costos.costoTotal : null,
      margen: costos ? costos.margen : null,
    });
  }
  return out;
}

export type DetallePresupuesto = {
  id: string;
  numero: string | null;
  estado: EstadoPresupuesto;
  estadoGuardado: EstadoPresupuesto;
  consultaLeadId: string;
  clientId: string;
  contacto: string;
  ownerUserId: number | null;
  validUntil: string | null;
  pedidoPorConfirmar: boolean;
  /** Último cambio (cada guardado del borrador lo mueve): el editor se vuelve a montar con él. */
  updatedAt: Date;
  /** La del enlace. */
  vigente: VersionVista | null;
  /** El borrador editable (puede ser la vigente, si nunca se envió). */
  borrador: VersionVista | null;
  versiones: { id: string; number: number; sentAt: Date | null; revokedAt: Date | null; acceptedAt: Date | null }[];
  veCostos: boolean;
};

/** La ficha del presupuesto (editor y vista). Sin token ni datos de la aceptación más allá de la fecha. */
export async function leerPresupuesto(ctx: CtxPresupuestos, presupuestoId: unknown, deps: DepsPresupuestos = {}): Promise<DetallePresupuesto | null> {
  if (!puedeVerPresupuestos(ctx) || !idValido(presupuestoId)) return null;
  const { workspaceId } = ctx;
  const ahora = deps.ahora?.() ?? new Date();
  const conCostos = veCostos(ctx);
  const p = await prisma.fotofficePresupuesto.findFirst({
    where: { id: presupuestoId, workspaceId },
    select: {
      id: true, status: true, consultaLeadId: true, clientId: true, ownerUserId: true, validUntil: true,
      currentVersionId: true, pedidoPorConfirmar: true, updatedAt: true,
    },
  });
  if (!p || !esEstadoPresupuesto(p.status)) return null;
  const [versiones, contacto, numeros] = await Promise.all([
    prisma.fotofficePresupuestoVersion.findMany({
      where: { workspaceId, presupuestoId },
      orderBy: [{ number: "asc" }],
      select: SELECT_VERSION,
    }),
    prisma.client.findFirst({ where: { id: p.clientId, workspaceId }, select: { firstName: true, lastName: true, businessName: true } }),
    numeroDe(workspaceId, ENTIDAD_NUMERACION, [p.id]),
  ]);
  const vigente = versiones.find((v) => v.id === p.currentVersionId);
  const borrador = versiones.find((v) => v.sentAt === null);
  return {
    id: p.id,
    numero: numeros.get(p.id) ?? null,
    estado: estadoEfectivo(p.status, p.validUntil, ahora),
    estadoGuardado: p.status,
    consultaLeadId: p.consultaLeadId,
    clientId: p.clientId,
    contacto: nombreDeContacto(contacto ?? undefined),
    ownerUserId: p.ownerUserId,
    validUntil: textoDeFecha(p.validUntil),
    pedidoPorConfirmar: p.pedidoPorConfirmar,
    updatedAt: p.updatedAt,
    vigente: vigente ? versionParaVista(vigente, conCostos) : null,
    borrador: borrador && p.status !== "ACEPTADO" ? versionParaVista(borrador, conCostos) : null,
    versiones: versiones.map((v) => ({ id: v.id, number: v.number, sentAt: v.sentAt, revokedAt: v.revokedAt, acceptedAt: v.acceptedAt })),
    veCostos: conCostos,
  };
}
