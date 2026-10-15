import { resolverPeriodo } from "./periodos";
import type { ConsultaListado, ConsultaResuelta, ContextoListado, DefinicionListado } from "./tipos";

export type PaginaListado<F> = { filas: F[]; total: number; pagina: number; paginas: number; desde: number; hasta: number };

export async function resolverConsulta<F>(
  def: DefinicionListado<F>,
  ctx: ContextoListado,
  consulta: ConsultaListado,
  hoyYmd: string,
): Promise<{ resuelta: ConsultaResuelta; descartados: string[] }> {
  const filtros = { ...consulta.filtros };
  const periodos: ConsultaResuelta["periodos"] = {};
  const etiquetasRelacion: Record<string, string> = {};
  const descartados: string[] = [];
  for (const f of def.filtros) {
    const valor = filtros[f.clave];
    if (!valor) continue;
    if (f.tipo === "periodo") {
      const rango = resolverPeriodo(valor, hoyYmd);
      if (rango) periodos[f.clave] = rango;
      else {
        delete filtros[f.clave];
        descartados.push(f.clave);
      }
    }
    if (f.tipo === "relacion") {
      const etiqueta = def.validarRelacion ? await def.validarRelacion(ctx, f.clave, valor) : null;
      if (etiqueta) etiquetasRelacion[f.clave] = etiqueta;
      else {
        delete filtros[f.clave];
        descartados.push(f.clave);
      }
    }
  }
  return { resuelta: { ...consulta, filtros, periodos, etiquetasRelacion }, descartados };
}

export async function ejecutarListado<F>(
  def: DefinicionListado<F>,
  ctx: ContextoListado,
  resuelta: ConsultaResuelta,
): Promise<PaginaListado<F>> {
  const total = await def.contar(ctx, resuelta);
  const paginas = Math.max(1, Math.ceil(total / resuelta.filas));
  const pagina = Math.min(resuelta.pagina, paginas);
  const skip = (pagina - 1) * resuelta.filas;
  const filas = total === 0 ? [] : await def.traer(ctx, { ...resuelta, pagina }, { skip, take: resuelta.filas });
  return {
    filas,
    total,
    pagina,
    paginas,
    desde: total === 0 ? 0 : skip + 1,
    hasta: total === 0 ? 0 : skip + filas.length,
  };
}
