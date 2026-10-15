import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { MENSAJES_PRESUPUESTO, puedeConfigurarPresupuestos, type CtxPresupuestos } from "./acceso";
import { validarItems, type ItemPresupuesto, type ResultadoValidacion } from "./constantes";
import { itemsDeLaPropuesta } from "./items-de-la-propuesta";
import { TIPOS_TRABAJO } from "./panel-cuanto-cobro";
import { asegurarPlantillasPresupuesto } from "./plantillas";
import { MAX_TEXTO_VERSION } from "./versiones";

/**
 * Propuesta modelo por categoría de consulta (etapa 2, Entrega B, spec §2 B.13 y §3.4).
 *
 * Una por categoría y organización (`FotofficePropuestaModelo`, único `workspaceId` +
 * `categoryId`): ítems predefinidos, condiciones, la plantilla de correo de PRESUPUESTO con la que
 * sale y el interruptor "Enviar sola al llegar una consulta web" (lo usa
 * `./propuesta-automatica.ts`).
 *
 * Reglas:
 * - configurar: SÓLO con `configurar` (dueño y administradores), como el resto de
 *   Configuración → Presupuestos;
 * - los ítems son productos activos del catálogo (modo LISTA: al enviarla, nombre, descripción y
 *   precio se toman del catálogo en ese momento) o conceptos calculados (CALCULO, sin producto):
 *   de éstos se guarda SÓLO el trabajo (`calculo.entrada.presupuesto`), NUNCA el perfil de precios
 *   (privado); el precio se calcula al instanciar la propuesta con el perfil del workspace
 *   (`./instanciar-propuesta.ts`). Mismos topes que un presupuesto (`validarItems`);
 * - la categoría y la plantilla se buscan DENTRO del workspace: una de otro no existe.
 *
 * Nunca loguea datos personales.
 */

export const MENSAJES_PROPUESTA_MODELO = {
  sinPermiso: MENSAJES_PRESUPUESTO.sinPermisoAjustes,
  datosInvalidos: MENSAJES_PRESUPUESTO.datosInvalidos,
  categoria: "No encontramos esa categoría.",
  soloLista: "Los productos de la propuesta tienen que ser del catálogo.",
  conceptoInvalido: "Revisá el concepto calculado: le faltan las horas o el tipo de trabajo.",
  producto: MENSAJES_PRESUPUESTO.producto,
  sinPerfil: "Para que salga sola con conceptos calculados, primero cargá tu perfil en Configuración → Precios.",
  calculoSinPrecio: "Uno de los conceptos calculados no da precio con tu perfil actual: revisalo antes de activar el envío automático.",
  plantilla: "Elegí una plantilla de correo de tipo Presupuesto.",
  sinItems: "Para que salga sola, la propuesta necesita al menos un ítem.",
  sinPlantilla: "Para que salga sola, elegí la plantilla de correo con la que se envía.",
  texto: `Las condiciones pueden tener hasta ${MAX_TEXTO_VERSION} caracteres.`,
  noExiste: "Esa categoría no tiene propuesta modelo.",
  fallo: "No se pudo guardar la propuesta modelo.",
} as const;

export type PropuestaModelo = {
  categoriaId: string;
  items: ItemPresupuesto[];
  condiciones: string | null;
  enviarSola: boolean;
  plantillaId: string | null;
  actualizadaEn: Date;
};

export type ResumenPropuestaCategoria = {
  categoriaId: string;
  nombre: string;
  grupo: string;
  tienePropuesta: boolean;
  enviarSola: boolean;
  cantidadItems: number;
};

export type DatosPropuestaModelo = {
  categoriaId: unknown;
  items: unknown;
  condiciones?: unknown;
  enviarSola?: unknown;
  plantillaId?: unknown;
};

export type ResultadoPropuestaModelo = { ok: true } | { ok: false; error: string };

const no = (error: string): ResultadoPropuestaModelo => ({ ok: false, error });

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function falla(donde: string, error: unknown): void {
  const e = error as { code?: unknown } | null;
  console.error(`[presupuestos] ${donde} falló`, { codigo: typeof e?.code === "string" ? e.code : null });
}

