import Link from "next/link";
import { getAuthUser } from "../../lib/auth";
import { landingSignOutAction } from "../../actions/landing-session";

type PageProps = { searchParams: Promise<{ incident?: string }> };

/** El `incident` de la URL es texto de un tercero (query param): se valida
 * como UUID antes de mostrarlo. No por XSS (JSX ya escapa texto), sino para
 * no exhibir como "código oficial" un valor arbitrario que alguien puso en
 * el link (p. ej. un intento de phishing tipo "llamá a este número"). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pantalla controlada para cuando no se pudo resolver el destino post-login
 * (o el hub personal) por una falla de backend. Deliberadamente NO llama a
 * `resolveHomeCapabilities` ni a ningún otro resolver secundario: si lo
 * hiciera, correría el riesgo de fallar por la misma causa que nos trajo acá.
 * Solo lee la sesión ya resuelta (`getAuthUser`, barata) para decidir si
 * ofrecer "reintentar" + "cerrar sesión" o mandar a `/login`.
 */
export default async function AccountUnavailablePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const incidentId =
    typeof sp.incident === "string" && UUID_RE.test(sp.incident) ? sp.incident : null;
  const user = await getAuthUser();

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <div className="fr-recuadro border border-fr-border bg-fr-card">
        <h1 className="text-2xl font-semibold tracking-tight">
          No pudimos cargar tu panel
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-fr-muted">
          {user
            ? "Tu sesión sigue activa. Tuvimos un problema para confirmar tu actividad (participaciones, organizaciones o jurado). Podés reintentar en unos segundos; si el problema sigue, contactá soporte con el código de abajo."
            : "Tuvimos un problema y ya no encontramos tu sesión. Volvé a iniciar sesión; si el problema sigue, contactá soporte con el código de abajo."}
        </p>
        {incidentId ? (
          <p className="mt-4 font-mono text-xs text-fr-muted">
            Código de incidente: {incidentId}
          </p>
        ) : null}

        {user ? (
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/mi-actividad" className="fr-btn fr-btn-primary px-6 py-3">
              Reintentar
            </Link>
            <form action={landingSignOutAction}>
              <button
                type="submit"
                className="rounded-lg border border-fr-border px-6 py-3 text-sm text-fr-muted transition-colors hover:border-gold/40 hover:text-gold"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-8">
            <Link href="/login" className="fr-btn fr-btn-primary px-6 py-3">
              Volver a iniciar sesión
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
