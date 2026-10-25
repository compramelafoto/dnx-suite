import "server-only";
import { prisma } from "@repo/db";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { userDisplayNames } from "@/lib/cash/repository";
import { EQUIPO_MODULE_KEY, MARCA_PASE_OMITIDO } from "./constantes";
import { hoyArgentina } from "./fechas";
import { debeOfrecerPase } from "./pase";
import { fichaActivaDe } from "./repositorio";

export type PasePendiente = {
  shiftId: string;
  accountId: string;
  accountName: string;
  abiertoPor: string;
  openedAt: Date;
};

/**
 * Los turnos abiertos por otra persona que se le piden cerrar a quien entra a Caja. Vacío si el
 * módulo está apagado, si quien entra no tiene ficha activa (al dueño no se le pide) o si algo
 * falla: el pase nunca puede trabar la caja.
 */
export async function pasesPendientes(p: {
  workspaceId: string;
  userId: number;
  turnos: readonly { accountId: string; accountName: string; shiftId: string; openedAt: Date; openedByUserId: number | null }[];
}): Promise<PasePendiente[]> {
  try {
    const candidatos = p.turnos.filter((t) => t.openedByUserId !== null && t.openedByUserId !== p.userId);
    if (candidatos.length === 0) return [];
    if (!(await isModuleEnabledForWorkspace(p.workspaceId, EQUIPO_MODULE_KEY))) return [];
    const ficha = await fichaActivaDe(p.workspaceId, p.userId);
    if (!ficha) return [];
    const marca = await prisma.fotofficeEquipoMarca.findUnique({
      where: {
        workspaceId_userId_fecha_motivo: { workspaceId: p.workspaceId, userId: p.userId, fecha: hoyArgentina(), motivo: MARCA_PASE_OMITIDO },
      },
      select: { shiftId: true },
    });
    const pendientes = candidatos.filter((t) =>
      debeOfrecerPase({ abiertoPor: t.openedByUserId, usuarioId: p.userId, usuarioEnEquipo: true, omitido: marca?.shiftId === t.shiftId }),
    );
    if (pendientes.length === 0) return [];
    const nombres = await userDisplayNames(pendientes.map((t) => t.openedByUserId));
    return pendientes.map((t) => ({
      shiftId: t.shiftId,
      accountId: t.accountId,
      accountName: t.accountName,
      abiertoPor: (t.openedByUserId !== null ? nombres.get(t.openedByUserId) : null)?.split(" ")[0] ?? "otra persona",
      openedAt: t.openedAt,
    }));
  } catch (e) {
    console.error("[equipo] no se pudo revisar el pase de turno", e);
    return [];
  }
}
