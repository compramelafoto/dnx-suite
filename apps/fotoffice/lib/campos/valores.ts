import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import type { TipoRegistro } from "./constantes";
import { esTipoRegistroActivo, leerCampos, type CampoDefinido, type CtxCampos } from "./definiciones";
import { textoLegible, validarValor, type ValorCampo } from "./validacion";

/** Un valor tal como está guardado, en la forma de `validarValor`. */
export type ValorGuardado = ValorCampo;

export type ResultadoGuardado =
  | { ok: true }
  | { ok: false; error: string; errores?: Record<string, string> };

export const MENSAJES_VALORES = {
  sinPermiso: "No tenés permiso para hacer esto.",
  noEncontrado: "No encontramos ese registro.",
  revisar: "Revisá los campos marcados.",
  obligatorio: "Este dato es obligatorio.",
} as const;

/**
 * Si el registro es del workspace. Cliente → `client`, Socio → `member`, Consulta →
 * `serviceSalesLead`; siempre filtrando por `workspaceId`. Cualquier otro tipo: no.
 */
export async function registroDelWorkspace(workspaceId: string, entityType: string, entityId: string): Promise<boolean> {
  if (typeof entityId !== "string" || !entityId || entityId.length > 100) return false;
  const where = { id: entityId, workspaceId };
  switch (entityType) {
    case "CLIENTE":
      return (await prisma.client.findFirst({ where, select: { id: true } })) !== null;
    case "SOCIO":
      return (await prisma.member.findFirst({ where, select: { id: true } })) !== null;
    case "CONSULTA":
      return (await prisma.serviceSalesLead.findFirst({ where, select: { id: true } })) !== null;
    default:
      return false;
  }
}

type FilaValor = {
  id?: string;
  fieldId: string;
  entityId: string;
  valueText: string | null;
  valueNumber: unknown;
  valueDate: Date | null;
  valueBool: boolean | null;
  optionId: string | null;
};

/** Número guardado (Decimal de Prisma, string o number) como texto con punto y sin ceros sobrantes. */
function numeroDeFila(v: unknown): string {
  const n = validarValor("NUMERO", String(v), []);
  return n.ok && n.valor?.numero !== undefined ? n.valor.numero : String(v);
}

function valorDeFila(f: FilaValor): ValorGuardado | null {
  if (f.optionId !== null) return { opcionId: f.optionId };
  if (f.valueBool !== null) return { booleano: f.valueBool };
  if (f.valueDate !== null) return { fecha: f.valueDate.toISOString().slice(0, 10) };
  if (f.valueNumber !== null && f.valueNumber !== undefined) return { numero: numeroDeFila(f.valueNumber) };
  if (f.valueText !== null) return { texto: f.valueText };
  return null;
}

/** Columnas de la fila para un valor (las demás en null: un valor ocupa una sola). */
function columnasDe(v: ValorGuardado) {
  return {
    valueText: v.texto ?? null,
    valueNumber: v.numero ?? null,
    valueDate: v.fecha ? new Date(`${v.fecha}T00:00:00.000Z`) : null,
    valueBool: v.booleano ?? null,
    optionId: v.opcionId ?? null,
  };
}

function mismoValor(a: ValorGuardado | null, b: ValorGuardado | null): boolean {
  if (!a || !b) return a === b;
  return a.texto === b.texto && a.numero === b.numero && a.fecha === b.fecha && a.booleano === b.booleano && a.opcionId === b.opcionId;
}

const SELECT_VALOR = {
  id: true, fieldId: true, entityId: true, valueText: true, valueNumber: true, valueDate: true, valueBool: true, optionId: true,
} as const;

/**
 * Los valores de varios registros del mismo tipo, en una consulta: entityId → fieldId → valor.
 * Trae también los de campos archivados: quien muestra filtra por las definiciones activas.
 */
