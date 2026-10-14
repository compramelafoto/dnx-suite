import { NextRequest, NextResponse } from "next/server";
import { OrderOrigin, OrderStatus, prisma } from "@/lib/prisma";
import { parseExternalPreventaRefs } from "@/lib/canje-externo/external-preventa";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { logLegacyPreventaUsage } from "@/lib/observability/legacy-preventa-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: Listar pedidos escolares (PreCompraOrder con schoolCourseId o álbum vinculado a escuela) */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get("schoolId");
    const albumId = searchParams.get("albumId");
    const status = searchParams.get("status");

    const where: any = {
      album: { userId: user.id },
    };

    if (schoolId && Number.isFinite(Number(schoolId))) {
      where.album = { ...where.album, schoolId: Number(schoolId) };
    }
    if (albumId && Number.isFinite(Number(albumId))) {
      where.albumId = Number(albumId);
    }
    if (status && ["CREATED", "PAID_HELD", "CANCELED"].includes(status)) {
      where.status = status;
    }
    // Los estados de los packs cobrados por fuera no existen en la tienda escolar.
    const soloPacksExternos = status === "POR_CANJEAR" || status === "CANJEADO" || status === "DEMO";

    const orders = soloPacksExternos ? [] : await prisma.preCompraOrder.findMany({
      where,
      include: {
        album: { select: { id: true, title: true, publicSlug: true, schoolId: true, school: { select: { id: true, name: true } } } },
        schoolCourse: { select: { id: true, name: true, division: true } },
        items: {
          select: {
            id: true,
            status: true,
            designProject: {
              select: {
                id: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const payload: Array<Record<string, unknown>> = orders.map((o) => {
      const { items: rawItems, ...orderRest } = o;
      return {
        ...orderRest,
        kind: "TIENDA_ESCOLAR",
        items: rawItems.map((item) => ({
          id: item.id,
          status: item.status,
          designProjectId: item.designProject?.id ?? null,
          designProjectStatus: item.designProject?.status ?? null,
        })),
      };
    });

    /*
     * Packs cobrados por fuera (importados del Excel, como San Patricio) y sus pruebas DEMO.
     * Son pedidos del álbum, no de la tienda escolar, así que antes no aparecían acá: ni los 500
     * de las familias ni los canjes de prueba del fotógrafo.
     */
    const incluirExternos = !status || soloPacksExternos;
    if (incluirExternos) {
      const escuelaElegida =
        schoolId && Number.isFinite(Number(schoolId))
          ? await prisma.school.findUnique({ where: { id: Number(schoolId) }, select: { id: true, name: true } })
          : null;
      const packs = await prisma.order.findMany({
        where: {
          origin: OrderOrigin.PREVENTA_PACK,
          status: OrderStatus.PAID,
          album: { userId: user.id },
          ...(albumId && Number.isFinite(Number(albumId)) ? { albumId: Number(albumId) } : {}),
          ...(status === "DEMO" ? { isTest: true } : {}),
          ...(status === "POR_CANJEAR" ? { isTest: false, redemptionOrderId: null } : {}),
          ...(status === "CANJEADO" ? { isTest: false, redemptionOrderId: { not: null } } : {}),
        },
        select: {
          id: true,
          createdAt: true,
          buyerEmail: true,
          buyerName: true,
          buyerPhone: true,
          totalCents: true,
          isTest: true,
          redemptionOrderId: true,
          redemptionPaymentRefsJson: true,
          album: { select: { id: true, title: true, publicSlug: true, schoolId: true, school: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      const canjes = packs.map((p) => p.redemptionOrderId).filter((id): id is number => id != null);
      const disenos = canjes.length
        ? await prisma.designProject.findMany({
            where: { albumOrderId: { in: canjes } },
            select: { id: true, status: true, albumOrderId: true },
          })
        : [];
      for (const p of packs) {
        const externo = parseExternalPreventaRefs(p.redemptionPaymentRefsJson);
        // Sólo los packs cargados del Excel y las pruebas: los packs comprados en la plataforma
        // ya tienen su pedido escolar.
        if (!externo && !p.isTest) continue;
        const escuela = p.album?.school ?? (externo?.schoolName ? { id: 0, name: externo.schoolName } : null);
        if (escuelaElegida) {
          const coincide =
            p.album?.schoolId === escuelaElegida.id ||
            (escuela?.name ?? "").trim().toLowerCase() === escuelaElegida.name.trim().toLowerCase();
          if (!coincide) continue;
        }
        const nombre = externo?.studentName?.trim() ?? "";
        payload.push({
          kind: "PACK_EXTERNO",
          id: p.id,
          createdAt: p.createdAt,
          buyerEmail: p.buyerEmail ?? "",
          buyerName: p.buyerName ?? externo?.parentName ?? null,
          buyerPhone: p.buyerPhone,
          studentFirstName: nombre || null,
          studentLastName: null,
          // Order.totalCents está en pesos; la pantalla espera centavos como la tienda escolar.
          totalCents: p.isTest ? 0 : Math.round(Number(p.totalCents ?? 0) * 100),
          status: p.isTest ? "DEMO" : p.redemptionOrderId != null ? "CANJEADO" : "POR_CANJEAR",
          redemptionOrderId: p.redemptionOrderId,
          album: p.album ? { ...p.album, school: escuela } : null,
          schoolCourse: externo?.courseName ? { id: 0, name: externo.courseName, division: null } : null,
          items: disenos
            .filter((d) => d.albumOrderId === p.redemptionOrderId)
            .map((d) => ({ id: 0, status: "", designProjectId: d.id, designProjectStatus: d.status })),
        });
      }
      payload.sort((a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime());
    }

    logLegacyPreventaUsage({
      source: "legacy_school_orders",
      route: "/api/fotografo/school-orders",
      method: "GET",
      resultCount: payload.length,
      filters: {
        schoolId: schoolId ?? null,
        albumId: albumId ?? null,
        status: status ?? null,
      },
    });

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error("GET /api/fotografo/school-orders:", err);
    return NextResponse.json({ error: "Error listando pedidos" }, { status: 500 });
  }
}
