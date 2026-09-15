"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { crearEvento } from "@/lib/crear-evento";
import { perfilDeVenta } from "@/lib/perfil-de-venta";


export type EstadoAlta = { error?: string };

export async function crearEventoAction(
  _estadoPrevio: EstadoAlta,
  formData: FormData,
): Promise<EstadoAlta> {
  const almacen = await cookies();
  const token = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = token ? await getSessionUserByRawToken(token) : null;
  if (!usuario) redirect("/login?next=%2Fpanel%2Feventos%2Fnuevo");

  const sellerProfileId = await perfilDeVenta(usuario.id, usuario.name ?? null);

  const resultado = await crearEvento({
    sellerProfileId,
    nombre: String(formData.get("nombre") ?? ""),
    tipo: String(formData.get("tipo") ?? "OTRO"),
    fechaHoraLocal: String(formData.get("fechaHora") ?? ""),
    zonaHoraria: String(formData.get("zona") ?? "America/Argentina/Buenos_Aires"),
    lugar: String(formData.get("lugar") ?? ""),
  });

  if (!resultado.ok) return { error: resultado.error };

  redirect(`/panel/eventos/${resultado.eventoId}`);
}
