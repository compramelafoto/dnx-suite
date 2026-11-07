"use server";

import { revalidatePath } from "next/cache";
import { quitarVinculo, vincularAlbum, type DestinoVinculo, type VinculoVista } from "@/lib/clf/vinculo";
import { contextoDePedidos } from "@/lib/pedidos/contexto";
import { contextoDeProyectos } from "@/lib/proyectos/contexto";

// Archivo "use server": sólo exporta funciones async. Cada acción, en este orden: revisa la forma de lo
// que llega, arma el contexto con "Gestionar" en el módulo del destino (Pedidos o Proyectos; el
// workspace sale de la sesión) y recién ahí escribe. Los ids se validan contra el workspace en `lib/clf`.

const SIN_ACCESO = { ok: false as const, error: "No tenés permiso para hacer esto." };
const INVALIDO = { ok: false as const, error: "Los datos no son válidos." };
const ID = /^[A-Za-z0-9_-]{1,64}$/;

function aDestino(v: unknown): DestinoVinculo | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.pedidoId === "string" && ID.test(o.pedidoId) && o.proyectoId === undefined) return { pedidoId: o.pedidoId };
  if (typeof o.proyectoId === "string" && ID.test(o.proyectoId) && o.pedidoId === undefined) return { proyectoId: o.proyectoId };
  return null;
}

async function contextoPara(destino: DestinoVinculo) {
  return "pedidoId" in destino ? contextoDePedidos("operar") : contextoDeProyectos("operar");
}

function rutaDe(destino: DestinoVinculo): string {
  return "pedidoId" in destino ? `/pedidos/${encodeURIComponent(destino.pedidoId)}` : `/proyectos/${encodeURIComponent(destino.proyectoId)}`;
}

export async function vincularAlbumClfAction(
  destino: unknown,
  texto: unknown,
): Promise<{ ok: true; vinculo: VinculoVista } | { ok: false; error: string }> {
  const d = aDestino(destino);
  if (!d || typeof texto !== "string" || texto.length > 2000) return INVALIDO;
  const ctx = await contextoPara(d);
  if (!ctx) return SIN_ACCESO;
  const r = await vincularAlbum(ctx.workspaceId, ctx.userId, d, texto);
  if (r.ok) revalidatePath(rutaDe(d));
  return r;
}

export async function quitarVinculoClfAction(destino: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const d = aDestino(destino);
  if (!d) return INVALIDO;
  const ctx = await contextoPara(d);
  if (!ctx) return SIN_ACCESO;
  const r = await quitarVinculo(ctx.workspaceId, d);
  if (r.ok) revalidatePath(rutaDe(d));
  return r.ok ? { ok: true } : r;
}
