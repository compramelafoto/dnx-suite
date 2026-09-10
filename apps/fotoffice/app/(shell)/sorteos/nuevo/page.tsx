import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireRafflesAdmin } from "@/lib/raffles/access";
import { createRaffleAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NuevoSorteoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRafflesAdmin();
  const params = await searchParams;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Nuevo sorteo"
        description="Queda en borrador. Los premios se cargan después, y recién entonces se anuncia."
      />

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}

      <form action={createRaffleAction} className="fo-card max-w-2xl space-y-6 p-6">
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="title">
            Título
          </label>
          <input
            id="title"
            name="title"
            className="fo-input"
            required
            placeholder="Sorteo de septiembre"
          />
        </div>

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="description">
            Descripción
          </label>
          <textarea id="description" name="description" className="fo-input" rows={3} />
          <p className="fo-helper">Lo que el socio lee en el portal. Puede quedar vacío.</p>
        </div>

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="drawsAt">
            El acto
          </label>
          <input
            id="drawsAt"
            name="drawsAt"
            type="datetime-local"
            className="fo-input"
            required
          />
          <p className="fo-helper">
            Cuándo se lee el número y se resuelven los premios. En hora de Argentina.
          </p>
        </div>

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="entriesCloseAt">
            Cierre del padrón
          </label>
          <input
            id="entriesCloseAt"
            name="entriesCloseAt"
            type="datetime-local"
            className="fo-input"
          />
          <p className="fo-helper">
            Si lo dejás vacío, el padrón cierra 24 horas antes del acto. Ese margen es lo que
            hace verificable el sorteo: la lista de participantes se congela y se publica su
            huella <strong>antes</strong> de que exista el número. Sin margen, alguien que ya
            vio el número podría cambiar quién está en la lista.
          </p>
        </div>

        <div className="fo-form-actions">
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Crear sorteo
          </button>
          <Link href="/sorteos" className="fo-btn fo-btn-ghost text-sm">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
