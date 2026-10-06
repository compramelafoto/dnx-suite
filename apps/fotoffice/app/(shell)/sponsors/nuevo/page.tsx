import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireSponsorsManager } from "@/lib/sponsors/access";
import { sponsorsWriteBlockedReason } from "@/lib/sponsors/clients";
import { crearSponsorAction } from "../actions";
import { BuscadorDeSponsors } from "./buscador";

export const dynamic = "force-dynamic";

/**
 * Sumar un sponsor: primero buscarlo en la base común, después crearlo si no está.
 *
 * El orden importa: si cada institución cargara la suya, la misma marca quedaría repetida en
 * la red, con logos distintos en cada lado.
 */
export default async function NuevoSponsorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSponsorsManager();
  if (sponsorsWriteBlockedReason()) redirect("/sponsors");
  const { error } = await searchParams;

  return (
    <div className="max-w-3xl space-y-8">
      <PageHeader
        title="Agregar sponsor"
        description="Buscalo primero: si ya trabaja con otra plataforma de DNX, ya tiene su ficha y su logo."
        actions={
          <Link href="/sponsors" className="fo-btn fo-btn-secondary text-sm">
            Volver
          </Link>
        }
      />

      {error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">1. Buscar en la base común</h2>
        <BuscadorDeSponsors />
      </section>

      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">2. ¿No aparece? Crealo</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            El logo se sube después, desde la ficha del sponsor.
          </p>
        </div>
        <form action={crearSponsorAction} className="grid gap-4 sm:grid-cols-2">
          <label className="fo-field-stack sm:col-span-2">
            <span className="fo-label">Nombre de la marca</span>
            <input name="name" required minLength={2} maxLength={120} className="fo-input" />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Sitio web (opcional)</span>
            <input name="websiteUrl" placeholder="marca.com.ar" className="fo-input" />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Instagram (opcional)</span>
            <input name="instagram" placeholder="@marca" className="fo-input" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Crear y vincular
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
