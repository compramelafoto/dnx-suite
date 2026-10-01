import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireCashAdmin } from "@/lib/cash/access";
import { listAccounts, listCategories } from "@/lib/cash/repository";
import { AccountForm } from "../account-form";
import { CategoryForm } from "../category-form";
import { enableCashForWorkspaceAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function CajaConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireCashAdmin();
  const params = await searchParams;

  const [cuentas, categorias] = await Promise.all([
    listAccounts(workspace.id, { includeInactive: true }),
    listCategories(workspace.id, undefined, { includeInactive: true }),
  ]);

  const sinNada = cuentas.length === 0 && categorias.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cuentas y categorías"
        description="Dónde está la plata del negocio y cómo se clasifica lo que entra y sale."
      />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p> : null}

      {sinNada ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <Wallet className="size-7" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold">Todavía no hay nada configurado</p>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Sembrá un punto de partida: una caja diaria, una caja fuerte, Mercado Pago y las
              categorías más comunes. Después se puede renombrar y agregar lo que falte.
            </p>
          </div>
          <form action={enableCashForWorkspaceAction}>
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Sembrar cuentas y categorías
            </button>
          </form>
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <h2 className="text-base font-semibold">Cuentas</h2>
            <div className="space-y-4">
              {cuentas.map((c) => (
                <div key={c.id} className={`fo-card p-5 ${c.isActive ? "" : "opacity-60"}`}>
                  <AccountForm account={c} />
                </div>
              ))}
            </div>
            <div className="fo-card space-y-2 p-5">
              <h3 className="text-sm font-semibold">Nueva cuenta</h3>
              <AccountForm account={null} />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold">Categorías</h2>
            <p className="fo-helper">
              Cada categoría sirve para un solo lado: una de ingreso no aparece al cargar un
              egreso, y al revés.
            </p>
            <div className="fo-card space-y-3 p-5">
              <h3 className="text-sm font-semibold">Ingresos</h3>
              {categorias
                .filter((c) => c.kind === "INGRESO")
                .map((c) => (
                  <div key={c.id} className={`border-b border-[var(--fo-border)] pb-3 last:border-0 ${c.isActive ? "" : "opacity-60"}`}>
                    <CategoryForm category={c} />
                  </div>
                ))}
            </div>
            <div className="fo-card space-y-3 p-5">
              <h3 className="text-sm font-semibold">Egresos</h3>
              {categorias
                .filter((c) => c.kind === "EGRESO")
                .map((c) => (
                  <div key={c.id} className={`border-b border-[var(--fo-border)] pb-3 last:border-0 ${c.isActive ? "" : "opacity-60"}`}>
                    <CategoryForm category={c} />
                  </div>
                ))}
            </div>
            <div className="fo-card space-y-2 p-5">
              <h3 className="text-sm font-semibold">Nueva categoría</h3>
              <CategoryForm category={null} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
