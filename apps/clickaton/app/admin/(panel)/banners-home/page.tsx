import { AdminDataTable, AdminTableLink } from "@/components/admin/AdminDataTable";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { HomeBannerCarouselSettingsForm } from "@/components/admin/home-banners/HomeBannerCarouselSettingsForm";
import { SystemSlidesAdminPanel } from "@/components/admin/home-banners/SystemSlidesAdminPanel";
import { Button } from "@/components/ui/Button";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import {
  getHomeBannerCarouselSettings,
  listHomeBanners,
  listSystemSlidesForAdmin,
} from "@/lib/admin/home-banners/queries";
import {
  deleteHomeBannerAction,
  moveHomeBannerAction,
  toggleHomeBannerActiveAction,
} from "@/lib/admin/home-banners/mutations";
import {
  DEFAULT_HOME_BANNER_CAROUSEL,
  HOME_BANNER_LINK_LABELS,
} from "@/lib/admin/home-banners/types";

export default async function AdminHomeBannersPage() {
  await requireClickatonAdmin();
  const [result, carouselResult, systemResult] = await Promise.all([
    listHomeBanners(),
    getHomeBannerCarouselSettings(),
    listSystemSlidesForAdmin(),
  ]);
  const carousel = carouselResult.ok ? carouselResult.data : DEFAULT_HOME_BANNER_CAROUSEL;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Banners del inicio"
        description="Organizá el carrusel superior: orden, imágenes, texto y destino del clic (maratón, página o enlace externo)."
        breadcrumbs={[{ label: "Banners del inicio" }]}
        actions={
          <Button href={`${adminRoutes.homeBanners}/nuevo`} variant="primary" className="min-h-11">
            Agregar banner
          </Button>
        }
      />

      {!carouselResult.ok ? (
        <AdminMigrationNotice message={carouselResult.message} />
      ) : null}
      <HomeBannerCarouselSettingsForm initial={carousel} />

      {!systemResult.ok ? (
        <AdminMigrationNotice message={systemResult.message} />
      ) : (
        <SystemSlidesAdminPanel
          config={systemResult.data.config}
          editions={systemResult.data.editions}
          news={systemResult.data.news}
        />
      )}

      {!result.ok ? (
        <AdminMigrationNotice message={result.message} />
      ) : result.data.length === 0 ? (
        <div className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-4 py-10 text-center">
          <p className="text-lg text-ck-text">Todavía no hay banners custom</p>
          <p className="mt-2 text-sm text-ck-text-secondary">
            Si creás banners custom activos, reemplazan a los de sistema en el Home. Mientras tanto
            se usan ediciones y novedades (arriba).
          </p>
          <div className="mt-6">
            <Button href={`${adminRoutes.homeBanners}/nuevo`} variant="primary">
              Agregar banner
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ck-text">
              Banners custom
            </h2>
            <p className="mt-2 text-sm text-ck-text-secondary">
              Si hay al menos uno activo, el Home usa solo esta lista (no los de sistema).
            </p>
          </div>
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
                  <form action={toggleHomeBannerActiveAction}>
                    <input type="hidden" name="bannerId" value={row.id} />
                    <button
                      type="submit"
                      className={
                        row.isActive
                          ? "text-sm text-emerald-400 hover:underline"
                          : "text-sm text-ck-text-muted hover:underline"
                      }
                    >
                      {row.isActive ? "Activo" : "Inactivo"}
                    </button>
                  </form>
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
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <form action={moveHomeBannerAction}>
                    <input type="hidden" name="bannerId" value={row.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" className="text-sm text-ck-yellow hover:underline">
                      Subir
                    </button>
                  </form>
                  <form action={moveHomeBannerAction}>
                    <input type="hidden" name="bannerId" value={row.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" className="text-sm text-ck-yellow hover:underline">
                      Bajar
                    </button>
                  </form>
                  <form action={toggleHomeBannerActiveAction}>
                    <input type="hidden" name="bannerId" value={row.id} />
                    <button type="submit" className="text-sm text-ck-text hover:underline">
                      {row.isActive ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>
              </>
            )}
          />
        </div>
      )}
    </div>
  );
}