/** Lo único que guarda un concepto calculado de la propuesta: el trabajo, sin el perfil. */
export type ConceptoDePropuesta = { entrada: { presupuesto: unknown } };

const CAMPOS_DEL_CONCEPTO = [
  "name", "itemType", "quantity", "coverageHours", "editingHours", "deliveryHours", "travelHours", "directCost",
  "supplierCost", "productionHours", "shippingCost", "outsourcedLaborCost", "managementHours", "expenseCost",
  "desiredMarginPercent",
] as const;

const objetoPlano = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const comoTexto = (v: unknown): string | undefined => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : undefined);

/**
 * El trabajo del concepto, armado con una lista blanca: sólo lo que lee `trabajoDesdeMotor`
 * (primer concepto, tipo de trabajo, horas con el cliente, precio manual). Nada de `perfil` ni
 * de otros campos. null si no hay un primer concepto que sea un objeto.
 */
function trabajoDelConcepto(calculo: unknown): unknown | null {
  if (!objetoPlano(calculo) || !objetoPlano(calculo.entrada)) return null;
  const presupuesto = calculo.entrada.presupuesto;
  if (!objetoPlano(presupuesto) || !Array.isArray(presupuesto.concepts)) return null;
  const c = presupuesto.concepts[0];
  if (!objetoPlano(c)) return null;
  const nombre = comoTexto(c.name);
  if (nombre === undefined || nombre.trim() === "") return null;
  if (!TIPOS_TRABAJO.some((t) => t.valor === c.itemType)) return null;
  const concepto: Record<string, string> = {};
  for (const k of CAMPOS_DEL_CONCEPTO) {
    const t = comoTexto(c[k]);
    if (t !== undefined) concepto[k] = t;
  }
  const client = objetoPlano(presupuesto.client) ? presupuesto.client : {};
  const horas = objetoPlano(client.hours) ? comoTexto(client.hours.salesHours) : undefined;
  const jobType = comoTexto(client.jobType);
  const chosenPrice = comoTexto(presupuesto.chosenPrice);
  return {
    client: { ...(jobType !== undefined ? { jobType } : {}), ...(horas !== undefined ? { hours: { salesHours: horas } } : {}) },
    ...(chosenPrice !== undefined ? { chosenPrice } : {}),
    concepts: [concepto],
  };
}

/**
 * PURO. Los ítems de una propuesta modelo: los de `validarItems` (topes, claves, números) y,
 * además, cada uno es un producto del catálogo a precio de lista (`productId`) o un concepto
 * calculado (sin producto, con su trabajo). Del concepto se descarta todo menos el trabajo.
 */
export function validarItemsDeModelo(raw: unknown): ResultadoValidacion<ItemPresupuesto[]> {
  const v = validarItems(raw);
  if (!v.ok) return v;
  const out: ItemPresupuesto[] = [];
  for (const it of v.valor) {
    if (it.modoPrecio === "LISTA") {
      if (it.productId === null) return { ok: false, error: MENSAJES_PROPUESTA_MODELO.soloLista };
      out.push({ ...it, calculo: null });
    } else if (it.modoPrecio === "CALCULO") {
      const presupuesto = it.productId === null ? trabajoDelConcepto(it.calculo) : null;
      if (presupuesto === null) return { ok: false, error: MENSAJES_PROPUESTA_MODELO.conceptoInvalido };
      // `calculo` está tipado como `InstantaneaCalculo`; acá guarda sólo `ConceptoDePropuesta`.
      const concepto: ConceptoDePropuesta = { entrada: { presupuesto } };
      out.push({ ...it, productId: null, precioUnitario: 0, calculo: concepto as unknown as ItemPresupuesto["calculo"] });
    } else {
      return { ok: false, error: MENSAJES_PROPUESTA_MODELO.soloLista };
    }
  }
  return { ok: true, valor: out };
}

function textoCondiciones(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (t.length > MAX_TEXTO_VERSION) return undefined;
  return t === "" ? null : t;
}

