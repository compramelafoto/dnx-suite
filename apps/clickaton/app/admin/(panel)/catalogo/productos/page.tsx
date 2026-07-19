import { AdminDataTable, AdminTableLink } from "@/components/admin/AdminDataTable";
import { AdminFlashMessage } from "@/components/admin/AdminFlashMessage";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { adminRoutes } from "@/config/admin/navigation";
import { catalogAdminRoutes } from "@/lib/admin-catalog/design/routes";
import { listProductsAction } from "@/lib/admin-catalog/actions/products";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import { EDITION_STATUS_LABELS, type ClickatonEditionStatus } from "@/lib/admin/editions/types";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { ProductListActiveButton } from "@/components/admin/catalog/ProductListActiveButton";

type Props = {
  searchParams: Promise<{
    flash?: string;
    editionId?: string;
    active?: string;
    q?: string;
    stock?: string;
    variants?: string;
  }>;
};

function buildProductsHref(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${catalogAdminRoutes.products}?${qs}` : catalogAdminRoutes.products;
}

export default async function AdminProductsPage({ searchParams }: Props) {
  await requireClickatonAdmin();
  const params = await searchParams;
  const editionsResult = await listEditionOptions();
  const editions = editionsResult.ok ? editionsResult.data : [];

  if (!editionsResult.ok) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Productos"
          description="Merchandising y variantes por edición."
          breadcrumbs={[
            { label: "Catálogo", href: catalogAdminRoutes.hub },
            { label: "Productos" },
          ]}
        />
        <AdminMigrationNotice message={editionsResult.message} />
      </div>
    );
  }

  if (editions.length === 0) {
    return (
      <div className="space-y-8">
        <AdminPageHeader
          title="Productos"
          description="Merchandising y variantes por edición."
          breadcrumbs={[
            { label: "Catálogo", href: catalogAdminRoutes.hub },
            { label: "Productos" },
          ]}
        />
        <AdminEmptyState
          title="Sin ediciones"
          description="Necesitás al menos una edición para crear productos del catálogo."
          action={
            <Button href={adminRoutes.editions} variant="primary">
              Ir a ediciones
            </Button>
          }
        />
      </div>
    );
  }

  const editionId = params.editionId || editions[0]?.id || "";
  const activeFilter =
    params.active === "active" ? true : params.active === "inactive" ? false : undefined;
  const withStock =
    params.stock === "with" ? true : params.stock === "without" ? false : undefined;
  const withVariants =
    params.variants === "with" ? true : params.variants === "without" ? false : undefined;

  const listResult = editionId
    ? await listProductsAction({
        editionId,
        isActive: activeFilter,
        query: params.q?.trim() || undefined,
        withStock,
        withVariants,
      })
    : { ok: false as const, message: "Seleccioná una edición." };

  const products = listResult.ok ? (listResult.data ?? []) : [];
  const hasFilters = Boolean(
    params.q ||
      params.active === "active" ||
      params.active === "inactive" ||
      params.stock ||
      params.variants,
  );
  const newHref = `${catalogAdminRoutes.productNew}?editionId=${encodeURIComponent(editionId)}`;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Productos"
        description="Un producto agrupa variantes (talle, color, formato…). Luego podrá incluirse en entradas y kits."
        breadcrumbs={[
          { label: "Catálogo", href: catalogAdminRoutes.hub },
          { label: "Productos" },
        ]}
        actions={
          <Button href={newHref} variant="primary">
            Crear producto
          </Button>
        }
      />

      <AdminFlashMessage flash={params.flash} />

      <form
        className="grid gap-4 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-4 sm:grid-cols-2 lg:grid-cols-3"
        method="get"
      >
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Edición</span>
          <Select name="editionId" defaultValue={editionId}>
            {editions.map((edition) => {
              const statusLabel =
                EDITION_STATUS_LABELS[edition.status as ClickatonEditionStatus] ??
                edition.status;
              return (
                <option key={edition.id} value={edition.id}>
                  {edition.name} ({statusLabel})
                </option>
              );
            })}
          </Select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Estado</span>
          <Select name="active" defaultValue={params.active ?? "all"}>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </Select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Búsqueda</span>
          <Input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Nombre, código o SKU"
          />
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Stock</span>
          <Select name="stock" defaultValue={params.stock ?? "all"}>
            <option value="all">Todos</option>
            <option value="with">Con stock disponible</option>
            <option value="without">Sin stock / agotado</option>
          </Select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="text-ck-text-secondary">Variantes</span>
          <Select name="variants" defaultValue={params.variants ?? "all"}>
            <option value="all">Todos</option>
            <option value="with">Con variantes</option>
            <option value="without">Sin variantes</option>
          </Select>
        </label>
        <div className="flex items-end gap-3">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          {hasFilters ? (
            <Button href={buildProductsHref({ editionId })} variant="outline">
              Limpiar
            </Button>
          ) : null}
        </div>
      </form>

      {!listResult.ok ? (
        <p className="rounded-[var(--ck-radius-card)] border border-[var(--ck-danger)]/40 bg-[var(--ck-danger-soft)] px-4 py-3 text-sm" role="alert">
          {listResult.message ?? "No se pudo cargar el listado."}
        </p>
      ) : products.length === 0 && !hasFilters ? (
        <AdminEmptyState
          title="Sin productos en esta edición"
          description="Un producto es un ítem de catálogo (remera, botella, diploma…). Cada producto puede tener variantes (talle, color, formato) con stock propio. Más adelante podrá incluirse dentro de entradas y kits."
          note="Empezá creando el producto y después agregá variantes desde el detalle."
          action={
            <Button href={newHref} variant="primary">
              Crear primer producto
            </Button>
          }
        />
      ) : products.length === 0 ? (
        <AdminEmptyState
          title="Filtros sin resultados"
          description="No hay productos que coincidan con los filtros actuales."
          action={
            <Button href={buildProductsHref({ editionId })} variant="secondary">
              Quitar filtros
            </Button>
          }
        />
      ) : (
        <AdminDataTable
          rows={products}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "name",
              header: "Producto",
              cell: (row) => (
                <AdminTableLink href={catalogAdminRoutes.productDetail(row.id)}>
                  {row.name}
                </AdminTableLink>
              ),
            },
            {
              key: "code",
              header: "Código",
              cell: (row) => <span className="font-mono text-xs">{row.code}</span>,
            },
            {
              key: "status",
              header: "Estado",
              cell: (row) => (
                <Badge variant={row.isActive ? "success" : "neutral"}>
                  {row.isActive ? "Activo" : "Inactivo"}
                </Badge>
              ),
            },
            {
              key: "variants",
              header: "Variantes",
              cell: (row) => String(row.variants.length),
            },
            {
              key: "stock",
              header: "Stock",
              cell: (row) => (
                <span title="total / reservado / disponible">
                  {row.stockTotal} / {row.reservedTotal} / {row.availableStock}
                </span>
              ),
            },
            {
              key: "tickets",
              header: "En entradas",
              cell: (row) => String(row.includedInTicketCount),
            },
            {
              key: "updated",
              header: "Actualizado",
              cell: (row) =>
                new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(row.updatedAt),
            },
            {
              key: "actions",
              header: "Acciones",
              cell: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button href={catalogAdminRoutes.productDetail(row.id)} variant="secondary">
                    Abrir
                  </Button>
                  <ProductListActiveButton productId={row.id} isActive={row.isActive} />
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
