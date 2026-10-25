import "server-only";
import { prisma } from "@repo/db";
import { MENSAJES_CONTRATO as M, puedeConfigurarContratos, puedeGestionarContratos, puedeVerContratos, type CtxContratos } from "./acceso";
import { MAX_CUERPO_CONTRATO, MAX_NOMBRE_CONTRATO, MAX_PLANTILLAS_CONTRATO } from "./constantes";
import { erroresDePlantilla } from "./muestra";

/**
 * Plantillas de contrato (`FotofficeContratoPlantilla`, Configuración → Contratos → Plantillas):
 * alta, edición, baja y lectura. Escribir exige `configurar`. Leer: quien configura ve todas; quien
 * sólo ve o gestiona contratos ve las activas (para elegir una al generar un contrato).
 */
export type PlantillaResumen = { id: string; name: string; isActive: boolean; order: number; updatedAt: Date };
export type PlantillaCompleta = PlantillaResumen & { body: string };

export type ResultadoPlantilla = { ok: true; id: string } | { ok: false; error: string };
export type ResultadoSimple = { ok: true } | { ok: false; error: string };

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function nombreLimpio(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= MAX_NOMBRE_CONTRATO ? t : null;
}

function cuerpoValido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r\n/g, "\n");
  return t.trim().length >= 1 && t.length <= MAX_CUERPO_CONTRATO ? t : null;
}

function ordenValido(v: unknown): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 9999 ? n : null;
}

function errorDeVariables(cuerpo: string): string | null {
  const errores = erroresDePlantilla(cuerpo);
  return errores ? `${M.plantillaVariables} ${errores.join(" ")}` : null;
}

const clave = (s: string) => s.trim().toLocaleLowerCase("es-AR");

function puedeLeer(ctx: CtxContratos): { todas: boolean } | null {
  if (puedeConfigurarContratos(ctx)) return { todas: true };
  if (puedeVerContratos(ctx) || puedeGestionarContratos(ctx)) return { todas: false };
  return null;
}

export async function listarPlantillas(ctx: CtxContratos): Promise<PlantillaResumen[]> {
  const alcance = puedeLeer(ctx);
  if (!alcance) return [];
  const filas = await prisma.fotofficeContratoPlantilla.findMany({
    where: { workspaceId: ctx.workspaceId, ...(alcance.todas ? {} : { isActive: true }) },
    select: { id: true, name: true, isActive: true, order: true, updatedAt: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return filas as PlantillaResumen[];
}

export async function leerPlantilla(ctx: CtxContratos, id: unknown): Promise<PlantillaCompleta | null> {
  const alcance = puedeLeer(ctx);
  if (!alcance || !idValido(id)) return null;
  const f = await prisma.fotofficeContratoPlantilla.findFirst({
    where: { id, workspaceId: ctx.workspaceId, ...(alcance.todas ? {} : { isActive: true }) },
    select: { id: true, name: true, isActive: true, order: true, updatedAt: true, body: true },
  });
  return (f as PlantillaCompleta | null) ?? null;
}

/** Alta. El texto se revisa contra las variables de contrato; nace activa y al final de la lista. */
export async function crearPlantilla(ctx: CtxContratos, datos: unknown): Promise<ResultadoPlantilla> {
  if (!puedeConfigurarContratos(ctx)) return { ok: false, error: M.sinPermiso };
  if (!datos || typeof datos !== "object") return { ok: false, error: M.datosInvalidos };
  const d = datos as Record<string, unknown>;
  const name = nombreLimpio(d.name);
  if (!name) return { ok: false, error: M.plantillaNombre };
  const body = cuerpoValido(d.body);
  if (!body) return { ok: false, error: M.plantillaCuerpo };
  const malas = errorDeVariables(body);
  if (malas) return { ok: false, error: malas };
  if (d.isActive !== undefined && typeof d.isActive !== "boolean") return { ok: false, error: M.datosInvalidos };
  try {
    const existentes = await prisma.fotofficeContratoPlantilla.findMany({ where: { workspaceId: ctx.workspaceId }, select: { name: true, order: true } });
    if (existentes.length >= MAX_PLANTILLAS_CONTRATO) return { ok: false, error: M.plantillaTope };
    if (existentes.some((e) => clave(e.name as string) === clave(name))) return { ok: false, error: M.plantillaRepetida };
    const orden = existentes.reduce((m, e) => Math.max(m, e.order as number), -1) + 1;
    const f = await prisma.fotofficeContratoPlantilla.create({
      data: { workspaceId: ctx.workspaceId, name, body, isActive: d.isActive !== false, order: orden },
      select: { id: true },
    });
    return { ok: true, id: f.id as string };
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "P2002") return { ok: false, error: M.plantillaRepetida };
    return { ok: false, error: M.guardar };
  }
}

/** Edita los datos que lleguen (nombre, texto, activa, orden). Los contratos ya generados no cambian. */
export async function editarPlantilla(ctx: CtxContratos, id: unknown, datos: unknown): Promise<ResultadoSimple> {
  if (!puedeConfigurarContratos(ctx)) return { ok: false, error: M.sinPermiso };
  if (!idValido(id) || !datos || typeof datos !== "object") return { ok: false, error: M.datosInvalidos };
  const d = datos as Record<string, unknown>;
  const cambios: { name?: string; body?: string; isActive?: boolean; order?: number } = {};
  if (d.name !== undefined) {
    const n = nombreLimpio(d.name);
    if (!n) return { ok: false, error: M.plantillaNombre };
    cambios.name = n;
  }
  if (d.body !== undefined) {
    const b = cuerpoValido(d.body);
    if (!b) return { ok: false, error: M.plantillaCuerpo };
    const malas = errorDeVariables(b);
    if (malas) return { ok: false, error: malas };
    cambios.body = b;
  }
  if (d.isActive !== undefined) {
    if (typeof d.isActive !== "boolean") return { ok: false, error: M.datosInvalidos };
    cambios.isActive = d.isActive;
  }
  if (d.order !== undefined) {
    const o = ordenValido(d.order);
    if (o === null) return { ok: false, error: M.plantillaOrden };
    cambios.order = o;
  }
  try {
    const actual = await prisma.fotofficeContratoPlantilla.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!actual) return { ok: false, error: M.plantillaNoExiste };
    if (cambios.name) {
      const otras = await prisma.fotofficeContratoPlantilla.findMany({ where: { workspaceId: ctx.workspaceId }, select: { id: true, name: true } });
      if (otras.some((o) => o.id !== id && clave(o.name as string) === clave(cambios.name!))) return { ok: false, error: M.plantillaRepetida };
    }
    await prisma.fotofficeContratoPlantilla.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: cambios });
    return { ok: true };
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "P2002") return { ok: false, error: M.plantillaRepetida };
    return { ok: false, error: M.guardar };
  }
}

/** Baja definitiva de la plantilla. Los contratos que salieron de ella conservan su texto (la FK queda en null). */
export async function eliminarPlantilla(ctx: CtxContratos, id: unknown): Promise<ResultadoSimple> {
  if (!puedeConfigurarContratos(ctx)) return { ok: false, error: M.sinPermiso };
  if (!idValido(id)) return { ok: false, error: M.datosInvalidos };
  const r = await prisma.fotofficeContratoPlantilla.deleteMany({ where: { id, workspaceId: ctx.workspaceId } });
  return r.count > 0 ? { ok: true } : { ok: false, error: M.plantillaNoExiste };
}
