import "server-only";
import type { Prisma } from "@prisma/client";
import {
  readPrivateCopy,
  resolveBlockIdMapBetweenVersions,
  type TemplateV2PrivateCopy,
} from "@repo/template-editor-core";
import { prisma } from "@/lib/prisma";
import {
  copyTemplateV2VersionAsPrivate,
  listClientPhotoSlots,
  loadTemplateV2BlocksForVersion,
  versionRowsToLegacyPayload,
} from "@/lib/template-v2/server";
import { parseDesignV2Data } from "./design-data";
import { pasarDisenoDeVersion } from "./pasar-de-version";
import { DesignProjectError, type DesignActor } from "./projects";
import { loadDesignTemplateVersion } from "./template";
import { invalidarAutorizacionDeLaFamilia } from "./autorizacion-familia";
import type {
  CategoriaDeCambio,
  DisenoAnteCambio,
  ResultadoDeCambio,
  ResumenDeCambio,
} from "./cambio-de-plantilla-tipos";

/**
 * Qué pasa con los diseños ya armados cuando se cambia la plantilla.
 *
 * Una versión de plantilla que usa algún diseño no se pisa: al guardar, el editor crea una
 * versión nueva y la vieja queda congelada (ver `version-en-uso.ts`). Los diseños siguen
 * dibujándose exactamente igual que antes hasta que el fotógrafo elige pasarlos a la nueva:
 *
 * - Pendientes de aprobar (o con cambios pedidos): se ofrecen marcados.
 * - Aprobados y todavía no mandados a imprimir: se ofrecen sin marcar. Si se pasan, vuelven a
 *   revisión (se borra la aprobación y el archivo generado).
 * - Mandados a imprenta, impresos o entregados: no se tocan nunca, ni se ofrecen.
 * - Editados a mano (tienen su copia propia de la plantilla): tampoco reciben cambios.
 * - Si a un diseño le falta en la versión nueva un hueco con foto: queda para revisar a mano.
 */

export const PRIVATE_COPY_KIND = "design-project";

const PRODUCCION = (d: { sentToPrintAt: Date | null; printedAt: Date | null; deliveredAt: Date | null }) =>
  d.sentToPrintAt != null || d.printedAt != null || d.deliveredAt != null;

const APROBADO = new Set(["APPROVED_FOR_EXPORT", "EXPORTED", "APPROVED"]);

export function esDisenoEnProduccion(d: { sentToPrintAt: Date | null; printedAt: Date | null; deliveredAt: Date | null }) {
  return PRODUCCION(d);
}

async function plantillaDelActor(templateId: string, actor: DesignActor) {
  const template = await prisma.templateV2.findUnique({
    where: { id: templateId },
    select: { id: true, name: true, ownerUserId: true, currentVersionId: true },
  });
  if (!template || !template.currentVersionId) throw new DesignProjectError("No encontramos esa plantilla.", 404);
  if (actor.role !== "ADMIN" && template.ownerUserId !== actor.id) {
    throw new DesignProjectError("No encontramos esa plantilla.", 404);
  }
  return template as typeof template & { currentVersionId: string };
}

function cargadorDeVersiones(templateId: string) {
  const cache = new Map<string, { id: string; metaJson: unknown; versionNumber: number } | null>();
  return async (id: string) => {
    if (!cache.has(id)) {
      cache.set(
        id,
        await prisma.templateV2Version.findFirst({
          where: { id, templateId },
          select: { id: true, metaJson: true, versionNumber: true },
        }),
      );
    }
    return cache.get(id) ?? null;
  };
}

const DISENO_SELECT = {
  id: true,
  status: true,
  templateV2VersionId: true,
  photographerUserId: true,
  sentToPrintAt: true,
  printedAt: true,
  deliveredAt: true,
  currentRevision: { select: { id: true, dataJson: true } },
  albumOrderId: true,
  orderItem: {
    select: { order: { select: { buyerName: true, buyerEmail: true, studentFirstName: true, studentLastName: true } } },
  },
} satisfies Prisma.DesignProjectSelect;

type DisenoFila = Prisma.DesignProjectGetPayload<{ select: typeof DISENO_SELECT }>;

function nombreDe(d: DisenoFila, compradores: Map<number, string>): string {
  const o = d.orderItem?.order;
  const alumno = [o?.studentFirstName, o?.studentLastName].filter(Boolean).join(" ").trim();
  return alumno || o?.buyerName || o?.buyerEmail || (d.albumOrderId ? compradores.get(d.albumOrderId) : null) || `Diseño #${d.id}`;
}

