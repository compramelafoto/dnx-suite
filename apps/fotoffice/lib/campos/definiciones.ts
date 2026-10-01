import "server-only";
import { cache } from "react";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import {
  MAX_CAMPOS, MAX_CLAVE, MAX_NOMBRE_CAMPO, TIPOS_CAMPO, TIPOS_REGISTRO_ACTIVOS,
  type TipoCampo, type TipoRegistro, type TipoRegistroActivo,
} from "./constantes";
import { claveDeCampo, validarNombreCampo } from "./validacion";

/** Quién configura. Las funciones de escritura exigen `configurar` adentro. */
export type CtxCampos = { workspaceId: string; userId: number; userLabel: string; role: string | null };

export type OpcionDeCampo = { id: string; label: string; order: number; archivedAt: Date | null };

export type CampoDefinido = {
  id: string;
  entityType: TipoRegistro;
  key: string;
  name: string;
  type: TipoCampo;
  required: boolean;
  showInList: boolean;
  order: number;
  archivedAt: Date | null;
  /** Opciones activas, por orden (sólo Lista). */
  opciones: OpcionDeCampo[];
  /** Etiqueta de TODAS las opciones, archivadas incluidas: un valor viejo se sigue leyendo. */
  etiquetas: Record<string, string>;
};

export type ResultadoCampos = { ok: true } | { ok: false; error: string };
export type ResultadoCreado = { ok: true; id: string } | { ok: false; error: string };

export const MAX_OPCIONES = 100;

export const MENSAJES_CAMPOS = {
  sinPermiso: "Sólo un administrador puede configurar los campos.",
  noEncontrado: "No encontramos ese campo.",
  opcionNoEncontrada: "No encontramos esa opción.",
  tipoRegistroInvalido: "Ese tipo de registro no admite campos.",
  tipoInvalido: "Elegí un tipo de campo válido.",
  tieneDatos: "Este campo tiene datos: archivalo.",
  tipoConDatos: "Este campo tiene datos: no se le puede cambiar el tipo. Creá uno nuevo.",
  noEsLista: "Sólo los campos de tipo Lista tienen opciones.",
  nombreOpcion: `Poné un nombre de hasta ${MAX_NOMBRE_CAMPO} caracteres para la opción.`,
  opcionRepetida: "Ya hay una opción con ese nombre.",
  muchasOpciones: `Una lista puede tener hasta ${MAX_OPCIONES} opciones.`,
  ordenDesactualizado: "La lista cambió mientras la ordenabas: recargá la página.",
  datosInvalidos: "Los datos no son válidos.",
} as const;

const no = (error: string) => ({ ok: false as const, error });

export function esTipoRegistroActivo(v: unknown): v is TipoRegistroActivo {
  return typeof v === "string" && (TIPOS_REGISTRO_ACTIVOS as readonly string[]).includes(v);
}
export function esTipoCampo(v: unknown): v is TipoCampo {
  return typeof v === "string" && (TIPOS_CAMPO as readonly string[]).includes(v);
}

