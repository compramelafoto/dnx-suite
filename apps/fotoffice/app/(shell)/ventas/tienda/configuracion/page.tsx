import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireStoreConfigurer } from "@/lib/store/access";
import { DEFAULT_RETURNS_POLICY, STORE_PUBLIC_SEGMENT } from "@/lib/store/constants";
import { loadPublicSlug } from "@/lib/blog/admin-queries";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { decimalArsToMinor, minorToDecimalString } from "@/lib/membership/money";
import { StoreSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function TiendaConfiguracionPage() {
  const { workspace } = await requireStoreConfigurer();

  const [settings, publicSlug, collector, categorias] = await Promise.all([
    prisma.storeSettings.findUnique({
      where: { workspaceId: workspace.id },
      select: {
        isOpen: true,
        pickupAddress: true,
        pickupHours: true,
        pickupInstructions: true,
        returnsPolicy: true,
        notifyEmail: true,
        bundleCategoryId: true,
        bundleQty: true,
        bundlePriceArs: true,
        bundleLabel: true,
      },
    }),
    loadPublicSlug(workspace.id),
    resolveWorkspaceCollector(workspace.id),
    // Para la promo "N por $X": las categorías de productos del negocio.
    prisma.productCategory.findMany({
      where: { workspaceId: workspace.id, isActive: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  // Sin fila todavía, la tienda está cerrada y sin nada cargado.
  const valores = settings
    ? {
        ...settings,
        bundlePriceArs:
          settings.bundlePriceArs === null ? null : minorToDecimalString(decimalArsToMinor(settings.bundlePriceArs)),
      }
    : {
        isOpen: false,
        pickupAddress: null,
        pickupHours: null,
        pickupInstructions: null,
        returnsPolicy: null,
        notifyEmail: null,
        bundleCategoryId: null,
        bundleQty: null,
        bundlePriceArs: null,
        bundleLabel: null,
      };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tienda online"
        description="Cuándo está abierta, dónde se retira lo comprado, qué política de devoluciones ve el comprador y a quién se avisa de cada pedido."
      />

      {!collector.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          Mercado Pago todavía no está conectado: podés dejar todo listo, pero para abrir la tienda primero{" "}
          <Link href="/workspace/configuracion/cobros" className="underline">
            conectá Mercado Pago en Configuración → Cobros
          </Link>
          .
        </p>
      ) : null}

      {valores.isOpen && publicSlug ? (
        <p className="text-sm text-[var(--fo-muted)]">
          La tienda está abierta en{" "}
          <Link href={`/w/${publicSlug}/${STORE_PUBLIC_SEGMENT}`} className="underline" target="_blank">
            /w/{publicSlug}/{STORE_PUBLIC_SEGMENT}
          </Link>
          .
        </p>
      ) : null}

      <StoreSettingsForm settings={valores} defaultReturnsPolicy={DEFAULT_RETURNS_POLICY} categories={categorias} />
    </div>
  );
}
