import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { listStoreCategories, listStoreProducts, loadOpenStore } from "@/lib/store/repository";
import { ProductGrid } from "@/components/store/product-grid";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ categoria?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await loadOpenStore((await params).workspaceSlug);
  if (!store) return {};
  const title = `Tienda — ${store.workspace.name}`;
  const description = `Productos de ${store.workspace.name}. Comprá online y retirá en el local.`;
  return { title, description, openGraph: { title, description, siteName: store.workspace.name, locale: "es_AR" } };
}

/**
 * La vitrina: los productos a la venta online, en el orden que eligió el negocio, con un filtro
 * por categoría (`?categoria=<id>`; una categoría que no existe muestra todo).
 */
export default async function StorePage({ params, searchParams }: Props) {
  const { workspaceSlug } = await params;
  const store = await loadOpenStore(workspaceSlug);
  if (!store) notFound();

  const pedida = (await searchParams).categoria;
  const categorias = await listStoreCategories(store.workspace.id);
  const categoria = categorias.find((c) => c.id === (Array.isArray(pedida) ? pedida[0] : pedida)) ?? null;
  const productos = await listStoreProducts(store.workspace.id, { categoryId: categoria?.id });

  const base = `/w/${workspaceSlug}/${STORE_PUBLIC_SEGMENT}`;
  const chip = (activo: boolean) =>
    `inline-flex min-h-9 shrink-0 items-center rounded-full border px-4 text-sm transition-colors ${
      activo
        ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-white"
        : "border-[var(--fo-border-strong)] hover:border-[var(--fo-text)]"
    }`;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8 md:py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{categoria ? categoria.name : "Tienda"}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-[var(--fo-muted)]">
          Comprá online y retirá en {store.settings.pickupAddress ?? "el local"}.
        </p>
      </div>

      {categorias.length > 1 ? (
        <nav aria-label="Categorías" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <ul className="flex gap-2 pb-1">
            <li>
              <Link href={base} className={chip(!categoria)} aria-current={!categoria ? "page" : undefined}>
                Todo
              </Link>
            </li>
            {categorias.map((c) => (
              <li key={c.id}>
                <Link
                  href={`${base}?categoria=${encodeURIComponent(c.id)}`}
                  className={chip(categoria?.id === c.id)}
                  aria-current={categoria?.id === c.id ? "page" : undefined}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {productos.length === 0 ? (
        <div className="fo-card p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">Por ahora no hay productos a la venta.</p>
        </div>
      ) : (
        <ProductGrid products={productos} basePath={base} />
      )}
    </main>
  );
}
