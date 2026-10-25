import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { cuerpoCaja, cuerpoOrden, cuerpoSucursal, idsExternos, leerOrden, validarSucursal, type DatosSucursal, type OrdenQr } from "./qr-mp";

/**
 * Llamadas a Mercado Pago para el QR del mostrador, con el token del negocio (Configuración →
 * Cobros). El token nunca sale del servidor y no se loguean datos del pago.
 */

const API = "https://api.mercadopago.com";

type Respuesta = { ok: boolean; status: number; json: Record<string, unknown> | null };

async function llamar(token: string, method: "GET" | "POST", path: string, body?: unknown, idempotente = false): Promise<Respuesta> {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(idempotente ? { "X-Idempotency-Key": randomUUID() } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) console.error("[ventas][qr-mp] Mercado Pago respondió", { path: path.replace(/\/[A-Z0-9]{20,}/g, "/…"), status: res.status, code: json?.code ?? json?.error ?? null });
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    console.error("[ventas][qr-mp] no se pudo llamar", { error: e instanceof Error ? e.name : "desconocido" });
    return { ok: false, status: 0, json: null };
  }
}

type Cobrador = { token: string; userId: string };

async function cobrador(workspaceId: string): Promise<{ ok: true; c: Cobrador } | { ok: false; error: string }> {
  const r = await resolveWorkspaceCollector(workspaceId);
  if (!r.ok) {
    return {
      ok: false,
      error:
        r.code === "NOT_CONNECTED" || r.code === "NO_CREDENTIAL"
          ? "Mercado Pago no está conectado. Se conecta en Configuración → Cobros."
          : "La conexión con Mercado Pago venció. Volvé a conectarla en Configuración → Cobros.",
    };
  }
  return { ok: true, c: { token: r.collector.accessToken, userId: r.collector.providerUserId } };
}

function mensajeMp(r: Respuesta, porDefecto: string): string {
  const m = r.json?.message ?? (Array.isArray(r.json?.errors) ? (r.json?.errors as Record<string, unknown>[])[0]?.message : null);
  return typeof m === "string" && m.trim() ? `${porDefecto} Mercado Pago dijo: «${m.trim().slice(0, 200)}».` : porDefecto;
}

export type QrMostrador = { activo: true; qrImage: string | null; qrPdf: string | null; createdAt: Date } | { activo: false };

export async function leerQrMostrador(workspaceId: string): Promise<QrMostrador> {
  const q = await prisma.fotofficeQrMostrador.findUnique({ where: { workspaceId }, select: { qrImage: true, qrPdf: true, createdAt: true } });
  return q ? { activo: true, ...q } : { activo: false };
}

function textoDe(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null;
}

/**
 * "Activar QR de mostrador": crea en Mercado Pago la sucursal y la caja del negocio y guarda el
 * QR. Si la sucursal ya existía (un intento anterior que falló a mitad), la reusa.
 */
export async function activarQrMostrador(workspaceId: string, userId: number, datos: DatosSucursal): Promise<{ ok: true } | { ok: false; error: string }> {
  const invalido = validarSucursal(datos);
  if (invalido) return { ok: false, error: invalido };
  const ya = await prisma.fotofficeQrMostrador.findUnique({ where: { workspaceId }, select: { id: true } });
  if (ya) return { ok: true };
  const co = await cobrador(workspaceId);
  if (!co.ok) return co;
  const { token, userId: mpUser } = co.c;
  const ids = idsExternos(workspaceId);

  // 1. La sucursal (o la que quedó de un intento anterior).
  let storeId: string | null = null;
  const s = await llamar(token, "POST", `/users/${encodeURIComponent(mpUser)}/stores`, cuerpoSucursal(datos, ids.sucursal));
  if (s.ok) storeId = textoDe(s.json?.id);
  else {
    const b = await llamar(token, "GET", `/users/${encodeURIComponent(mpUser)}/stores/search?external_id=${ids.sucursal}`);
    const resultados = (b.json?.results ?? []) as Record<string, unknown>[];
    storeId = Array.isArray(resultados) ? textoDe(resultados[0]?.id) : null;
    if (!storeId) return { ok: false, error: mensajeMp(s, "Mercado Pago no aceptó la sucursal. Revisá la dirección y las coordenadas.") };
  }
  if (!storeId) return { ok: false, error: "Mercado Pago no devolvió la sucursal." };

  // 2. La caja: primero la API nueva (/v2/pos) y, si no la acepta, la anterior (/pos).
  let caja = await llamar(token, "POST", "/v2/pos", cuerpoCaja(storeId, ids.sucursal, ids.caja), true);
  if (!caja.ok) {
    caja = await llamar(token, "POST", "/pos", {
      name: "Mostrador",
      fixed_amount: false,
      store_id: Number(storeId),
      external_store_id: ids.sucursal,
      external_id: ids.caja,
    });
  }
  if (!caja.ok) {
    // Una caja que ya existía con ese id externo (intento anterior): se busca.
    const b = await llamar(token, "GET", `/pos?external_id=${ids.caja}`);
    const r0 = ((b.json?.results ?? []) as Record<string, unknown>[])[0];
    if (!r0) return { ok: false, error: mensajeMp(caja, "Mercado Pago no aceptó la caja del mostrador.") };
    caja = { ok: true, status: 200, json: r0 };
  }
  const qr = (caja.json?.qr_response ?? caja.json?.qr ?? {}) as Record<string, unknown>;
  const posId = textoDe(caja.json?.id);
  if (!posId) return { ok: false, error: "Mercado Pago no devolvió la caja." };

  await prisma.fotofficeQrMostrador.create({
    data: {
      workspaceId,
      storeId,
      externalStoreId: ids.sucursal,
      posId,
      externalPosId: textoDe(caja.json?.external_id) ?? ids.caja,
      qrImage: textoDe(qr.image) ?? textoDe(qr.template_image),
      qrPdf: textoDe(qr.template_document),
      createdByUserId: userId,
    },
  });
  return { ok: true };
}

