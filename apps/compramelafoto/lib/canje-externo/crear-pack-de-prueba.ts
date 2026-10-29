import "server-only";
import {
  CheckoutPaymentSource,
  OrderOrigin,
  OrderStatus,
  Prisma,
  prisma,
} from "@/lib/prisma";
import { generatePackAccessToken } from "@/lib/preventa-canjeable/pack-access-tokens";
import {
  buildPreventaPackSnapshotV1,
  parsePreventaPackSnapshotV1,
} from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { parsePreCompraOrderIdFromPaymentRef } from "@/lib/preventa-canjeable/preventa-redeem-url";
import {
  accionSobrePackDePrueba,
  cantidadDeBeneficios,
  datosDeFamiliaParaPrueba,
  elegirPackFuente,
  plantillasDelSnapshot,
  prepararSnapshotDePrueba,
  snapshotArmaDiseno,
} from "./pack-de-prueba";

/** El link de la prueba dura lo mismo que el de una familia. */
const DIAS_DEL_LINK = 60;

const PACK_REAL = {
  origin: OrderOrigin.PREVENTA_PACK,
  status: OrderStatus.PAID,
  isTest: false,
} as const;

/**
 * Un chico real del padrón del álbum para la prueba, cuando no hay compra de la que copiarlo: así
 * el librito sale con un nombre, un curso y los compañeros de ese curso, y no con «Prueba Alumno».
 * Null si el álbum no tiene padrón.
 */
async function alumnoDeMuestra(albumId: number) {
  const fila = await prisma.albumStudentRosterEntry.findFirst({
    where: { albumId, isActive: true },
    orderBy: [{ courseName: "asc" }, { division: "asc" }, { snapshotLastName: "asc" }, { snapshotFirstName: "asc" }],
    select: { snapshotFirstName: true, snapshotLastName: true, courseName: true, division: true },
  });
  if (!fila) return null;
  return {
    studentFirstName: fila.snapshotFirstName,
    studentLastName: fila.snapshotLastName,
    buyerName: `Familia ${fila.snapshotLastName}`.trim(),
    curso: [fila.courseName, fila.division].filter((s) => s && s.trim()).join(" ") || null,
  };
}

/** ¿El álbum tiene algo para canjear? (packs vendidos o packs de preventa armados). */
export async function albumTienePacksCanjeables(albumId: number): Promise<boolean> {
  const [vendidos, definidos] = await Promise.all([
    prisma.order.count({
      where: { albumId, ...PACK_REAL, preventaPackSnapshotJson: { not: Prisma.AnyNull } },
    }),
    prisma.packDefinition.count({ where: { albumId, benefits: { some: {} } } }),
  ]);
  return vendidos + definidos > 0;
}

/**
 * ¿Se muestra «Probar canje» en el álbum, y se puede usar ya?
 *
 * Escolar es todo álbum marcado como escolar, con un colegio asociado o con packs de preventa:
 * la carpeta de San Patricio, por ejemplo, es un álbum «simple» con packs vendidos por fuera.
 * En un álbum escolar sin packs el botón aparece igual y explica que primero hay que armar uno.
 */
export async function estadoDePruebaDeCanje(
  albumId: number,
): Promise<{ escolar: boolean; disponible: boolean }> {
  const [album, disponible] = await Promise.all([
    prisma.album.findUnique({ where: { id: albumId }, select: { mode: true, schoolId: true } }),
    albumTienePacksCanjeables(albumId),
  ]);
  const escolar = disponible || album?.mode === "SCHOOL" || album?.schoolId != null;
  return { escolar, disponible };
}

export type PackDePruebaListo = {
  token: string;
  orderId: number;
  /** true: se reusó el pack de prueba que no se había canjeado; false: se creó uno nuevo. */
  reutilizado: boolean;
};

