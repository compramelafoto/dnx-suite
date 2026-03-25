import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, urlToR2Key } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const expired = await prisma.printOrderItem.findMany({
      where: {
        printExpiresAt: { lt: now },
        fileKey: { not: "" },
      },
      select: { id: true, fileKey: true },
      take: 200,
    });

    let deleted = 0;
    for (const item of expired) {
      const r2Key = urlToR2Key(item.fileKey);
      if (r2Key.startsWith("prints/carnet/") || r2Key.startsWith("prints/polaroids/")) {
        await deleteFromR2(r2Key).catch(() => {});
        deleted += 1;
      }
      await prisma.printOrderItem.update({
        where: { id: item.id },
        data: { printExpiresAt: null },
      });
    }

    return NextResponse.json({ ok: true, deleted }, { status: 200 });
  } catch (err: any) {
    console.error("CLEANUP EXPIRED PRINTS ERROR >>>", err);
    return NextResponse.json(
      { error: "Error limpiando impresiones vencidas", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
