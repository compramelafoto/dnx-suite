import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { roomCodeFrom } from "@repo/muestras";

const INTENTOS = 3;
const esChoqueUnico = (err: unknown) => typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002";

/** Un código de sala nuevo (muestreo por rechazo; con 24 bytes casi nunca hace falta otra vuelta). */
export function nuevoCodigoDeSala(azar: (n: number) => Uint8Array = randomBytes): string {
  for (;;) {
    const c = roomCodeFrom(azar(24));
    if (c) return c;
  }
}

/**
 * Los códigos de sala de estas obras (spec D29), creando los que falten. Es estable: bajar las
 * fichas dos veces da los mismos QR. Si un código nuevo choca con otro (`skipDuplicates` lo saltea
 * en silencio, o el índice único avisa con P2002 en una carrera), se vuelve a intentar hasta 3 veces.
 */
export async function asegurarCodigosDeSala(activityId: string, workIds: readonly string[]): Promise<Map<string, string>> {
  const ids = [...new Set(workIds)];
  let mapa = new Map<string, string>();
  for (let intento = 0; intento <= INTENTOS; intento++) {
    const existentes = await prisma.culturalActivityRoomCode.findMany({
      where: { activityId, workId: { in: ids } },
      select: { code: true, workId: true },
    });
    mapa = new Map(existentes.map((e) => [e.workId, e.code]));
    const faltan = ids.filter((w) => !mapa.has(w));
    if (faltan.length === 0 || intento === INTENTOS) break;
    try {
      await prisma.culturalActivityRoomCode.createMany({
        data: faltan.map((workId) => ({ code: nuevoCodigoDeSala(), activityId, workId })),
        skipDuplicates: true,
      });
    } catch (err) {
      if (!esChoqueUnico(err)) throw err;
    }
  }
  if (ids.some((w) => !mapa.has(w))) throw new Error("No pudimos generar los códigos de sala.");
  return mapa;
}
