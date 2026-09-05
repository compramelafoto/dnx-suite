#!/usr/bin/env node
/**
 * Auditoría end-to-end de la venta escolar (preventa → canje → diseño → entrega).
 *
 * Recorre el circuito completo llamando al MISMO código que usa la app
 * (no reimplementa la lógica), y reporta en qué paso se rompe.
 *
 * Etapas:
 *   1. Escenario     escuela + curso + álbum escolar + padrón + fotos + plantilla + pack
 *   2. Catálogo      el pack aparece en la vidriera pública de preventa
 *   3. Pedido        creación del pedido de preventa (bridge PreCompraOrder + Order)
 *   4. Pago          aprobación (replica lo que hace el webhook de Mercado Pago)
 *   5. Link canje    token de acceso al pack (el link que va por email)
 *   6. Canje         la familia elige fotos y se genera el pedido de canje
 *   7. Diseño        proyecto de diseño, revisión y preflight de render
 *   8. Export        cola de exportación e impacto en el estado del ítem
 *   9. Entrega       descarga digital y entrega física en la escuela
 *
 * Uso (NUNCA contra producción):
 *   DATABASE_URL="postgresql://..." \
 *   AUDIT_E2E_CONFIRM=1 \
 *   pnpm --filter @repo/payments exec tsx --tsconfig ../../apps/compramelafoto/tsconfig.json \
 *     ../../apps/compramelafoto/scripts/audit-venta-escolar-e2e.ts
 *
 *   Agregá `--cleanup` para borrar todo lo que creó la corrida anterior.
 */
// Primero de todo: deja el entorno listo antes de que Prisma o R2 lo lean.
import "./_cargar-env-local";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { prisma } from "@/lib/prisma";
import {
  CheckoutPaymentSource,
  OrderOrigin,
  OrderStatus,
  PreCompraOrderStatus,
  Role,
  StudentIdentificationMode,
  StudentSourceType,
} from "@/lib/prisma";
import { listActivePacksForPublicCatalog } from "@/lib/preventa-canjeable/pack-service";
import { getPreventaRequirements } from "@/lib/preventa-canjeable/preventa-mode";
import { createPrecompraPackOrderInTransaction } from "@/lib/preventa-canjeable/precompra-pack-order-transaction";
import {
  buildOrderItems,
  buildPricingSnapshot,
} from "@/lib/preventa-canjeable/precompra-order-request-helpers";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import {
  ensurePackAccessTokenForOrder,
  getOrderIdForPackAccessToken,
} from "@/lib/preventa-canjeable/pack-access-tokens";
import { parsePreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { executePreventaPackRedeemV1 } from "@/lib/preventa-canjeable/redeem-preventa-pack-order-v1";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { loadPhotoIdsByBenefitKeyForPreventaOrder } from "@/lib/preventa-canjeable/photo-ids-by-benefit-key";
import { deleteFromR2, listObjectsByPrefix, uploadToR2 } from "@/lib/r2-client";
import sharp from "sharp";
import type { NextRequest } from "next/server";
import { GET as procesarPreviews } from "@/app/api/cron/process-design-previews/route";
import { GET as procesarExports } from "@/app/api/cron/process-design-exports/route";
import { createStudentInSchool } from "@/lib/school-roster/student-and-roster";

/** Marca única para poder limpiar todo lo que crea esta auditoría. */
const MARCA = "AUDITORIA-VENTA-ESCOLAR-E2E";
const EMAIL_COMPRADOR = "auditoria.venta.escolar@example.invalid";

/**
 * Un color plano por foto. Sirven de "huella": al final se miran los píxeles del JPG exportado
 * para confirmar que en cada hueco quedó la foto que la familia eligió para imprimir.
 * Las fotos 0 y 1 van al beneficio digital; las 2 y 3, al impreso.
 */
const COLORES_FOTO = ["#c0392b", "#27ae60", "#2980b9", "#8e44ad", "#d35400", "#16a085"];

/** Prefijo propio en R2: todo lo que sube la auditoría vive acá y se borra con --cleanup. */
const PREFIJO_R2 = "auditoria-e2e";

/** ¿Hay credenciales de R2? Sin ellas se puede auditar todo menos el render. */
function hayR2(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_ENDPOINT &&
      (process.env.R2_BUCKET_NAME || process.env.R2_BUCKET)
  );
}

