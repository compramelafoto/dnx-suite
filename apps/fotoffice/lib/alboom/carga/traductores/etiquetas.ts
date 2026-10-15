import { MOTIVOS, porMapa } from "../campos";
import { campos, claveEtiqueta, texto } from "../normalizar";
import type { Crudo, Decision, EntradaMapa } from "../tipos";

/**
 * Etiquetas de contactos de Alboom (`/tags?type=contacts`, guardadas como "contacts/<id>") → `FotofficeTag`
 * (el catálogo de etiquetas de personas). Por nombre sin mayúsculas ni acentos (`nameKey`): nunca se duplica.
 * La asignación a cada contacto la hace el traductor de contactos (Alboom guarda `tags` como texto en el contacto).
 *
 * Las de oportunidades ("leads/<id>") no tienen dónde ir todavía: se informan y se cargan en 8B-2.
 * Forma esperada: `{ tag }` o `{ name }` (doc 01 §13.5); si viniera una fila por asignación, se repiten nombres
 * y se fusionan acá.
 */

export const TIPO_ETIQUETA = "TAG";
export const MAX_NOMBRE_ETIQUETA = 40;

export type CtxEtiquetas = {
  etiquetas: { id: string; nameKey: string }[];
  mapa: Map<string, EntradaMapa>;
};

export function traducirEtiqueta(c: Crudo, ctx: CtxEtiquetas): Decision {
  if (!c.alboomId.startsWith("contacts/")) return { accion: "OMITIR", motivo: MOTIVOS.etiquetaDeOportunidad };
  const ya = porMapa(c, ctx.mapa.get(c.alboomId), (id) => ctx.etiquetas.some((e) => e.id === id));
  if (ya) return ya;
  const p = campos(c.payload);
  const name = texto(p.tag ?? p.name, 1000);
  if (!name) return { accion: "OMITIR", motivo: MOTIVOS.sinNombre };
  if (name.length > MAX_NOMBRE_ETIQUETA) return { accion: "OMITIR", motivo: MOTIVOS.etiquetaLarga };
  const mapa = ctx.mapa.get(c.alboomId);
  if (mapa) return { accion: "IGUAL", targetId: mapa.targetId, huellas: {} };
  const nameKey = claveEtiqueta(name);
  const existente = ctx.etiquetas.find((e) => e.nameKey === nameKey);
  if (existente) return { accion: "IGUAL", targetId: existente.id, vincula: true, huellas: {} };
  return { accion: "CREAR", datos: { name, nameKey }, huellas: {} };
}

export function registrarEtiqueta(ctx: CtxEtiquetas, d: Decision, targetId: string): void {
  if (d.accion === "CREAR" && typeof d.datos?.nameKey === "string") ctx.etiquetas.push({ id: targetId, nameKey: d.datos.nameKey });
}
