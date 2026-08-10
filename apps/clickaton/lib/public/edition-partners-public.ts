import { prisma } from "@repo/db";
import {
  groupPartnersForPublicDisplay,
  isPartnerClickTrackingEnabled,
  partnerRedirectPath,
  resolveParticipationDestinationUrl,
  resolvePartnerLogoForSurface,
  resolvePublicRoleLabel,
  type PublicPartnerDisplayItem,
  type PublicPartnerGroup,
} from "@repo/partners";

/** `false` oculta el bloque público; cualquier otro valor (o ausente) lo muestra si hay grupos. */
export function isClickatonPartnersPublicEnabled(): boolean {
  return process.env.CLICKATON_PARTNERS_PUBLIC_ENABLED !== "false";
}

/**
 * Agrupamiento público de partners de una edición Clickatón.
 * Soft-read: no crea datos. Omite grupos vacíos y SUPPLIER.
 * Links: `/r/<trackingKey>` cuando tracking activo + destino.
 */
export async function listEditionPartnerPublicGroups(
  editionId: string,
): Promise<PublicPartnerGroup[]> {
  if (!isClickatonPartnersPublicEnabled()) return [];

  try {
    const rows = await prisma.dnxPartnerParticipation.findMany({
      where: {
        application: "CLICKATON",
        contextType: "EDITION",
        contextId: editionId,
        archivedAt: null,
        status: { in: ["CONFIRMED", "ACTIVE", "COMPLETED"] },
        publicVisibility: "PUBLIC",
      },
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            websiteUrl: true,
            status: true,
            brandAssets: {
              where: {
                archivedAt: null,
                status: "ACTIVE",
                approvalStatus: "APPROVED",
              },
              select: {
                id: true,
                name: true,
                type: true,
                backgroundType: true,
                status: true,
                approvalStatus: true,
                isPrimary: true,
                fileUrl: true,
                storageKey: true,
                altText: true,
                width: true,
                height: true,
                mimeType: true,
                archivedAt: true,
              },
            },
          },
        },
        outboundLinks: {
          where: { placement: "LOGO", status: "ACTIVE", archivedAt: null },
          select: { trackingKey: true },
          take: 1,
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    const trackingOn = isPartnerClickTrackingEnabled();

    const items: PublicPartnerDisplayItem[] = rows
      .filter((r) => r.partner.status !== "ARCHIVED")
      .map((r) => {
        // Franja sobre fondo negro: preferir horizontal + tratamiento DARK (legado LOGO_LIGHT).
        const logo = resolvePartnerLogoForSurface({
          assets: r.partner.brandAssets as never,
          surface: "DARK",
          preferredType: "LOGO_HORIZONTAL",
          logoUrl: r.partner.logoUrl,
        });
        const destination = resolveParticipationDestinationUrl({
          participationDestinationUrl: r.destinationUrl,
          partnerWebsiteUrl: r.partner.websiteUrl,
        });
        const link = r.outboundLinks[0];
        let websiteUrl: string | null = null;
        if (destination) {
          if (trackingOn && r.clickTrackingEnabled !== false && link?.trackingKey) {
            websiteUrl = partnerRedirectPath(link.trackingKey);
          } else {
            websiteUrl = destination;
          }
        }
        return {
          participationId: r.id,
          partnerId: r.partnerId,
          partnerName: r.partner.name,
          partnerSlug: r.partner.slug,
          logoUrl: logo.source === "placeholder" ? null : logo.url,
          websiteUrl,
          institutionalRole: r.institutionalRole,
          displayTier: r.displayTier,
          displayOrder: r.displayOrder,
          publicRoleLabel: r.publicRoleLabel,
          resolvedRoleLabel: resolvePublicRoleLabel(
            r.institutionalRole,
            r.publicRoleLabel,
          ),
          title: r.title,
          description: r.description,
          status: r.status,
          publicVisibility: r.publicVisibility,
        };
      });

    return groupPartnersForPublicDisplay(items);
  } catch (err) {
    console.error("[clickaton.partners] public groups unavailable:", err);
    return [];
  }
}
