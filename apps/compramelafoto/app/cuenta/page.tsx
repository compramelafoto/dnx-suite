import { redirect } from "next/navigation";

/** Evita coincidencia con `/[handler]` público y centraliza cuenta en cambiar contraseña. */
export default function CuentaIndexPage() {
  redirect("/cuenta/cambiar-contrasena");
}
