import { NextResponse } from "next/server";
import { isGlobalProductsCatalogPhase1Enabled } from "@/lib/catalog-products/feature-flag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ enabled: isGlobalProductsCatalogPhase1Enabled() });
}
