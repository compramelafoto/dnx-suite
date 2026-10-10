import "server-only";
import { prisma } from "@repo/db";
import { escapeHtml } from "@/lib/communications/html";
import { sendTransactionalEmail, type OutboundEmail } from "@/lib/communications/send-email";
import { correoValido } from "@/lib/plantillas/contexto";
import { inicioDelDiaAR, type DepsEnvio } from "@/lib/plantillas/envio";
import { destinatarioDelPresupuesto } from "@/lib/presupuestos/avisos";
import { enviarCorreoGaleria } from "./correos";
import { registrarEventoSinFallar } from "./eventos";

/**
 * Lo que sale cuando un cliente envía su selección (etapa 7), siempre después de responderle (`after()`):
 *
 * 1. La confirmación al cliente (`GALERIA_SELECCION_ENVIADA`, plantilla automática con tope diario), si tiene correo.
 * 2. El aviso interno al responsable de la galería (o al dueño si ya no está en el equipo), con el enlace a la ficha.
 *
 * Cada resultado queda en el historial de la galería (sin datos personales). Nunca lanza.
 */

/** Avisos internos por día (de Buenos Aires) y organización. */
export const TOPE_AVISOS_ESTUDIO_DIA = 50;

export type DatosAviso = { workspaceId: string; galeriaId: string; galeriaClienteId: string; cantidad: number };
export type DepsAviso = DepsEnvio & { enviarInterno?: (m: OutboundEmail) => ReturnType<typeof sendTransactionalEmail>; appOrigin?: string };

export async function avisarSeleccionEnviada(d: DatosAviso, deps: DepsAviso = {}): Promise<{ cliente: string; estudio: string }> {
  const salida = { cliente: "ERROR", estudio: "ERROR" };
  try {
    const ahora = (deps.ahora ?? (() => new Date()))();
    const c = await prisma.fotofficeGaleriaCliente.findFirst({
      where: { id: d.galeriaClienteId, workspaceId: d.workspaceId, galeriaId: d.galeriaId },
      select: { id: true, name: true, email: true },
    });
    const g = await prisma.fotofficeGaleria.findFirst({
      where: { id: d.galeriaId, workspaceId: d.workspaceId },
      select: { id: true, number: true, name: true, ownerUserId: true },
    });
    if (!c || !g) return salida;

    // 1. Confirmación al cliente.
    if (c.email && correoValido(c.email)) {
      const r = await enviarCorreoGaleria(
        { workspaceId: d.workspaceId, clave: "GALERIA_SELECCION_ENVIADA", galeriaId: g.id, para: c.email, nombre: c.name, numero: g.number, nombreGaleria: g.name, cantidad: d.cantidad },
        deps,
      );
      salida.cliente = r;
      await registrarEventoSinFallar({
        workspaceId: d.workspaceId, galeriaId: g.id, galeriaClienteId: c.id,
        tipo: r === "ENVIADO" ? "CONFIRMACION_ENVIADA" : "CONFIRMACION_NO_ENVIADA",
        ...(r === "ENVIADO" ? {} : { data: { motivo: r } }),
      });
    } else {
      salida.cliente = "SIN_CORREO";
    }

    // 2. Aviso interno al estudio.
    salida.estudio = await avisarAlEstudio(d.workspaceId, g, c, d.cantidad, ahora, deps);
    await registrarEventoSinFallar({
      workspaceId: d.workspaceId, galeriaId: g.id, galeriaClienteId: c.id,
      tipo: salida.estudio === "ENVIADO" ? "AVISO_ESTUDIO_ENVIADO" : "AVISO_ESTUDIO_NO_ENVIADO",
      ...(salida.estudio === "ENVIADO" ? {} : { data: { motivo: salida.estudio === "TOPE" ? "TOPE" : salida.estudio === "SIN_DESTINATARIO" || salida.estudio === "SIN_CORREO" ? "SIN_CORREO" : "NO_ENVIADO" } }),
    });
    return salida;
  } catch (e) {
    console.error("[galerias] falló el aviso de la selección enviada", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return salida;
  }
}

async function avisarAlEstudio(
  workspaceId: string,
  g: { id: string; number: string; name: string; ownerUserId: number | null },
  c: { name: string },
  cantidad: number,
  ahora: Date,
  deps: DepsAviso,
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
    const fotos = cantidad === 1 ? "1 foto" : `${cantidad} fotos`;
    const lineas = ["Hola:", "", `${c.name} envió su selección de la galería ${g.number} (${g.name}): eligió ${fotos}.`, "Ya podés revisarla, ver sus comentarios y exportar los nombres de archivo.", ...(enlace ? ["", enlace] : [])];
    const html = lineas.map((l) => (l === "" ? "<br>" : l === enlace ? `<p><a href="${escapeHtml(l)}">Ver la galería</a></p>` : `<p>${escapeHtml(l)}</p>`)).join("");
    const enviar = deps.enviarInterno ?? ((m: OutboundEmail) => sendTransactionalEmail(m));
    const r = await enviar({ to: usuario!.email!, subject: `${c.name} envió su selección de ${g.name}`, html, text: lineas.join("\n") });
    return r.status === "SENT" ? "ENVIADO" : "NO_ENVIADO";
  } catch (e) {
    console.error("[galerias] falló el aviso interno", { codigo: (e as { code?: unknown } | null)?.code ?? "desconocido" });
    return "ERROR";
  }
}
