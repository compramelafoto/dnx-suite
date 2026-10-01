"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { estadoDeAcceso } from "@/lib/acceso-evento";
import { COOKIE_INVITADO, obtenerOCrearSesion } from "@/lib/invitado-cookie";
import { ipDelPedido, registrarAceptacion } from "@/lib/consentimiento-db";
import { OPCIONES_COOKIE } from "@/lib/sesion";

/**
 * El invitado acepta los términos y entra.
 *
 * Recién acá se crea su sesión: antes no hay nada que guardar. Crearla al abrir
 * la puerta dejaría una fila por cada escaneo, incluidos los de quien mira y se
 * va.
 */
export async function aceptarYEntrar(formData: FormData): Promise<void> {
  const codigo = String(formData.get("codigo") ?? "").toUpperCase();
  if (!codigo) redirect("/");

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { code: codigo },
    select: { id: true, status: true, activationAt: true, deactivationAt: true },
  });
  if (!evento) redirect("/");

  // Se vuelve a mirar la ventana acá y no sólo al pintar la puerta: entre que se
  // cargó la pantalla y se apretó el botón, el evento pudo cerrarse.
  if (!estadoDeAcceso(evento, new Date()).puedeSubir) redirect(`/e/${codigo}`);

  const almacen = await cookies();
  const sesion = await obtenerOCrearSesion({
    eventoId: evento.id,
    token: almacen.get(COOKIE_INVITADO)?.value ?? null,
  });

  await registrarAceptacion({
    eventoId: evento.id,
    guestSessionId: sesion.id,
    ip: ipDelPedido(await headers()),
  });

  almacen.set(COOKIE_INVITADO, sesion.token, { ...OPCIONES_COOKIE, maxAge: 86400 });

  redirect(`/e/${codigo}/subir`);
}
