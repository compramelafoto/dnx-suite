import { redirect } from "next/navigation";

/**
 * Antes: las invitaciones por correo, un segundo sistema de invitaciones que no
 * mandaba ningún correo (había que copiar el enlace a mano). Desde el
 * 2026-09-25 las invitaciones son las del directorio.
 */
export default function InvitacionesPorCorreoRedirige() {
  redirect("/jurados/directorio/invitaciones");
}