function esChoque(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/** Cómo se nombra el tipo de registro en plural dentro de un mensaje (Socios con el vocabulario). */
async function pluralDe(workspaceId: string, entityType: TipoRegistroActivo): Promise<string> {
  if (entityType === "CLIENTE") return "clientes";
  if (entityType === "CONSULTA") return "consultas";
  return (await loadPersonVocabulary(workspaceId)).plural;
}

async function mensajeTope(workspaceId: string, entityType: TipoRegistroActivo): Promise<string> {
  return `Ya hay ${MAX_CAMPOS} campos activos para ${await pluralDe(workspaceId, entityType)}. Archivá alguno.`;
}

/** Nombre de opción limpio (espacios colapsados) o null. */
function limpiarEtiqueta(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= MAX_NOMBRE_CAMPO ? t : null;
}
const mismaEtiqueta = (a: string, b: string) =>
  a.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === b.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ─── Lectura ─────────────────────────────────────────────────────────────────

/** Sin caché: lo usan las escrituras, que necesitan lo último. */
export async function leerCampos(
  workspaceId: string,
  entityType: TipoRegistro,
  incluirArchivados = false,
): Promise<CampoDefinido[]> {
  const campos = await prisma.fotofficeCustomField.findMany({
    where: { workspaceId, entityType, ...(incluirArchivados ? {} : { archivedAt: null }) },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    take: 500,
    select: {
      id: true, entityType: true, key: true, name: true, type: true, required: true, showInList: true, order: true,
      archivedAt: true,
    },
  });
  const listas = campos.filter((c) => c.type === "LISTA").map((c) => c.id);
  const opciones = listas.length
    ? await prisma.fotofficeCustomFieldOption.findMany({
        where: { fieldId: { in: listas } },
        orderBy: [{ order: "asc" }, { id: "asc" }],
        select: { id: true, fieldId: true, label: true, order: true, archivedAt: true },
      })
    : [];
  return campos.map((c) => {
    const propias = opciones.filter((o) => o.fieldId === c.id);
    return {
      ...c,
      entityType: c.entityType as TipoRegistro,
      type: c.type as TipoCampo,
      opciones: propias
        .filter((o) => o.archivedAt === null)
        .map((o) => ({ id: o.id, label: o.label, order: o.order, archivedAt: o.archivedAt })),
      etiquetas: Object.fromEntries(propias.map((o) => [o.id, o.label])),
    };
  });
}

const leerCamposCacheado = cache(leerCampos);

/** Definiciones del tipo de registro, leídas una sola vez por pedido. */
export function listarCampos(
  workspaceId: string,
  entityType: TipoRegistro,
  opciones: { incluirArchivados?: boolean } = {},
): Promise<CampoDefinido[]> {
  return leerCamposCacheado(workspaceId, entityType, opciones.incluirArchivados === true);
}

/**
 * Cuántos valores guardados tiene cada campo (sólo los del workspace). Configuración lo usa para
 * ofrecer "Borrar" sólo a los campos sin datos; el borrado vuelve a verificarlo adentro.
 */
export async function contarValoresPorCampo(workspaceId: string, fieldIds: string[]): Promise<Record<string, number>> {
  if (fieldIds.length === 0) return {};
  const grupos = await prisma.fotofficeCustomValue.groupBy({
    by: ["fieldId"],
    where: { workspaceId, fieldId: { in: fieldIds } },
    _count: true,
  });
  return Object.fromEntries(grupos.map((g) => [g.fieldId, g._count as number]));
}

/** El campo, sólo si es del workspace. */
async function campoDelWorkspace(workspaceId: string, fieldId: unknown) {
  if (typeof fieldId !== "string" || !fieldId || fieldId.length > 100) return null;
  return prisma.fotofficeCustomField.findFirst({
    where: { id: fieldId, workspaceId },
    select: { id: true, entityType: true, type: true, archivedAt: true },
  });
}

async function tieneValores(workspaceId: string, fieldId: string): Promise<boolean> {
  return (await prisma.fotofficeCustomValue.count({ where: { workspaceId, fieldId } })) > 0;
}

async function activos(workspaceId: string, entityType: string): Promise<number> {
  return prisma.fotofficeCustomField.count({ where: { workspaceId, entityType, archivedAt: null } });
}

/** `base`, o `base_2`, `base_3`… la primera que no use otro campo del tipo (archivados incluidos). */
function claveLibre(base: string, usadas: Set<string>): string {
  if (!usadas.has(base)) return base;
  for (let n = 2; ; n++) {
    const sufijo = `_${n}`;
    const k = `${base.slice(0, MAX_CLAVE - sufijo.length).replace(/_+$/g, "")}${sufijo}`;
    if (!usadas.has(k)) return k;
  }
}

// ─── Campos ──────────────────────────────────────────────────────────────────

export type NuevoCampo = {
  nombre: unknown;
  tipo: unknown;
  obligatorio?: unknown;
  enListado?: unknown;
  /** Sólo Lista: opciones iniciales. */
  opciones?: unknown;
};

export async function crearCampo(ctx: CtxCampos, entityType: unknown, datos: NuevoCampo): Promise<ResultadoCreado> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_CAMPOS.sinPermiso);
  if (!esTipoRegistroActivo(entityType)) return no(MENSAJES_CAMPOS.tipoRegistroInvalido);
  const errorNombre = validarNombreCampo(datos?.nombre);
  if (errorNombre) return no(errorNombre);
  if (!esTipoCampo(datos.tipo)) return no(MENSAJES_CAMPOS.tipoInvalido);
  const nombre = (datos.nombre as string).trim();
  const tipo = datos.tipo;

  let etiquetas: string[] = [];
  if (tipo === "LISTA" && datos.opciones !== undefined) {
    if (!Array.isArray(datos.opciones)) return no(MENSAJES_CAMPOS.datosInvalidos);
    if (datos.opciones.length > MAX_OPCIONES) return no(MENSAJES_CAMPOS.muchasOpciones);
    for (const raw of datos.opciones) {
      const e = limpiarEtiqueta(raw);
      if (!e) return no(MENSAJES_CAMPOS.nombreOpcion);
      if (etiquetas.some((x) => mismaEtiqueta(x, e))) return no(MENSAJES_CAMPOS.opcionRepetida);
      etiquetas.push(e);
    }
  }
  if (tipo !== "LISTA") etiquetas = [];

  if ((await activos(ctx.workspaceId, entityType)) >= MAX_CAMPOS) return no(await mensajeTope(ctx.workspaceId, entityType));

  // Dos intentos: si otra pestaña tomó la misma clave en el mismo instante, el índice único frena
  // y se elige la siguiente.
  for (let intento = 0; intento < 2; intento++) {
    const existentes = await prisma.fotofficeCustomField.findMany({
      where: { workspaceId: ctx.workspaceId, entityType },
      select: { key: true, order: true },
    });
    const key = claveLibre(claveDeCampo(nombre), new Set(existentes.map((e) => e.key)));
    const order = existentes.reduce((m, e) => Math.max(m, e.order + 1), 0);
    try {
      const id = await prisma.$transaction(async (tx) => {
        const campo = await tx.fotofficeCustomField.create({
          data: {
            workspaceId: ctx.workspaceId, entityType, key, name: nombre, type: tipo,
            required: datos.obligatorio === true, showInList: datos.enListado === true, order,
          },
          select: { id: true },
        });
        if (etiquetas.length > 0) {
          await tx.fotofficeCustomFieldOption.createMany({
            data: etiquetas.map((label, i) => ({ fieldId: campo.id, label, order: i })),
          });
        }
        return campo.id;
      });
      return { ok: true, id };
    } catch (e) {
      if (!esChoque(e) || intento === 1) throw e;
    }
  }
  throw new Error("inalcanzable");
}

