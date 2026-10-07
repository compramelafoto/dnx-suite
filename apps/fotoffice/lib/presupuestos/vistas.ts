import "server-only";
import { prisma } from "@repo/db";
import { crearTareaDeConsulta, destinatarioDelPresupuesto, TITULO_TAREA_VISTO } from "./avisos";
import { pasarEstado } from "./presupuestos";
import type { EnlaceEncontrado } from "./publico";

/**
 * Cada apertura del enlace queda registrada (`FotofficePresupuestoVista`: versión, hora, IP con
 * hash y navegador; nunca la IP).
 *
 * La PRIMERA apertura de la versión vigente mientras el presupuesto está ENVIADO lo pasa a VISTO y
 * crea la tarea "Presupuesto visto" para el responsable. Las siguientes no tocan el estado (no hay
 * VISTO → VISTO). Dos aperturas a la vez: el cambio de estado es condicional (`pasarEstado`
 * escribe sólo si sigue ENVIADO), así que una sola gana y crea la tarea.
 *
 * Nunca lanza: una falla al registrar no puede impedir que el cliente vea su presupuesto.
 */
export async function registrarVista(
  enlace: EnlaceEncontrado,
  visita: { ipHash: string | null; userAgent: string | null },
  ahora: Date,
): Promise<{ registrada: boolean; primera: boolean }> {
  let registrada = false;
  try {
    await prisma.fotofficePresupuestoVista.create({
      data: { workspaceId: enlace.workspaceId, versionId: enlace.versionId, viewedAt: ahora, ipHash: visita.ipHash, userAgent: visita.userAgent },
      select: { id: true },
    });
    registrada = true;
  } catch (e) {
    console.error("[presupuestos] no se pudo registrar la vista", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
  }
  if (enlace.estado !== "ACTIVO" || enlace.estadoGuardado !== "ENVIADO") return { registrada, primera: false };
  try {
    const r = await pasarEstado(prisma, { workspaceId: enlace.workspaceId, presupuestoId: enlace.presupuestoId, a: "VISTO", ahora });
    if (!r.ok) return { registrada, primera: false };
    const para = await destinatarioDelPresupuesto(enlace.workspaceId, enlace.ownerUserId);
    await crearTareaDeConsulta(enlace.workspaceId, enlace.leadId, TITULO_TAREA_VISTO, para, ahora);
    return { registrada, primera: true };
  } catch (e) {
    console.error("[presupuestos] no se pudo marcar el presupuesto visto", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    return { registrada, primera: false };
  }
}