export async function valoresDe(
  workspaceId: string,
  entityType: TipoRegistro,
  ids: string[],
): Promise<Map<string, Map<string, ValorGuardado>>> {
  const salida = new Map<string, Map<string, ValorGuardado>>();
  const unicos = [...new Set(ids.filter((i) => typeof i === "string" && i.length > 0))];
  if (unicos.length === 0) return salida;
  const filas = (await prisma.fotofficeCustomValue.findMany({
    where: { workspaceId, entityType, entityId: { in: unicos } },
    select: SELECT_VALOR,
  })) as FilaValor[];
  for (const f of filas) {
    const v = valorDeFila(f);
    if (!v) continue;
    const delRegistro = salida.get(f.entityId) ?? new Map<string, ValorGuardado>();
    delRegistro.set(f.fieldId, v);
    salida.set(f.entityId, delRegistro);
  }
  return salida;
}

const legible = (c: CampoDefinido, v: ValorGuardado | null): string | null => textoLegible(c.type, v, c.etiquetas) || null;

function esChoque(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";
}

/**
 * Guarda los valores de "Más datos" de un registro. `entrada` es fieldId → valor crudo; sólo se
 * miran los campos activos del tipo que vienen en `entrada` (los demás quedan como están).
 * Valida todo antes de escribir; en una transacción guarda, borra los vaciados y deja una fila
 * de historial por campo que cambió, con antes y después legibles. Gana la última edición.
 */
export async function guardarValores(
  ctx: CtxCampos,
  entityType: unknown,
  entityId: string,
  entrada: Record<string, unknown>,
): Promise<ResultadoGuardado> {
  if (!puede(ctx.role, "operar")) return { ok: false, error: MENSAJES_VALORES.sinPermiso };
  if (!esTipoRegistroActivo(entityType) || !entrada || typeof entrada !== "object") {
    return { ok: false, error: MENSAJES_VALORES.noEncontrado };
  }
  if (!(await registroDelWorkspace(ctx.workspaceId, entityType, entityId))) {
    return { ok: false, error: MENSAJES_VALORES.noEncontrado };
  }

  const activos = await leerCampos(ctx.workspaceId, entityType);
  const campos = activos.filter((c) => Object.hasOwn(entrada, c.id));

  const actuales = await valoresDe(ctx.workspaceId, entityType, [entityId]);
  const delRegistro = actuales.get(entityId) ?? new Map<string, ValorGuardado>();

  const errores: Record<string, string> = {};
  // Un obligatorio que no vino (por ejemplo, marcado como obligatorio después de abrir el
  // formulario) se exige contra lo que el registro ya tiene guardado.
  for (const c of activos) {
    if (c.required && !Object.hasOwn(entrada, c.id) && !delRegistro.has(c.id)) errores[c.id] = MENSAJES_VALORES.obligatorio;
  }
  const nuevos = new Map<string, ValorGuardado | null>();
  for (const c of campos) {
    const actual = delRegistro.get(c.id) ?? null;
    // Una opción archivada sólo vale si ya era el valor del registro (no se elige de nuevo).
    const validas = c.opciones.map((o) => o.id);
    if (actual?.opcionId && !validas.includes(actual.opcionId)) validas.push(actual.opcionId);
    const r = validarValor(c.type, entrada[c.id], validas);
    if (!r.ok) errores[c.id] = r.error;
    else if (c.required && r.valor === null) errores[c.id] = MENSAJES_VALORES.obligatorio;
    else nuevos.set(c.id, r.valor);
  }
  if (Object.keys(errores).length > 0) return { ok: false, error: MENSAJES_VALORES.revisar, errores };
  if (campos.length === 0) return { ok: true };

  const escribir = () =>
    prisma.$transaction(async (tx) => {
      // Se relee adentro: el "antes" del historial es lo que había al escribir, no al validar.
      const filas = (await tx.fotofficeCustomValue.findMany({
        where: { workspaceId: ctx.workspaceId, entityType, entityId, fieldId: { in: campos.map((c) => c.id) } },
        select: SELECT_VALOR,
      })) as FilaValor[];
      const porCampo = new Map(filas.map((f) => [f.fieldId, f]));
      const cambios: { fieldId: string; before: string | null; after: string | null }[] = [];

      for (const c of campos) {
        const fila = porCampo.get(c.id);
        const antes = fila ? valorDeFila(fila) : null;
        const despues = nuevos.get(c.id) ?? null;
        if (mismoValor(antes, despues)) continue;
        if (!despues) {
          await tx.fotofficeCustomValue.deleteMany({ where: { workspaceId: ctx.workspaceId, fieldId: c.id, entityId } });
        } else if (fila) {
          await tx.fotofficeCustomValue.updateMany({
            where: { id: fila.id, workspaceId: ctx.workspaceId },
            data: { ...columnasDe(despues), updatedByUserId: ctx.userId },
          });
        } else {
          await tx.fotofficeCustomValue.create({
            data: {
              workspaceId: ctx.workspaceId, fieldId: c.id, entityType, entityId, ...columnasDe(despues),
              updatedByUserId: ctx.userId,
            },
            select: { id: true },
          });
        }
        cambios.push({ fieldId: c.id, before: legible(c, antes), after: legible(c, despues) });
      }

      if (cambios.length > 0) {
        await tx.fotofficeCustomValueChange.createMany({
          data: cambios.map((x) => ({
            workspaceId: ctx.workspaceId, entityType, entityId, ...x, actorUserId: ctx.userId, actorLabel: ctx.userLabel,
          })),
        });
      }
    });

  try {
    await escribir();
  } catch (e) {
    // Otra edición creó el mismo valor en el mismo instante: se repite una vez y gana la última.
    if (!esChoque(e)) throw e;
    await escribir();
  }
  return { ok: true };
}