export type CambiosDeCampo = { nombre?: unknown; tipo?: unknown; obligatorio?: unknown; enListado?: unknown };

/** Nombre, tipo (sólo sin valores), obligatorio y "mostrar en el listado". La clave nunca cambia. */
export async function editarCampo(ctx: CtxCampos, fieldId: string, cambios: CambiosDeCampo): Promise<ResultadoCampos> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_CAMPOS.sinPermiso);
  if (!cambios || typeof cambios !== "object") return no(MENSAJES_CAMPOS.datosInvalidos);
  const campo = await campoDelWorkspace(ctx.workspaceId, fieldId);
  if (!campo) return no(MENSAJES_CAMPOS.noEncontrado);

  const data: { name?: string; type?: TipoCampo; required?: boolean; showInList?: boolean } = {};
  if (cambios.nombre !== undefined) {
    const error = validarNombreCampo(cambios.nombre);
    if (error) return no(error);
    data.name = (cambios.nombre as string).trim();
  }
  if (cambios.obligatorio !== undefined) {
    if (typeof cambios.obligatorio !== "boolean") return no(MENSAJES_CAMPOS.datosInvalidos);
    data.required = cambios.obligatorio;
  }
  if (cambios.enListado !== undefined) {
    if (typeof cambios.enListado !== "boolean") return no(MENSAJES_CAMPOS.datosInvalidos);
    data.showInList = cambios.enListado;
  }
  if (cambios.tipo !== undefined && cambios.tipo !== campo.type) {
    if (!esTipoCampo(cambios.tipo)) return no(MENSAJES_CAMPOS.tipoInvalido);
    // Aviso temprano sin abrir transacción; la verificación que vale es la de adentro.
    if (await tieneValores(ctx.workspaceId, campo.id)) return no(MENSAJES_CAMPOS.tipoConDatos);
    data.type = cambios.tipo;
  }
  if (Object.keys(data).length === 0) return { ok: true };
  return prisma.$transaction(async (tx) => {
    // Se vuelve a contar adentro: un valor guardado en el mismo instante no queda con otro tipo.
    if (data.type && (await tx.fotofficeCustomValue.count({ where: { workspaceId: ctx.workspaceId, fieldId: campo.id } })) > 0) {
      return no(MENSAJES_CAMPOS.tipoConDatos);
    }
    await tx.fotofficeCustomField.updateMany({ where: { id: campo.id, workspaceId: ctx.workspaceId }, data });
    return { ok: true as const };
  });
}

