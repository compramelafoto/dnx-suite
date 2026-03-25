import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { UPSELL_CAPABILITIES, type Capability } from "@/lib/upsells/capabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function capabilitiesFromFlags(flags: {
  digitalEnabled?: boolean;
  printsEnabled?: boolean;
  retouchEnabled?: boolean;
  expressEnabled?: boolean;
  storageExtendEnabled?: boolean;
}): string[] {
  const caps: Capability[] = [];
  if (flags.digitalEnabled !== false) caps.push("DIGITAL_SALES");
  if (flags.printsEnabled) caps.push("PRINT_SALES");
  if (flags.retouchEnabled) caps.push("RETOUCH_PRO");
  if (flags.expressEnabled) caps.push("EXPRESS_DELIVERY");
  if (flags.storageExtendEnabled) caps.push("STORAGE_EXTEND");
  return caps;
}

export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado." },
        { status: 401 }
      );
    }

    const [settings, photographer] = await Promise.all([
      prisma.photographerSalesSettings.findUnique({
        where: { userId: user.id },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { preferredLabId: true },
      }),
    ]);

    if (!settings) {
      return NextResponse.json({
        capabilities: [] as string[],
        digitalEnabled: true,
        printsEnabled: false,
        retouchEnabled: false,
        expressEnabled: false,
        storageExtendEnabled: false,
        printsPriceListJson: null,
        printsFulfillmentJson: null,
        retouchPricingJson: null,
        expressPricingJson: null,
        storageExtendPricingJson: null,
        preferredLabId: photographer?.preferredLabId ?? null,
      });
    }

    return NextResponse.json({
      capabilities: settings.capabilities,
      digitalEnabled: settings.digitalEnabled,
      printsEnabled: settings.printsEnabled,
      retouchEnabled: settings.retouchEnabled,
      expressEnabled: settings.expressEnabled,
      storageExtendEnabled: settings.storageExtendEnabled,
      printsPriceListJson: settings.printsPriceListJson,
      printsFulfillmentJson: settings.printsFulfillmentJson,
      retouchPricingJson: settings.retouchPricingJson,
      expressPricingJson: settings.expressPricingJson,
      storageExtendPricingJson: settings.storageExtendPricingJson,
      preferredLabId: photographer?.preferredLabId ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Error al cargar configuración de ventas." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const capabilities =
      Array.isArray(body.capabilities) && body.capabilities.length > 0
        ? body.capabilities.filter((c: string) => UPSELL_CAPABILITIES.includes(c as Capability))
        : capabilitiesFromFlags({
            digitalEnabled: body.digitalEnabled,
            printsEnabled: body.printsEnabled,
            retouchEnabled: body.retouchEnabled,
            expressEnabled: body.expressEnabled,
            storageExtendEnabled: body.storageExtendEnabled,
          });

    let printsPriceListJson = body.printsPriceListJson ?? undefined;
    if (body.useOwnProductList === true && body.printsEnabled) {
      const products = await prisma.photographerProduct.findMany({
        where: { userId: user.id, isActive: true },
        select: { size: true, retailPrice: true },
      });
      const bySize = new Map<string, number>();
      for (const p of products) {
        const size = p.size?.trim();
        const price = p.retailPrice;
        if (!size || !Number.isFinite(price) || price <= 0) continue;
        const existing = bySize.get(size);
        if (existing == null || price < existing) bySize.set(size, price);
      }
      printsPriceListJson = Array.from(bySize.entries()).map(([size, price]) => ({ size, price }));
    }

    const data = {
      capabilities,
      digitalEnabled: Boolean(body.digitalEnabled),
      printsEnabled: Boolean(body.printsEnabled),
      retouchEnabled: Boolean(body.retouchEnabled),
      expressEnabled: Boolean(body.expressEnabled),
      storageExtendEnabled: Boolean(body.storageExtendEnabled),
      printsPriceListJson,
      printsFulfillmentJson: body.printsFulfillmentJson ?? undefined,
      retouchPricingJson: body.retouchPricingJson ?? undefined,
      expressPricingJson: body.expressPricingJson ?? undefined,
      storageExtendPricingJson: body.storageExtendPricingJson ?? undefined,
    };

    if (body.preferredLabId !== undefined) {
      const labId = body.preferredLabId === null || body.preferredLabId === "" ? null : Number(body.preferredLabId);
      await prisma.user.update({
        where: { id: user.id },
        data: { preferredLabId: Number.isFinite(labId) ? labId : null },
      });
    }

    const settings = await prisma.photographerSalesSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });

    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { preferredLabId: true },
    });
    return NextResponse.json({
      ...settings,
      preferredLabId: updatedUser?.preferredLabId ?? null,
    } as any);
  } catch (e) {
    return NextResponse.json(
      { error: "Error al guardar configuración de ventas." },
      { status: 500 }
    );
  }
}
