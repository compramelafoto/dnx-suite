import "@repo/auth-ui/tokens.css";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import {
  DnxAuthError,
  DnxAuthHeader,
  DnxAuthShell,
  DnxGoogleButton,
  subilafotoAuthBrand,
} from "@repo/auth-ui";
import { rutaInternaSegura } from "@/lib/ruta-segura";

/**
 * Ingreso del profesional. La misma cuenta que en el resto de DNX Suite.
 *
 * Usa `@repo/auth-ui`, el mismo paquete que las demás plataformas: así el
 * botón de Google, el orden de los elementos y el tamaño de los controles son
 * idénticos en toda la suite. Lo único propio es la paleta, que vive en
 * `tokens.css` bajo `data-brand="subilafoto"`.
 *
 * No hay ingreso con contraseña ni registro: quien vende eventos ya tiene su
 * Cuenta DNX, y el invitado nunca inicia sesión — llega por el QR.
 */

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function Login({ searchParams }: Props) {
  const { error, next } = await searchParams;

  // Quien ya tiene la sesión abierta no tiene nada que hacer acá. La portada
  // muestra «Ingresar» a todo el mundo para poder servirse estática, así que
  // este desvío es lo que hace que ese botón no sea un callejón sin salida.
  const token = (await cookies()).get(DNX_SESSION_COOKIE)?.value;
  if (token && (await getSessionUserByRawToken(token))) {
    redirect(rutaInternaSegura(next) ?? "/panel");
  }

  const destino = next
    ? `/api/auth/google?next=${encodeURIComponent(next)}`
    : "/api/auth/google";

  const { logo, contextualCopy } = subilafotoAuthBrand;

  return (
    <DnxAuthShell brand={subilafotoAuthBrand}>
      <DnxAuthHeader
        logo={logo}
        title={contextualCopy?.loginTitle ?? "Entrá a tu cuenta"}
        description={contextualCopy?.loginDescription}
      />

      <DnxAuthError message={error} />

      {/*
        `secondary` y no `emphasized`: es el estilo canónico de la suite y el
        que hace que este botón se vea igual que en las otras plataformas, que
        es justamente lo pedido. El color de marca lo pone el fondo púrpura y
        el amarillo del foco, no el botón.
      */}
      <DnxGoogleButton href={destino} emphasis="secondary" />
    </DnxAuthShell>
  );
}
