import { prisma } from "@repo/db";
import { normalizeGearSerial } from "@repo/gear/serial";
import { avisarAlAdmin } from "@/lib/aviso-admin";
import { urlBaseDeLaApp } from "@/lib/sesion";

/** Consultas por usuario cada 24 horas (se cuentan en la base, no en memoria). */
export const MAX_CONSULTAS_POR_DIA = 30;

/**
 * El resultado nunca trae datos de la denuncia ni de quien la hizo: sólo si hay una activa y la
 * serie normalizada que se consultó.
 */
export type SerialLookupResult =
  | { result: "SIN_DENUNCIA" | "CON_DENUNCIA"; serial: string }
  | { error: "SERIE_INVALIDA" | "LIMITE" };

export async function lookupSerial(userId: number, raw: string): Promise<SerialLookupResult> {
  const serial = normalizeGearSerial(raw);
  if (!serial) return { error: "SERIE_INVALIDA" };

  const desde = new Date(Date.now() - 24 * 3600 * 1000);
  const hechas = await prisma.gearSerialLookup.count({
    where: { userId, createdAt: { gte: desde } },
  });
  if (hechas >= MAX_CONSULTAS_POR_DIA) return { error: "LIMITE" };

  // Robo o pérdida: cualquier denuncia activa sobre esa serie.
  const denuncia = await prisma.stolenGearReport.findFirst({
    where: { serialNormalized: serial, status: "ACTIVE" },
    select: { id: true },
  });

  await prisma.gearSerialLookup.create({
    data: { userId, serialNormalized: serial, matchedReportId: denuncia?.id ?? null },
  });

  if (!denuncia) return { result: "SIN_DENUNCIA", serial };

  await avisarConsulta(userId, serial, denuncia.id);
  return { result: "CON_DENUNCIA", serial };
}

/** El aviso nunca rompe la consulta: si falla, se registra y se sigue. */
async function avisarConsulta(userId: number, serial: string, reportId: number): Promise<void> {
  await avisarAlAdmin("serie", "consulta_serie_coincide_admin", {
    usuario: String(userId),
    serie: serial,
    denuncia: String(reportId),
    url: `${urlBaseDeLaApp()}/admin/publicaciones`,
  });
}
