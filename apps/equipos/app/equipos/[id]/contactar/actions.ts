"use server";

import { redirect } from "next/navigation";
import { contactSeller, ContactoError } from "@/lib/contacto/contactar";
import { requireLevel } from "@/lib/guards";

/** Pide los datos del vendedor y vuelve a la misma página, que los muestra. */
export async function contactarVendedor(formData: FormData) {
  const raw = formData.get("id");
  const id = Number(typeof raw === "string" ? raw : "");
  const volver = `/equipos/${id}/contactar`;
  const user = await requireLevel("identidad", volver);
  let destino = volver;
  try {
    await contactSeller({ id: user.id, displayName: user.displayName }, id);
  } catch (err) {
    if (err instanceof ContactoError) {
      destino = `${volver}?error=${err.code}`;
    } else {
      console.error("[contacto] Error inesperado:", err);
      destino = `${volver}?error=ERROR`;
    }
  }
  redirect(destino);
}