/** La categoría activa del workspace, o null. */
async function categoriaDelWorkspace(workspaceId: string, categoriaId: string): Promise<{ id: string } | null> {
  return prisma.fotofficeConsultaCategoria.findFirst({ where: { id: categoriaId, workspaceId, archivedAt: null }, select: { id: true } });
}

/** Una plantilla común de correo de PRESUPUESTO del workspace, sin archivar, o null. */
export async function plantillaDePropuesta(workspaceId: string, plantillaId: unknown): Promise<{ id: string } | null> {
  if (!idValido(plantillaId)) return null;
  return prisma.fotofficeMessageTemplate.findFirst({
    where: { id: plantillaId, workspaceId, channel: "EMAIL", entityType: "PRESUPUESTO", systemKey: null, archivedAt: null },
    select: { id: true },
  });
}

// --- Lectura -------------------------------------------------------------------------------------

/**
 * La propuesta modelo de una categoría (sin permisos: la usan la pantalla, ya con `configurar`, y
 * el envío automático, que es el sistema). Ítems guardados que ya no validan se descartan.
 */
export async function leerPropuestaModelo(workspaceId: string, categoriaId: string): Promise<PropuestaModelo | null> {
  if (!idValido(categoriaId)) return null;
  const f = await prisma.fotofficePropuestaModelo.findFirst({
    where: { workspaceId, categoryId: categoriaId },
    select: { categoryId: true, items: true, terms: true, autoSendOnWeb: true, templateId: true, updatedAt: true },
  });
  if (!f) return null;
  const items = validarItemsDeModelo(f.items);
  return {
    categoriaId: f.categoryId,
    items: items.ok ? items.valor : [],
    condiciones: f.terms,
    enviarSola: f.autoSendOnWeb,
    plantillaId: f.templateId,
    actualizadaEn: f.updatedAt,
  };
}

/** Categorías activas del workspace con su propuesta (sí o no). Sin `configurar`, null. */
export async function listarPropuestasModelo(ctx: CtxPresupuestos): Promise<ResumenPropuestaCategoria[] | null> {
  if (!puedeConfigurarPresupuestos(ctx)) return null;
  const { workspaceId } = ctx;
  const [categorias, propuestas] = await Promise.all([
    prisma.fotofficeConsultaCategoria.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, group: true },
      take: 500,
    }),
    prisma.fotofficePropuestaModelo.findMany({
      where: { workspaceId },
      select: { categoryId: true, items: true, autoSendOnWeb: true },
      take: 500,
    }),
  ]);
  const deCategoria = new Map(propuestas.map((p) => [p.categoryId, p]));
  return categorias.map((c) => {
    const p = deCategoria.get(c.id);
    return {
      categoriaId: c.id,
      nombre: c.name,
      grupo: c.group,
      tienePropuesta: p !== undefined,
      enviarSola: p?.autoSendOnWeb === true,
      cantidadItems: Array.isArray(p?.items) ? p.items.length : 0,
    };
  });
}

