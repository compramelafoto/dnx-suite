import Link from "next/link";
import { prisma } from "@repo/db";

import { PageContainer, PublicShell } from "../../../components/public-ui";
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
      <section className="fr-public-section">
        <PageContainer className="max-w-3xl">
          <header className="space-y-3">
            <h1 className="fr-public-title text-3xl md:text-4xl">Recibimos tu postulación</h1>
            <p className="fr-public-body">
              Si el correo es válido, te va a llegar un mensaje para confirmarlo. Ese paso es
              necesario: sin el correo confirmado, tu ficha no entra a revisión.
            </p>
          </header>

          <ol className="fr-public-stack-content space-y-3 text-sm text-[var(--foreground-muted)]">
            <li>
              <span className="font-medium text-[var(--foreground)]">1.</span> Confirmás tu correo
              con el enlace que te mandamos. Vence a las 48 horas.
            </li>
            <li>
              <span className="font-medium text-[var(--foreground)]">2.</span> Revisamos tu ficha.
              Si falta algo, te lo decimos y podés corregirlo.
            </li>
            <li>
              <span className="font-medium text-[var(--foreground)]">3.</span> Una vez aprobada,
              aparecés en el directorio y tenés tu página pública.
            </li>
          </ol>

          {judge && perfil ? (
            <div className="fr-public-stack-content rounded-lg border border-[var(--border)] p-5">
              <div className="mb-4">
                <h2 className="fr-public-title text-xl">Ahora mostrá tu trabajo</h2>
                <p className="fr-public-body mt-2 text-sm">
                  Tu cuenta ya está creada. Subí algunas fotos: son lo primero que mira un
                  organizador cuando busca jurado, y una ficha con obra se convoca mucho más que
                  una ficha con texto.
                </p>
              </div>

              <PortfolioDelJurado iniciales={imagenes} />
            </div>
          ) : (
            <p className="fr-public-stack-content fr-public-body">
              Cuando confirmes tu correo vas a poder entrar y completar tu ficha con fotos de tu
              trabajo.
            </p>
          )}

          <div className="fr-public-stack-content flex flex-wrap gap-3">
            <Link href="/jurado/perfil" className="fr-btn fr-btn-primary">
              Completar el resto de mi ficha
            </Link>
            <Link href="/jurado/panel" className="fr-btn fr-btn-secondary">
              Ir a mi panel
            </Link>
          </div>
        </PageContainer>
      </section>
    </PublicShell>
  );
}
