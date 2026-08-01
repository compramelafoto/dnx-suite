import { notFound } from "next/navigation";
import { HomeBannerForm } from "@/components/admin/home-banners/HomeBannerForm";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { listEditionOptions } from "@/lib/admin/editions/queries";
import { getHomeBannerById } from "@/lib/admin/home-banners/queries";
import { bannerToFormInput } from "@/lib/admin/home-banners/types";

type Props = { params: Promise<{ bannerId: string }> };

export default async function EditHomeBannerPage({ params }: Props) {
  await requireClickatonAdmin();
  const { bannerId } = await params;
  const [bannerResult, editionsResult] = await Promise.all([
    getHomeBannerById(bannerId),
    listEditionOptions(),
  ]);

  if (!bannerResult.ok) return <AdminMigrationNotice message={bannerResult.message} />;
  if (!bannerResult.data) notFound();
  if (!editionsResult.ok) return <AdminMigrationNotice message={editionsResult.message} />;

  const banner = bannerResult.data;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`Editar: ${banner.title}`}
        breadcrumbs={[
          { label: "Banners Home", href: adminRoutes.homeBanners },
          { label: "Editar" },
        ]}
      />
      <HomeBannerForm
        mode="edit"
        bannerId={banner.id}
        initialValues={bannerToFormInput(banner)}
        editions={editionsResult.data.map((e) => ({ id: e.id, name: e.name }))}
        cancelHref={adminRoutes.homeBanners}
      />
    </div>
  );
}
