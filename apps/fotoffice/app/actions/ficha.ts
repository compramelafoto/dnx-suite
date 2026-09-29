"use server";

import { revalidatePath } from "next/cache";
import { contextoDeFicha, type PersonaPedida } from "@/lib/ficha/acceso";
import { asegurarCategorias } from "@/lib/ficha/categorias";
import { borrarNota, crearNota, editarNota, fijarNota, type ResultadoNota } from "@/lib/ficha/notas";
import { buscarEtiquetas, ponerEtiqueta, quitarEtiqueta } from "@/lib/ficha/etiquetas";
import type { PersonaRef } from "@/lib/ficha/persona";

export type EstadoFicha = ResultadoNota;

const SIN_ACCESO: EstadoFicha = { ok: false, error: "No tenés acceso a esta ficha." };
const DATOS_INVALIDOS: EstadoFicha = { ok: false, error: "Los datos no son válidos." };

function personaValida(p: unknown): p is PersonaPedida {
  if (!p || typeof p !== "object") return false;
  const { tipo, id } = p as Record<string, unknown>;
  return (tipo === "CLIENTE" || tipo === "SOCIO") && typeof id === "string" && id.length > 0 && id.length <= 100;
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 100;
}

/** Vuelve a pintar la ficha desde cualquiera de sus dos entradas. */
function revalidarFicha(persona: PersonaRef) {
  if (persona.clientId) revalidatePath(`/clientes/${persona.clientId}`);
  if (persona.memberId) revalidatePath(`/members/${persona.memberId}`);
}

export async function crearNotaAction(
  persona: PersonaPedida,
  datos: { body: string; categoryId: string },
): Promise<EstadoFicha> {
  if (!personaValida(persona) || !datos || typeof datos !== "object") return DATOS_INVALIDOS;
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return SIN_ACCESO;
  await asegurarCategorias(ctx.workspaceId, ctx.workspaceSlug);
  const r = await crearNota(ctx, { body: datos.body, categoryId: datos.categoryId });
  if (r.ok) revalidarFicha(ctx.persona);
  return r;
}

export async function editarNotaAction(
  persona: PersonaPedida,
  noteId: string,
  datos: { body: string; categoryId?: string },
): Promise<EstadoFicha> {
  if (!personaValida(persona) || !idValido(noteId) || !datos || typeof datos !== "object") return DATOS_INVALIDOS;
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return SIN_ACCESO;
  const r = await editarNota(ctx, noteId, { body: datos.body, categoryId: datos.categoryId });
  if (r.ok) revalidarFicha(ctx.persona);
  return r;
}

export async function borrarNotaAction(persona: PersonaPedida, noteId: string): Promise<EstadoFicha> {
  if (!personaValida(persona) || !idValido(noteId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return SIN_ACCESO;
  const r = await borrarNota(ctx, noteId);
  if (r.ok) revalidarFicha(ctx.persona);
  return r;
}

export async function fijarNotaAction(persona: PersonaPedida, noteId: string, fijar: boolean): Promise<EstadoFicha> {
  if (!personaValida(persona) || !idValido(noteId) || typeof fijar !== "boolean") return DATOS_INVALIDOS;
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return SIN_ACCESO;
  const r = await fijarNota(ctx, noteId, fijar);
  if (r.ok) revalidarFicha(ctx.persona);
  return r;
}

export async function ponerEtiquetaAction(
  persona: PersonaPedida,
  ref: { tagId: string } | { nombre: string },
): Promise<EstadoFicha> {
  if (!personaValida(persona) || !ref || typeof ref !== "object") return DATOS_INVALIDOS;
  const r = ref as Record<string, unknown>;
  const limpia = idValido(r.tagId)
    ? { tagId: r.tagId }
    : typeof r.nombre === "string" && r.nombre.length <= 200
      ? { nombre: r.nombre }
      : null;
  if (!limpia) return DATOS_INVALIDOS;
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return SIN_ACCESO;
  const res = await ponerEtiqueta(ctx, ctx.persona, limpia);
  if (res.ok) revalidarFicha(ctx.persona);
  return res;
}

export async function quitarEtiquetaAction(persona: PersonaPedida, tagId: string): Promise<EstadoFicha> {
  if (!personaValida(persona) || !idValido(tagId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return SIN_ACCESO;
  const res = await quitarEtiqueta(ctx, ctx.persona, tagId);
  if (res.ok) revalidarFicha(ctx.persona);
  return res;
}

/** Sugerencias al escribir: hasta 10, con al menos 1 carácter. Sin acceso, lista vacía. */
export async function buscarEtiquetasAction(
  persona: PersonaPedida,
  texto: string,
): Promise<{ id: string; name: string; color: string }[]> {
  if (!personaValida(persona) || typeof texto !== "string") return [];
  const t = texto.trim().slice(0, 40);
  if (t.length < 1) return [];
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return [];
  return buscarEtiquetas(ctx.workspaceId, t, 10);
}
