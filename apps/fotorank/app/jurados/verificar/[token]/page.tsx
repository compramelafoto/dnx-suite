import Link from "next/link";

import { PageContainer, PublicShell } from "../../../components/public-ui";
import { verificarEmailDeJuradoAction } from "../../../actions/judgePublicSignup";

export const dynamic = "force-dynamic";

export default async function VerificarCorreoDeJuradoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resultado = await verificarEmailDeJuradoAction(token);

  return (
    <PublicShell header={{ variant: "contest", panelHref: "/jurado/panel" }}>
      <section className="fr-public-section">
        <PageContainer className="max-w-2xl">
          <h1 className="fr-public-title text-3xl md:text-4xl">
            {resultado.ok ? "Correo confirmado" : "No pudimos confirmar tu correo"}
          </h1>

          <p
            className={`fr-public-stack-content ${resultado.ok ? "fr-public-body" : "text-sm text-red-300"}`}
            role="status"
          >
            {resultado.mensaje}
          </p>

          {resultado.ok ? (
            <p className="fr-public-stack-content fr-public-body">
              Tu ficha entró a revisión. Te avisamos por correo cuando esté resuelta. Mientras
              tanto podés seguir completándola: cuanto más contás, más fácil es que te convoquen.
            </p>
          ) : null}

          <div className="fr-public-stack-content flex flex-wrap gap-3">
            {resultado.ok ? (
              <Link href="/jurado/perfil" className="fr-btn fr-btn-primary">
                Completar mi ficha
              </Link>
            ) : null}
            <Link href="/jurado/panel" className="fr-btn fr-btn-secondary">
              Ir a mi panel
            </Link>
            <Link href="/jurado/login" className="fr-btn fr-btn-secondary">
              Iniciar sesión
            </Link>
          </div>
        </PageContainer>
      </section>
    </PublicShell>
  );
}
