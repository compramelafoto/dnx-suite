"use server";

import { after } from "next/server";
import { alFirmarContrato, firmar, MENSAJES_FIRMA, rechazar, solicitarCodigo, verificarCodigo } from "@/lib/contratos/firma";
import { workspaceDelSlug } from "@/lib/presupuestos/sitio";
import { visitanteDeAccion } from "./visitante";

/**
 * Acciones del enlace público de firma, sin sesión: el token es la llave y el workspace sale del slug de
 * la dirección (un token de otra organización no sirve). Cada una pasa por el freno por IP (en memoria,
 * por instancia) y después `lib/contratos/firma.ts` vuelve a resolver el token y aplica las reglas.
 */

const DEMASIADOS = "Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.";

type Salida<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

async function entrar(accion: string, tope: number, slug: unknown) {
  const v = await visitanteDeAccion(accion, tope);
  if (!v.permitido) return { ok: false, error: DEMASIADOS } as const;
  const workspaceId = await workspaceDelSlug(slug);
  if (!workspaceId) return { ok: false, error: MENSAJES_FIRMA.enlaceInvalido } as const;
  return { ok: true, workspaceId, v } as const;
}

export async function solicitarCodigoAction(slug: unknown, token: unknown, nombre: unknown, acepto: unknown): Promise<Salida<{ correo: string }>> {
  const e = await entrar("codigo", 10, slug);
  if (!e.ok) return e;
  const r = await solicitarCodigo(e.workspaceId, token, { nombre, acepto });
  return r.ok ? { ok: true, correo: r.correo } : r;
}

export async function verificarCodigoAction(slug: unknown, token: unknown, codigo: unknown): Promise<Salida> {
  const e = await entrar("verificar", 20, slug);
  if (!e.ok) return e;
  const r = await verificarCodigo(e.workspaceId, token, codigo);
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function firmarAction(slug: unknown, token: unknown, nombre: unknown, png: unknown): Promise<Salida> {
  const e = await entrar("firmar", 10, slug);
  if (!e.ok) return e;
  const r = await firmar(e.workspaceId, token, { nombre, png }, { ipHash: e.v.ipHash, userAgent: e.v.userAgent });
  if (!r.ok) return r;
  // El PDF (tarea 6) se arma después de responder, y sólo cuando firmaron todos.
  if (r.completo) after(() => alFirmarContrato(r.contratoId));
  return { ok: true };
}

export async function rechazarAction(slug: unknown, token: unknown, motivo: unknown): Promise<Salida> {
  const e = await entrar("rechazar", 10, slug);
  if (!e.ok) return e;
  return rechazar(e.workspaceId, token, motivo, { ipHash: e.v.ipHash, userAgent: e.v.userAgent });
}
