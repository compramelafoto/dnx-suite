import CambiarContrasenaClient from "@/components/cuenta/CambiarContrasenaClient";

export const dynamic = "force-dynamic";

/** Ruta canónica (ASCII) para cambio de contraseña — evita problemas con URLs con caracteres especiales. */
export default function CambiarContrasenaPage() {
  return <CambiarContrasenaClient loginRedirectPath="/cuenta/cambiar-contrasena" />;
}
