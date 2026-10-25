"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { contextoPersonal } from "./acceso";
import { MARCA_PASE_OMITIDO } from "./constantes";
import { hoyArgentina } from "./fechas";
import { avisoDeSalidaAhora, cerrarAvisoDeSalida } from "./mensajes-servidor";

/**
 * Las acciones que usa cualquier persona del equipo (no el panel del dueño). Ninguna devuelve
 * un error a la pantalla: si algo falla, el aviso no aparece y la caja sigue igual.
 */

/** El texto del aviso de salida, si ya es la hora y corresponde; si no, null. */
export async function pedirAvisoSalidaAction(): Promise<string | null> {
  try {
    const ctx = await contextoPersonal();
    if (!ctx) return null;
    return await avisoDeSalidaAhora(ctx);
  } catch {
    return null;
  }
}

/** La cruz del aviso de salida: no vuelve a aparecer en el día. */
export async function cerrarAvisoSalidaAction(): Promise<void> {
  try {
    const ctx = await contextoPersonal();
    if (!ctx) return;
    await cerrarAvisoDeSalida(ctx);
  } catch {
    // Si no se pudo guardar, a lo sumo vuelve a aparecer al cambiar de pantalla.
  }
}

/**
 * "Seguir sin cerrar": la persona elige vender igual sin hacer el pase de turno. La venta cae
 * en el turno abierto, como siempre, y el día queda marcado para que lo revise el dueño.
 */
export async function omitirPaseAction(formData: FormData): Promise<void> {
  const ctx = await contextoPersonal();
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  if (ctx && shiftId) {
    try {
      const turno = await prisma.cashShift.findFirst({
        where: { id: shiftId, workspaceId: ctx.workspaceId, status: "ABIERTO" },
        select: { openedByUserId: true },
      });
      if (turno && turno.openedByUserId !== ctx.userId) {
        await prisma.fotofficeEquipoMarca.upsert({
          where: {
            workspaceId_userId_fecha_motivo: {
              workspaceId: ctx.workspaceId,
              userId: ctx.userId,
              fecha: hoyArgentina(),
              motivo: MARCA_PASE_OMITIDO,
            },
          },
          create: { workspaceId: ctx.workspaceId, userId: ctx.userId, fecha: hoyArgentina(), motivo: MARCA_PASE_OMITIDO, shiftId },
          update: { shiftId },
        });
      }
    } catch (e) {
      console.error("[equipo] no se pudo marcar el pase omitido", e);
    }
  }
  revalidatePath("/caja");
  redirect("/caja");
}
