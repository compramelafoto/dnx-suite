import { redirect } from "next/navigation";

/**
 * Antes: el organizador creaba la cuenta del jurado con correo y contraseña.
 *
 * Esas cuentas nacían fuera de la revisión —sin aprobar, pero con perfil
 * público— y nunca podían entrar al directorio. Desde el 2026-09-25 hay un solo
 * camino: el jurado se postula, FotoRank lo aprueba y el organizador lo invita
 * desde el directorio. La dirección se conserva para enlaces guardados.
 */
export default function NuevoJuradoRedirige() {
  redirect("/jurados/directorio");
}
