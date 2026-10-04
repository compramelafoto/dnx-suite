"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import { prisma } from "@repo/db";
import { hashDeIp } from "@/lib/consentimiento";
import { ipDelPedido } from "@/lib/consentimiento-db";
import { registrarProveedor } from "@/lib/proveedores/registrar";
import { categoriaDelEnlace, esCategoriaValida, etiquetaDeCategoria } from "@/lib/proveedores/categorias";

/**
 * Las dos acciones de la captación de proveedores: crear el enlace y recibir la ficha.
 *
 * La primera la usa el fotógrafo desde su panel. La segunda la usa cualquiera que tenga
 * el enlace, y por eso no confía en nada de lo que le llega: el evento sale del token, no
 * del formulario.
 */

export type EstadoEnlace = { error?: string };

/** Crea el enlace de proveedores del evento, si todavía no tiene uno. */
export async function crearEnlaceDeProveedoresAction(
  _previo: EstadoEnlace,
  formData: FormData,
): Promise<EstadoEnlace> {
  const eventoId = String(formData.get("eventoId") ?? "");

  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) return { error: "Tenés que iniciar sesión otra vez." };

  const evento = await prisma.subilafotoEvent.findFirst({
    where: { id: eventoId, sellerProfile: { userId: usuario.id } },
    select: { id: true },
  });
  if (!evento) return { error: "No encontramos ese evento." };

  const yaHay = await prisma.subilafotoAccessLink.count({
    where: { eventId: evento.id, kind: "VENDOR", revokedAt: null },
  });
  if (yaHay > 0) return {};

  await prisma.subilafotoAccessLink.create({
    data: {
      eventId: evento.id,
      kind: "VENDOR",
      // Opaco: no lleva el evento adentro, así que no se puede adivinar el de otro.
      token: randomBytes(24).toString("base64url"),
      label: "Proveedores del evento",
    },
  });

  revalidatePath(`/panel/eventos/${eventoId}/proveedores`);
  return {};
}

/**
 * Crea un enlace para una categoría concreta.
 *
 * Mandarle al salón uno que ya diga "salón" le ahorra un paso y, sobre todo, evita que el
 * catering se anote como fotografía por elegir mal en una lista de treinta.
 */
export async function crearEnlaceDeCategoriaAction(
  _previo: EstadoEnlace,
  formData: FormData,
): Promise<EstadoEnlace> {
  const eventoId = String(formData.get("eventoId") ?? "");
  const categoria = String(formData.get("categoria") ?? "");

  if (!esCategoriaValida(categoria)) return { error: "Elegí una categoría." };

  const almacen = await cookies();
  const cookie = almacen.get(DNX_SESSION_COOKIE)?.value;
  const usuario = cookie ? await getSessionUserByRawToken(cookie) : null;
  if (!usuario) return { error: "Tenés que iniciar sesión otra vez." };

  const evento = await prisma.subilafotoEvent.findFirst({
    where: { id: eventoId, sellerProfile: { userId: usuario.id } },
    select: { id: true },
  });
  if (!evento) return { error: "No encontramos ese evento." };

  const etiqueta = etiquetaDeCategoria(categoria);

  // Uno por categoría y por evento: generar el mismo dos veces deja dos enlaces vivos y
  // después nadie sabe cuál repartió.
  const yaHay = await prisma.subilafotoAccessLink.count({
    where: { eventId: evento.id, kind: "VENDOR", label: etiqueta, revokedAt: null },
  });
  if (yaHay > 0) return {};

  await prisma.subilafotoAccessLink.create({
    data: {
      eventId: evento.id,
      kind: "VENDOR",
      token: randomBytes(24).toString("base64url"),
      label: etiqueta,
    },
  });

  revalidatePath(`/panel/eventos/${eventoId}/proveedores`);
  return {};
}

export type EstadoFicha = { error?: string; listo?: boolean; yaEstaba?: boolean };

/**
 * Recibe la ficha que completó un proveedor.
 *
 * El evento sale del token del enlace. Si viniera del formulario, cualquiera podría
 * cargarle proveedores al evento de otro cambiando un campo oculto.
 */
export async function enviarFichaDeProveedorAction(
  _previo: EstadoFicha,
  formData: FormData,
): Promise<EstadoFicha> {
  const token = String(formData.get("token") ?? "");

  const enlace = await prisma.subilafotoAccessLink.findUnique({
    where: { token },
    select: { eventId: true, revokedAt: true, expiresAt: true, kind: true, label: true },
  });

  if (!enlace || enlace.kind !== "VENDOR" || enlace.revokedAt) {
    return { error: "Este enlace no está disponible." };
  }
  if (enlace.expiresAt && enlace.expiresAt.getTime() <= Date.now()) {
    return { error: "Este enlace venció. Pedile uno nuevo a quien te lo pasó." };
  }

  const texto = (campo: string) => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor : null;
  };

  const resultado = await registrarProveedor(
    enlace.eventId,
    {
      nombre: texto("nombre") ?? "",
      razonSocial: texto("razonSocial"),
      cuit: texto("cuit"),
      /*
        Si el enlace es de una categoría, manda esa. No es sólo comodidad: el formulario
        de un enlace por rubro no muestra el selector, así que confiar en lo que llega
        dejaría entrar cualquier cosa escrita a mano.
      */
      categoria: categoriaDelEnlace(enlace.label) ?? texto("categoria") ?? "",
      descripcion: texto("descripcion"),
      contactoNombre: texto("contactoNombre"),
      contactoRol: texto("contactoRol"),
      telefono: texto("telefono"),
      whatsapp: texto("whatsapp"),
      email: texto("email"),
      sitioWeb: texto("sitioWeb"),
      instagram: texto("instagram"),
      localidad: texto("localidad"),
      provincia: texto("provincia"),
      pais: texto("pais"),
      aceptaContacto: formData.get("aceptaContacto") === "on",
      aceptaNovedades: formData.get("aceptaNovedades") === "on",
    },
    hashDeIp(ipDelPedido(await headers())),
  );

  if (!resultado.ok) return { error: resultado.error };

  await prisma.subilafotoAccessLink.update({
    where: { token },
    data: { usageCount: { increment: 1 } },
  });

  return { listo: true, yaEstaba: resultado.yaEstaba };
}
