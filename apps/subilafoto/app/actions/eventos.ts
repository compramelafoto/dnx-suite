"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { crearEvento } from "@/lib/crear-evento";

/** Perfil de venta del usuario. Si todavía no tiene, se crea uno mínimo que después edita. */
async function perfilDeVenta(userId: number, nombreUsuario: string | null) {
  const existente = await prisma.subilafotoSellerProfile.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (existente) return existente.id;

  const base = (nombreUsuario ?? "profesional")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "profesional";

  // El slug es público y único: si está tomado, se le agrega un sufijo corto.
  for (let intento = 0; intento < 5; intento++) {
    const slug = intento === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const creado = await prisma.subilafotoSellerProfile.create({
        data: {
          userId,
          slug,
          displayName: nombreUsuario ?? "Mi estudio",
          basePriceCents: 0,
          isPublished: false,
        },
        select: { id: true },
      });
      return creado.id;
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  throw new Error("No se pudo crear el perfil de venta.");
}

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
