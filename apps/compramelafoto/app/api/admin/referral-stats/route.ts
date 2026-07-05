/**
 * GET /api/admin/referral-stats
 * Estadísticas de referidores: ranking con cantidad de referidos y monto ganado.
 * Query: fromDate, toDate (YYYY-MM-DD), sortBy (name|referrals|amount), sortOrder (asc|desc)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const fromDateStr = searchParams.get("fromDate") || "";
    const toDateStr = searchParams.get("toDate") || "";
    const sortBy = searchParams.get("sortBy") || "amount";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromDateStr) {
      const d = new Date(fromDateStr);
      if (!isNaN(d.getTime())) dateFilter.gte = new Date(d.setHours(0, 0, 0, 0));
    }
    if (toDateStr) {
      const d = new Date(toDateStr);
      if (!isNaN(d.getTime())) dateFilter.lte = new Date(d.setHours(23, 59, 59, 999));
    }

    const earningsWhere: { reversedAt: null; createdAt?: { gte?: Date; lte?: Date } } = {
      reversedAt: null,
    };
    if (Object.keys(dateFilter).length > 0) {
      earningsWhere.createdAt = dateFilter as { gte?: Date; lte?: Date };
    }

    // Total referidos por referidor (todos los que recomendó, hayan comprado o no)
    const attributions = await prisma.referralAttribution.groupBy({
      by: ["referrerUserId"],
      _count: { referredUserId: true },
    });

    const attributionsByReferrer = new Map<number, number>();
    const referrerIdsFromAttributions = new Set<number>();
    for (const a of attributions) {
      attributionsByReferrer.set(a.referrerUserId, a._count.referredUserId);
      referrerIdsFromAttributions.add(a.referrerUserId);
    }

    const earnings = await prisma.referralEarning.findMany({
      where: earningsWhere,
      select: {
        referralAmountCents: true,
        attributionId: true,
        attribution: {
          select: {
            referrerUserId: true,
            referredUserId: true,
            referrerUser: {
              select: {
                id: true,
                name: true,
                whatsapp: true,
                email: true,
              },
            },
          },
        },
      },
    });

    const byReferrer = new Map<
      number,
      {
        referrer: { id: number; name: string | null; whatsapp: string | null; email: string };
        referredWhoBought: Set<number>;
        totalCents: number;
      }
    >();

    for (const e of earnings) {
      const ref = e.attribution?.referrerUser;
      if (!ref) continue;
      let entry = byReferrer.get(ref.id);
      if (!entry) {
        entry = {
          referrer: {
            id: ref.id,
            name: ref.name ?? null,
            whatsapp: ref.whatsapp ?? null,
            email: ref.email,
          },
          referredWhoBought: new Set(),
          totalCents: 0,
        };
        byReferrer.set(ref.id, entry);
      }
      entry.referredWhoBought.add(e.attribution!.referredUserId);
      entry.totalCents += e.referralAmountCents ?? 0;
    }

    // Incluir referidores que tienen atribuciones pero no earnings (referidos que nunca compraron)
    const referrerIdsSet = new Set(referrerIdsFromAttributions);
    const referrerUsers = await prisma.user.findMany({
      where: { id: { in: Array.from(referrerIdsSet) } },
      select: { id: true, name: true, whatsapp: true, email: true },
    });
    const userById = new Map(referrerUsers.map((u) => [u.id, u]));
    for (const referrerId of referrerIdsSet) {
      if (byReferrer.has(referrerId)) continue;
      const u = userById.get(referrerId);
      if (!u) continue;
      byReferrer.set(referrerId, {
        referrer: {
          id: u.id,
          name: u.name ?? null,
          whatsapp: u.whatsapp ?? null,
          email: u.email,
        },
        referredWhoBought: new Set(),
        totalCents: 0,
      });
    }

    // Incluir todos los referidores con código (aunque tengan 0 atribuciones)
    const allReferrers = await prisma.referralCode.findMany({
      where: { isActive: true },
      select: { ownerUserId: true },
    });
    const missingReferrerIds = allReferrers
      .map((r) => r.ownerUserId)
      .filter((id) => !byReferrer.has(id));
    if (missingReferrerIds.length > 0) {
      const missingUsers = await prisma.user.findMany({
        where: { id: { in: missingReferrerIds } },
        select: { id: true, name: true, whatsapp: true, email: true },
      });
      for (const u of missingUsers) {
        byReferrer.set(u.id, {
          referrer: {
            id: u.id,
            name: u.name ?? null,
            whatsapp: u.whatsapp ?? null,
            email: u.email,
          },
          referredWhoBought: new Set(),
          totalCents: 0,
        });
      }
    }

    let rows = Array.from(byReferrer.entries()).map(([referrerId, v]) => ({
      referrerId: v.referrer.id,
      name: v.referrer.name ?? v.referrer.email,
      whatsapp: v.referrer.whatsapp,
      referredTotal: attributionsByReferrer.get(referrerId) ?? 0,
      referredWhoBought: v.referredWhoBought.size,
      totalCents: v.totalCents,
    }));

    const ord = sortOrder === "asc" ? 1 : -1;
    if (sortBy === "name") {
      rows.sort((a, b) => ord * (a.name.localeCompare(b.name, "es") || 0));
    } else if (sortBy === "referrals") {
      rows.sort((a, b) => ord * (a.referredTotal - b.referredTotal));
    } else {
      rows.sort((a, b) => ord * (a.totalCents - b.totalCents));
    }

    return NextResponse.json({
      stats: rows,
      fromDate: fromDateStr || null,
      toDate: toDateStr || null,
    });
  } catch (err: unknown) {
    console.error("GET /api/admin/referral-stats ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo estadísticas de referidos" },
      { status: 500 }
    );
  }
}
