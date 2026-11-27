"use server";

import { redirect } from "next/navigation";
import { EquipoError } from "@/lib/inventario/equipos";
import { requireLevel } from "@/lib/guards";
import { flagListing } from "@/lib/publicaciones/moderacion";

/** Guarda el reporte y vuelve a la misma página con un código (nunca texto libre en la URL). */
export async function reportarPublicacion(formData: FormData) {
  const raw = formData.get("id");
  const id = Number(typeof raw === "string" ? raw : "");
  const volver = `/equipos/${id}/reportar`;
  const user = await requireLevel("registrado", volver);
  const motivo = formData.get("motivo");
  let destino = `${volver}?enviado=1`;
  try {
    await flagListing(user.id, id, typeof motivo === "string" ? motivo : "");
  } catch (err) {
    if (err instanceof EquipoError) {
      const codigo =
        err.code === "NO_ENCONTRADO"
          ? "NO_DISPONIBLE"
          : /propia/.test(err.message)
            ? "PROPIA"
            : "MOTIVO";
      destino = `${volver}?error=${codigo}`;
    } else {
      console.error("[reportar] Error inesperado:", err);
      destino = `${volver}?error=ERROR`;
    }
  }
  redirect(destino);
}
