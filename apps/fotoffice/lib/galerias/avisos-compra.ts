import "server-only";
import { prisma } from "@repo/db";
import { escapeHtml } from "@/lib/communications/html";
import { sendTransactionalEmail, type OutboundEmail } from "@/lib/communications/send-email";
import { decimalArsToMinor } from "@/lib/membership/money";
import { correoValido } from "@/lib/plantillas/contexto";
import { inicioDelDiaAR, type DepsEnvio } from "@/lib/plantillas/envio";
import { destinatarioDelPresupuesto } from "@/lib/presupuestos/avisos";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { TOPE_AVISOS_ESTUDIO_DIA, type DepsAviso } from "./avisos";
import { enviarCorreoGaleria } from "./correos";
import { hashDeToken, resolverClaveDeEnlace, tokenDeGaleriaCliente, urlDeGaleria } from "./enlace";
import { registrarEventoSinFallar } from "./eventos";
import { formatearCentavos } from "./precios";

/**
 * Lo que sale cuando se acredita el pago de unas fotos extra (etapa 7, Entrega A2), siempre después de
 * responderle a Mercado Pago o al cliente (`after()`):
 *
 * 1. La confirmación al cliente (`GALERIA_COMPRA_PAGADA`, plantilla automática con tope diario), si tiene correo,
 *    con la cantidad de fotos y el total.
 * 2. El aviso interno al responsable de la galería (o al dueño si ya no está en el equipo).
 *
 * También el aviso interno cuando llegó un pago que NO se pudo acreditar (importe menor, otra moneda). Cada
 * resultado queda en el historial de la galería (sin datos personales). Nunca lanza ni loguea datos personales.
 */

export type DatosAvisoCompra = {
  workspaceId: string;
  compraId: string;
  /** La compra quedó pagada pero no se anotó en Caja (apagada o sin cuenta). */
  sinCaja?: boolean;
  /** Alguna de las fotos ya estaba paga en otra compra: puede haber que devolver. */
  fotosRepetidas?: boolean;
};

type Fila = { id: string; number: string; name: string; ownerUserId: number | null };

