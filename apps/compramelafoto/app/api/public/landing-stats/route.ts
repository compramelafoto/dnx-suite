import { NextResponse } from "next/server";
import { unstable_noStore } from "next/cache";
import { getPlatformLandingStats } from "@/lib/platform-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  unstable_noStore(); // Evita caché de Next.js/Vercel
  try {
    const stats = await getPlatformLandingStats();

    return NextResponse.json(
      {
        daysActive: stats.daysActive,
        totalUsers: stats.totalUsers,
        totalPhotos: stats.totalPhotos,
        totalAmountSold: stats.totalAmountSold,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, s-maxage=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: unknown) {
    console.error("GET /api/public/landing-stats ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Error obteniendo estadísticas",
        daysActive: 0,
        totalUsers: 0,
        totalPhotos: 0,
        totalAmountSold: 0,
      },
      { status: 500 }
    );
  }
}