export type CambioDeValor = {
  id: string;
  fieldId: string;
  /** Nombre actual del campo ("Campo borrado" si ya no existe). */
  campo: string;
  antes: string | null;
  despues: string | null;
  actorLabel: string | null;
  createdAt: Date;
};

/** Posición en el historial: la última fila mostrada. */
export type CursorDeCambios = { fecha: Date; id: string };

export type PaginaDeCambios = { cambios: CambioDeValor[]; siguiente: CursorDeCambios | null };

/**
 * Historial de un registro, del más nuevo al más viejo (en empate de fecha, id descendente).
 * `antesDe` es el cursor compuesto (fecha + id) de la última fila mostrada: las filas de un
 * mismo guardado comparten la fecha y no se pierden al cortar la página. `siguiente` es null
 * cuando no hay más.
 */
export async function cambiosDe(
  workspaceId: string,
  entityType: TipoRegistro,
  entityId: string,
  opciones: { antesDe?: CursorDeCambios; take: number },
): Promise<PaginaDeCambios> {
  const take = Math.min(Math.max(1, Math.floor(opciones.take) || 1), 200);
  const c = opciones.antesDe;
  const corte = c ? { OR: [{ createdAt: { lt: c.fecha } }, { createdAt: c.fecha, id: { lt: c.id } }] } : {};
  const leidas = await prisma.fotofficeCustomValueChange.findMany({
    where: { workspaceId, entityType, entityId, ...corte },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    select: { id: true, fieldId: true, before: true, after: true, actorLabel: true, createdAt: true },
  });
  const hayMas = leidas.length > take;
  const filas = leidas.slice(0, take);
  const ids = [...new Set(filas.map((f) => f.fieldId))];
  const nombres = ids.length
    ? await prisma.fotofficeCustomField.findMany({ where: { workspaceId, id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nombre = new Map(nombres.map((n) => [n.id, n.name]));
  const cambios = filas.map((f) => ({
    id: f.id,
    fieldId: f.fieldId,
    campo: nombre.get(f.fieldId) ?? "Campo borrado",
    antes: f.before,
    despues: f.after,
    actorLabel: f.actorLabel,
    createdAt: f.createdAt,
  }));
  const ultima = filas.at(-1);
  return { cambios, siguiente: hayMas && ultima ? { fecha: ultima.createdAt, id: ultima.id } : null };
}