/** `ids` son los campos activos del tipo, en el orden nuevo (todos, sin repetir). */
export async function reordenarCampos(ctx: CtxCampos, entityType: unknown, ids: unknown): Promise<ResultadoCampos> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_CAMPOS.sinPermiso);
  if (!esTipoRegistroActivo(entityType)) return no(MENSAJES_CAMPOS.tipoRegistroInvalido);
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every((i) => typeof i === "string")) return no(MENSAJES_CAMPOS.datosInvalidos);
  const actuales = await prisma.fotofficeCustomField.findMany({
    where: { workspaceId: ctx.workspaceId, entityType, archivedAt: null },
    select: { id: true },
  });
  const set = new Set(actuales.map((a) => a.id));
  if (new Set(ids).size !== ids.length || ids.length !== set.size || !ids.every((i) => set.has(i))) {
    return no(MENSAJES_CAMPOS.ordenDesactualizado);
  }
  await prisma.$transaction(async (tx) => {
    for (const [i, id] of (ids as string[]).entries()) {
      await tx.fotofficeCustomField.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: { order: i } });
    }
  });
  return { ok: true };
}

/** Deja de verse en fichas y listados; los valores quedan guardados. */
export async function archivarCampo(ctx: CtxCampos, fieldId: string): Promise<ResultadoCampos> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_CAMPOS.sinPermiso);
  const campo = await campoDelWorkspace(ctx.workspaceId, fieldId);
  if (!campo) return no(MENSAJES_CAMPOS.noEncontrado);
  if (campo.archivedAt) return { ok: true };
  await prisma.fotofficeCustomField.updateMany({
    where: { id: campo.id, workspaceId: ctx.workspaceId },
    data: { archivedAt: new Date() },
  });
  return { ok: true };
}

/** Vuelve con sus valores, al final de la lista, si no se pasa el tope. */
export async function desarchivarCampo(ctx: CtxCampos, fieldId: string): Promise<ResultadoCampos> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_CAMPOS.sinPermiso);
  const campo = await campoDelWorkspace(ctx.workspaceId, fieldId);
  if (!campo) return no(MENSAJES_CAMPOS.noEncontrado);
  if (!campo.archivedAt) return { ok: true };
  const tipo = campo.entityType;
  if (esTipoRegistroActivo(tipo) && (await activos(ctx.workspaceId, tipo)) >= MAX_CAMPOS) {
    return no(await mensajeTope(ctx.workspaceId, tipo));
  }
  const ultimo = await prisma.fotofficeCustomField.findFirst({
    where: { workspaceId: ctx.workspaceId, entityType: tipo, archivedAt: null },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.fotofficeCustomField.updateMany({
    where: { id: campo.id, workspaceId: ctx.workspaceId },
    data: { archivedAt: null, order: (ultimo?.order ?? -1) + 1 },
  });
  return { ok: true };
}

/** Sólo sin valores; con valores se archiva. El historial de cambios queda. */
export async function borrarCampo(ctx: CtxCampos, fieldId: string): Promise<ResultadoCampos> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_CAMPOS.sinPermiso);
  const campo = await campoDelWorkspace(ctx.workspaceId, fieldId);
  if (!campo) return no(MENSAJES_CAMPOS.noEncontrado);
  const r = await prisma.$transaction(async (tx) => {
    // Adentro de la transacción: un valor guardado en el mismo instante no queda huérfano.
    if ((await tx.fotofficeCustomValue.count({ where: { workspaceId: ctx.workspaceId, fieldId: campo.id } })) > 0) {
      return no(MENSAJES_CAMPOS.tieneDatos);
    }
    await tx.fotofficeCustomFieldOption.deleteMany({ where: { fieldId: campo.id } });
    await tx.fotofficeCustomField.deleteMany({ where: { id: campo.id, workspaceId: ctx.workspaceId } });
    return { ok: true as const };
  });
  return r;
}

// ─── Opciones de Lista ───────────────────────────────────────────────────────

async function opcionDelWorkspace(workspaceId: string, optionId: unknown) {
  if (typeof optionId !== "string" || !optionId || optionId.length > 100) return null;
  return prisma.fotofficeCustomFieldOption.findFirst({
    where: { id: optionId, field: { workspaceId } },
    select: { id: true, fieldId: true, archivedAt: true },
  });
}