type Clasificado = DisenoAnteCambio & { fila: DisenoFila; blockIdMap: Record<string, string> | null };

async function clasificar(templateId: string, actor: DesignActor) {
  const template = await plantillaDelActor(templateId, actor);
  const destino = await loadDesignTemplateVersion({ templateId, versionId: template.currentVersionId });
  if (!destino) throw new DesignProjectError("No encontramos esa plantilla.", 404);
  const cargar = cargadorDeVersiones(templateId);
  const vigente = await cargar(template.currentVersionId);

  const filas = await prisma.designProject.findMany({
    where: {
      templateV2Id: templateId,
      templateV2VersionId: { not: template.currentVersionId },
      ...(actor.role === "ADMIN" ? {} : { photographerUserId: actor.id }),
    },
    select: DISENO_SELECT,
    orderBy: { id: "asc" },
  });

  const pedidos = [...new Set(filas.map((f) => f.albumOrderId).filter((n): n is number => n != null))];
  const compradores = new Map(
    (pedidos.length
      ? await prisma.order.findMany({ where: { id: { in: pedidos } }, select: { id: true, buyerName: true, buyerEmail: true } })
      : []
    ).map((o) => [o.id, o.buyerName || o.buyerEmail || ""]),
  );

  const mapas = new Map<string, Record<string, string> | null>();
  const clasificados: Clasificado[] = [];
  for (const fila of filas) {
    const versionId = fila.templateV2VersionId;
    const version = versionId ? await cargar(versionId) : null;
    const base = {
      id: fila.id,
      quien: nombreDe(fila, compradores),
      status: fila.status,
      versionNumber: version?.versionNumber ?? null,
      motivo: null as string | null,
      huecosNuevos: 0,
      fila,
      blockIdMap: null as Record<string, string> | null,
    };
    if (PRODUCCION(fila)) {
      clasificados.push({ ...base, categoria: "produccion" });
      continue;
    }
    if (version && readPrivateCopy(version.metaJson)) {
      clasificados.push({ ...base, categoria: "editado-a-mano" });
      continue;
    }
    const data = parseDesignV2Data(fila.currentRevision?.dataJson);
    if (!data || !versionId) {
      clasificados.push({ ...base, categoria: "revision-manual", motivo: "El diseño está incompleto." });
      continue;
    }
    if (!mapas.has(versionId)) {
      mapas.set(versionId, await resolveBlockIdMapBetweenVersions(versionId, template.currentVersionId, cargar));
    }
    const mapa = mapas.get(versionId) ?? null;
    if (!mapa) {
      clasificados.push({
        ...base,
        categoria: "revision-manual",
        motivo: "La versión nueva no sale de la de este diseño: hay que revisarlo a mano.",
      });
      continue;
    }
    const prueba = pasarDisenoDeVersion(data, { versionId: template.currentVersionId, blockIdMap: mapa, slots: destino.slots });
    if (!prueba.ok) {
      clasificados.push({ ...base, categoria: "revision-manual", motivo: prueba.motivo });
      continue;
    }
    clasificados.push({
      ...base,
      categoria: APROBADO.has(fila.status) ? "aprobado" : "pendiente",
      huecosNuevos: prueba.huecosNuevos.length,
      blockIdMap: mapa,
    });
  }

  return { template, vigente, destino, clasificados };
}

export async function resumenDeCambioDePlantilla(templateId: string, actor: DesignActor): Promise<ResumenDeCambio> {
  const { template, vigente, clasificados } = await clasificar(templateId, actor);
  const totales: Record<CategoriaDeCambio, number> = {
    pendiente: 0,
    aprobado: 0,
    produccion: 0,
    "editado-a-mano": 0,
    "revision-manual": 0,
  };
  for (const c of clasificados) totales[c.categoria]++;
  const enVersionVigente = await prisma.designProject.count({
    where: {
      templateV2Id: templateId,
      templateV2VersionId: template.currentVersionId,
      ...(actor.role === "ADMIN" ? {} : { photographerUserId: actor.id }),
    },
  });
  return {
    enVersionVigente,
    template: {
      id: template.id,
      name: template.name,
      versionId: template.currentVersionId,
      versionNumber: vigente?.versionNumber ?? 0,
    },
    disenos: clasificados.map(({ fila: _fila, blockIdMap: _mapa, ...d }) => d),
    totales,
  };
}


/**
 * Pasa a la versión vigente los diseños elegidos. Cada uno se vuelve a validar acá: lo que diga el
 * navegador no alcanza para tocar un diseño en producción.
 */
