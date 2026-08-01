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
          title="Productos y kits"
          description="Configurá los artículos incluidos con la inscripción y las opciones que deberá elegir cada participante."
          breadcrumbs={[
            { label: "Productos y kits", href: catalogAdminRoutes.hub },
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
          title="Productos y kits"
          description="Configurá los artículos incluidos con la inscripción y las opciones que deberá elegir cada participante."
          breadcrumbs={[
            { label: "Productos y kits", href: catalogAdminRoutes.hub },
            { label: "Productos" },
          ]}
        />
        <AdminEmptyState
          title="Todavía no hay ediciones"
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
        title="Productos y kits"
        description="Configurá los artículos incluidos con la inscripción y las opciones que deberá elegir cada participante."
        breadcrumbs={[
          { label: "Productos y kits", href: catalogAdminRoutes.hub },
          { label: "Productos" },
        ]}
        actions={
          <Button href={newHref} variant="primary" className="min-h-11">
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
            placeholder="Nombre o código"
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
          <span className="text-ck-text-secondary">Talles u opciones</span>
          <Select name="variants" defaultValue={params.variants ?? "all"}>
            <option value="all">Todos</option>
            <option value="with">Con talles u opciones</option>
            <option value="without">Sin talles u opciones</option>
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
          title="No hay productos configurados"
          description="Agregá los artículos que se incluirán con la inscripción (por ejemplo remera u otros ítems). Después podés definir talles u opciones."
          note="Empezá creando el producto y después agregá talles desde el detalle."
          action={
            <Button href={newHref} variant="primary">
              Crear primer producto
            </Button>
          }
        />
      ) : products.length === 0 ? (
        <AdminEmptyState
          title="No encontramos resultados"
          description="Probá cambiar los filtros."
          action={
            <Button href={buildProductsHref({ editionId })} variant="secondary">
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <AdminDataTable
          rows={products}
          rowKey={(row) => row.id}
          mobileCard={(row) => (
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <AdminTableLink href={catalogAdminRoutes.productDetail(row.id)}>
                  {row.name}
                </AdminTableLink>
                <Badge variant={row.isActive ? "success" : "neutral"}>
                  {row.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              <p className="text-sm text-ck-text-secondary">
                {row.variants.length} talle{row.variants.length === 1 ? "" : "s"} u opción
                {row.variants.length === 1 ? "" : "es"} · Disponible {row.availableStock}
              </p>
              <p className="text-xs text-ck-text-muted">
                Incluido en {row.includedInTicketCount} entrada
                {row.includedInTicketCount === 1 ? "" : "s"}
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  href={catalogAdminRoutes.productDetail(row.id)}
                  variant="secondary"
                  className="min-h-11"
                >
                  Abrir
                </Button>
                <ProductListActiveButton productId={row.id} isActive={row.isActive} />
              </div>
            </div>
          )}
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
              header: "Talles / opciones",
              cell: (row) => String(row.variants.length),
            },
            {
              key: "stock",
              header: "Disponible",
              cell: (row) => String(row.availableStock),
            },
            {
              key: "tickets",
              header: "En entradas",
              cell: (row) => String(row.includedInTicketCount),
            },
            {
              key: "actions",
              header: "Acción",
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