async function avisoInterno(
  workspaceId: string,
  g: Fila,
  ahora: Date,
  deps: DepsAviso,
  texto: { asunto: string; lineas: string[] },
): Promise<"ENVIADO" | "NO_ENVIADO" | "SIN_DESTINATARIO" | "SIN_CORREO" | "TOPE" | "ERROR"> {
  try {
    const hoy = await prisma.fotofficeGaleriaEvento.count({
      where: { workspaceId, type: "AVISO_ESTUDIO_ENVIADO", createdAt: { gte: inicioDelDiaAR(ahora) } },
    });
    if (hoy >= TOPE_AVISOS_ESTUDIO_DIA) return "TOPE";
    const para = await destinatarioDelPresupuesto(workspaceId, g.ownerUserId);
    if (para === null) return "SIN_DESTINATARIO";
    const usuario = await prisma.user.findUnique({ where: { id: para }, select: { email: true } });
    if (!correoValido(usuario?.email)) return "SIN_CORREO";
    const origen = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
    const enlace = origen ? `${origen}/galerias/${encodeURIComponent(g.id)}` : null;
    const lineas = [...texto.lineas, ...(enlace ? ["", enlace] : [])];
    const html = lineas.map((l) => (l === "" ? "<br>" : l === enlace ? `<p><a href="${escapeHtml(l)}">Ver la galería</a></p>` : `<p>${escapeHtml(l)}</p>`)).join("");
    const enviar = deps.enviarInterno ?? ((m: OutboundEmail) => sendTransactionalEmail(m));
    const r = await enviar({ to: usuario!.email!, subject: texto.asunto, html, text: lineas.join("\n") });
    return r.status === "SENT" ? "ENVIADO" : "NO_ENVIADO";
  } catch (e) {
    console.error("[galerias] falló el aviso interno de la compra", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return "ERROR";
  }
}

const motivoDeAviso = (r: string) => (r === "TOPE" ? "TOPE" : r === "SIN_DESTINATARIO" || r === "SIN_CORREO" ? "SIN_CORREO" : "NO_ENVIADO");

/** El enlace personal del cliente, rearmado con la clave de los enlaces. null si no se puede (sin clave o hash que no coincide). */
async function enlaceDelCliente(workspaceId: string, c: { id: string; tokenIssuedAt: Date; tokenHash: string }, deps: DepsAviso & { clave?: string | null }): Promise<string | null> {
  try {
    const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
    if (!clave) return null;
    const token = tokenDeGaleriaCliente(c.id, c.tokenIssuedAt, clave);
    if (hashDeToken(token) !== c.tokenHash) return null;
    const sitio = await sitioDelWorkspace(workspaceId);
    if (!sitio) return null;
    const origen = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
    return urlDeGaleria({ customDomain: sitio.customDomain, appOrigin: origen, slug: sitio.slug, token });
  } catch {
    return null;
  }
}

export async function avisarCompraPagada(d: DatosAvisoCompra, deps: DepsAviso & { clave?: string | null } = {}): Promise<{ cliente: string; estudio: string }> {
  const salida = { cliente: "ERROR", estudio: "ERROR" };
  try {
    const ahora = (deps.ahora ?? (() => new Date()))();
    const compra = await prisma.fotofficeGaleriaCompra.findFirst({
      where: { id: d.compraId, workspaceId: d.workspaceId },
      select: { id: true, galeriaId: true, galeriaClienteId: true, extraCount: true, totalArs: true },
    });
    if (!compra) return salida;
    const [c, g] = await Promise.all([
      prisma.fotofficeGaleriaCliente.findFirst({
        where: { id: compra.galeriaClienteId, workspaceId: d.workspaceId, galeriaId: compra.galeriaId },
        select: { id: true, name: true, email: true, tokenIssuedAt: true, tokenHash: true },
      }),
      prisma.fotofficeGaleria.findFirst({ where: { id: compra.galeriaId, workspaceId: d.workspaceId }, select: { id: true, number: true, name: true, ownerUserId: true } }),
    ]);
    if (!c || !g) return salida;
    const total = formatearCentavos(decimalArsToMinor(compra.totalArs));
    const fotos = compra.extraCount === 1 ? "1 foto extra" : `${compra.extraCount} fotos extra`;

    // 1. Confirmación al cliente (con el enlace para volver a su galería).
    if (c.email && correoValido(c.email)) {
      const enlace = await enlaceDelCliente(d.workspaceId, c, deps);
      const r = await enviarCorreoGaleria(
        { workspaceId: d.workspaceId, clave: "GALERIA_COMPRA_PAGADA", galeriaId: g.id, para: c.email, nombre: c.name, numero: g.number, nombreGaleria: g.name, cantidad: compra.extraCount, total, enlace },
        deps,
      );
      salida.cliente = r;
      await registrarEventoSinFallar({
        workspaceId: d.workspaceId, galeriaId: g.id, galeriaClienteId: c.id,
        tipo: r === "ENVIADO" ? "CONFIRMACION_ENVIADA" : "CONFIRMACION_NO_ENVIADA",
        data: { compraId: compra.id, ...(r === "ENVIADO" ? {} : { motivo: r }) },
      });
    } else {
      salida.cliente = "SIN_CORREO";
    }

    // 2. Aviso interno al estudio.
    const lineas = [
      "Hola:",
      "",
      `${c.name} pagó ${fotos} de la galería ${g.number} (${g.name}) por ${total} con Mercado Pago.`,
      ...(d.sinCaja ? ["No se anotó en Caja (está apagada o no hay una cuenta donde depositar). Podés cargarlo a mano en Caja."] : []),
      ...(d.fotosRepetidas ? ["Llegó un pago por fotos que ya estaban pagas: revisá si corresponde devolverlo."] : []),
    ];
    salida.estudio = await avisoInterno(d.workspaceId, g, ahora, deps, { asunto: `${c.name} pagó fotos extra de ${g.name}`, lineas });
    await registrarEventoSinFallar({
      workspaceId: d.workspaceId, galeriaId: g.id, galeriaClienteId: c.id,
      tipo: salida.estudio === "ENVIADO" ? "AVISO_ESTUDIO_ENVIADO" : "AVISO_ESTUDIO_NO_ENVIADO",
      data: { compraId: compra.id, ...(salida.estudio === "ENVIADO" ? {} : { motivo: motivoDeAviso(salida.estudio) }) },
    });
    return salida;
  } catch (e) {
    console.error("[galerias] falló el aviso de la compra pagada", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return salida;
  }
}

export type DatosPagoNoAcreditado = {
  workspaceId: string;
  galeriaId: string;
  galeriaClienteId: string;
  compraId: string;
  motivo: "IMPORTE_MENOR" | "MONEDA";
  pagadoCents: number;
  totalCents: number;
};

/** Un pago aprobado que NO se pudo acreditar: aviso interno con los importes (el dinero entró y hay que resolverlo a mano). */
export async function avisarPagoNoAcreditado(d: DatosPagoNoAcreditado, deps: DepsEnvio & DepsAviso = {}): Promise<string> {
  try {
    const ahora = (deps.ahora ?? (() => new Date()))();
    const [c, g] = await Promise.all([
      prisma.fotofficeGaleriaCliente.findFirst({ where: { id: d.galeriaClienteId, workspaceId: d.workspaceId, galeriaId: d.galeriaId }, select: { id: true, name: true } }),
      prisma.fotofficeGaleria.findFirst({ where: { id: d.galeriaId, workspaceId: d.workspaceId }, select: { id: true, number: true, name: true, ownerUserId: true } }),
    ]);
    if (!c || !g) return "ERROR";
    const lineas = [
      "Hola:",
      "",
      d.motivo === "IMPORTE_MENOR"
        ? `${c.name} pagó ${formatearCentavos(d.pagadoCents)} con Mercado Pago por las fotos extra de la galería ${g.number} (${g.name}), pero el total de la compra era ${formatearCentavos(d.totalCents)}.`
        : `${c.name} pagó con Mercado Pago las fotos extra de la galería ${g.number} (${g.name}) en una moneda que no es pesos.`,
      "No acreditamos las fotos: el dinero entró en tu cuenta de Mercado Pago y tenés que resolverlo con el cliente (cobrar la diferencia o devolver el pago).",
    ];
    const r = await avisoInterno(d.workspaceId, g, ahora, deps, { asunto: `Pago de fotos extra sin acreditar en ${g.name}`, lineas });
    await registrarEventoSinFallar({
      workspaceId: d.workspaceId, galeriaId: g.id, galeriaClienteId: c.id,
      tipo: r === "ENVIADO" ? "AVISO_ESTUDIO_ENVIADO" : "AVISO_ESTUDIO_NO_ENVIADO",
      data: { compraId: d.compraId, ...(r === "ENVIADO" ? {} : { motivo: motivoDeAviso(r) }) },
    });
    return r;
  } catch (e) {
    console.error("[galerias] falló el aviso del pago sin acreditar", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return "ERROR";
  }
}

/** Llegó un segundo pago aprobado por una compra que ya estaba paga: aviso interno (no se crea otro movimiento de Caja). */
export async function avisarSegundoPago(d: { workspaceId: string; galeriaId: string; galeriaClienteId: string; compraId: string; pagadoCents: number }, deps: DepsEnvio & DepsAviso = {}): Promise<string> {
  try {
    const ahora = (deps.ahora ?? (() => new Date()))();
    const [c, g] = await Promise.all([
      prisma.fotofficeGaleriaCliente.findFirst({ where: { id: d.galeriaClienteId, workspaceId: d.workspaceId, galeriaId: d.galeriaId }, select: { id: true, name: true } }),
      prisma.fotofficeGaleria.findFirst({ where: { id: d.galeriaId, workspaceId: d.workspaceId }, select: { id: true, number: true, name: true, ownerUserId: true } }),
    ]);
    if (!c || !g) return "ERROR";
    const lineas = [
      "Hola:",
      "",
      `${c.name} hizo un pago de ${formatearCentavos(d.pagadoCents)} con Mercado Pago por las fotos extra de la galería ${g.number} (${g.name}), pero esa compra ya estaba paga.`,
      "Llegó un segundo pago por la misma compra: revisá si corresponde devolverlo.",
    ];
    const r = await avisoInterno(d.workspaceId, g, ahora, deps, { asunto: `Segundo pago de fotos extra en ${g.name}`, lineas });
    await registrarEventoSinFallar({
      workspaceId: d.workspaceId, galeriaId: g.id, galeriaClienteId: c.id,
      tipo: r === "ENVIADO" ? "AVISO_ESTUDIO_ENVIADO" : "AVISO_ESTUDIO_NO_ENVIADO",
      data: { compraId: d.compraId, ...(r === "ENVIADO" ? {} : { motivo: motivoDeAviso(r) }) },
    });
    return r;
  } catch (e) {
    console.error("[galerias] falló el aviso del segundo pago", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return "ERROR";
  }
}
