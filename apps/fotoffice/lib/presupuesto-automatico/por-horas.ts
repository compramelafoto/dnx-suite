import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { geocodingProvider } from "@/lib/geocode/nominatim";
import { MENSAJES_PRESUPUESTO, puedeConfigurarPresupuestos, type CtxPresupuestos } from "@/lib/presupuestos/acceso";
import { normalizarAjustesPorHoras, type AjustesPorHoras, type Punto } from "./por-horas-puro";

/**
 * Presupuesto por horas (spec 2026-10-28), servidor: ajustes del workspace
 * (`FotofficePresupuestoAutoAjustes.porHoras`) y lo de cada consulta (`ServiceSalesLead.metaJson.porHoras`:
 * horas que dijo el cliente y, al armar, km y traslado). Nunca loguea direcciones ni datos personales.
 */

export type ResultadoAjustesPorHoras = { ok: true } | { ok: false; error: string };

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function falla(donde: string, e: unknown): void {
  const codigo = (e as { code?: unknown } | null)?.code;
  if (codigo === "P2021" || codigo === "P2022") console.warn(`[presupuesto-por-horas] ${donde}: falta aplicar el SQL`);
  else console.error(`[presupuesto-por-horas] ${donde} falló`, { codigo: typeof codigo === "string" ? codigo : null });
}

/** Ante cualquier error (la columna todavía no existe), los ajustes por omisión: apagado. */
export async function leerAjustesPorHoras(workspaceId: string): Promise<AjustesPorHoras> {
  try {
    const f = (await prisma.fotofficePresupuestoAutoAjustes.findUnique({ where: { workspaceId }, select: { porHoras: true } })) as { porHoras: unknown } | null;
    return normalizarAjustesPorHoras(f?.porHoras ?? null);
  } catch (e) {
    falla("leerAjustesPorHoras", e);
    return normalizarAjustesPorHoras(null);
  }
}

/** Ubica una dirección o lugar en el mapa (Argentina). Nunca lanza. */
export async function geocodificarLugar(lugar: string | null | undefined): Promise<Punto | null> {
  const q = lugar?.trim();
  if (!q) return null;
  try {
    const [p] = await geocodingProvider().search(q, { limit: 1 });
    return p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) ? { lat: p.latitude, lon: p.longitude } : null;
  } catch {
    return null;
  }
}

export async function guardarAjustesPorHoras(
  ctx: CtxPresupuestos,
  valores: unknown,
  deps: { geocodificar?: (direccion: string) => Promise<Punto | null> } = {},
): Promise<ResultadoAjustesPorHoras> {
  if (!puedeConfigurarPresupuestos(ctx)) return { ok: false, error: MENSAJES_PRESUPUESTO.sinPermisoAjustes };
  if (!esObjeto(valores)) return { ok: false, error: MENSAJES_PRESUPUESTO.datosInvalidos };
  const previos = await leerAjustesPorHoras(ctx.workspaceId);
  const nuevos = normalizarAjustesPorHoras(valores);
  if (nuevos.partida.direccion === previos.partida.direccion && previos.partida.lat !== null) {
    nuevos.partida = previos.partida;
  } else {
    const punto = await (deps.geocodificar ?? geocodificarLugar)(nuevos.partida.direccion).catch(() => null);
    nuevos.partida = { direccion: nuevos.partida.direccion, lat: punto?.lat ?? null, lon: punto?.lon ?? null };
  }
  const porHoras = nuevos as unknown as Prisma.InputJsonObject;
  try {
    await prisma.fotofficePresupuestoAutoAjustes.upsert({
      where: { workspaceId: ctx.workspaceId },
      create: { workspaceId: ctx.workspaceId, porHoras, updatedByUserId: ctx.userId },
      update: { porHoras, updatedByUserId: ctx.userId },
      select: { id: true },
    });
    return { ok: true };
  } catch (e) {
    falla("guardarAjustesPorHoras", e);
    return { ok: false, error: "No se pudo guardar. ¿Ya se aplicó el SQL del presupuesto por horas?" };
  }
}

export type DatosPorHorasDeConsulta = { horas: number | null; km: number | null; traslado: number | null; ubicado: boolean; segundoFotografo: boolean };

const numeroONull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Lo guardado en la consulta. `null` si la consulta no existe o no tiene nada del presupuesto por horas. */
export async function leerPorHorasDeConsulta(workspaceId: string, leadId: string): Promise<DatosPorHorasDeConsulta | null> {
  const lead = (await prisma.serviceSalesLead.findFirst({ where: { id: leadId, workspaceId }, select: { metaJson: true } })) as { metaJson: unknown } | null;
  const d = esObjeto(lead?.metaJson) && esObjeto(lead.metaJson.porHoras) ? lead.metaJson.porHoras : null;
  if (!d) return null;
  return { horas: numeroONull(d.horas), km: numeroONull(d.km), traslado: numeroONull(d.traslado), ubicado: d.ubicado === true, segundoFotografo: d.segundoFotografo === true };
}

/** Suma datos a `metaJson.porHoras` sin pisar el resto de `metaJson`. */
export async function guardarPorHorasDeConsulta(workspaceId: string, leadId: string, datos: Partial<DatosPorHorasDeConsulta>): Promise<void> {
  const lead = (await prisma.serviceSalesLead.findFirst({ where: { id: leadId, workspaceId }, select: { metaJson: true } })) as { metaJson: unknown } | null;
  if (!lead) return;
  const meta = esObjeto(lead.metaJson) ? lead.metaJson : {};
  const previo = esObjeto(meta.porHoras) ? meta.porHoras : {};
  const metaJson = { ...meta, porHoras: { ...previo, ...datos } } as Prisma.InputJsonObject;
  await prisma.serviceSalesLead.updateMany({ where: { id: leadId, workspaceId }, data: { metaJson } });
}
