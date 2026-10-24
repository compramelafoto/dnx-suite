import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/hidden-album-audit";
import {
  MosaicoError,
  asignarDesdeElColegio,
  corregirIntegrantesDesdeElColegio,
  cursoDelEnlace,
  resumenDelCurso,
} from "@/lib/mosaico/curso";
import { leerAccionDelColegio, resumenParaElColegio } from "@/lib/escolar-mosaico/resumen-para-el-colegio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El enlace sin cuenta del colegio para el «Mosaico del curso».
 * GET: lo que el colegio necesita ver (sin compras, familias ni URLs de R2).
 * POST: sólo «asignar» un retrato sin identificar o corregir maestra/directivos.
 */

const VENCIDO = "Este enlace venció o el curso ya se cerró. Pedile uno nuevo al fotógrafo.";
const MAX_BODY = 8 * 1024;
const SIN_CACHE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: SIN_CACHE });
}

function tokenDe(raw: string): string {
  return decodeURIComponent(String(raw || "")).trim().slice(0, 200);
}

function limitado(req: NextRequest, token: string, tipo: "get" | "post") {
  const ip = getClientIp(req);
  const porIp = checkRateLimit({ key: `mosaico-colegio:${tipo}:ip:${ip}`, limit: tipo === "get" ? 120 : 60, windowMs: 60_000 });
  const porToken = checkRateLimit({ key: `mosaico-colegio:${tipo}:tk:${token.slice(0, 16)}`, limit: tipo === "get" ? 240 : 120, windowMs: 60_000 });
  return !porIp.allowed || !porToken.allowed;
}

function respuestaDeError(err: unknown, donde: string) {
  if (err instanceof MosaicoError) return json({ error: err.message }, err.status);
  console.error(`[escolar/mosaico ${donde}]`, err);
  return json({ error: "No se pudo completar. Probá de nuevo en un rato." }, 500);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const token = tokenDe((await ctx.params).token);
  if (limitado(req, token, "get")) return json({ error: "Demasiados pedidos. Esperá un minuto." }, 429);
  try {
    const e = await cursoDelEnlace(prisma, token);
    if (!e) return json({ error: VENCIDO }, 410);
    const r = await resumenDelCurso(prisma, e.albumId, e.courseKey);
    return json(resumenParaElColegio(r));
  } catch (err) {
    return respuestaDeError(err, "GET");
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const token = tokenDe((await ctx.params).token);
  if (limitado(req, token, "post")) return json({ error: "Demasiados pedidos. Esperá un minuto." }, 429);

  const largo = Number(req.headers.get("content-length") ?? "0");
  if (largo > MAX_BODY) return json({ error: "Pedido demasiado grande." }, 413);
  let texto: string;
  try {
    texto = await req.text();
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }
  if (texto.length > MAX_BODY) return json({ error: "Pedido demasiado grande." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(texto);
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }
  const accion = leerAccionDelColegio(body);
  if (!accion) return json({ error: "Acción no válida." }, 400);

  try {
    if (accion.accion === "asignar") {
      await asignarDesdeElColegio(prisma, { token, photoId: accion.photoId, rosterEntryId: accion.rosterEntryId });
      return json({ ok: true });
    }
    // Un cargo vacío se queda con el que había: así ningún integrante se pierde y el orden no se corre.
    const e = await cursoDelEnlace(prisma, token);
    if (!e) return json({ error: VENCIDO }, 410);
    const actuales = (await resumenDelCurso(prisma, e.albumId, e.courseKey)).integrantes;
    const integrantes = actuales.map((a, i) => ({
      role: accion.integrantes[i]?.role || a.role,
      name: accion.integrantes[i]?.name ?? a.name,
    }));
    await corregirIntegrantesDesdeElColegio(prisma, { token, integrantes });
    return json({ ok: true });
  } catch (err) {
    return respuestaDeError(err, "POST");
  }
}
