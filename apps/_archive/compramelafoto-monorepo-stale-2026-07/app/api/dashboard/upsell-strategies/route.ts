import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { UpsellStrategyStatus } from "@prisma/client";
import {
  validateAvailability,
  isCapability,
  UPSELL_CAPABILITIES,
} from "@/lib/upsells/capabilities";

const CAPABILITY_LABELS: Record<string, string> = {
  DIGITAL_SALES: "Ventas digitales",
  PRINT_SALES: "Impresiones",
  RETOUCH_PRO: "Retoque pro",
  EXPRESS_DELIVERY: "Entrega express",
  STORAGE_EXTEND: "Extensión de almacenamiento",
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: Lista estrategias de upsell con disponibilidad para el fotógrafo actual.
 * available = tiene capabilities requeridas y config mínima (sin álbum para STORAGE_EXTEND).
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado." },
        { status: 401 }
      );
    }

    const [strategies, settings] = await Promise.all([
      prisma.upsellStrategy.findMany({
        where: {
          enabledGlobally: true,
          status: { in: [UpsellStrategyStatus.BETA, UpsellStrategyStatus.APPROVED] },
        },
        include: { userConfigs: { where: { userId: user.id } } },
        orderBy: { slug: "asc" },
      }),
      prisma.photographerSalesSettings.findUnique({
        where: { userId: user.id },
      }),
    ]);

    const userSettings = settings as Parameters<typeof validateAvailability>[0]["userSettings"] | null;
    const capsSet = new Set<string>();
    if (userSettings) {
      const fromFlags = [
        userSettings.digitalEnabled && "DIGITAL_SALES",
        userSettings.printsEnabled && "PRINT_SALES",
        userSettings.retouchEnabled && "RETOUCH_PRO",
        userSettings.expressEnabled && "EXPRESS_DELIVERY",
        userSettings.storageExtendEnabled && "STORAGE_EXTEND",
      ].filter(Boolean) as string[];
      const fromArray = (userSettings.capabilities ?? []).filter((c) =>
        UPSELL_CAPABILITIES.includes(c as any)
      );
      const src = fromArray.length > 0 ? fromArray : fromFlags;
      src.forEach((c) => capsSet.add(c));
    }

    const list = strategies.map((s) => {
      const required = (s.requiresCapabilities ?? []).filter((c) => isCapability(c));
      let available = true;
      let missingReason = "";

      for (const cap of required) {
        if (!capsSet.has(cap)) {
          available = false;
          missingReason = `Activá "${CAPABILITY_LABELS[cap] ?? cap}" en Ventas para usar este upsell.`;
          break;
        }
        if (!validateAvailability({ capability: cap, userSettings, album: null })) {
          available = false;
          missingReason = `Completá la configuración de "${CAPABILITY_LABELS[cap] ?? cap}" (precios/fulfillment).`;
          break;
        }
      }

      const userConfig = s.userConfigs[0];
      const enabledByUser = userConfig ? userConfig.enabled : true;

      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        description: s.description,
        requiredCapabilities: s.requiresCapabilities,
        requiredCapabilitiesLabels: required.map((c) => CAPABILITY_LABELS[c] ?? c),
        available,
        enabledByUser,
        missingReason: available ? null : missingReason,
      };
    });

    return NextResponse.json({ strategies: list });
  } catch (e) {
    return NextResponse.json(
      { error: "Error al cargar estrategias." },
      { status: 500 }
    );
  }
}
