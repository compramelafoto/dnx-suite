import Link from "next/link";
import { prisma } from "@repo/db";

import { PublicShell } from "../../../components/public-ui";
import { getJudgeAuthUser } from "../../../lib/judge-auth";
import { portfolioImageSrc } from "../../../lib/fotorank/judges/portfolioSrc";
import { PortfolioDelJurado } from "../../../jurado/perfil/PortfolioDelJurado";

export const dynamic = "force-dynamic";

/**
 * El paso 2 del alta, con la cuenta ya creada.
 *
 * El formulario de postulación llega hasta crear el usuario y ahí se corta.
 * El portfolio va acá: si algo falla subiendo doce fotos, la cuenta ya está
 * hecha y no se pierde nada.
 */
export default async function GraciasPorPostulartePage() {
  const judge = await getJudgeAuthUser();

  const perfil = judge
    ? await prisma.fotorankJudgeProfile.findUnique({
        where: { judgeAccountId: judge.id },
        select: { id: true, portfolioImages: { orderBy: { sortOrder: "asc" } } },
      })
    : null;

  const imagenes = (perfil?.portfolioImages ?? [])
    .map((img) => ({ id: img.id, src: portfolioImageSrc(img), title: img.title }))
    .filter((img): img is { id: string; src: string; title: string | null } => img.src !== null);

  return (
    <PublicShell
      header={{
        variant: "contest",
        panelHref: "/jurado/panel",
        // Acaba de crear su cuenta: ofrecerle "Iniciar sesión" sería raro.
        hasSession: !!judge,
        userEmail: judge?.email ?? null,
      }}
    >
      <div className="mx-auto w-full max-w-[88rem] px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
        <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16 xl:gap-24">
          <aside className="lg:self-start">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--foreground)] lg:text-4xl">
              Recibimos tu postulación
            </h1>

            <p className="mt-4 max-w-prose leading-relaxed text-[var(--foreground-muted)]">
              Si el correo es válido, te va a llegar un mensaje para confirmarlo. Ese paso es
              necesario: sin el correo confirmado, tu ficha no entra a revisión.
            </p>

            <ol className="mt-8 space-y-4">
              {[
                "Confirmás tu correo con el enlace que te mandamos. Vence a las 48 horas.",
                "Revisamos tu ficha. Si falta algo, te lo decimos y podés corregirlo.",
                "Aparecés en el directorio, con tu página pública y tu portfolio.",
              ].map((paso, i) => (
                <li
                  key={paso}
                  className="flex gap-3 text-sm leading-relaxed text-[var(--foreground-muted)]"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-xs font-medium text-[var(--foreground)]"
                  >
                    {i + 1}
                  </span>
                  <span>{paso}</span>
                </li>
              ))}
            </ol>
          </aside>

          <div className="mt-10 lg:mt-0">
            {judge && perfil ? (
              <>
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">
                    Ahora mostrá tu trabajo
                  </h2>
                  <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-[var(--foreground-muted)]">
                    Tu cuenta ya está creada. Subí algunas fotos: son lo primero que mira un
                    organizador cuando busca jurado, y una ficha con obra se convoca mucho más que
                    una ficha con texto.
                  </p>
                </div>

                <PortfolioDelJurado iniciales={imagenes} />
              </>
            ) : (
              <p className="max-w-prose leading-relaxed text-[var(--foreground-muted)]">
                Cuando confirmes tu correo vas a poder entrar y completar tu ficha con fotos de tu
                trabajo.
              </p>
            )}

            <div className="mt-10 flex flex-wrap gap-3 border-t border-[var(--border)] pt-8">
              <Link href="/jurado/perfil" className="fr-btn fr-btn-primary">
                Completar el resto de mi ficha
              </Link>
              <Link href="/jurado/panel" className="fr-btn fr-btn-secondary">
                Ir a mi panel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
