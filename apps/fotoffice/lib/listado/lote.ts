import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { registrarActividad } from "./actividad";
import { consultaSaneada, leerConsulta } from "./consulta";
import { resolverConsulta } from "./ejecutar";
import type { AccionLote, ContextoListado, DefinicionListado, ResultadoLote } from "./tipos";

export type Seleccion = { tipo: "ids"; ids: string[] } | { tipo: "todos"; query: string };

type Excluido = { id: string; motivo: string };

const OPCION_INVALIDA = "Elegí una opción válida.";

export async function resolverObjetivo<F>(
  def: DefinicionListado<F>,
  ctx: ContextoListado,
  seleccion: Seleccion,
  maximo: number,
  hoyYmd: string,
): Promise<{ ok: true; ids: string[] } | { ok: false; error: string }> {
  const demasiadas = { ok: false as const, error: `Son más de ${maximo}. Filtrá un poco más.` };
  if (seleccion.tipo === "ids") {
    const pedidos = Array.from(new Set(seleccion.ids));
    if (pedidos.length > maximo) return demasiadas;
    // Lo que vuelve de `traerPorIds` ya está filtrado por workspace: los ids ajenos desaparecen.
    const filas = await def.traerPorIds(ctx, pedidos);
    return { ok: true, ids: Array.from(new Set(filas.map((f) => def.idDe(f)))) };
  }
  const { consulta } = leerConsulta(def, new URLSearchParams(seleccion.query));
  const { resuelta } = await resolverConsulta(def, ctx, consulta, hoyYmd);
  const ids = await def.traerIds(ctx, resuelta, maximo + 1);
  return ids.length > maximo ? demasiadas : { ok: true, ids };
}

export type PreparacionLote =
  | { ok: true; cantidad: number; excluidos: Excluido[]; mensaje: string }
  | { ok: false; error: string };

async function calcular<F>(
  def: DefinicionListado<F>,
  accion: AccionLote,
  ctx: ContextoListado,
  seleccion: Seleccion,
  parametro: string | null,
  hoyYmd: string,
): Promise<(PreparacionLote & { ok: true; elegibles: string[] }) | { ok: false; error: string }> {
  let etiquetaParametro = "";
  if (accion.parametro) {
    const opciones = await accion.parametro.opciones(ctx);
    const elegida = opciones.find((o) => o.valor === parametro);
    if (!elegida) return { ok: false, error: OPCION_INVALIDA };
    etiquetaParametro = elegida.etiqueta;
  } else if (parametro !== null) {
    return { ok: false, error: OPCION_INVALIDA };
  }

  const objetivo = await resolverObjetivo(def, ctx, seleccion, accion.maximo, hoyYmd);
  if (!objetivo.ok) return objetivo;

  const { elegibles, excluidos } = accion.elegibles
    ? await accion.elegibles(ctx, objetivo.ids, parametro)
    : { elegibles: objetivo.ids, excluidos: [] as Excluido[] };

  const mensaje = accion.confirmacion.replaceAll("{n}", String(elegibles.length)).replaceAll("{parametro}", etiquetaParametro);
  return { ok: true, cantidad: elegibles.length, excluidos, mensaje, elegibles };
}

export async function prepararLote<F>(
  def: DefinicionListado<F>,
  accion: AccionLote,
  ctx: ContextoListado,
  seleccion: Seleccion,
  parametro: string | null,
  hoyYmd: string,
): Promise<PreparacionLote> {
  const c = await calcular(def, accion, ctx, seleccion, parametro, hoyYmd);
  if (!c.ok) return c;
  return { ok: true, cantidad: c.cantidad, excluidos: c.excluidos, mensaje: c.mensaje };
}

export type ResultadoAplicar =
  | { estado: "reconfirmar"; cantidad: number; excluidos: Excluido[]; mensaje: string }
  | { estado: "hecho"; resultado: ResultadoLote }
  | { estado: "error"; error: string };

export async function aplicarLote<F>(
  def: DefinicionListado<F>,
  accion: AccionLote,
  ctx: ContextoListado,
  seleccion: Seleccion,
  parametro: string | null,
  cantidadConfirmada: number,
  hoyYmd: string,
): Promise<ResultadoAplicar> {
  const p = await calcular(def, accion, ctx, seleccion, parametro, hoyYmd);
  if (!p.ok) return { estado: "error", error: p.error };
  if (p.cantidad === 0) return { estado: "error", error: "No hay filas para modificar." };
  if (p.cantidad !== cantidadConfirmada) {
    return { estado: "reconfirmar", cantidad: p.cantidad, excluidos: p.excluidos, mensaje: p.mensaje };
  }
  const resultado = await accion.aplicar(ctx, p.elegibles, parametro);
  await registrarActividad(prisma, {
    ctx,
    listKey: def.clave,
    kind: "BULK_ACTION",
    action: accion.clave,
    rowCount: resultado.aplicados,
    // Lo que entendió la lista, no el texto que mandó el navegador.
    query: seleccion.tipo === "todos" ? consultaSaneada(def, new URLSearchParams(seleccion.query)) : "",
    detail: {
      parametro,
      excluidos: p.excluidos,
      fallidos: resultado.fallidos,
      detalle: resultado.detalle,
    } as Prisma.InputJsonValue,
  });
  return { estado: "hecho", resultado };
}
