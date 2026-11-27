"use server";

import { redirect } from "next/navigation";
import { codigoDeError } from "@/lib/avisos";
import { toggleFavorite } from "@/lib/catalogo/favoritos";
import { requireLevel } from "@/lib/guards";

/**
 * Guarda o quita una publicación de favoritos. Vuelve a la ficha, o a «/favoritos» si el botón
 * estaba ahí (`desde=favoritos`), con `?ok=CODIGO` / `?error=CODIGO`.
 */
export async function alternarFavorito(formData: FormData) {
  const raw = formData.get("listingId");
  const listingId = Number(typeof raw === "string" ? raw.trim() : "");
  const desdeFavoritos = formData.get("desde") === "favoritos";
  const ficha = `/equipos/${Number.isInteger(listingId) && listingId > 0 ? listingId : ""}`;
  const volver = desdeFavoritos ? "/favoritos" : ficha;
  const user = await requireLevel("registrado", volver);

  let query: string;
  if (!Number.isInteger(listingId) || listingId <= 0) {
    query = "error=NO_ENCONTRADA_PUBLICACION";
  } else {
    try {
      const { favorite } = await toggleFavorite(user.id, listingId);
      query = favorite ? "ok=FAVORITO_GUARDADO" : "ok=FAVORITO_QUITADO";
    } catch (err) {
      query = `error=${codigoDeError(err, { noEncontrado: "NO_ENCONTRADA_PUBLICACION", origen: "favoritos" })}`;
    }
  }
  redirect(`${volver}?${query}`);
}
