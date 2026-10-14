import { NextRequest, NextResponse } from "next/server";
import { OrderOrigin, OrderStatus, prisma } from "@/lib/prisma";
import { parseExternalPreventaRefs } from "@/lib/canje-externo/external-preventa";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { logLegacyPreventaUsage } from "@/lib/observability/legacy-preventa-usage";
import { emptySlotIds, parseDesignV2Data } from "@/lib/design-v2/design-data";
import { ubicarPedido } from "@/lib/schools/embudo-pedidos-escolares";

type DisenoFila = {
  id: number;
  status: string;
  reviewNote: string | null;
  /** Huecos sin foto (sólo se calcula para los que esperan revisión). */
  emptySlots: number;
  /** Producción: lote de impresión y fechas de enviado, impreso y entregado. */
  printBatchName: string | null;
  sentToPrintAt: Date | null;
  printedAt: Date | null;
  deliveredAt: Date | null;
};

const PRODUCCION = { printBatchName: true, sentToPrintAt: true, printedAt: true, deliveredAt: true } as const;

function produccion(d: {
  printBatchName: string | null;
  sentToPrintAt: Date | null;
  printedAt: Date | null;
  deliveredAt: Date | null;
}) {
  return {
    printBatchName: d.printBatchName,
    sentToPrintAt: d.sentToPrintAt,
    printedAt: d.printedAt,
    deliveredAt: d.deliveredAt,
  };
}

/** Huecos vacíos de los diseños que esperan revisión: aprobar en lote avisa si van a salir vacíos. */
async function huecosVaciosDe(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.designProject.findMany({
    where: { id: { in: ids } },
    select: { id: true, currentRevision: { select: { dataJson: true } } },
  });
  const out = new Map<number, number>();
  for (const r of rows) {
    const data = parseDesignV2Data(r.currentRevision?.dataJson);
    out.set(r.id, data ? emptySlotIds(data).length : 0);
  }
  return out;
}

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
                reviewNote: true,
                ...PRODUCCION,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const pendientesTienda = orders.flatMap((o) =>
      o.items
        .map((i) => i.designProject)
        .filter((d): d is NonNullable<typeof d> => d?.status === "PENDING_PHOTOGRAPHER_APPROVAL")
        .map((d) => d.id),
    );
    const huecosTienda = await huecosVaciosDe(pendientesTienda);

    const payload: Array<Record<string, unknown>> = orders.map((o) => {
      const { items: rawItems, ...orderRest } = o;
      const disenos: DisenoFila[] = rawItems
        .map((i) => i.designProject)
        .filter((d): d is NonNullable<typeof d> => d != null)
        .map((d) => ({
          id: d.id,
          status: d.status,
          reviewNote: d.reviewNote,
          emptySlots: huecosTienda.get(d.id) ?? 0,
          ...produccion(d),
        }));
      return {
        ...orderRest,
        kind: "TIENDA_ESCOLAR",
        isDemo: false,
        paso: ubicarPedido({
          kind: "TIENDA_ESCOLAR",
          orderStatus: o.status,
          items: rawItems.map((i) => ({
            status: i.status,
            diseno: i.designProject ? { status: i.designProject.status, ...produccion(i.designProject) } : null,
          })),
        }),
        disenos,
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
      const [disenos, conCopias] = canjes.length
        ? await Promise.all([
            prisma.designProject.findMany({
              where: { albumOrderId: { in: canjes } },
              select: { id: true, status: true, albumOrderId: true, reviewNote: true, ...PRODUCCION },
              orderBy: { id: "asc" },
            }),
            // Canjes con copias impresas o cuadros: sin librito, igual hay algo para imprimir.
            prisma.orderItem.findMany({
              where: { orderId: { in: canjes }, productType: { not: "DIGITAL" } },
              select: { orderId: true },
              distinct: ["orderId"],
            }),
          ])
        : [[], []];
      const canjesConCopias = new Set(conCopias.map((c) => c.orderId));
      const huecosPacks = await huecosVaciosDe(
        disenos.filter((d) => d.status === "PENDING_PHOTOGRAPHER_APPROVAL").map((d) => d.id),
      );
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
        const delCanje = disenos.filter((d) => p.redemptionOrderId != null && d.albumOrderId === p.redemptionOrderId);
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
          isDemo: p.isTest,
          paso: ubicarPedido({
            kind: "PACK_EXTERNO",
            canjeado: p.redemptionOrderId != null,
            disenos: delCanje.map((d) => ({ status: d.status, ...produccion(d) })),
            tieneCopiasFisicas: p.redemptionOrderId != null && canjesConCopias.has(p.redemptionOrderId),
          }),
          disenos: delCanje.map(
            (d): DisenoFila => ({
              id: d.id,
              status: d.status,
              reviewNote: d.reviewNote,
              emptySlots: huecosPacks.get(d.id) ?? 0,
              ...produccion(d),
            }),
          ),
          album: p.album ? { ...p.album, school: escuela } : null,
          schoolCourse: externo?.courseName ? { id: 0, name: externo.courseName, division: null } : null,
          items: delCanje.map((d) => ({ id: 0, status: "", designProjectId: d.id, designProjectStatus: d.status })),
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
