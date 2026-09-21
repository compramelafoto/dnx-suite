import Link from "next/link";

export default function GraciasPorPostulartePage() {
  return (
    <div className="min-h-screen bg-fr-bg px-4 py-10 text-fr-primary md:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-sans text-3xl font-semibold tracking-tight">Recibimos tu postulación</h1>

        <p className="text-sm text-fr-muted">
          Si el correo es válido, te va a llegar un mensaje para confirmarlo. Ese paso es
          necesario: sin el correo confirmado, tu ficha no entra a revisión.
        </p>

        <ol className="space-y-3 text-sm text-fr-muted">
          <li>
            <span className="font-medium text-fr-primary">1.</span> Confirmás tu correo con el
            enlace que te mandamos. Vence a las 48 horas.
          </li>
          <li>
            <span className="font-medium text-fr-primary">2.</span> Revisamos tu ficha. Si falta
            algo, te lo decimos y podés corregirlo.
          </li>
          <li>
            <span className="font-medium text-fr-primary">3.</span> Una vez aprobada, aparecés en
            el directorio y tenés tu página pública.
          </li>
        </ol>

        <p className="text-sm text-fr-muted">
          Mientras tanto ya podés entrar y completar tu ficha: mejor la contás, más fácil es que
          te convoquen.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link href="/jurado/perfil" className="fr-btn fr-btn-primary">
            Completar mi ficha
          </Link>
          <Link href="/jurado/panel" className="fr-btn fr-btn-secondary">
            Ir a mi panel
          </Link>
        </div>
      </div>
    </div>
  );
}