/**
 * "Probar como cliente": deja listo el pack de prueba del álbum y devuelve un link nuevo.
 *
 * - Se arma copiando un pack real del álbum (estructura, beneficios, alumno y curso), o, si
 *   todavía no se vendió ninguno, desde la definición del pack de preventa. Los packs reales
 *   no se tocan.
 * - Un solo pack de prueba por álbum: si el último no se canjeó, se actualiza ese; si ya se
 *   canjeó, se crea una copia nueva (como "Reiniciar prueba") y el canje anterior queda como
 *   pedido DEMO.
 * - Cada vez se genera un link nuevo (se guarda sólo el sha256) y se revocan los anteriores.
 */
export async function prepararPackDePrueba(albumId: number): Promise<PackDePruebaListo | { error: string }> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      id: true,
      deletedAt: true,
      user: { select: { email: true } },
      school: { select: { name: true } },
    },
  });
  if (!album || album.deletedAt) return { error: "No encontramos el álbum." };

  const [definicionesConPlantilla, previa] = await Promise.all([
    prisma.benefitDefinition.findMany({
      where: { packDefinition: { albumId }, templateV2Id: { not: null } },
      select: { id: true, templateV2Id: true },
    }),
    prisma.order.findFirst({
      where: { albumId, origin: OrderOrigin.PREVENTA_PACK, status: OrderStatus.PAID, isTest: true },
      orderBy: { id: "desc" },
      select: {
        id: true,
        redemptionOrderId: true,
        preventaPackSnapshotJson: true,
        redemptionPaymentRefsJson: true,
        buyerName: true,
      },
    }),
  ]);
  const porBeneficio = new Map(
    definicionesConPlantilla.flatMap((d) => (d.templateV2Id ? [[d.id, d.templateV2Id] as const] : []))
  );
  const plantillas = { porBeneficio, porPruebaAnterior: plantillasDelSnapshot(previa?.preventaPackSnapshotJson) };

  // 1) Pack real más completo del álbum.
  const reales = await prisma.order.findMany({
    where: { albumId, ...PACK_REAL, preventaPackSnapshotJson: { not: Prisma.AnyNull } },
    orderBy: { id: "desc" },
    take: 300,
    select: { id: true, preventaPackSnapshotJson: true },
  });
  const fuenteId = elegirPackFuente(
    reales.map((o) => ({
      id: o.id,
      beneficios: cantidadDeBeneficios(o.preventaPackSnapshotJson),
      conDiseno: snapshotArmaDiseno(o.preventaPackSnapshotJson, porBeneficio),
    }))
  );

  let snapshotBase: unknown = null;
  let familia: ReturnType<typeof datosDeFamiliaParaPrueba>;
  let fuente: string;
  const emailFotografo = album.user?.email ?? "";
  const colegio = album.school?.name ?? null;

  if (fuenteId != null) {
    const src = await prisma.order.findUniqueOrThrow({
      where: { id: fuenteId },
      select: {
        preventaPackSnapshotJson: true,
        redemptionPaymentRefsJson: true,
        buyerName: true,
        preCompraPaymentRef: true,
      },
    });
    const preCompraId = parsePreCompraOrderIdFromPaymentRef(src.preCompraPaymentRef);
    const pc = preCompraId
      ? await prisma.preCompraOrder.findUnique({
          where: { id: preCompraId },
          select: {
            studentFirstName: true,
            studentLastName: true,
            buyerName: true,
            studentCourseSnapshot: true,
            studentDivisionSnapshot: true,
          },
        })
      : null;
    snapshotBase = src.preventaPackSnapshotJson;
    familia = datosDeFamiliaParaPrueba({
      refsFuente: src.redemptionPaymentRefsJson,
      buyerNameFuente: src.buyerName,
      emailFotografo,
      colegio,
      preCompra: pc
        ? {
            studentFirstName: pc.studentFirstName,
            studentLastName: pc.studentLastName,
            buyerName: pc.buyerName,
            curso: [pc.studentCourseSnapshot, pc.studentDivisionSnapshot].filter(Boolean).join(" ") || null,
          }
        : await alumnoDeMuestra(albumId),
    });
    fuente = `pack ${fuenteId}`;
  } else {
    // 2) Sin packs vendidos: el pack de preventa tal como está armado.
    const def = await prisma.packDefinition.findFirst({
      where: { albumId, benefits: { some: {} } },
      orderBy: [{ isActive: "desc" }, { displayOrder: "asc" }, { id: "asc" }],
      include: {
        benefits: {
          include: { template: { select: { name: true } }, photographerProduct: { select: { name: true } } },
        },
      },
    });
    if (def) {
      snapshotBase = buildPreventaPackSnapshotV1(def, new Date());
      familia = datosDeFamiliaParaPrueba({
        refsFuente: null,
        buyerNameFuente: null,
        emailFotografo,
        colegio,
        preCompra: await alumnoDeMuestra(albumId),
      });
      fuente = `definición ${def.id}`;
    } else if (previa?.preventaPackSnapshotJson) {
      // 3) Sólo queda el pack de prueba anterior (p. ej. armado a mano).
      snapshotBase = previa.preventaPackSnapshotJson;
      familia = datosDeFamiliaParaPrueba({
        refsFuente: previa.redemptionPaymentRefsJson,
        buyerNameFuente: previa.buyerName,
        emailFotografo,
        colegio,
      });
      fuente = `prueba ${previa.id}`;
    } else {
      return { error: "Este álbum no tiene packs de preventa para canjear." };
    }
  }

  let snapshot;
  try {
    const parsed = parsePreventaPackSnapshotV1(snapshotBase);
    snapshot = parsePreventaPackSnapshotV1(prepararSnapshotDePrueba(parsed, plantillas));
  } catch {
    return { error: "No pudimos leer el pack para armar la prueba." };
  }

  const datos = {
    buyerEmail: familia.buyerEmail,
    buyerName: familia.buyerName,
    buyerPhone: null,
    totalCents: 0,
    extensionSurchargeCents: 0,
    platformCommissionCents: 0,
    referralFeeDiscountCents: null,
    checkoutPaymentSource: CheckoutPaymentSource.SIMULATED,
    pricingSnapshot: { kind: "PACK_DE_PRUEBA", fuente } as Prisma.InputJsonValue,
    redemptionPaymentRefsJson: familia.refs as Prisma.InputJsonValue,
    preventaPackSnapshotJson: snapshot as unknown as Prisma.InputJsonValue,
    organizerSchoolId: null,
    organizerUserId: null,
    organizerReferralApplied: false,
  };

  const { token, tokenHash } = generatePackAccessToken();
  const ahora = new Date();
  const vence = new Date(ahora.getTime() + DIAS_DEL_LINK * 24 * 60 * 60 * 1000);

  const resultado = await prisma.$transaction(async (tx) => {
    let orderId: number;
    let reutilizado = false;
    const accion = accionSobrePackDePrueba(previa);
    if (accion.tipo === "reusar") {
      await tx.order.update({ where: { id: accion.orderId }, data: datos });
      orderId = accion.orderId;
      reutilizado = true;
    } else {
      const nuevo = await tx.order.create({
        data: {
          albumId,
          status: OrderStatus.PAID,
          origin: OrderOrigin.PREVENTA_PACK,
          isTest: true,
          ...datos,
        },
        select: { id: true },
      });
      orderId = nuevo.id;
    }
    // Un solo link vivo: los de pruebas anteriores dejan de andar.
    const pruebas = await tx.order.findMany({
      where: { albumId, origin: OrderOrigin.PREVENTA_PACK, isTest: true },
      select: { id: true },
    });
    await tx.packAccessToken.updateMany({
      where: { orderId: { in: pruebas.map((p) => p.id) }, revokedAt: null },
      data: { revokedAt: ahora },
    });
    await tx.packAccessToken.create({ data: { orderId, tokenHash, expiresAt: vence } });
    return { orderId, reutilizado };
  });

  return { token, ...resultado };
}
