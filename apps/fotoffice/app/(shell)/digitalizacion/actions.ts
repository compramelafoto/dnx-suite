"use server";

import { revalidatePath } from "next/cache";
import { contextoDigitalizacion } from "@/lib/digitalizacion/contexto";
import * as G from "@/lib/digitalizacion/servidor/grabaciones";
import { validarCierre, validarLatido, validarNuevaGrabacion, validarPedidoParte } from "@/lib/digitalizacion/validar";

const SIN_PERMISO = { ok: false as const, error: "No tenés permiso para hacer esto.", definitivo: true };
const INVALIDO = { ok: false as const, error: "Los datos no son válidos.", definitivo: true };

export async function crearGrabacionAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const g = validarNuevaGrabacion(input);
  return g ? G.crearGrabacion(ctx, g) : INVALIDO;
}

export async function pedirParteAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const p = validarPedidoParte(input);
  return p ? G.pedirParte(ctx, p) : INVALIDO;
}

export async function confirmarParteAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const p = validarPedidoParte({ ...(input as object), bytes: 1 });
  return p ? G.confirmarParte(ctx, { grabacionId: p.grabacionId, tramo: p.tramo, indice: p.indice }) : INVALIDO;
}

export async function latidoAction(grabacionId: string, latido: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const l = validarLatido(latido);
  return l ? G.registrarLatido(ctx, grabacionId, l) : INVALIDO;
}

export async function cerrarGrabacionAction(grabacionId: string, cierre: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const c = validarCierre(cierre);
  if (!c) return INVALIDO;
  const r = await G.cerrarGrabacion(ctx, grabacionId, c);
  revalidatePath("/digitalizacion");
  return r;
}

export async function continuarGrabacionAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  return ctx ? G.continuarGrabacion(ctx, grabacionId) : SIN_PERMISO;
}

export async function terminarConLoGrabadoAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.terminarConLoGrabado(ctx, grabacionId);
  revalidatePath("/digitalizacion");
  return r;
}

export async function descartarGrabacionAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.descartarGrabacion(ctx, grabacionId);
  revalidatePath("/digitalizacion");
  return r;
}

export async function urlsDeLecturaAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("VIEW");
  return ctx ? G.urlsDeLectura(ctx, grabacionId) : SIN_PERMISO;
}

export async function buscarTrabajosAction(q: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  return G.buscarTrabajos(ctx, typeof q === "string" ? q : "");
}

export async function guardarEquipoAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  return ctx ? G.guardarEquipo(ctx, input) : SIN_PERMISO;
}

export async function guardarAjustesAction(minutos: number) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.guardarAjustes(ctx, minutos);
  revalidatePath("/digitalizacion");
  return r;
}