/** Plantillas de correo de PRESUPUESTO para elegir (siembra las iniciales una vez). */
export async function plantillasParaPropuesta(workspaceId: string): Promise<{ id: string; nombre: string }[]> {
  await asegurarPlantillasPresupuesto(workspaceId);
  const filas = await prisma.fotofficeMessageTemplate.findMany({
    where: { workspaceId, channel: "EMAIL", entityType: "PRESUPUESTO", systemKey: null, archivedAt: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
    take: 100,
  });
  return filas.map((f) => ({ id: f.id, nombre: f.name }));
}

// --- Escritura -----------------------------------------------------------------------------------

/** Guarda (crea o reemplaza) la propuesta modelo de una categoría. Exige `configurar`. */
export async function guardarPropuestaModelo(ctx: CtxPresupuestos, datos: DatosPropuestaModelo): Promise<ResultadoPropuestaModelo> {
  if (!puedeConfigurarPresupuestos(ctx)) return no(MENSAJES_PROPUESTA_MODELO.sinPermiso);
  if (!datos || typeof datos !== "object" || !idValido(datos.categoriaId)) return no(MENSAJES_PROPUESTA_MODELO.datosInvalidos);
  const { workspaceId } = ctx;
  const categoriaId = datos.categoriaId;

  const items = validarItemsDeModelo(datos.items);
  if (!items.ok) return no(items.error);
  const condiciones = textoCondiciones(datos.condiciones);
  if (condiciones === undefined) return no(MENSAJES_PROPUESTA_MODELO.texto);
  if (datos.enviarSola !== undefined && typeof datos.enviarSola !== "boolean") return no(MENSAJES_PROPUESTA_MODELO.datosInvalidos);
  const enviarSola = datos.enviarSola === true;

  if (!(await categoriaDelWorkspace(workspaceId, categoriaId))) return no(MENSAJES_PROPUESTA_MODELO.categoria);

  // Cada producto, activo y del MISMO workspace.
  const productIds = [...new Set(items.valor.map((i) => i.productId).filter((x): x is string => x !== null))];
  if (productIds.length > 0) {
    const encontrados = await prisma.product.findMany({
      where: { workspaceId, id: { in: productIds }, isActive: true },
      select: { id: true },
    });
    if (encontrados.length !== productIds.length) return no(MENSAJES_PROPUESTA_MODELO.producto);
  }

  // Si sale sola, los conceptos calculados tienen que dar precio de verdad (misma vía que al enviar).
  if (enviarSola && items.valor.length > 0) {
    const real = await itemsDeLaPropuesta(workspaceId, items.valor, new Date());
    if (!real.ok) {
      if (real.motivo === "SIN_PERFIL") return no(MENSAJES_PROPUESTA_MODELO.sinPerfil);
      if (real.motivo === "CALCULO") return no(MENSAJES_PROPUESTA_MODELO.calculoSinPrecio);
      return no(MENSAJES_PROPUESTA_MODELO.producto);
    }
  }

  let plantillaId: string | null = null;
  if (datos.plantillaId !== undefined && datos.plantillaId !== null && datos.plantillaId !== "") {
    const p = await plantillaDePropuesta(workspaceId, datos.plantillaId);
    if (!p) return no(MENSAJES_PROPUESTA_MODELO.plantilla);
    plantillaId = p.id;
  }
  if (enviarSola && items.valor.length === 0) return no(MENSAJES_PROPUESTA_MODELO.sinItems);
  if (enviarSola && plantillaId === null) return no(MENSAJES_PROPUESTA_MODELO.sinPlantilla);

  const valores = {
    items: items.valor as unknown as Prisma.InputJsonValue,
    terms: condiciones,
    autoSendOnWeb: enviarSola,
    templateId: plantillaId,
    updatedByUserId: ctx.userId,
  };
  try {
    try {
      await prisma.fotofficePropuestaModelo.upsert({
        where: { workspaceId_categoryId: { workspaceId, categoryId: categoriaId } },
        create: { workspaceId, categoryId: categoriaId, ...valores },
        update: valores,
        select: { id: true },
      });
    } catch (e) {
      // Dos pestañas guardaron la primera vez a la vez: el único frena a una; gana la última.
      if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
      await prisma.fotofficePropuestaModelo.updateMany({ where: { workspaceId, categoryId: categoriaId }, data: valores });
    }
  } catch (e) {
    falla("guardarPropuestaModelo", e);
    return no(MENSAJES_PROPUESTA_MODELO.fallo);
  }
  return { ok: true };
}

/** Borra la propuesta modelo de una categoría. Exige `configurar`. */
export async function borrarPropuestaModelo(ctx: CtxPresupuestos, categoriaId: unknown): Promise<ResultadoPropuestaModelo> {
  if (!puedeConfigurarPresupuestos(ctx)) return no(MENSAJES_PROPUESTA_MODELO.sinPermiso);
  if (!idValido(categoriaId)) return no(MENSAJES_PROPUESTA_MODELO.datosInvalidos);
  try {
    const r = await prisma.fotofficePropuestaModelo.deleteMany({ where: { workspaceId: ctx.workspaceId, categoryId: categoriaId } });
    return r.count > 0 ? { ok: true } : no(MENSAJES_PROPUESTA_MODELO.noExiste);
  } catch (e) {
    falla("borrarPropuestaModelo", e);
    return no(MENSAJES_PROPUESTA_MODELO.fallo);
  }
}
