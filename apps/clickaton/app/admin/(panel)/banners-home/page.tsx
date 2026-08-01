import { AdminDataTable, AdminTableLink } from "@/components/admin/AdminDataTable";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/Button";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { listHomeBanners } from "@/lib/admin/home-banners/queries";
import {
  deleteHomeBannerAction,
  moveHomeBannerAction,
} from "@/lib/admin/home-banners/mutations";
import { HOME_BANNER_LINK_LABELS } from "@/lib/admin/home-banners/types";

export default async function AdminHomeBannersPage() {
  await requireClickatonAdmin();
  const result = await listHomeBanners();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Banners del Home"
        description="Organizá el carousel superior: orden, imágenes, texto y destino del clic (maratón, página o link externo)."
        breadcrumbs={[{ label: "Banners Home" }]}
        actions={
          <Button href={`${adminRoutes.homeBanners}/nuevo`} variant="primary">
            Agregar banner
          </Button>
        }
      />

      {!result.ok ? (
        <AdminMigrationNotice message={result.message} />
      ) : result.data.length === 0 ? (
        <div className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-4 py-10 text-center">
          <p className="text-lg text-ck-text">No hay banners todavía</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            Creá el primero. Mientras tanto el Home puede mostrar ediciones publicadas como fallback.
          </p>
          <div className="mt-6">
            <Button href={`${adminRoutes.homeBanners}/nuevo`} variant="primary">
              Agregar banner
            </Button>
          </div>
        </div>
      ) : (
        <AdminDataTable
          rows={result.data}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "order",
              header: "Orden",
              cell: (row) => (
                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-ck-text-muted">{row.sortOrder}</span>
                  <form action={moveHomeBannerAction}>
                    <input type="hidden" name="bannerId" value={row.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" className="text-xs text-ck-yellow hover:underline">
                      ↑
                    </button>
                  </form>
                  <form action={moveHomeBannerAction}>
                    <input type="hidden" name="bannerId" value={row.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" className="text-xs text-ck-yellow hover:underline">
                      ↓
                    </button>
                  </form>
                </div>
              ),
            },
            {
              key: "title",
              header: "Banner",
              cell: (row) => (
                <AdminTableLink href={`${adminRoutes.homeBanners}/${row.id}/editar`}>
                  {row.title}
                </AdminTableLink>
              ),
            },
            {
              key: "link",
              header: "Destino",
              hideOnMobile: true,
              cell: (row) => (
                <span className="text-sm text-ck-text-secondary">
                  {HOME_BANNER_LINK_LABELS[row.linkType]}
                  {row.linkType === "EDITION" && row.edition
                    ? ` · ${row.edition.name}`
                    : row.href
                      ? ` · ${row.href}`
                      : ""}
                </span>
              ),
            },
            {
              key: "active",
              header: "Estado",
              cell: (row) => (
                <span className={row.isActive ? "text-emerald-400" : "text-ck-text-muted"}>
                  {row.isActive ? "Activo" : "Inactivo"}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              cell: (row) => (
                <div className="flex flex-wrap gap-3">
                  <AdminTableLink href={`${adminRoutes.homeBanners}/${row.id}/editar`}>
                    Editar
                  </AdminTableLink>
                  <form action={deleteHomeBannerAction}>
                    <input type="hidden" name="bannerId" value={row.id} />
                    <button type="submit" className="text-sm text-red-400 hover:underline">
                      Quitar
                    </button>
                  </form>
                </div>
              ),
            },
          ]}
          mobileCard={(row) => (
            <>
              <AdminTableLink href={`${adminRoutes.homeBanners}/${row.id}/editar`}>
                {row.title}
              </AdminTableLink>
              <p className="text-sm text-ck-text-secondary">
                {HOME_BANNER_LINK_LABELS[row.linkType]} · {row.isActive ? "Activo" : "Inactivo"}
              </p>
            </>
          )}
        />
      )}
    </div>
  );
}
