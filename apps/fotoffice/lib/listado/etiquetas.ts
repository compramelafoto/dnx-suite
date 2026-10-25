import { etiquetaPeriodo } from "./periodos";
import type { ConsultaResuelta, DefinicionListado } from "./tipos";

export function etiquetasDeFiltro<F>(def: DefinicionListado<F>, r: ConsultaResuelta): { clave: string; texto: string }[] {
  const out: { clave: string; texto: string }[] = [];
  for (const f of def.filtros) {
    const v = r.filtros[f.clave];
    if (!v) continue;
    let texto: string | undefined;
    if (f.tipo === "opcion") texto = f.opciones.find((o) => o.valor === v)?.etiqueta;
    if (f.tipo === "relacion") texto = r.etiquetasRelacion[f.clave];
    if (f.tipo === "periodo") texto = etiquetaPeriodo(v);
    if (f.tipo === "siNo") texto = v === "si" ? f.si : f.no;
    if (texto) out.push({ clave: f.clave, texto: `${f.etiqueta}: ${texto}` });
  }
  return out;
}
