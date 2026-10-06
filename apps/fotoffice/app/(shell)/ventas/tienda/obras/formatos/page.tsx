import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { formatMoney } from "@/lib/format";
import { requireStoreConfigurer } from "@/lib/store/access";
import { minLongSidePx } from "@/lib/store/artworks/resolution";
import { DEFAULT_DPI } from "@/lib/store/artworks/format-form";
import { FormatEditor, type PrintFormatView } from "./format-editor";
import { PrintSettingsForm } from "./print-settings-form";

export const dynamic = "force-dynamic";

/** Formatos de impresión de las obras (copias y cuadros) y la resolución mínima. */
export default async function TiendaFormatosPage() {
  const { workspace } = await requireStoreConfigurer();
  const [settings, formatos] = await Promise.all([
    prisma.storePrintSettings.findUnique({ where: { workspaceId: workspace.id }, select: { minDpi: true } }),
    prisma.printFormat.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);
  const minDpi = settings?.minDpi ?? DEFAULT_DPI;

  const vistas: PrintFormatView[] = formatos.map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.kind === "FRAME" ? "FRAME" : "PRINT",
    widthCm: f.widthCm,
    heightCm: f.heightCm,
    price: f.priceArs.toString(),
    cost: f.costArs?.toString() ?? "",
    weightGrams: f.weightGrams,
    packLengthCm: f.packLengthCm,
    packWidthCm: f.packWidthCm,
    packHeightCm: f.packHeightCm,
    isActive: f.isActive,
    priceText: formatMoney(f.priceArs, "ARS"),
    costText: f.costArs ? formatMoney(f.costArs, "ARS") : null,
    requiredPx: minLongSidePx(f, minDpi),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Formatos de impresión"
        description="Los tamaños y precios en que vendés las obras, como copia impresa o como cuadro."
      />
      <p className="text-sm">
        <Link href="/ventas/tienda/obras" className="underline">
          ← Volver a Obras
        </Link>
      </p>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Calidad de impresión</h2>
        <PrintSettingsForm minDpi={minDpi} />
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Formatos</h2>
        <FormatEditor formats={vistas} minDpi={minDpi} />
      </section>
    </div>
  );
}