export async function aplicarCambioDePlantilla(
  templateId: string,
  actor: DesignActor,
  ids: number[],
): Promise<ResultadoDeCambio> {
  const pedidos = new Set(ids);
  const { template, vigente, clasificados } = await clasificar(templateId, actor);
  const resultado: ResultadoDeCambio = { pasados: [], volvieronARevision: [], autorizacionesAnuladas: [], omitidos: [] };
  const destino = await loadDesignTemplateVersion({ templateId, versionId: template.currentVersionId });
  if (!destino) throw new DesignProjectError("No encontramos esa plantilla.", 404);

  for (const c of clasificados) {
    if (!pedidos.has(c.id)) continue;
    pedidos.delete(c.id);
    if (c.categoria !== "pendiente" && c.categoria !== "aprobado") {
      resultado.omitidos.push({
        id: c.id,
        motivo:
          c.categoria === "produccion"
            ? "Ya se mandó a imprimir."
            : c.categoria === "editado-a-mano"
              ? "Se editó a mano."
              : (c.motivo ?? "Hay que revisarlo a mano."),
      });
      continue;
    }
    const data = parseDesignV2Data(c.fila.currentRevision?.dataJson);
    const movido = data && c.blockIdMap
      ? pasarDisenoDeVersion(data, { versionId: template.currentVersionId, blockIdMap: c.blockIdMap, slots: destino.slots })
      : null;
    if (!movido?.ok) {
      resultado.omitidos.push({ id: c.id, motivo: "Hay que revisarlo a mano." });
      continue;
    }
    const aprobado = c.categoria === "aprobado";
    const nota = `Se pasó a la versión ${vigente?.versionNumber ?? "nueva"} de la plantilla «${template.name}».`;

    const hecho = await prisma.$transaction(async (tx) => {
      // Se vuelve a mirar dentro de la transacción: que nadie lo haya mandado a imprimir ni
      // movido mientras tanto.
      const sigue = await tx.designProject.updateMany({
        where: {
          id: c.id,
          templateV2VersionId: c.fila.templateV2VersionId,
          currentRevisionId: c.fila.currentRevision?.id ?? -1,
          sentToPrintAt: null,
          printedAt: null,
          deliveredAt: null,
        },
        data: { templateV2VersionId: template.currentVersionId },
      });
      if (sigue.count !== 1) return null;

      const revision = await tx.designRevision.create({
        data: {
          designProjectId: c.id,
          createdBy: "PHOTOGRAPHER",
          dataJson: movido.data as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      await tx.designProject.update({
        where: { id: c.id },
        data: {
          currentRevisionId: revision.id,
          ...(aprobado
            ? {
                status: "PENDING_PHOTOGRAPHER_APPROVAL",
                approvedAt: null,
                approvedByUserId: null,
                reviewReason: "PLANTILLA_ACTUALIZADA",
                reviewNote: `${nota} Estaba aprobado: volvé a revisarlo.`,
              }
            : {}),
        },
      });
      if (aprobado) {
        // La familia ya no tiene el archivo final: vuelve a "Diseño en revisión".
        const item = await tx.designProject.findUnique({ where: { id: c.id }, select: { orderItemId: true } });
        if (item?.orderItemId) {
          await tx.preCompraOrderItem.updateMany({
            where: { id: item.orderItemId, status: { in: ["EXPORTED", "APPROVED"] } },
            data: { status: "DESIGN_SUBMITTED" },
          });
        }
      }
      const anulada = await invalidarAutorizacionDeLaFamilia(tx, c.id, nota);
      return { anulada };
    });

    if (!hecho) {
      resultado.omitidos.push({ id: c.id, motivo: "Cambió mientras tanto: volvé a abrir la lista." });
      continue;
    }
    resultado.pasados.push(c.id);
    if (aprobado) resultado.volvieronARevision.push(c.id);
    if (hecho.anulada) resultado.autorizacionesAnuladas.push(c.id);
  }

  for (const id of pedidos) resultado.omitidos.push({ id, motivo: "No es un diseño de esta plantilla con una versión anterior." });
  return resultado;
}

// ---------------------------------------------------------------------------------------------
// Copia propia de un diseño
// ---------------------------------------------------------------------------------------------

/**
 * Le da al diseño una copia propia de su versión de plantilla, para retocar el armado (mover un
 * texto, agrandar una foto…) sin tocar la plantilla ni los demás diseños. Si ya la tiene, la
 * devuelve. El diseño queda «editado a mano»: los cambios de la plantilla ya no le llegan.
 */
export async function copiaPropiaDelDiseno(
  designId: number,
  actor: DesignActor,
): Promise<{ templateId: string; versionId: string; creada: boolean }> {
  const fila = await prisma.designProject.findUnique({
    where: { id: designId },
    select: {
      id: true,
      photographerUserId: true,
      templateV2Id: true,
      templateV2VersionId: true,
      sentToPrintAt: true,
      printedAt: true,
      deliveredAt: true,
      currentRevision: { select: { id: true, dataJson: true } },
    },
  });
  if (!fila || !fila.templateV2Id || (actor.role !== "ADMIN" && fila.photographerUserId !== actor.id)) {
    throw new DesignProjectError("No encontramos ese diseño.", 404);
  }
  if (PRODUCCION(fila)) {
    throw new DesignProjectError("Este librito ya se mandó a imprimir: su diseño no se puede cambiar.", 409);
  }
  const data = parseDesignV2Data(fila.currentRevision?.dataJson);
  if (!data || !fila.currentRevision) throw new DesignProjectError("El diseño está incompleto.", 422);
  const template = await prisma.templateV2.findUnique({
    where: { id: fila.templateV2Id },
    select: { id: true, ownerUserId: true, currentVersionId: true },
  });
  if (!template) throw new DesignProjectError("La plantilla de este diseño ya no existe.", 410);
  if (actor.role !== "ADMIN" && template.ownerUserId !== actor.id) {
    throw new DesignProjectError(
      "La plantilla de este diseño no es tuya: duplicala en tus plantillas para poder editar el armado.",
      403,
    );
  }
  const versionId = data.templateV2VersionId || fila.templateV2VersionId || template.currentVersionId;
  if (!versionId) throw new DesignProjectError("El diseño está incompleto.", 422);

  const actual = await prisma.templateV2Version.findFirst({
    where: { id: versionId, templateId: template.id },
    select: { id: true, metaJson: true },
  });
  if (!actual) throw new DesignProjectError("La plantilla de este diseño ya no existe.", 410);
  const copia = readPrivateCopy(actual.metaJson);
  if (copia?.kind === PRIVATE_COPY_KIND && copia.id === String(designId)) {
    return { templateId: template.id, versionId: actual.id, creada: false };
  }

  const privateCopy: TemplateV2PrivateCopy = { kind: PRIVATE_COPY_KIND, id: String(designId), at: new Date().toISOString() };
  const resultado = await prisma.$transaction(async (tx) => {
    const creada = await copyTemplateV2VersionAsPrivate(tx, {
      templateId: template.id,
      versionId: actual.id,
      userId: actor.id,
      privateCopy,
    });
    const slots = await huecosDeLaVersion(tx, template.id, creada.newVersionId);
    const movido = pasarDisenoDeVersion(data, { versionId: creada.newVersionId, blockIdMap: creada.blockIdMap, slots });
    if (!movido.ok) throw new DesignProjectError(movido.motivo, 422);
    const sigue = await tx.designProject.updateMany({
      where: { id: designId, currentRevisionId: fila.currentRevision!.id, sentToPrintAt: null, printedAt: null, deliveredAt: null },
      data: { templateV2VersionId: creada.newVersionId },
    });
    if (sigue.count !== 1) throw new DesignProjectError("El diseño cambió mientras tanto. Recargá la página.", 409);
    await tx.designRevision.update({
      where: { id: fila.currentRevision!.id },
      // Mismo contenido, con los ids de la copia. El archivo generado sigue sirviendo hasta que se
      // toque el armado (ahí `onVersionSaved` lo manda de vuelta a revisión).
      data: { dataJson: { ...movido.data, export: data.export, exportError: data.exportError } as unknown as Prisma.InputJsonValue },
    });
    return creada;
  });
  return { templateId: template.id, versionId: resultado.newVersionId, creada: true };
}

/** Los huecos del cliente de una versión, leídos dentro de la transacción (la copia recién creada). */
async function huecosDeLaVersion(tx: Prisma.TransactionClient, templateId: string, versionId: string) {
  const version = await tx.templateV2Version.findFirst({
    where: { id: versionId, templateId },
    select: { id: true, canvasJson: true, metaJson: true },
  });
  if (!version) throw new DesignProjectError("No se pudo crear la copia.", 500);
  const [blocks, bindings] = await Promise.all([
    loadTemplateV2BlocksForVersion(tx as never, version.id),
    tx.templateV2VariableBinding.findMany({ where: { templateVersionId: version.id } }),
  ]);
  const legacy = versionRowsToLegacyPayload({ canvasJson: version.canvasJson, metaJson: version.metaJson, blocks, bindings });
  return listClientPhotoSlots(legacy.blocks, legacy.meta);
}
