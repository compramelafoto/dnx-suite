"use server";

import { revalidatePath } from "next/cache";
import { contextoDeListado, exigirCapacidad } from "@/lib/listado/acceso";
import { aplicarLote, prepararLote, type PreparacionLote, type ResultadoAplicar, type Seleccion } from "@/lib/listado/lote";
import { hoyEnBuenosAires } from "@/lib/listado/periodos";
import { definicionDe, LISTAS } from "@/lib/listado/registro";
import type { Opcion } from "@/lib/listado/tipos";
import { borrarVista, crearVista, normalizarNombreVista, renombrarVista, sanearQuery } from "@/lib/listado/vistas";

type Estado = { error: string | null; ok?: boolean };

const SIN_ACCESO = { error: "No tenés acceso a esta lista." };
const VISTA_AJENA = { error: "No encontramos esa vista o no podés modificarla." };

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v : "";
}

export async function guardarVistaAction(_prev: Estado, formData: FormData): Promise<Estado> {
  const clave = texto(formData, "clave");
  const ctx = await contextoDeListado(clave);
  if (!ctx) return SIN_ACCESO;
  const def = await definicionDe(clave, ctx);
  if (!def) return SIN_ACCESO;

  const nombre = normalizarNombreVista(texto(formData, "nombre"));
  if (!nombre) return { error: "Poné un nombre de hasta 60 caracteres." };
  const compartida = texto(formData, "compartida") === "on";
  if (compartida && !exigirCapacidad(ctx, "configurar")) {
    return { error: "Sólo el dueño o un administrador pueden compartir vistas con el equipo." };
  }
  await crearVista(ctx, clave, nombre, sanearQuery(def, texto(formData, "query")), compartida);
  revalidatePath(LISTAS[clave].ruta);
  return { error: null, ok: true };
}

export async function renombrarVistaAction(_prev: Estado, formData: FormData): Promise<Estado> {
  const clave = texto(formData, "clave");
  const ctx = await contextoDeListado(clave);
  if (!ctx) return SIN_ACCESO;
  const nombre = normalizarNombreVista(texto(formData, "nombre"));
  if (!nombre) return { error: "Poné un nombre de hasta 60 caracteres." };
  if (!(await renombrarVista(ctx, texto(formData, "id"), nombre))) return VISTA_AJENA;
  revalidatePath(LISTAS[clave].ruta);
  return { error: null, ok: true };
}

export async function borrarVistaAction(_prev: Estado, formData: FormData): Promise<Estado> {
  const clave = texto(formData, "clave");
  const ctx = await contextoDeListado(clave);
  if (!ctx) return SIN_ACCESO;
  if (!(await borrarVista(ctx, texto(formData, "id")))) return VISTA_AJENA;
  revalidatePath(LISTAS[clave].ruta);
  return { error: null, ok: true };
}

type EntradaLote = { clave: string; accion: string; seleccion: Seleccion; parametro: string | null };

/** Los argumentos de una acción de servidor llegan de afuera: se revisa la forma antes de usarlos. */
function entradaLoteValida(e: unknown): e is EntradaLote {
  if (!e || typeof e !== "object") return false;
  const { clave, accion, seleccion, parametro } = e as Record<string, unknown>;
  if (typeof clave !== "string" || typeof accion !== "string") return false;
  if (parametro !== null && typeof parametro !== "string") return false;
  if (!seleccion || typeof seleccion !== "object") return false;
  const s = seleccion as Record<string, unknown>;
  if (s.tipo === "ids") return Array.isArray(s.ids) && s.ids.every((i) => typeof i === "string");
  return s.tipo === "todos" && typeof s.query === "string";
}

const ENTRADA_INVALIDA = { error: "No pudimos leer la solicitud." };

export async function prepararLoteAction(entrada: EntradaLote): Promise<PreparacionLote | { error: string }> {
  if (!entradaLoteValida(entrada)) return ENTRADA_INVALIDA;
  const ctx = await contextoDeListado(entrada.clave);
  if (!ctx) return SIN_ACCESO;
  const def = await definicionDe(entrada.clave, ctx);
  if (!def) return SIN_ACCESO;
  const accion = def.acciones.find((a) => a.clave === entrada.accion);
  if (!accion) return { error: "Acción desconocida." };
  if (!exigirCapacidad(ctx, accion.capacidad)) return { error: "No tenés permiso para esta acción." };
  return prepararLote(def, accion, ctx, entrada.seleccion, entrada.parametro, hoyEnBuenosAires());
}

export async function aplicarLoteAction(
  entrada: EntradaLote & { cantidadConfirmada: number },
): Promise<ResultadoAplicar | { error: string }> {
  if (!entradaLoteValida(entrada) || !Number.isInteger((entrada as { cantidadConfirmada: unknown }).cantidadConfirmada)) {
    return ENTRADA_INVALIDA;
  }
  const ctx = await contextoDeListado(entrada.clave);
  if (!ctx) return SIN_ACCESO;
  const def = await definicionDe(entrada.clave, ctx);
  if (!def) return SIN_ACCESO;
  const accion = def.acciones.find((a) => a.clave === entrada.accion);
  if (!accion) return { error: "Acción desconocida." };
  if (!exigirCapacidad(ctx, accion.capacidad)) return { error: "No tenés permiso para esta acción." };
  const r = await aplicarLote(def, accion, ctx, entrada.seleccion, entrada.parametro, entrada.cantidadConfirmada, hoyEnBuenosAires());
  if (r.estado === "hecho") revalidatePath(LISTAS[entrada.clave].ruta);
  return r;
}

const MAX_SUGERENCIAS = 20;

/** Sugerencias para un filtro de relación con buscador. Ante cualquier falta devuelve una lista vacía. */
export async function buscarOpcionesRelacionAction(clave: string, filtro: string, texto: string): Promise<Opcion[]> {
  if (typeof clave !== "string" || typeof filtro !== "string" || typeof texto !== "string") return [];
  const ctx = await contextoDeListado(clave);
  if (!ctx) return [];
  const def = await definicionDe(clave, ctx);
  if (!def?.buscarRelacion) return [];
  const declarado = def.filtros.find((f) => f.clave === filtro);
  if (!declarado || declarado.tipo !== "relacion" || !declarado.conBuscador) return [];
  const buscado = texto.trim().slice(0, 100);
  if (buscado.length < 2) return [];
  const opciones = await def.buscarRelacion(ctx, filtro, buscado);
  return opciones.slice(0, MAX_SUGERENCIAS).map((o) => ({ valor: o.valor, etiqueta: o.etiqueta }));
}
