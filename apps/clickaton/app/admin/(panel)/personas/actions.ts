"use server";

import { revalidatePath } from "next/cache";

import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  asegurarLocalidad,
  corregirLocalidad,
  elegirCandidata,
} from "@/lib/localities/service";

export type ResultadoDeAccion = { ok: boolean; mensaje: string };

/**
 * Ubica en el mapa todas las ciudades escritas que todavía no tienen fila.
 * Sirve para las inscripciones anteriores y para cualquier ubicación que haya
 * fallado al inscribirse.
 */
export async function ubicarCiudadesPendientesAction(): Promise<ResultadoDeAccion> {
  await requireClickatonAdmin();
  const conCiudad = await prisma.clickatonRegistration.findMany({
    where: { city: { not: null } },
    select: { city: true, province: true, country: true },
    distinct: ["city", "province", "country"],
  });
  let resueltas = 0;
  let dudosas = 0;
  for (const r of conCiudad) {
    const fila = await asegurarLocalidad({ ciudad: r.city, provincia: r.province, pais: r.country });
    if (fila?.estado === "RESUELTA") resueltas += 1;
    else if (fila) dudosas += 1;
  }
  revalidatePath(adminRoutes.people);
  return {
    ok: true,
    mensaje: `Listo: ${resueltas} ciudades ubicadas y ${dudosas} para revisar.`,
  };
}

export async function elegirCandidataAction(clave: string, indice: number): Promise<ResultadoDeAccion> {
  await requireClickatonAdmin();
  try {
    const fila = await elegirCandidata(clave, indice);
    revalidatePath(adminRoutes.people);
    return { ok: true, mensaje: `${fila.ciudad} quedó ubicada.` };
  } catch {
    return { ok: false, mensaje: "No se pudo elegir esa opción." };
  }
}

/**
 * Corrección a mano. `coordenadas` acepta lo que copia Google Maps al hacer
 * clic derecho: "-32.9468, -60.6393".
 */
export async function corregirLocalidadAction(
  clave: string,
  datos: { ciudad: string; provincia: string; coordenadas: string },
): Promise<ResultadoDeAccion> {
  await requireClickatonAdmin();
  const ciudad = datos.ciudad.trim();
  if (!ciudad) return { ok: false, mensaje: "Escribí el nombre de la ciudad." };

  let lat: number | null = null;
  let lng: number | null = null;
  if (datos.coordenadas.trim()) {
    const partes = datos.coordenadas.split(",").map((p) => Number(p.trim()));
    if (
      partes.length !== 2 ||
      !partes.every(Number.isFinite) ||
      Math.abs(partes[0]!) > 90 ||
      Math.abs(partes[1]!) > 180
    ) {
      return { ok: false, mensaje: "Las coordenadas van así: -32.9468, -60.6393" };
    }
    [lat, lng] = partes as [number, number];
  }

  try {
    const fila = await corregirLocalidad(clave, {
      ciudad,
      provincia: datos.provincia.trim() || null,
      lat,
      lng,
    });
    revalidatePath(adminRoutes.people);
    return fila.estado === "RESUELTA"
      ? { ok: true, mensaje: `${fila.ciudad} quedó ubicada.` }
      : {
          ok: false,
          mensaje:
            fila.estado === "DUDOSA"
              ? "Sigue habiendo más de una opción: elegí una de la lista o pegá las coordenadas."
              : "No la encontramos con ese nombre: pegá las coordenadas desde Google Maps.",
        };
  } catch {
    return { ok: false, mensaje: "No se pudo guardar la corrección." };
  }
}
