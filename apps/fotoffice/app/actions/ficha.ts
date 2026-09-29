"use server";

import { revalidatePath } from "next/cache";
import { contextoDeFicha, type PersonaPedida } from "@/lib/ficha/acceso";
import { asegurarCategorias } from "@/lib/ficha/categorias";
import { borrarNota, crearNota, editarNota, fijarNota, type ResultadoNota } from "@/lib/ficha/notas";
import { buscarEtiquetas, ponerEtiqueta, quitarEtiqueta } from "@/lib/ficha/etiquetas";
import type { PersonaRef } from "@/lib/ficha/persona";
import { puede } from "@/lib/access/policy";
import {
  borrarAdjunto,
  confirmarSubida,
  enlaceDeDescarga,
  ERROR_SIN_PERMISO_RESTAURAR,
  pedirSubida,
  restaurarAdjunto,
} from "@/lib/ficha/adjuntos";
import { adjuntosR2Configurado } from "@/lib/ficha/adjuntos-r2";

export type EstadoFicha = ResultadoNota;

type Falla = { ok: false; error: string };

const SIN_ACCESO: Falla = { ok: false, error: "No tenés acceso a esta ficha." };
const DATOS_INVALIDOS: Falla = { ok: false, error: "Los datos no son válidos." };

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

// ---------------------------------------------------------------------------------------
// Adjuntos privados. Orden fijo: forma de los datos → contexto de la ficha (sesión,
// workspace, módulo, `operar`, persona del workspace) → bucket configurado → capacidad.
// Ninguna respuesta lleva la clave del objeto: sólo el id y enlaces firmados que vencen.

const ADJUNTOS_APAGADOS: Falla = { ok: false, error: "Los adjuntos todavía no están habilitados." };

export type SubidaPedida = { ok: true; id: string; url: string } | { ok: false; error: string };
export type EnlaceAdjunto = { ok: true; url: string } | { ok: false; error: string };

export async function pedirSubidaAction(
  persona: PersonaPedida,
  archivo: { nombre: string; tipo: string; tamano: number },
): Promise<SubidaPedida> {
  if (!personaValida(persona) || !archivo || typeof archivo !== "object") return DATOS_INVALIDOS;
  const { nombre, tipo, tamano } = archivo as Record<string, unknown>;
  if (typeof nombre !== "string" || nombre.length > 1000) return DATOS_INVALIDOS;
  if (typeof tipo !== "string" || tipo.length > 200) return DATOS_INVALIDOS;
  if (typeof tamano !== "number" || !Number.isFinite(tamano)) return DATOS_INVALIDOS;
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return SIN_ACCESO;
  if (!adjuntosR2Configurado()) return ADJUNTOS_APAGADOS;
  const r = await pedirSubida(ctx, ctx.persona, { nombre, tipo, tamano });
  return r.ok ? { ok: true, id: r.id, url: r.url } : r;
}

export async function confirmarSubidaAction(persona: PersonaPedida, adjuntoId: string): Promise<EstadoFicha> {
  if (!personaValida(persona) || !idValido(adjuntoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return SIN_ACCESO;
  if (!adjuntosR2Configurado()) return ADJUNTOS_APAGADOS;
  const r = await confirmarSubida(ctx, adjuntoId);
  if (r.ok) revalidarFicha(ctx.persona);
  return r;
}

export async function enlaceDeDescargaAction(persona: PersonaPedida, adjuntoId: string): Promise<EnlaceAdjunto> {
  if (!personaValida(persona) || !idValido(adjuntoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return SIN_ACCESO;
  if (!adjuntosR2Configurado()) return ADJUNTOS_APAGADOS;
  const r = await enlaceDeDescarga(ctx, adjuntoId);
  return r.ok ? { ok: true, url: r.url } : r;
}

export async function borrarAdjuntoAction(persona: PersonaPedida, adjuntoId: string): Promise<EstadoFicha> {
  if (!personaValida(persona) || !idValido(adjuntoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return SIN_ACCESO;
  if (!adjuntosR2Configurado()) return ADJUNTOS_APAGADOS;
  const r = await borrarAdjunto(ctx, adjuntoId);
  if (r.ok) revalidarFicha(ctx.persona);
  return r;
}

export async function restaurarAdjuntoAction(persona: PersonaPedida, adjuntoId: string): Promise<EstadoFicha> {
  if (!personaValida(persona) || !idValido(adjuntoId)) return DATOS_INVALIDOS;
  const ctx = await contextoDeFicha(persona);
  if (!ctx) return SIN_ACCESO;
  if (!adjuntosR2Configurado()) return ADJUNTOS_APAGADOS;
  if (!puede(ctx.role, "configurar")) return { ok: false, error: ERROR_SIN_PERMISO_RESTAURAR };
  const r = await restaurarAdjunto(ctx, adjuntoId);
  if (r.ok) revalidarFicha(ctx.persona);
  return r;
}
