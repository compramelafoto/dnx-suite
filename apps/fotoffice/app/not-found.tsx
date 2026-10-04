import Link from "next/link";

/**
 * El 404 global de la aplicación. Se dibuja cuando:
 * - Un visitante llega a una ruta que no existe (ni en /w/ ni en /dashboard/ ni en ningún lado)
 * - Un layout hace notFound() antes de poder montar el armazón del sitio (ej: workspace inexistente)
 *
 * No tiene acceso a ningún contexto de workspace o usuario: debe ser autónomo y usar
 * sólo los tokens del panel (--fo-*) o valores neutros de Tailwind.
 */
export default function AppNotFound() {
  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)] flex items-center justify-center px-4">
      <main className="mx-auto max-w-md text-center space-y-6">
        <div className="space-y-2">
          <p className="text-sm text-[var(--fo-muted)]">Página no encontrada</p>
          <h1 className="text-3xl font-semibold tracking-tight">Esta página no existe</h1>
        </div>

        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
          Puede que el enlace esté mal escrito, o que la página ya no esté disponible.
        </p>

        <Link href="/" className="fo-btn fo-btn-primary inline-block">
          Ir al inicio
        </Link>
      </main>
    </div>
  );
}
