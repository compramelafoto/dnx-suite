import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireStoreConfigurer } from "@/lib/store/access";
import { loadShippingZones, toShippingSource } from "@/lib/store/shipping/repository";
import {
  SHIPPING_SETTINGS_DEFAULTS,
  bpsToPercentText,
  minorToEditableText,
  type ShippingSettingsValues,
} from "@/lib/store/shipping/settings-form";
import { describeCorreoArgentinoConnection } from "@/lib/integrations/correo-argentino/credentials";
import { maskCustomerId } from "@/lib/integrations/correo-argentino/user-message";
import { ShippingSettingsForm } from "./shipping-settings-form";
import { ShippingZonesEditor, type ZoneView } from "./zones-editor";
import { CorreoConnectionCard } from "./correo-connection";
import { describeAndreaniConnection } from "@/lib/integrations/andreani/credentials";
import { AndreaniConnectionCard } from "./andreani-connection";

export const dynamic = "force-dynamic";

export default async function TiendaEnviosPage() {
  const { workspace } = await requireStoreConfigurer();

  const [fila, zonas, correo, andreani, sinPeso] = await Promise.all([
    prisma.storeShippingSettings.findUnique({
      where: { workspaceId: workspace.id },
      select: {
        pickupEnabled: true,
        homeDeliveryEnabled: true,
        branchDeliveryEnabled: true,
        source: true,
        tableAsFallback: true,
        originPostalCode: true,
        surchargeKind: true,
        surchargeValue: true,
        packagingGrams: true,
        defaultUnitGrams: true,
        boxLengthCm: true,
        boxWidthCm: true,
        boxHeightCm: true,
        handlingNote: true,
      },
    }),
    loadShippingZones(workspace.id),
    describeCorreoArgentinoConnection(workspace.id),
    // Enmascarada: nunca la contraseña, y códigos y contratos sólo con los últimos 4.
    describeAndreaniConnection(workspace.id),
    prisma.productStoreListing.findMany({
      where: {
        workspaceId: workspace.id,
        sellOnline: true,
        weightGrams: null,
        product: { workspaceId: workspace.id, isActive: true },
      },
      select: { productId: true, product: { select: { name: true } } },
      orderBy: { product: { name: "asc" } },
      take: 200,
    }),
  ]);

  const settings: ShippingSettingsValues = fila
    ? {
        ...fila,
        source: toShippingSource(fila.source),
        surchargeKind:
          fila.surchargeKind === "PERCENT" || fila.surchargeKind === "FIXED" ? fila.surchargeKind : "NONE",
      }
    : SHIPPING_SETTINGS_DEFAULTS;

  const surchargeText =
    settings.surchargeKind === "PERCENT"
      ? bpsToPercentText(settings.surchargeValue)
      : settings.surchargeKind === "FIXED"
        ? minorToEditableText(settings.surchargeValue)
        : "";

  const zonasVista: ZoneView[] = zonas.map((z) => ({
    id: z.id,
    name: z.name,
    postalCodes: z.postalCodes,
    provinceCodes: z.provinceCodes,
    isRestOfCountry: z.isRestOfCountry,
    rates: [...z.rates]
      .sort((a, b) => a.maxGrams - b.maxGrams)
      .map((r) => ({ maxGrams: r.maxGrams, priceText: minorToEditableText(r.priceMinor) })),
  }));

  const correoActivo = correo?.status === "ACTIVE";
  const andreaniActivo = andreani?.status === "ACTIVE";
  const usaTabla = settings.source === "TABLE" || settings.tableAsFallback;
  const faltanZonas = settings.homeDeliveryEnabled && usaTabla && zonas.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Envíos"
        description="Cómo le llega lo comprado al cliente: retiro, envío a domicilio o a una sucursal de Correo Argentino o Andreani, y cuánto cuesta."
      />

      {correo && correo.status !== "ACTIVE" ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          Correo Argentino dejó de aceptar tus credenciales: volvé a conectarlo más abajo. Mientras tanto, los envíos
          {settings.tableAsFallback ? " se cotizan con tu tabla." : " por Correo no se pueden cotizar."}
        </p>
      ) : null}

      {andreani && andreani.status !== "ACTIVE" ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          Andreani dejó de aceptar tus credenciales: volvé a conectarlo más abajo. Mientras tanto, los envíos
          {settings.tableAsFallback ? " a domicilio se cotizan con tu tabla." : " por Andreani no se pueden cotizar."}
        </p>
      ) : null}

      {faltanZonas ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          El envío a domicilio está activo pero tu tabla no tiene zonas: cargá al menos una para que el comprador vea un
          precio.
        </p>
      ) : null}

      <ShippingSettingsForm
        settings={settings}
        surchargeText={surchargeText}
        correoActive={correoActivo}
        andreaniActive={andreaniActivo}
        andreaniBranchContract={Boolean(andreani?.contractBranch)}
      />

      <ShippingZonesEditor zones={zonasVista} />

      <CorreoConnectionCard
        connection={
          correo
            ? {
                status: correo.status,
                accountEmail: correo.accountEmail,
                env: correo.env,
                customerIdMasked: correo.customerId ? maskCustomerId(correo.customerId) : null,
              }
            : null
        }
      />

      <AndreaniConnectionCard
        connection={
          andreani
            ? {
                status: andreani.status,
                env: andreani.env,
                userMasked: andreani.user,
                clientCodeMasked: andreani.clientCode,
                contractHomeMasked: andreani.contractHome,
                contractBranchMasked: andreani.contractBranch,
                originBranch: andreani.originBranch,
              }
            : null
        }
        originPostalCode={settings.originPostalCode}
      />

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Productos sin peso</h2>
        {sinPeso.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todos los productos que vendés online tienen el peso cargado.</p>
        ) : (
          <>
            <p className="fo-helper">
              Estos productos se venden online y no tienen el peso cargado: para el envío se calcula con el peso por
              unidad por defecto ({settings.defaultUnitGrams} g). Cargalo en la ficha de cada uno para que el precio sea
              más exacto.
            </p>
            <ul className="space-y-1 text-sm">
              {sinPeso.map((l) => (
                <li key={l.productId}>
                  <Link href={`/ventas/catalogo/${l.productId}`} className="underline">
                    {l.product.name}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
