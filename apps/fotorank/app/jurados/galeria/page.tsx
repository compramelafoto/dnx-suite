import Link from "next/link";
import type { Metadata } from "next";
import { PageContainer, PublicShell } from "../../components/public-ui";
import { juradosDeLaGaleria } from "../../lib/fotorank/judges/galeriaPublica";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Jurados de FotoRank",
  description:
    "Los fotógrafos que califican los concursos de FotoRank. Si tenés experiencia, postulate como jurado.",
};

/**
 * La galería pública de jurados: la vidriera y la convocatoria en una página.
 *
 * Hasta el 2026-09-25 no existía. La única lista completa era el directorio,
 * que sólo ve el organizador, y a la postulación se llegaba por un enlace
 * chiquito al pie del perfil de un jurado. Nada del sitio llevaba ahí.
 */
export default async function GaleriaDeJuradosPage() {
  const jurados = await juradosDeLaGaleria();

  return (
    <PublicShell header={{ variant: "contest", panelHref: "/jurado/panel" }}>
      <section className="fr-public-section">
        <PageContainer className="space-y-12">
          <header className="mx-auto max-w-2xl space-y-5 text-center">
            <p className="fr-eyebrow text-gold">Jurados de FotoRank</p>
            <h1 className="font-sans text-3xl font-semibold tracking-tight text-fr-primary md:text-5xl">
              Quienes califican los concursos
            </h1>
            <p className="text-base leading-relaxed text-fr-muted">
              Fotógrafos con trayectoria que evalúan las obras con criterios públicos. Cada ficha
              la revisa FotoRank antes de publicarse.
            </p>
            <Link
              href="/jurados/postulacion"
              className="fr-btn fr-btn-primary inline-flex px-6 py-3"
            >
              Postulate como jurado
            </Link>
          </header>

          {jurados.length === 0 ? (
            <p className="text-center text-sm text-fr-muted">
              Todavía no hay jurados publicados. Podés ser el primero.
            </p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {jurados.map((j) => (
                <li key={j.slug}>
                  <Link
                    href={`/jurados/publico/${j.slug}`}
                    className="fr-recuadro flex h-full items-center gap-4 border border-fr-border bg-fr-card transition-colors hover:border-gold/40"
                  >
                    {j.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- la foto sale de nuestra propia ruta
                      <img
                        src={j.foto}
                        alt=""
                        className="h-20 w-20 shrink-0 rounded-full border border-fr-border object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-dashed border-fr-border text-lg font-semibold text-fr-muted"
                        aria-hidden
                      >
                        {j.nombre.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold text-fr-primary">{j.nombre}</p>
                      {j.titular ? (
                        <p className="line-clamp-2 text-sm text-fr-muted">{j.titular}</p>
                      ) : null}
                      {j.lugar ? <p className="text-xs text-fr-muted-soft">{j.lugar}</p> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <section className="fr-recuadro mx-auto max-w-3xl border border-fr-border bg-fr-card">
            <h2 className="text-xl font-semibold tracking-tight text-fr-primary">
              ¿Cómo se llega a ser jurado?
            </h2>
            <ol className="mt-4 space-y-3 text-sm text-fr-muted">
              <li>
                <span className="font-semibold text-gold">1.</span> Completás la postulación con tu
                trayectoria y tu portfolio, y confirmás tu correo.
              </li>
              <li>
                <span className="font-semibold text-gold">2.</span> FotoRank revisa tu ficha. Si la
                aprueba, aparecés en esta galería y en el directorio que usan los organizadores.
              </li>
              <li>
                <span className="font-semibold text-gold">3.</span> Un organizador te invita a su
                concurso. Aceptás desde tu cuenta, en Jurado → Invitaciones recibidas, y ya podés
                calificar.
              </li>
            </ol>
            <Link
              href="/jurados/postulacion"
              className="mt-6 inline-flex text-sm font-medium text-gold hover:text-gold-hover"
            >
              Ir a la postulación →
            </Link>
          </section>
        </PageContainer>
      </section>
    </PublicShell>
  );
}