const ID_ORDEN = /^[A-Za-z0-9]{10,64}$/;

/** Cobrar con el QR: crea la order por el monto (cancelando la que el QR estuviera mostrando). */
export async function crearOrdenQr(workspaceId: string, montoMinor: number, descripcion: string): Promise<{ ok: true; ordenId: string } | { ok: false; error: string }> {
  if (!Number.isInteger(montoMinor) || montoMinor < 100) return { ok: false, error: "El monto mínimo para cobrar con QR es $ 1." };
  const q = await prisma.fotofficeQrMostrador.findUnique({ where: { workspaceId }, select: { externalPosId: true, ordenPendienteId: true } });
  if (!q) return { ok: false, error: "El QR del mostrador no está activado (Configuración → Cobros)." };
  const co = await cobrador(workspaceId);
  if (!co.ok) return co;
  if (q.ordenPendienteId) await llamar(co.c.token, "POST", `/v1/orders/${q.ordenPendienteId}/cancel`, undefined, true);

  const referencia = `mos-${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const r = await llamar(co.c.token, "POST", "/v1/orders", cuerpoOrden({ montoMinor, externalPosId: q.externalPosId, referencia, descripcion }), true);
  const orden = r.ok ? leerOrden(r.json) : null;
  if (!orden) return { ok: false, error: mensajeMp(r, "Mercado Pago no creó el cobro. Probá de nuevo o anotalo a mano.") };
  await prisma.fotofficeQrMostrador.update({ where: { workspaceId }, data: { ordenPendienteId: orden.id } });
  return { ok: true, ordenId: orden.id };
}

export async function consultarOrdenQr(workspaceId: string, ordenId: unknown): Promise<{ ok: true; orden: OrdenQr } | { ok: false; error: string }> {
  if (typeof ordenId !== "string" || !ID_ORDEN.test(ordenId)) return { ok: false, error: "Ese cobro no se entiende." };
  const co = await cobrador(workspaceId);
  if (!co.ok) return co;
  const r = await llamar(co.c.token, "GET", `/v1/orders/${ordenId}`);
  const orden = r.ok ? leerOrden(r.json) : null;
  if (!orden) return { ok: false, error: "Mercado Pago no respondió. Seguimos esperando…" };
  if (orden.estado !== "ESPERANDO") {
    await prisma.fotofficeQrMostrador.updateMany({ where: { workspaceId, ordenPendienteId: ordenId }, data: { ordenPendienteId: null } });
  }
  return { ok: true, orden };
}

export async function cancelarOrdenQr(workspaceId: string, ordenId: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof ordenId !== "string" || !ID_ORDEN.test(ordenId)) return { ok: false, error: "Ese cobro no se entiende." };
  const co = await cobrador(workspaceId);
  if (!co.ok) return co;
  const r = await llamar(co.c.token, "POST", `/v1/orders/${ordenId}/cancel`, undefined, true);
  await prisma.fotofficeQrMostrador.updateMany({ where: { workspaceId, ordenPendienteId: ordenId }, data: { ordenPendienteId: null } });
  if (r.ok || r.json?.code === "order_already_canceled") return { ok: true };
  if (r.status === 409) return { ok: false, error: "El cliente ya está pagando: esperá a que termine." };
  return { ok: false, error: mensajeMp(r, "No se pudo cancelar el cobro en Mercado Pago.") };
}
