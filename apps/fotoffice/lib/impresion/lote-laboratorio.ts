/**
 * Preparar para laboratorio, del lado del editor: valores de las fotos nuevas, cambios en lote,
 * lo que se refleja en pantalla al guardar y el resumen del pie. Módulo PURO (sin servidor).
 */
import { mismaReceta } from "./lote";
import { cambiarModo, papelOrientado, propuestaAutomatica, type Papel } from "./encuadre";
import { calidadDeCopia, type AvisoCalidad } from "./geometria";
import { CANTIDAD_MAX_LAB, medidaEnMm, type OpcionesLab, type PapelLab, type PlazoLab } from "./laboratorio";
import type { Receta } from "./receta";

/** Lo que lleva cada foto (salvo la receta): medida, plazo, papel y copias. */
export type ValoresLab = { medida: string; plazo: PlazoLab; papel: PapelLab; cantidad: number };
/** Un cambio en lote: sólo lo que se elige cambiar. */
export type CambioLab = Partial<ValoresLab>;

export type PiezaLabVista = ValoresLab & { receta: Receta; revisada: boolean };
export type FotoLabVista = { originalId: string; nombre: string; ancho: number; alto: number; pieza: PiezaLabVista | null };
/** Lo que se le manda a `guardarPiezasLaboratorioAction`. */
export type PiezaLabAGuardar = ValoresLab & { originalId: string; receta: Receta; revisada: boolean };

export const TEXTO_PLAZO: Record<PlazoLab, string> = { MANANA: "para mañana", SEMANA: "próxima semana" };
export const TEXTO_PAPEL: Record<PapelLab, string> = { MATE: "mate", BRILLO: "brillo" };

export function acotarCantidadLab(n: number): number {
  const r = Math.round(n);
  return Number.isFinite(r) && r >= 1 ? Math.min(CANTIDAD_MAX_LAB, r) : 1;
}

/** El plazo que queda para una medida: el pedido si la medida lo ofrece; si no, «próxima semana» o el primero. */
export function plazoParaMedida(opciones: OpcionesLab, medida: string, pedido?: PlazoLab): PlazoLab | null {
  const op = opciones.medidas.find((m) => m.medida === medida);
  if (!op || op.plazos.length === 0) return null;
  if (pedido && op.plazos.includes(pedido)) return pedido;
  return op.plazos.includes("SEMANA") ? "SEMANA" : op.plazos[0]!;
}

/** «Para las fotos nuevas» al abrir: la primera medida, próxima semana si la ofrece, el primer papel, 1 copia. */
export function valoresIniciales(opciones: OpcionesLab): ValoresLab | null {
  const primera = opciones.medidas.find((m) => m.plazos.length > 0 && medidaEnMm(m.medida));
  const papel = opciones.papeles[0];
  if (!primera || !papel) return null;
  return { medida: primera.medida, plazo: plazoParaMedida(opciones, primera.medida)!, papel, cantidad: 1 };
}

/** El papel de una medida, con su nombre (lo que espera el editor de una foto). */
export function papelDeMedida(medida: string): (Papel & { nombre: string }) | null {
  const mm = medidaEnMm(medida);
  return mm ? { ...mm, nombre: medida } : null;
}

/** La pieza de una foto recién subida: los valores de las fotos nuevas y la propuesta automática para esa medida. */
export function piezaNueva(foto: { originalId: string; ancho: number; alto: number }, v: ValoresLab): PiezaLabAGuardar | null {
  const papel = medidaEnMm(v.medida);
  if (!papel) return null;
  return { originalId: foto.originalId, ...v, cantidad: acotarCantidadLab(v.cantidad), receta: propuestaAutomatica(foto.ancho, foto.alto, papel), revisada: false };
}

/** Las fotos que quedaron sin pieza (falló el guardado al subirlas): reciben los valores de las fotos nuevas. */
export function piezasFaltantes(fotos: FotoLabVista[], v: ValoresLab): PiezaLabAGuardar[] {
  return fotos.filter((f) => !f.pieza).flatMap((f) => piezaNueva(f, v) ?? []);
}

/**
 * La receta al cambiar de medida: la propuesta automática para la medida nueva, en el mismo modo
 * (recortar o encajar) que tenía y con sus ajustes de luz y color.
 */
export function recetaParaMedida(foto: { ancho: number; alto: number }, anterior: Receta, medida: string): Receta | null {
  const papel = medidaEnMm(medida);
  if (!papel) return null;
  const p = propuestaAutomatica(foto.ancho, foto.alto, papel);
  const r = cambiarModo(p, anterior.modo, { foto: { ancho: foto.ancho, alto: foto.alto }, papel });
  return { ...r, ajustes: { ...anterior.ajustes }, nitidez: anterior.nitidez };
}