async function etiquetasActivas(fieldId: string, salvo?: string) {
  const filas = await prisma.fotofficeCustomFieldOption.findMany({
    where: { fieldId, archivedAt: null },
    select: { id: true, label: true, order: true },
  });
  return filas.filter((f) => f.id !== salvo);
}

export async function crearOpcion(ctx: CtxCampos, fieldId: string, label: unknown): Promise<ResultadoCreado> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_CAMPOS.sinPermiso);
  const campo = await campoDelWorkspace(ctx.workspaceId, fieldId);
  if (!campo) return no(MENSAJES_CAMPOS.noEncontrado);
  if (campo.type !== "LISTA") return no(MENSAJES_CAMPOS.noEsLista);
  const etiqueta = limpiarEtiqueta(label);
  if (!etiqueta) return no(MENSAJES_CAMPOS.nombreOpcion);
  const otras = await etiquetasActivas(campo.id);
  if (otras.length >= MAX_OPCIONES) return no(MENSAJES_CAMPOS.muchasOpciones);
  if (otras.some((o) => mismaEtiqueta(o.label, etiqueta))) return no(MENSAJES_CAMPOS.opcionRepetida);
  const ultima = await prisma.fotofficeCustomFieldOption.findFirst({
    where: { fieldId: campo.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const creada = await prisma.fotofficeCustomFieldOption.create({
    data: { fieldId: campo.id, label: etiqueta, order: (ultima?.order ?? -1) + 1 },
    select: { id: true },
  });
  return { ok: true, id: creada.id };
}

/** Renombrar no toca los valores: apuntan a la opción, no al texto. */
export async function renombrarOpcion(ctx: CtxCampos, optionId: string, label: unknown): Promise<ResultadoCampos> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_CAMPOS.sinPermiso);
  const opcion = await opcionDelWorkspace(ctx.workspaceId, optionId);
  if (!opcion) return no(MENSAJES_CAMPOS.opcionNoEncontrada);
  const etiqueta = limpiarEtiqueta(label);
  if (!etiqueta) return no(MENSAJES_CAMPOS.nombreOpcion);
  const otras = await etiquetasActivas(opcion.fieldId, opcion.id);
  if (otras.some((o) => mismaEtiqueta(o.label, etiqueta))) return no(MENSAJES_CAMPOS.opcionRepetida);
  await prisma.fotofficeCustomFieldOption.updateMany({
    where: { id: opcion.id, field: { workspaceId: ctx.workspaceId } },
    data: { label: etiqueta },
  });
  return { ok: true };
}

/** Una opción no se borra: se archiva. Los valores que la usan la siguen mostrando. */
export async function archivarOpcion(ctx: CtxCampos, optionId: string): Promise<ResultadoCampos> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_CAMPOS.sinPermiso);
  const opcion = await opcionDelWorkspace(ctx.workspaceId, optionId);
  if (!opcion) return no(MENSAJES_CAMPOS.opcionNoEncontrada);
  if (opcion.archivedAt) return { ok: true };
  await prisma.fotofficeCustomFieldOption.updateMany({
    where: { id: opcion.id, field: { workspaceId: ctx.workspaceId } },
    data: { archivedAt: new Date() },
  });
  return { ok: true };
}

/** `ids` son las opciones activas del campo, en el orden nuevo (todas, sin repetir). */
export async function reordenarOpciones(ctx: CtxCampos, fieldId: string, ids: unknown): Promise<ResultadoCampos> {
  if (!puede(ctx.role, "configurar")) return no(MENSAJES_CAMPOS.sinPermiso);
  const campo = await campoDelWorkspace(ctx.workspaceId, fieldId);
  if (!campo) return no(MENSAJES_CAMPOS.noEncontrado);
  if (!Array.isArray(ids) || ids.length > MAX_OPCIONES || !ids.every((i) => typeof i === "string")) {
    return no(MENSAJES_CAMPOS.datosInvalidos);
  }
  const set = new Set((await etiquetasActivas(campo.id)).map((o) => o.id));
  if (new Set(ids).size !== ids.length || ids.length !== set.size || !ids.every((i) => set.has(i))) {
    return no(MENSAJES_CAMPOS.ordenDesactualizado);
  }
  await prisma.$transaction(async (tx) => {
    for (const [i, id] of (ids as string[]).entries()) {
      await tx.fotofficeCustomFieldOption.updateMany({ where: { id, fieldId: campo.id }, data: { order: i } });
    }
  });
  return { ok: true };
}
