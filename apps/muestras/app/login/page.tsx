import "@repo/auth-ui/tokens.css";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DNX_SESSION_COOKIE, getSessionUserByRawToken } from "@repo/auth";
import {
  DnxAuthDivider,
  DnxAuthError,
  DnxAuthHeader,
  DnxAuthShell,
  DnxEmailField,
  DnxGoogleButton,
  DnxPasswordField,
  DnxPrimaryAuthButton,
  muestrasAuthBrand,
} from "@repo/auth-ui";
import { rutaInternaSegura } from "@/lib/ruta-segura";

/** Ingreso a Muestras Fotográficas. La misma cuenta que en el resto de DNX Suite: con Google o
 * con la contraseña que la persona ya tiene (FotoRank, FOTOFFICE). */

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function Login({ searchParams }: Props) {
  const { error, next } = await searchParams;

  // Quien ya tiene la sesión abierta no tiene nada que hacer acá: si llega por
  // un enlace viejo o con la pestaña desactualizada, se lo manda a destino.
  const token = (await cookies()).get(DNX_SESSION_COOKIE)?.value;
  if (token && (await getSessionUserByRawToken(token))) {
    redirect(rutaInternaSegura(next) ?? "/panel");
  }

  const destino = next
    ? `/api/auth/google?next=${encodeURIComponent(next)}`
    : "/api/auth/google";

  const { logo, contextualCopy } = muestrasAuthBrand;

  return (
    <DnxAuthShell brand={muestrasAuthBrand}>
      <DnxAuthHeader
        logo={logo}
        title={contextualCopy?.loginTitle ?? "Entrá a tu cuenta"}
        description={contextualCopy?.loginDescription}
      />

      <DnxAuthError message={error} />

      {/* La misma clave de DNX Suite. Muestras no crea cuentas ni recupera claves por acá. */}
      <form
        action="/api/auth/clave"
        method="post"
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}
      >
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <DnxEmailField />
        <DnxPasswordField autoComplete="current-password" />
        <DnxPrimaryAuthButton>Entrar</DnxPrimaryAuthButton>
      </form>

      <DnxAuthDivider />

      {/*
        `secondary` y no `emphasized`: es el estilo canónico de la suite y el
        que hace que este botón se vea igual que en las otras plataformas, que
        es justamente lo pedido. El color de marca lo ponen el logo y el
        petróleo del foco, no el botón.
      */}
      <DnxGoogleButton href={destino} emphasis="secondary" />
    </DnxAuthShell>
  );
}