/**
 * Lo que hay que guardar para aplicar un cambio a las fotos elegidas (o a todas si no hay
 * elegidas). Sólo devuelve las que cambian. Cambiar la medida rehace el recorte y saca «Revisada»;
 * si la medida nueva no ofrece el plazo, queda «próxima semana» (o el que tenga).
 */
export function cambiosLab(fotos: FotoLabVista[], elegidas: ReadonlySet<string>, cambio: CambioLab, opciones: OpcionesLab): PiezaLabAGuardar[] {
  const destino = elegidas.size > 0 ? fotos.filter((f) => elegidas.has(f.originalId)) : fotos;
  const out: PiezaLabAGuardar[] = [];
  for (const f of destino) {
    const p = f.pieza;
    if (!p) continue;
    const medida = cambio.medida ?? p.medida;
    const plazo = plazoParaMedida(opciones, medida, cambio.plazo ?? p.plazo);
    const papel = cambio.papel ?? p.papel;
    if (!plazo || !opciones.papeles.includes(papel)) continue;
    const cantidad = cambio.cantidad === undefined ? p.cantidad : acotarCantidadLab(cambio.cantidad);
    const otraMedida = medida !== p.medida;
    const receta = otraMedida ? recetaParaMedida(f, p.receta, medida) : p.receta;
    if (!receta) continue;
    if (!otraMedida && plazo === p.plazo && papel === p.papel && cantidad === p.cantidad) continue;
    out.push({ originalId: f.originalId, medida, plazo, papel, cantidad, receta, revisada: false });
  }
  return out;
}

/**
 * Refleja en pantalla lo que el servidor acaba de guardar, con su misma regla de «Revisada»: se
 * conserva si no cambiaron ni el recorte, ni la medida, ni el papel.
 */
export function aplicarGuardadoLab<F extends FotoLabVista>(fotos: F[], items: PiezaLabAGuardar[]): F[] {
  return fotos.map((f) => {
    const it = items.find((i) => i.originalId === f.originalId);
    if (!it) return f;
    const p = f.pieza;
    const misma = p !== null && p.medida === it.medida && p.papel === it.papel && mismaReceta(p.receta, it.receta);
    const revisada = it.revisada || (misma && (p?.revisada ?? false));
    return { ...f, pieza: { medida: it.medida, plazo: it.plazo, papel: it.papel, cantidad: it.cantidad, receta: it.receta, revisada } };
  });
}

/** El aviso de calidad de una foto en su medida («Pixelada», «algo blanda»). */
export function calidadLab(foto: { ancho: number; alto: number }, pieza: { medida: string; receta: Receta }): { ppp: number; aviso: AvisoCalidad } | null {
  const papel = medidaEnMm(pieza.medida);
  if (!papel) return null;
  return calidadDeCopia({ ancho: foto.ancho, alto: foto.alto }, pieza.receta, papelOrientado(papel, pieza.receta.orientacion ?? "VERTICAL"));
}

export type GrupoLab = { medida: string; papel: PapelLab; plazo: PlazoLab; fotos: number; copias: number };

/** El pie del editor: copias por «medida · papel · plazo», de la medida más chica a la más grande. */
export function resumenPorGrupo(fotos: FotoLabVista[], opciones: OpcionesLab): GrupoLab[] {
  const grupos = new Map<string, GrupoLab>();
  for (const f of fotos) {
    const p = f.pieza;
    if (!p) continue;
    const k = `${p.medida}|${p.papel}|${p.plazo}`;
    const g = grupos.get(k) ?? { medida: p.medida, papel: p.papel, plazo: p.plazo, fotos: 0, copias: 0 };
    g.fotos += 1;
    g.copias += p.cantidad;
    grupos.set(k, g);
  }
  const orden = (m: string) => {
    const i = opciones.medidas.findIndex((x) => x.medida === m);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const ordenPlazo: Record<PlazoLab, number> = { MANANA: 0, SEMANA: 1 };
  const ordenPapel: Record<PapelLab, number> = { MATE: 0, BRILLO: 1 };
  return [...grupos.values()].sort(
    (a, b) => orden(a.medida) - orden(b.medida) || a.medida.localeCompare(b.medida) || ordenPapel[a.papel] - ordenPapel[b.papel] || ordenPlazo[a.plazo] - ordenPlazo[b.plazo],
  );
}

/** «10x15 · mate · ×2 · próxima semana». */
export function textoDePieza(p: ValoresLab): string {
  return `${p.medida} · ${TEXTO_PAPEL[p.papel]} · ×${p.cantidad} · ${TEXTO_PLAZO[p.plazo]}`;
}
