import Link from "next/link";

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
    <div className="min-h-screen bg-fr-bg px-4 py-10 text-fr-primary md:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-sans text-3xl font-semibold tracking-tight">
          {resultado.ok ? "Correo confirmado" : "No pudimos confirmar tu correo"}
        </h1>

        <p className={`text-sm ${resultado.ok ? "text-fr-muted" : "text-red-300"}`} role="status">
          {resultado.mensaje}
        </p>

        {resultado.ok ? (
          <p className="text-sm text-fr-muted">
            Tu ficha entró a revisión. Te avisamos por correo cuando esté resuelta.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link href="/jurado/panel" className="fr-btn fr-btn-primary">
            Ir a mi panel
          </Link>
          <Link href="/jurado/login" className="fr-btn fr-btn-secondary">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
