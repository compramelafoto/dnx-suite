/**
 * Alta, consulta y corrección de localidades.
 *
 * Sin `server-only`: también lo usa el script que ubica las ciudades ya
 * cargadas (`scripts/ubicar-localidades.ts`).
 */
import { prisma } from "@repo/db";

import { claveDeLocalidad } from "./clave";
import { ubicarLocalidad, type CandidataDeLocalidad } from "./georef";

type Db = Pick<typeof prisma, "clickatonLocality">;

/**
 * Se asegura de que la ciudad de una inscripción tenga su fila en el mapa.
 *
 * Si la clave ya existe no consulta nada: una ciudad corregida a mano no se
 * pisa con una búsqueda automática. Nunca tira: si Georef no responde, la
 * ciudad queda para la próxima pasada.
 */
export async function asegurarLocalidad(
  input: { ciudad: string | null | undefined; provincia: string | null | undefined; pais?: string | null },
  db: Db = prisma,
): Promise<{ clave: string; estado: string } | null> {
  const clave = claveDeLocalidad(input.ciudad, input.provincia);
  if (!clave || !input.ciudad) return null;

  const existente = await db.clickatonLocality.findUnique({
    where: { clave },
    select: { clave: true, estado: true },
  });
  if (existente) return existente;

  let ubicada;
  try {
    ubicada = await ubicarLocalidad({
      ciudad: input.ciudad.trim(),
      provincia: input.provincia?.trim() || null,
      pais: input.pais,
    });
  } catch (error) {
    console.warn("[clickaton] no se pudo ubicar la localidad", clave, error);
    return null;
  }

  const elegida = ubicada.estado === "RESUELTA" ? ubicada.elegida : null;
  const fila = await db.clickatonLocality.upsert({
    where: { clave },
    update: {},
    create: {
      clave,
      ciudad: elegida?.ciudad ?? input.ciudad.trim(),
      provincia: elegida?.provincia ?? (input.provincia?.trim() || null),
      pais: (input.pais || "AR").toUpperCase(),
      lat: elegida?.lat ?? null,
      lng: elegida?.lng ?? null,
      origen: "GEOREF",
      estado: ubicada.estado,
      candidatos: ubicada.candidatas.length > 0 ? ubicada.candidatas : undefined,
    },
    select: { clave: true, estado: true },
  });
  return fila;
}

/** Elegir una de las candidatas que propuso Georef. */
export async function elegirCandidata(clave: string, indice: number, db: Db = prisma) {
  const fila = await db.clickatonLocality.findUnique({ where: { clave } });
  const candidatas = (fila?.candidatos ?? []) as CandidataDeLocalidad[];
  const elegida = candidatas[indice];
  if (!fila || !elegida) throw new Error("CANDIDATA_INEXISTENTE");
  return db.clickatonLocality.update({
    where: { clave },
    data: {
      ciudad: elegida.ciudad,
      provincia: elegida.provincia,
      lat: elegida.lat,
      lng: elegida.lng,
      estado: "RESUELTA",
      origen: "MANUAL",
      revisadaAt: new Date(),
    },
  });
}

/**
 * Corregir a mano: con el nombre bien escrito se vuelve a buscar; con
 * coordenadas (pegadas de Google Maps) se usan tal cual.
 */
export async function corregirLocalidad(
  clave: string,
  correccion: { ciudad: string; provincia: string | null; lat?: number | null; lng?: number | null },
  db: Db = prisma,
) {
  const tieneCoordenadas =
    typeof correccion.lat === "number" &&
    typeof correccion.lng === "number" &&
    Number.isFinite(correccion.lat) &&
    Number.isFinite(correccion.lng);

  if (tieneCoordenadas) {
    return db.clickatonLocality.update({
      where: { clave },
      data: {
        ciudad: correccion.ciudad,
        provincia: correccion.provincia,
        lat: correccion.lat,
        lng: correccion.lng,
        estado: "RESUELTA",
        origen: "MANUAL",
        revisadaAt: new Date(),
      },
    });
  }

  const ubicada = await ubicarLocalidad({ ciudad: correccion.ciudad, provincia: correccion.provincia });
  const elegida = ubicada.estado === "RESUELTA" ? ubicada.elegida : null;
  return db.clickatonLocality.update({
    where: { clave },
    data: {
      ciudad: elegida?.ciudad ?? correccion.ciudad,
      provincia: elegida?.provincia ?? correccion.provincia,
      lat: elegida?.lat ?? null,
      lng: elegida?.lng ?? null,
      estado: ubicada.estado,
      origen: "MANUAL",
      candidatos: ubicada.candidatas.length > 0 ? ubicada.candidatas : undefined,
      revisadaAt: new Date(),
    },
  });
}
