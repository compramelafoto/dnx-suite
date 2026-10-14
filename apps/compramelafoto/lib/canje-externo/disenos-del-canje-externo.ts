import "server-only";
import { OrderOrigin, prisma } from "@/lib/prisma";
import { createDesignV2Project } from "@/lib/design-v2/projects";
import { loadDesignTemplateVersion } from "@/lib/design-v2/template";
import { buildDesignValues } from "@/lib/design-v2/values";
import {
  parsePreventaPackSnapshotV1,
  type RedeemUnitSelectionInput,
} from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { parseExternalPreventaRefs, splitExcelStudentName, type ExternalPreventaRefs } from "./external-preventa";

/**
 * Los textos del librito de un pack cobrado por fuera: alumno, curso, colegio y el listado del
 * curso, sacados de los packs cargados del Excel (no hay pedido de la tienda escolar).
 *
 * Es la misma cuenta que usa la vista previa del canje: lo que la familia ve antes de confirmar
 * es lo que lleva el diseño.
 */
export async function valoresDelPackExterno(input: {
  albumId: number;
  externo: ExternalPreventaRefs;
  schoolName: string | null | undefined;
  buyerName: string | null | undefined;
  photographerName: string | null | undefined;
}): Promise<Record<string, string>> {
  const { externo } = input;
  const partes = splitExcelStudentName(externo.studentName);
  const delCurso = externo.courseName
    ? await prisma.order.findMany({
        where: { albumId: input.albumId, origin: OrderOrigin.PREVENTA_PACK, isTest: false },
        select: { redemptionPaymentRefsJson: true },
      })
    : [];
  const vistos = new Set<string>();
  const propio = (externo.studentName ?? "").trim().toLowerCase();
  const courseStudents = delCurso
    .map((o) => parseExternalPreventaRefs(o.redemptionPaymentRefsJson))
    .filter((r) => r?.courseName === externo.courseName && r.studentName)
    .flatMap((r) => {
      const clave = r!.studentName!.trim().toLowerCase();
      if (vistos.has(clave)) return [];
      vistos.add(clave);
      const p = splitExcelStudentName(r!.studentName);
      return p ? [{ ...p, isOwner: clave === propio }] : [];
    });
  return buildDesignValues({
    studentName: externo.studentName,
    studentFirstName: partes?.firstName,
    studentLastName: partes?.lastName,
    courseName: externo.courseName,
    schoolName: input.schoolName ?? externo.schoolName,
    buyerName: input.buyerName,
    photographerName: input.photographerName,
    courseStudents,
  });
}

/**
 * Arma el librito de un canje de pack cobrado por fuera (la carpeta de San Patricio).
 *
 * El canje sólo armaba el diseño cuando el pack venía de la tienda escolar (un pedido escolar y
 * un álbum con colegio). Los packs importados del Excel no tienen ninguna de las dos cosas: la
 * familia elegía sus fotos, veía el librito armado, confirmaba… y el diseño nunca se creaba. No
 * aparecía en «Diseños» para revisar ni había nada que imprimir.
 *
 * Se crea un diseño por unidad de cada beneficio con plantilla obligatoria, con las fotos en el
 * orden en que la familia las dejó en el librito y con sus encuadres. Si el canje ya tiene
 * diseños (los armó el camino escolar, o es un reintento), no hace nada.
 */
export async function armarDisenosDelCanjeExterno(input: {
  preventaOrderId: number;
  redemptionOrderId: number;
  selections: RedeemUnitSelectionInput[];
}): Promise<number> {
  const yaHay = await prisma.designProject.count({ where: { albumOrderId: input.redemptionOrderId } });
  if (yaHay > 0) return 0;

  const pack = await prisma.order.findUnique({
    where: { id: input.preventaOrderId },
    select: {
      albumId: true,
      buyerName: true,
      preventaPackSnapshotJson: true,
      redemptionPaymentRefsJson: true,
      album: { select: { userId: true, school: { select: { name: true } }, user: { select: { name: true } } } },
    },
  });
  if (!pack?.albumId || !pack.album) return 0;
  const externo = parseExternalPreventaRefs(pack.redemptionPaymentRefsJson);
  if (!externo) return 0;
  const snapshot = parsePreventaPackSnapshotV1(pack.preventaPackSnapshotJson);
  if (!snapshot) return 0;

  const conDiseno = snapshot.benefits.filter((b) => b.templateV2Id && b.templatePolicy === "REQUIRED");
  if (conDiseno.length === 0) return 0;

  const values = await valoresDelPackExterno({
    albumId: pack.albumId,
    externo,
    schoolName: pack.album.school?.name,
    buyerName: pack.buyerName,
    photographerName: pack.album.user?.name,
  });

  let creados = 0;
  for (const beneficio of conDiseno) {
    const template = await loadDesignTemplateVersion({ templateId: beneficio.templateV2Id! });
    if (!template || template.slots.length === 0) continue;
    const eleccion = input.selections.find((s) => s.benefitStableKey === beneficio.stableKey);
    if (!eleccion) continue;
    for (const [u, fotos] of eleccion.units.entries()) {
      if (fotos.length === 0) continue;
      const cropsByPhotoId = new Map<number, { zoom: number; x: number; y: number }>();
      fotos.forEach((photoId, p) => {
        const crop = eleccion.crops?.[u]?.[p];
        if (crop) cropsByPhotoId.set(photoId, crop);
      });
      const r = await createDesignV2Project(prisma, {
        template,
        photoIds: fotos,
        values,
        photographerUserId: pack.album.userId,
        albumId: pack.albumId,
        albumOrderId: input.redemptionOrderId,
        cropsByPhotoId,
      });
      if (r.created) creados++;
    }
  }
  return creados;
}
