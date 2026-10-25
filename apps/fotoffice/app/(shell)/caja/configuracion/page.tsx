import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireCashConfigurer } from "@/lib/cash/access";
import { listAccounts } from "@/lib/cash/repository";
import { listarRubros } from "@/lib/rubros/repositorio";
import { agruparRubros, type LadoRubro, type RubroFila } from "@/lib/rubros/rubros";
import { loadPublicSlug } from "@/lib/blog/admin-queries";
import { esSlugDnx } from "@/lib/slug-dnx";
import { AccountForm } from "../account-form";
import { CategoryForm } from "../category-form";
import { enableCashForWorkspaceAction, sembrarPlanDnxAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function CajaConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireCashConfigurer();
  const params = await searchParams;

  const [cuentas, categorias, slug] = await Promise.all([
    listAccounts(workspace.id, { includeInactive: true }),
    listarRubros(workspace.id, { includeInactive: true }),
    loadPublicSlug(workspace.id),
  ]);
  const esDnx = esSlugDnx(slug);

  // Pueden ser padres los de primer nivel. Un rubro con hijos no puede pasar a tener padre.
  const padres = categorias.filter((c) => c.parentCategoryId === null);
  const conHijos = new Set(categorias.map((c) => c.parentCategoryId).filter((x): x is string => x !== null));

  const sinNada = cuentas.length === 0 && categorias.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cuentas y categorías"
        description="Dónde está el dinero del negocio y cómo se clasifica lo que entra y sale."
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
              egreso, y al revés. Se pueden agrupar en un solo nivel: un rubro padre (por ejemplo,
              3.1 Estudio Fotográfico) con sus subrubros debajo (3.1.1 Bodas).
            </p>
            <RubrosDelLado titulo="Ingresos" kind="INGRESO" categorias={categorias} padres={padres} conHijos={conHijos} />
            <RubrosDelLado titulo="Egresos" kind="EGRESO" categorias={categorias} padres={padres} conHijos={conHijos} />
            <div className="fo-card space-y-2 p-5">
              <h3 className="text-sm font-semibold">Nueva categoría</h3>
              <CategoryForm category={null} padres={padres} />
            </div>
            {esDnx ? (
              <div className="fo-card flex flex-wrap items-center justify-between gap-3 p-5">
                <p className="fo-helper max-w-xl">
                  Ingresos 3.1 (Estudio Fotográfico) y costos 4.0 (La Isla) y 4.1 (Costos Directos), con sus subrubros.
                  Sólo crea lo que falta: no cambia códigos ni padres que ya estén cargados.
                </p>
                <form action={sembrarPlanDnxAction}>
                  <button type="submit" className="fo-btn fo-btn-secondary text-sm">
                    Cargar plan de cuentas de DNX
                  </button>
                </form>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}

/** Los rubros de un lado, agrupados por padre y ordenados por código. */
function RubrosDelLado({
  titulo,
  kind,
  categorias,
  padres,
  conHijos,
}: {
  titulo: string;
  kind: LadoRubro;
  categorias: RubroFila[];
  padres: RubroFila[];
  conHijos: Set<string>;
}) {
  const grupos = agruparRubros(categorias.filter((c) => c.kind === kind));
  return (
    <div className="fo-card space-y-3 p-5">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {grupos.map(({ rubro, hijos }) => (
        <div key={rubro.id} className="space-y-3 border-b border-[var(--fo-border)] pb-3 last:border-0">
          <div className={rubro.isActive ? "" : "opacity-60"}>
            <CategoryForm category={rubro} padres={padres} tieneHijos={conHijos.has(rubro.id)} />
          </div>
          {hijos.length > 0 ? (
            <div className="space-y-3 border-l-2 border-[var(--fo-border)] pl-4 sm:ml-4">
              {hijos.map((h) => (
                <div key={h.id} className={h.isActive ? "" : "opacity-60"}>
                  <CategoryForm category={h} padres={padres} tieneHijos={conHijos.has(h.id)} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
