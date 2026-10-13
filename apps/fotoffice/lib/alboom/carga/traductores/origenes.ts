import { DUDAS, MOTIVOS, porMapa } from "../campos";
import { campos, clave, entero, texto } from "../normalizar";
import type { Crudo, Decision, EntradaMapa } from "../tipos";

/**
 * Orígenes de oportunidad de Alboom (`settings.lead_origin`, una opción por línea; la extracción los guarda como
 * `{ name, posicion }` con el nombre como id) → `FotofficeOrigen`. Por nombre normalizado, sin duplicar los que ya
 * existen (aunque estén archivados: no se reactivan). Lo que falta se crea al final de la lista.
 */

export const TIPO_ORIGEN = "ORIGEN";
export const MAX_NOMBRE_ORIGEN = 100;

export type OrigenExistente = { id: string; name: string };

export type CtxOrigenes = {
  origenes: OrigenExistente[];
  /** Orden desde el que se agregan los nuevos (el mayor existente + 1). */
  ordenBase: number;
  mapa: Map<string, EntradaMapa>;
};

export function traducirOrigen(c: Crudo, ctx: CtxOrigenes): Decision {
  const ya = porMapa(c, ctx.mapa.get(c.alboomId), (id) => ctx.origenes.some((o) => o.id === id));
  if (ya) return ya;
  const p = campos(c.payload);
  const nombreCompleto = texto(p.name, 1000);
  if (!nombreCompleto) return { accion: "OMITIR", motivo: MOTIVOS.sinNombre };
  const name = nombreCompleto.slice(0, MAX_NOMBRE_ORIGEN).trim();
  const dudas = nombreCompleto.length > MAX_NOMBRE_ORIGEN ? [DUDAS.nombreLargo] : undefined;
  const mapa = ctx.mapa.get(c.alboomId);
  if (mapa) return { accion: "IGUAL", targetId: mapa.targetId, huellas: {} };
  const igual = ctx.origenes.find((o) => clave(o.name) === clave(name));
  if (igual) return { accion: "IGUAL", targetId: igual.id, vincula: true, huellas: {}, dudas };
  const posicion = entero(p.posicion) ?? 0;
  return { accion: "CREAR", datos: { name, order: ctx.ordenBase + Math.max(0, posicion) }, huellas: {}, dudas };
}

export function registrarOrigen(ctx: CtxOrigenes, d: Decision, targetId: string): void {
  if (d.accion === "CREAR" && typeof d.datos?.name === "string") ctx.origenes.push({ id: targetId, name: d.datos.name });
}