/** Imagen sólida de color, para tener fotos reales que el renderizador pueda bajar. */
async function subirImagenDePrueba(
  clave: string,
  ancho: number,
  alto: number,
  color: string
): Promise<string> {
  const buffer = await sharp({
    create: { width: ancho, height: alto, channels: 3, background: color },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
  const { url } = await uploadToR2(buffer, clave, "image/jpeg");
  return url;
}

type Resultado = "OK" | "FALLA" | "AVISO";

const hallazgos: Array<{
  etapa: string;
  resultado: Resultado;
  detalle: string;
}> = [];

function registrar(etapa: string, resultado: Resultado, detalle: string) {
  hallazgos.push({ etapa, resultado, detalle });
  const icono = resultado === "OK" ? "  ok " : resultado === "AVISO" ? " aviso" : " FALLA";
  console.log(`[${icono}] ${etapa}: ${detalle}`);
}

function abortarSiEsProduccion() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    throw new Error("Falta DATABASE_URL. Apuntá a una rama de prueba, nunca a producción.");
  }
  const host = url.replace(/^[^@]*@/, "").split("/")[0] ?? "(desconocido)";
  console.log(`Base de datos: ${host}`);
  if (process.env.AUDIT_E2E_CONFIRM !== "1") {
    throw new Error(
      "Definí AUDIT_E2E_CONFIRM=1 para confirmar que esta base NO es producción. " +
        `Host actual: ${host}`
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Limpieza
// ─────────────────────────────────────────────────────────────

async function limpiar(): Promise<void> {
  const albums = await prisma.album.findMany({
    where: { title: { startsWith: MARCA } },
    select: { id: true },
  });
  const albumIds = albums.map((a) => a.id);

  // Previews y exports se guardan con el id de la revisión en el nombre. Hay que resolverlos y
  // borrarlos ANTES de tocar la base: si primero se borran los álbumes, ya no hay forma de saber
  // qué archivos de R2 eran nuestros y quedan huérfanos.
  const revisionesDeAuditoria = new Set<string>();
  if (albumIds.length > 0) {
    const revisiones = await prisma.designRevision.findMany({
      where: { designProject: { orderItem: { order: { albumId: { in: albumIds } } } } },
      select: { id: true },
    });
    for (const r of revisiones) {
      // `generateR2Key` antepone un identificador aleatorio, así que se busca por nombre.
      revisionesDeAuditoria.add(`design-preview-${r.id}.`);
      revisionesDeAuditoria.add(`design-export-${r.id}.`);
    }
  }

  // Objetos que la auditoría subió a R2 (fotos, plantillas, previews y exports).
  if (hayR2()) {
    let borrados = 0;
    for (const prefijo of [PREFIJO_R2, "design-previews", "design-exports"]) {
      const soloAuditoria = prefijo === PREFIJO_R2;
      const objetos = await listObjectsByPrefix(prefijo);
      for (const { Key: clave } of objetos) {
        // Fuera del prefijo propio solo se tocan los archivos de las revisiones creadas acá.
        if (!soloAuditoria && ![...revisionesDeAuditoria].some((m) => clave.includes(m))) continue;
        try {
          await deleteFromR2(clave);
          borrados += 1;
        } catch {
          // Un objeto que ya no está no debería frenar la limpieza.
        }
      }
    }
    console.log(`Objetos borrados de R2: ${borrados}`);
  }

  if (albumIds.length > 0) {
    const ordenes = await prisma.order.findMany({
      where: { albumId: { in: albumIds } },
      select: { id: true },
    });
    const orderIds = ordenes.map((o) => o.id);

    await prisma.zipGenerationJob.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.orderDownloadToken.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.packAccessToken.deleteMany({ where: { orderId: { in: orderIds } } });
    // Romper el enlace 1:1 antes de borrar, para no chocar con la FK.
    await prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { redemptionOrderId: null },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.preCompraOrder.deleteMany({ where: { albumId: { in: albumIds } } });
    await prisma.templateSlot.deleteMany({
      where: { template: { albumId: { in: albumIds } } },
    });
    await prisma.template.deleteMany({ where: { albumId: { in: albumIds } } });
    await prisma.selectionPhoto.deleteMany({
      where: { photo: { albumId: { in: albumIds } } },
    });
    await prisma.albumStudentRosterEntry.deleteMany({ where: { albumId: { in: albumIds } } });
    await prisma.subject.deleteMany({ where: { albumId: { in: albumIds } } });
    await prisma.photo.deleteMany({ where: { albumId: { in: albumIds } } });
    await prisma.packDefinition.deleteMany({ where: { albumId: { in: albumIds } } });
    await prisma.album.deleteMany({ where: { id: { in: albumIds } } });
  }

  await prisma.school.deleteMany({ where: { name: { startsWith: MARCA } } });
  await prisma.photographerProduct.deleteMany({ where: { name: { startsWith: MARCA } } });
  console.log(`Limpieza terminada (${albumIds.length} álbum/es de auditoría eliminados).`);
}

// ─────────────────────────────────────────────────────────────
// Etapa 1 — Escenario
// ─────────────────────────────────────────────────────────────

type Escenario = {
  albumId: number;
  fotografoId: number;
  schoolId: number;
  rosterEntryId: number;
  packDefinitionId: number;
  templateId: number;
  photoIds: number[];
};

async function prepararEscenario(): Promise<Escenario> {
  const fotografo =
    (await prisma.user.findFirst({
      where: { role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] } },
      orderBy: { id: "asc" },
      select: { id: true },
    })) ?? null;
  if (!fotografo) {
    throw new Error("No hay ningún fotógrafo en la base; no se puede armar el escenario.");
  }

  const sufijo = Date.now().toString(36);

  const escuela = await prisma.school.create({
    data: { ownerId: fotografo.id, name: `${MARCA} Escuela ${sufijo}` },
  });
  const curso = await prisma.schoolCourse.create({
    data: { schoolId: escuela.id, name: "5to", division: "A" },
  });
  const alumno = await createStudentInSchool(
    prisma,
    escuela.id,
    "Ana",
    "Prueba",
    null,
    null,
    StudentSourceType.MANUAL_PHOTOGRAPHER
  );

  const album = await prisma.album.create({
    data: {
      userId: fotografo.id,
      title: `${MARCA} Álbum ${sufijo}`,
      publicSlug: `auditoria-venta-escolar-${sufijo}`,
      schoolId: escuela.id,
      studentIdentificationMode: StudentIdentificationMode.ROSTER_REQUIRED,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  const rosterEntry = await prisma.albumStudentRosterEntry.create({
    data: {
      albumId: album.id,
      schoolId: escuela.id,
      studentId: alumno.id,
      level: "Primario",
      shift: "Mañana",
      courseName: curso.name,
      division: curso.division ?? "A",
      snapshotFirstName: alumno.firstName,
      snapshotLastName: alumno.lastName,
      sourceType: StudentSourceType.MANUAL_PHOTOGRAPHER,
    },
  });

  // Seis fotos: alcanzan para un beneficio digital y uno impreso.
  // Con R2 se suben imágenes de verdad, porque el renderizador las baja por HTTP.
  const conR2 = hayR2();
  const COLORES = COLORES_FOTO;
  const photoIds: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const clave = `${PREFIJO_R2}/${sufijo}/foto-${i}.jpg`;
    const previewUrl = conR2
      ? await subirImagenDePrueba(clave, 1200, 800, COLORES[i % COLORES.length]!)
      : `https://ejemplo.invalid/auditoria/${sufijo}/preview-${i}.jpg`;
    const foto = await prisma.photo.create({
      data: {
        albumId: album.id,
        userId: fotografo.id,
        previewUrl,
        originalKey: clave,
        sellDigital: true,
        sellPrint: true,
      },
    });
    photoIds.push(foto.id);
  }

  // Plantilla legacy con dos huecos: es la única que entiende el motor de diseño escolar.
  // OJO con las unidades: el comentario del esquema dice "px o normalizado", pero
  // `preview-renderer.ts` divide bbox por widthCm/heightCm, o sea que las trata como CENTÍMETROS.
  // Con valores en px el render se va de escala y sale en blanco.
  const claveePlantilla = `${PREFIJO_R2}/${sufijo}/plantilla.jpg`;
  const plantilla = await prisma.template.create({
    data: {
      albumId: album.id,
      name: `${MARCA} Carpeta 2 fotos`,
      imageUrl: conR2
        ? await subirImagenDePrueba(claveePlantilla, 1000, 1500, "#f2f2f2")
        : `https://ejemplo.invalid/auditoria/${sufijo}/plantilla.png`,
      widthCm: 20,
      heightCm: 30,
      slots: {
        create: [
          { index: 0, pageIndex: 0, bbox: { x: 1, y: 1, width: 18, height: 13 } },
          { index: 1, pageIndex: 0, bbox: { x: 1, y: 16, width: 18, height: 13 } },
        ],
      },
    },
  });

  const productoLab = await prisma.photographerProduct.create({
    data: {
      userId: fotografo.id,
      name: `${MARCA} Copia 15x21`,
      size: "15x21",
      acabado: "BRILLO",
      retailPrice: 3000,
    },
  });

  const pack = await prisma.packDefinition.create({
    data: {
      albumId: album.id,
      name: `${MARCA} Pack escolar`,
      description: "Pack de auditoría: 2 digitales + 1 carpeta impresa con diseño.",
      isActive: true,
      priceClientArs: 20000,
      benefits: {
        create: [
          {
            kind: "DIGITAL",
            includedQuantity: 2,
            sortOrder: 0,
            selectionMode: "SINGLE_PHOTO",
            requiredPhotoCount: 1,
            templatePolicy: "NONE",
          },
          {
            kind: "PHYSICAL",
            includedQuantity: 1,
            sortOrder: 1,
            selectionMode: "MULTI_PHOTO_FIXED",
            requiredPhotoCount: 2,
            templatePolicy: "REQUIRED",
            templateId: plantilla.id,
            photographerProductId: productoLab.id,
          },
        ],
      },
    },
  });

  registrar(
    "1. Escenario",
    "OK",
    `álbum ${album.id}, escuela ${escuela.id}, pack ${pack.id}, plantilla ${plantilla.id} (2 huecos), ` +
      `${photoIds.length} fotos ${conR2 ? "subidas a R2" : "simuladas (sin R2)"}`
  );

  return {
    albumId: album.id,
    fotografoId: fotografo.id,
    schoolId: escuela.id,
    rosterEntryId: rosterEntry.id,
    packDefinitionId: pack.id,
    templateId: plantilla.id,
    photoIds,
  };
}

// ─────────────────────────────────────────────────────────────
// Etapa 2 — Catálogo público
// ─────────────────────────────────────────────────────────────

async function verificarCatalogo(esc: Escenario): Promise<void> {
  const sinFotos = await listActivePacksForPublicCatalog(esc.albumId, new Date(), {
    hasPhotos: false,
  });
  const conFotos = await listActivePacksForPublicCatalog(esc.albumId, new Date(), {
    hasPhotos: true,
  });

  const visibleSinFotos = sinFotos.some((p) => p.id === esc.packDefinitionId);
  const visibleConFotos = conFotos.some((p) => p.id === esc.packDefinitionId);

  registrar(
    "2. Catálogo",
    visibleSinFotos && visibleConFotos ? "OK" : "AVISO",
    `pack visible antes de subir fotos: ${visibleSinFotos ? "sí" : "no"}; después: ${
      visibleConFotos ? "sí" : "no"
    }`
  );
}

// ─────────────────────────────────────────────────────────────
// Etapa 3 — Pedido de preventa
// ─────────────────────────────────────────────────────────────

async function crearPedido(
  esc: Escenario
): Promise<{ preCompraOrderId: number; orderId: number }> {
  const album = await prisma.album.findUniqueOrThrow({
    where: { id: esc.albumId },
    select: { id: true, userId: true, schoolId: true, selectedLabId: true },
  });
  const roster = await prisma.albumStudentRosterEntry.findUniqueOrThrow({
    where: { id: esc.rosterEntryId },
  });
  const packs = await listActivePacksForPublicCatalog(esc.albumId, new Date(), {
    hasPhotos: true,
  });
  const pack = packs.find((p) => p.id === esc.packDefinitionId);
  if (!pack) throw new Error("El pack no aparece en el catálogo público; no se puede comprar.");

  const platformPercent = await resolveClientMarketplaceFeePercent({
    photographerId: album.userId,
    labId: album.selectedLabId ?? null,
  });

  // Mismo cálculo que POST /api/precompra/order: base del fotógrafo + fee de plataforma.
  const orderItems = buildOrderItems(
    [{ packDefinitionId: esc.packDefinitionId, quantity: 1 }],
    new Map([[pack.id, { id: pack.id, priceClientArs: pack.priceClientArs }]]),
    platformPercent
  );
  if (orderItems.length !== 1) throw new Error("buildOrderItems no produjo la línea del pack");
  const totalCents = orderItems.reduce((acc, it) => acc + it.priceCents * it.quantity, 0);
  const orderTotalArs = Math.max(0, Math.round(totalCents / 100));
  const marketplaceFeeCents = feeFromTotal(orderTotalArs, platformPercent);

  const { preCompraOrder, albumPackOrder } = await prisma.$transaction((tx) =>
    createPrecompraPackOrderInTransaction(tx, {
      albumId: esc.albumId,
      buyerEmail: EMAIL_COMPRADOR,
      buyerUserId: null,
      buyerName: "Familia Prueba",
      buyerPhone: "3510000000",
      isSchool: true,
      resolvedSchoolCourseId: null,
      resolvedStudentFirstName: roster.snapshotFirstName,
      resolvedStudentLastName: roster.snapshotLastName,
      resolvedStudentId: roster.studentId,
      resolvedAlbumRosterEntryId: roster.id,
      resolvedStudentSourceType: roster.sourceType,
      resolvedLevelSnap: roster.level,
      resolvedShiftSnap: roster.shift,
      resolvedCourseSnap: roster.courseName,
      resolvedDivisionSnap: roster.division,
      orderItems,
      packDefinitionId: esc.packDefinitionId,
      packQuantity: 1,
      totalCents,
      orderTotalArs,
      pricingSnapshot: buildPricingSnapshot(
        esc.packDefinitionId,
        platformPercent,
        marketplaceFeeCents
      ),
      platformPercent,
      now: new Date(),
      isTest: false,
      checkoutPaymentSource: CheckoutPaymentSource.MERCADO_PAGO,
      preventaReqs: getPreventaRequirements(album),
      organizerReferralSchoolId: null,
    })
  );

  const items = await prisma.preCompraOrderItem.findMany({
    where: { orderId: preCompraOrder.id },
    select: { id: true, status: true, subjectId: true },
  });

  registrar(
    "3. Pedido",
    "OK",
    `PreCompraOrder ${preCompraOrder.id} + Order ${albumPackOrder.id}; ${items.length} ítem(s) en estado ${items[0]?.status}`
  );

  const entitlement = await prisma.packPurchaseEntitlement.findUnique({
    where: { preCompraOrderId: preCompraOrder.id },
  });
  registrar(
    "3b. Entitlement",
    entitlement ? "OK" : "AVISO",
    entitlement
      ? `creado (estado ${entitlement.status})`
      : "no se crea ningún PackPurchaseEntitlement. Ya no rompe nada (el circuito usa " +
        "Order.preventaPackSnapshotJson), pero el modelo y sus servicios son código muerto"
  );

  return { preCompraOrderId: preCompraOrder.id, orderId: albumPackOrder.id };
}

// ─────────────────────────────────────────────────────────────
// Etapa 4 y 5 — Pago aprobado y link de canje
// ─────────────────────────────────────────────────────────────

async function aprobarPagoYGenerarLink(ids: {
  preCompraOrderId: number;
  orderId: number;
}): Promise<string> {
  // Réplica de la parte no-MP de finalize-album-order-mp-approved.
  await prisma.order.update({
    where: { id: ids.orderId },
    data: { status: OrderStatus.PAID },
  });
  await prisma.preCompraOrder.updateMany({
    where: { id: ids.preCompraOrderId, status: PreCompraOrderStatus.CREATED },
    data: { status: PreCompraOrderStatus.PAID_HELD },
  });
  registrar("4. Pago", "OK", `Order ${ids.orderId} → PAID; PreCompraOrder → PAID_HELD`);

  const token = await ensurePackAccessTokenForOrder(ids.orderId);
  if (!token?.token) {
    registrar("5. Link de canje", "FALLA", "no se generó el token de acceso al pack");
    throw new Error("sin token de canje");
  }
  const lookup = await getOrderIdForPackAccessToken(token.token);
  registrar(
    "5. Link de canje",
    lookup.ok && lookup.orderId === ids.orderId ? "OK" : "FALLA",
    lookup.ok
      ? `token válido → /cliente/pack/<token> (vence ${token.expiresAt.toISOString().slice(0, 10)})`
      : `token inválido (${lookup.error})`
  );
  return token.token;
}

// ─────────────────────────────────────────────────────────────
// Etapa 6 — Canje
// ─────────────────────────────────────────────────────────────

async function canjear(
  esc: Escenario,
  orderId: number
): Promise<number> {
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { preventaPackSnapshotJson: true },
  });
  const snapshot = parsePreventaPackSnapshotV1(order.preventaPackSnapshotJson);

  // La familia elige: 2 fotos digitales sueltas + 2 fotos para la carpeta impresa.
  const disponibles = [...esc.photoIds];
  const selections = snapshot.benefits
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((ben) => {
      const porUnidad =
        ben.selectionMode === "MULTI_PHOTO_FIXED" ? Math.max(1, ben.requiredPhotoCount) : 1;
      const units: number[][] = [];
      for (let u = 0; u < ben.includedQuantity; u += 1) {
        units.push(disponibles.splice(0, porUnidad));
      }
      return { benefitStableKey: ben.stableKey, units };
    });

  const resultado = await executePreventaPackRedeemV1(orderId, selections);
  const hijo = await prisma.order.findUniqueOrThrow({
    where: { id: resultado.redemptionOrderId },
    include: { items: true },
  });
  const digitales = hijo.items.filter((i) => i.productType === "DIGITAL").length;
  const impresas = hijo.items.filter((i) => i.productType === "PRINT").length;

  registrar(
    "6. Canje",
    "OK",
    `Order de canje ${hijo.id} (${digitales} digital/es, ${impresas} impresa/s)`
  );
  return hijo.id;
}

// ─────────────────────────────────────────────────────────────
// Etapa 7 y 8 — Diseño y exportación
// ─────────────────────────────────────────────────────────────

async function verificarDiseno(preCompraOrderId: number, preventaOrderId: number): Promise<void> {
  const items = await prisma.preCompraOrderItem.findMany({
    where: { orderId: preCompraOrderId },
    include: {
      selection: { include: { photos: true } },
      designProject: { include: { currentRevision: true } },
    },
  });

  const item = items[0];
  if (!item) {
    registrar("7. Diseño", "FALLA", "el pedido quedó sin ítems");
    return;
  }

  registrar(
    "7a. Selección guardada",
    item.selection && item.selection.photos.length > 0 ? "OK" : "FALLA",
    item.selection
      ? `${item.selection.photos.length} foto(s) persistidas en Selection`
      : "no se guardó ninguna Selection para el ítem escolar"
  );

  registrar(
    "7b. Proyecto de diseño",
    item.designProject ? "OK" : "FALLA",
    item.designProject
      ? `DesignProject ${item.designProject.id} en estado ${item.designProject.status}`
      : "no se creó el proyecto de diseño (revisá plantilla del beneficio y cantidad de huecos)"
  );

  if (item.designProject?.currentRevision) {
    const data = item.designProject.currentRevision.dataJson as Record<string, unknown> | null;
    const preflight = (data?.preflight ?? null) as { isValid?: boolean } | null;
    registrar(
      "7c. Preflight de render",
      preflight?.isValid ? "OK" : "AVISO",
      preflight ? `preflight isValid=${preflight.isValid}` : "la revisión no tiene preflight"
    );
  } else {
    registrar("7c. Preflight de render", "FALLA", "el proyecto no tiene revisión actual");
  }

  // ¿La carpeta impresa se arma con las fotos que la familia eligió PARA IMPRIMIR?
  if (item.designProject?.currentRevision && item.selection) {
    const data = item.designProject.currentRevision.dataJson as Record<string, unknown> | null;
    const asignaciones = (data?.assignments ?? []) as Array<{ selectionPhotoId: number }>;
    const porSelectionPhotoId = new Map(item.selection.photos.map((p) => [p.id, p.photoId]));
    const fotosEnElDiseno = new Set(
      asignaciones
        .map((a) => porSelectionPhotoId.get(a.selectionPhotoId))
        .filter((x): x is number => x != null)
    );

    const fotosCompradasParaImprimir = await prisma.orderItem.findMany({
      where: {
        order: { origin: OrderOrigin.PACK_REDEMPTION, redeemsOrderId: preventaOrderId },
        productType: "PRINT",
      },
      select: { photoId: true },
    });
    const esperadas = fotosCompradasParaImprimir
      .map((r) => r.photoId)
      .filter((x): x is number => x != null);

    const faltantes = esperadas.filter((id) => !fotosEnElDiseno.has(id));
    registrar(
      "7d. Fotos del impreso",
      esperadas.length > 0 && faltantes.length === 0 ? "OK" : "FALLA",
      esperadas.length === 0
        ? "el pack no tiene beneficio impreso; no aplica"
        : faltantes.length === 0
          ? `el diseño usa las ${esperadas.length} foto(s) elegidas para imprimir`
          : `el diseño NO usa las fotos elegidas para imprimir (faltan ${faltantes.join(", ")}); ` +
            `en su lugar colocó ${[...fotosEnElDiseno].join(", ")}`
    );
  }

  // Regenerar un diseño más tarde (botón del fotógrafo) necesita saber qué foto era de qué
  // beneficio. Ese vínculo tiene que poder reconstruirse desde la base, no solo en memoria.
  const mapaRecuperado = await loadPhotoIdsByBenefitKeyForPreventaOrder(preventaOrderId);
  const fotosImpresasSegunMapa = new Set(
    [...(mapaRecuperado?.values() ?? [])].flat()
  );
  const impresasEsperadas = await prisma.orderItem.findMany({
    where: {
      order: { origin: OrderOrigin.PACK_REDEMPTION, redeemsOrderId: preventaOrderId },
      productType: "PRINT",
    },
    select: { photoId: true },
  });
  const todasPresentes =
    impresasEsperadas.length > 0 &&
    impresasEsperadas.every((r) => fotosImpresasSegunMapa.has(r.photoId));
  registrar(
    "7e. Mapeo foto↔beneficio",
    mapaRecuperado && todasPresentes ? "OK" : "FALLA",
    mapaRecuperado
      ? `recuperable desde la base: ${mapaRecuperado.size} beneficio(s) con sus fotos` +
        (todasPresentes ? "" : " — pero faltan fotos del impreso")
      : "no se puede reconstruir qué foto era de qué beneficio: la regeneración manual del " +
        "diseño volvería a usar las fotos equivocadas"
  );

  registrar(
    "8a. Estado del ítem",
    item.status === "READY_TO_DESIGN" ? "OK" : "FALLA",
    `estado ${item.status} (se esperaba READY_TO_DESIGN tras el canje)`
  );

  // Que los workers existan no alcanza: si no están agendados, nunca corren.
  const vercelJson = JSON.parse(
    readFileSync(resolve(import.meta.dirname ?? __dirname, "../vercel.json"), "utf8")
  ) as { crons?: Array<{ path: string; schedule: string }> };
  const agendados = new Set((vercelJson.crons ?? []).map((c) => c.path));
  const faltan = [
    "/api/cron/process-design-previews",
    "/api/cron/process-design-exports",
  ].filter((ruta) => !agendados.has(ruta));
  registrar(
    "8b. Cron de render agendados",
    faltan.length === 0 ? "OK" : "FALLA",
    faltan.length === 0
      ? "los dos figuran en vercel.json"
      : `faltan en vercel.json: ${faltan.join(", ")} — los diseños nunca se renderizarían`
  );
}

// ─────────────────────────────────────────────────────────────
// Etapa 9 — Entrega
// ─────────────────────────────────────────────────────────────

async function verificarEntrega(redemptionOrderId: number): Promise<void> {
  const zipsAntes = await prisma.zipGenerationJob.count({
    where: { orderId: redemptionOrderId },
  });
  const tokensAntes = await prisma.orderDownloadToken.count({
    where: { orderId: redemptionOrderId },
  });

  registrar(
    "9a. Descarga automática",
    zipsAntes > 0 || tokensAntes > 0 ? "OK" : "FALLA",
    zipsAntes > 0 || tokensAntes > 0
      ? `${zipsAntes} zip job(s), ${tokensAntes} token(s) creados por el canje`
      : "el canje no encoló ZIP ni creó token: la familia no recibe la descarga digital"
  );

  // ¿Funciona si alguien la dispara a mano (botón del fotógrafo / admin)?
  await ensureDigitalDelivery(redemptionOrderId);
  const zipsDespues = await prisma.zipGenerationJob.count({
    where: { orderId: redemptionOrderId },
  });
  const tokensDespues = await prisma.orderDownloadToken.count({
    where: { orderId: redemptionOrderId },
  });
  registrar(
    "9b. Descarga manual",
    zipsDespues > 0 && tokensDespues > 0 ? "OK" : "FALLA",
    `tras ensureDigitalDelivery: ${zipsDespues} zip job(s), ${tokensDespues} token(s)`
  );
}


// ─────────────────────────────────────────────────────────────
// Etapa 10 — Render real y entrega física
// ─────────────────────────────────────────────────────────────

/** Invoca el worker de cron igual que lo haría Vercel. */
async function correrCron(
  handler: (req: NextRequest) => Promise<Response>,
  ruta: string
): Promise<void> {
  const headers: Record<string, string> = {};
  if (process.env.CRON_SECRET) headers.authorization = `Bearer ${process.env.CRON_SECRET}`;
  const req = new Request(`http://localhost:3002${ruta}`, { headers }) as unknown as NextRequest;
  const res = await handler(req);
  if (!res.ok) {
    throw new Error(`${ruta} respondió ${res.status}: ${await res.text()}`);
  }
}

function leerEstadoRender(dataJson: unknown): {
  previewStatus?: string;
  previewUrl?: string | null;
  exportStatus?: string;
  exportUrlJpg?: string | null;
  previewError?: string | null;
  exportError?: string | null;
} {
  return (dataJson && typeof dataJson === "object" ? dataJson : {}) as never;
}

async function verificarRenderYEntrega(preCompraOrderId: number): Promise<void> {
  if (!hayR2()) {
    registrar(
      "10. Render real",
      "AVISO",
      "sin credenciales de R2: no se puede ejercitar el render ni la entrega física"
    );
    return;
  }

  const item = await prisma.preCompraOrderItem.findFirst({
    where: { orderId: preCompraOrderId },
    include: { designProject: { include: { currentRevision: true } } },
  });
  const proyecto = item?.designProject;
  const revision = proyecto?.currentRevision;
  if (!item || !proyecto || !revision) {
    registrar("10. Render real", "FALLA", "no hay proyecto de diseño con revisión para renderizar");
    return;
  }

  // --- Vista previa: se encola igual que lo hace el panel del fotógrafo ---
  const dataInicial = leerEstadoRender(revision.dataJson);
  await prisma.designRevision.update({
    where: { id: revision.id },
    data: { dataJson: { ...dataInicial, previewStatus: "RENDERING", previewError: null } as never },
  });
  await prisma.designPreviewJob.create({ data: { designRevisionId: revision.id } });

  await correrCron(procesarPreviews, "/api/cron/process-design-previews");

  const trasPreview = leerEstadoRender(
    (await prisma.designRevision.findUniqueOrThrow({ where: { id: revision.id } })).dataJson
  );
  const previewOk = trasPreview.previewStatus === "READY" && Boolean(trasPreview.previewUrl);
  registrar(
    "10a. Vista previa",
    previewOk ? "OK" : "FALLA",
    previewOk
      ? `renderizada y subida a R2 (previewStatus=READY)`
      : `previewStatus=${trasPreview.previewStatus} error=${trasPreview.previewError ?? "—"}`
  );
  if (!previewOk) return;

  // --- Aprobación del fotógrafo (la ruta del panel exige sesión; acá se replica el efecto) ---
  await prisma.designProject.update({
    where: { id: proyecto.id },
    data: { status: "APPROVED_FOR_EXPORT", approvedAt: new Date() },
  });

  // --- Exportación: se encola igual que lo hace el panel ---
  const antesExport = leerEstadoRender(
    (await prisma.designRevision.findUniqueOrThrow({ where: { id: revision.id } })).dataJson
  );
  await prisma.designRevision.update({
    where: { id: revision.id },
    data: { dataJson: { ...antesExport, exportStatus: "EXPORTING", exportError: null } as never },
  });
  await prisma.designProject.update({ where: { id: proyecto.id }, data: { status: "EXPORTING" } });
  await prisma.designExportJob.create({
    data: { designProjectId: proyecto.id, designRevisionId: revision.id },
  });

  await correrCron(procesarExports, "/api/cron/process-design-exports");

  const trasExport = leerEstadoRender(
    (await prisma.designRevision.findUniqueOrThrow({ where: { id: revision.id } })).dataJson
  );
  const proyectoFinal = await prisma.designProject.findUniqueOrThrow({ where: { id: proyecto.id } });
  const exportOk =
    trasExport.exportStatus === "EXPORTED" &&
    Boolean(trasExport.exportUrlJpg) &&
    proyectoFinal.status === "EXPORTED";
  registrar(
    "10b. Exportación",
    exportOk ? "OK" : "FALLA",
    exportOk
      ? "JPG final generado y subido a R2"
      : `exportStatus=${trasExport.exportStatus} proyecto=${proyectoFinal.status} error=${trasExport.exportError ?? "—"}`
  );
  if (!exportOk) return;

  // El JPG tiene que poder bajarse: es lo que ve e imprime el fotógrafo.
  const res = await fetch(String(trasExport.exportUrlJpg));
  registrar(
    "10c. Archivo final",
    res.ok ? "OK" : "FALLA",
    res.ok
      ? `descargable (HTTP ${res.status}, ${Math.round(Number(res.headers.get("content-length") ?? 0) / 1024)} kB)`
      : `no se pudo descargar (HTTP ${res.status})`
  );

  // La prueba definitiva: mirar el JPG. Un render en blanco también da un archivo válido.
  if (res.ok) {
    const jpg = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(jpg).metadata();
    const ancho = meta.width ?? 0;
    const alto = meta.height ?? 0;

    // Centro de cada hueco, en proporción de la plantilla de 20x30 cm.
    const centros: Array<[number, number]> = [
      [(1 + 18 / 2) / 20, (1 + 13 / 2) / 30],
      [(1 + 18 / 2) / 20, (16 + 13 / 2) / 30],
    ];
    const esperados = [COLORES_FOTO[2]!, COLORES_FOTO[3]!];

    const aRgb = (hex: string) => [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    const crudo = await sharp(jpg).raw().toBuffer({ resolveWithObject: true });
    const canales = crudo.info.channels;

    const leidos: string[] = [];
    let coinciden = true;
    for (let i = 0; i < centros.length; i += 1) {
      const [fx, fy] = centros[i]!;
      const x = Math.min(ancho - 1, Math.round(fx * ancho));
      const y = Math.min(alto - 1, Math.round(fy * alto));
      const off = (y * ancho + x) * canales;
      const px = [crudo.data[off]!, crudo.data[off + 1]!, crudo.data[off + 2]!];
      const esp = aRgb(esperados[i]!);
      const dist = Math.max(...px.map((c, j) => Math.abs(c - esp[j]!)));
      leidos.push(`hueco ${i + 1}: rgb(${px.join(",")}) vs ${esperados[i]}`);
      if (dist > 30) coinciden = false;
    }

    registrar(
      "10f. Fotos dentro del impreso",
      coinciden ? "OK" : "FALLA",
      coinciden
        ? `cada hueco del JPG tiene la foto elegida para imprimir (${ancho}x${alto}px)`
        : `el JPG no tiene las fotos esperadas — ${leidos.join(" | ")}`
    );
  }

  const itemExportado = await prisma.preCompraOrderItem.findUniqueOrThrow({ where: { id: item.id } });
  registrar(
    "10d. Ítem listo para imprimir",
    itemExportado.status === "EXPORTED" && Boolean(itemExportado.fulfillmentQrToken) ? "OK" : "FALLA",
    `estado ${itemExportado.status}, QR de entrega ${itemExportado.fulfillmentQrToken ? "generado" : "FALTA"}`
  );
  if (itemExportado.status !== "EXPORTED") return;

  // --- Cadena de entrega en la escuela ---
  const pasos: Array<[string, string]> = [
    ["EXPORTED", "PHYSICAL_IN_PROGRESS"],
    ["PHYSICAL_IN_PROGRESS", "AT_SCHOOL"],
    ["AT_SCHOOL", "DELIVERED"],
  ];
  let cadenaOk = true;
  for (const [desde, hacia] of pasos) {
    const movido = await prisma.preCompraOrderItem.updateMany({
      where: { id: item.id, status: desde as never },
      data: { status: hacia as never },
    });
    if (movido.count !== 1) {
      cadenaOk = false;
      registrar("10e. Entrega en la escuela", "FALLA", `no se pudo pasar de ${desde} a ${hacia}`);
      break;
    }
  }
  if (cadenaOk) {
    registrar(
      "10e. Entrega en la escuela",
      "OK",
      "impresión → en la escuela → entregado, con los mismos guardas que usa el panel"
    );
  }
}

// ─────────────────────────────────────────────────────────────

async function main() {
  abortarSiEsProduccion();

  if (process.argv.includes("--cleanup")) {
    await limpiar();
    return;
  }

  console.log(`\n=== Auditoría end-to-end de la venta escolar ===\n`);

  const esc = await prepararEscenario();
  await verificarCatalogo(esc);
  const ids = await crearPedido(esc);
  await aprobarPagoYGenerarLink(ids);
  const redemptionOrderId = await canjear(esc, ids.orderId);
  await verificarDiseno(ids.preCompraOrderId, ids.orderId);
  await verificarEntrega(redemptionOrderId);
  await verificarRenderYEntrega(ids.preCompraOrderId);

  const fallas = hallazgos.filter((h) => h.resultado === "FALLA");
  const avisos = hallazgos.filter((h) => h.resultado === "AVISO");

  console.log(`\n=== Resumen ===`);
  console.log(`Pasos verificados: ${hallazgos.length}`);
  console.log(`Fallas: ${fallas.length} | Avisos: ${avisos.length}`);
  if (fallas.length > 0) {
    console.log(`\nFallas encontradas:`);
    for (const f of fallas) console.log(`  - ${f.etapa}: ${f.detalle}`);
  }
  console.log(
    `\nPara borrar los datos de esta corrida: agregá --cleanup al mismo comando.\n`
  );

  process.exitCode = fallas.length > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error("\nLa auditoría se cortó:", e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
