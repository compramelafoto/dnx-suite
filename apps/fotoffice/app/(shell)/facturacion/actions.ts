"use server";

import { redirect } from "next/navigation";
import { contextoFacturacion } from "@/lib/invoicing/access";
import { leerFormulario } from "@/lib/invoicing/borrador";
import type { ResultadoConciliacion, ResultadoEmision } from "@/lib/invoicing/emision";
import { parseArsToMinor } from "@/lib/membership/money";
import {
  anularConNotaDeCredito,
  conciliarComprobante,
  emitirComprobante,
  facturarPedido,
  facturarVenta,
} from "@/lib/invoicing/servicio";

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;

function ir(ruta: string, params: { ok?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (params.ok) q.set("ok", params.ok.slice(0, 400));
  if (params.error) q.set("error", params.error.slice(0, 600));
  redirect(`${ruta}${ruta.includes("?") ? "&" : "?"}${q.toString()}`);
}

async function contexto() {
  const c = await contextoFacturacion();
  if (!c || !c.puedeEmitir) ir("/facturacion", { error: "No tenés permiso para emitir comprobantes." });
  return c;
}

function campo(fd: FormData, n: string, max = 300): string {
  const v = fd.get(n);
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Lo que vuelve de ARCA, dicho para la persona. */
function mensajeEmision(e: ResultadoEmision | null): { ok?: string; error?: string } {
  if (!e) return { error: "No se pudo emitir." };
  switch (e.estado) {
    case "AUTORIZADA":
      return { ok: `ARCA autorizó el comprobante número ${e.numero} (CAE ${e.cae}).` };
    case "RECHAZADA":
      return { error: `ARCA rechazó el comprobante: ${e.mensajes.map((m) => (m.code ? `${m.code} ${m.msg}` : m.msg)).join(" · ")}` };
    case "PENDIENTE":
      return { error: `${e.detalle} El comprobante número ${e.numero} quedó esperando: en un par de minutos tocá «Conciliar» para saber si ARCA lo autorizó. Mientras tanto no se emite ningún otro.` };
    case "NO_ENVIADA":
      return { error: `${e.error} El comprobante quedó sin emitir; podés volver a intentar desde Facturación.` };
  }
}

function mensajeConciliacion(r: ResultadoConciliacion | { estado: "ERROR"; detalle: string }): { ok?: string; error?: string } {
  switch (r.estado) {
    case "AUTORIZADA":
      return { ok: `ARCA lo había autorizado: CAE ${r.cae}.` };
    case "BORRADOR":
      return { ok: "ARCA nunca lo autorizó. Quedó sin emitir: tocá «Emitir» para mandarlo de nuevo." };
    default:
      return { error: r.detalle };
  }
}

function formulario(fd: FormData) {
  return leerFormulario({
    anonimo: fd.get("anonimo") === "1",
    docTipo: campo(fd, "docTipo", 4),
    docNro: campo(fd, "docNro", 20),
    nombre: campo(fd, "nombre", 200),
    ivaCondition: campo(fd, "ivaCondition", 30),
    domicilio: campo(fd, "domicilio", 300),
    concepto: campo(fd, "concepto", 2),
    fecha: campo(fd, "fecha", 10),
    servDesde: campo(fd, "servDesde", 10),
    servHasta: campo(fd, "servHasta", 10),
    vtoPago: campo(fd, "vtoPago", 10),
  });
}

export async function facturarAction(fd: FormData) {
  const c = await contexto();
  const venta = campo(fd, "saleId", 64);
  const pedido = campo(fd, "pedidoId", 64);
  const volver = venta ? `/facturacion/nueva?venta=${encodeURIComponent(venta)}` : `/facturacion/nueva?pedido=${encodeURIComponent(pedido)}`;
  if ((!venta && !pedido) || (venta && !ID_VALIDO.test(venta)) || (pedido && !ID_VALIDO.test(pedido))) ir("/facturacion", { error: "Falta qué facturar." });
  const f = formulario(fd);
  if (!f.ok) ir(volver, { error: f.error });
  let r;
  if (venta) {
    r = await facturarVenta(c.ctx, venta, f.datos);
  } else {
    const monto = parseArsToMinor(campo(fd, "monto", 30));
    if (monto === null) ir(volver, { error: "El importe a facturar no es válido." });
    r = await facturarPedido(c.ctx, pedido, f.datos, monto, campo(fd, "descripcion", 500));
  }
  if (!r.ok) ir(volver, { error: r.error });
  ir("/facturacion", mensajeEmision(r.emision));
}

export async function emitirAction(fd: FormData) {
  const c = await contexto();
  const id = campo(fd, "id", 64);
  if (!ID_VALIDO.test(id)) ir("/facturacion", { error: "Comprobante inválido." });
  ir("/facturacion", mensajeEmision(await emitirComprobante(c.ctx, id)));
}

export async function conciliarAction(fd: FormData) {
  const c = await contexto();
  const id = campo(fd, "id", 64);
  if (!ID_VALIDO.test(id)) ir("/facturacion", { error: "Comprobante inválido." });
  ir("/facturacion", mensajeConciliacion(await conciliarComprobante(c.ctx, id)));
}

export async function anularAction(fd: FormData) {
  const c = await contexto();
  const id = campo(fd, "id", 64);
  if (!ID_VALIDO.test(id)) ir("/facturacion", { error: "Comprobante inválido." });
  if (fd.get("confirmo") !== "1") ir("/facturacion", { error: "Para anular hay que confirmar la casilla: se emite una nota de crédito en ARCA." });
  const r = await anularConNotaDeCredito(c.ctx, id, campo(fd, "motivo", 300));
  if (!r.ok) ir("/facturacion", { error: r.error });
  ir("/facturacion", mensajeEmision(r.emision));
}
