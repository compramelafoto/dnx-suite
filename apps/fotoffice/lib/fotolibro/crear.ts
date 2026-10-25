import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { HOJAS_MAX, HOJAS_MIN } from "./limites";
import { DPI_FOTOLIBRO, describirCerrado, lienzoDelPliego, medidaPorId, LINEAS_FOTOLIBRO } from "./medidas-pliego";

import { FOTOLIBRO_TEMPLATE_KEY } from "./constantes";

export { FOTOLIBRO_TEMPLATE_KEY };


/**
 * Margen interior sugerido: lo que el laboratorio puede comerse al cortar y montar. No hay
 * sangrado, porque la medida real del pliego ya es la de la copia que se manda.
 */
const ZONA_SEGURA_MM = 5;

export type ResultadoFotolibro =
  | { ok: true; templateId: string; versionId: string }
  | { ok: false; error: string };

/**
 * Crea un fotolibro vacío: una hoja del editor por cada pliego, todas con la medida real.
 *
 * A diferencia del carnet, no es idempotente: una institución hace muchos fotolibros.
 */
export async function crearFotolibro(input: {
  /** `null`: fotolibro personal de un socio, desde su portal (ver `./socio.ts`). */
  workspaceId: string | null;
  userId: number;
  medidaId: string;
  hojas: number;
  proveedorId: string | null;
  nombre: string | null;
}): Promise<ResultadoFotolibro> {
  const medida = medidaPorId(input.medidaId);
  if (!medida) return { ok: false, error: "Elegí una medida de pliego." };
  const hojas = Math.trunc(input.hojas);
  if (!Number.isFinite(hojas) || hojas < HOJAS_MIN || hojas > HOJAS_MAX) {
    return { ok: false, error: `La cantidad de hojas va de ${HOJAS_MIN} a ${HOJAS_MAX}.` };
  }

  let proveedor: { id: string; name: string } | null = null;
  if (input.proveedorId && input.workspaceId) {
    proveedor = await prisma.fotofficeProveedor.findFirst({
      where: { id: input.proveedorId, workspaceId: input.workspaceId },
      select: { id: true, name: true },
    });
    if (!proveedor) return { ok: false, error: "Ese proveedor no existe." };
  }

  const lienzo = lienzoDelPliego(medida);
  const nombre =
    input.nombre?.trim().slice(0, 200) ||
    `Fotolibro ${medida.nombre}${proveedor ? ` · ${proveedor.name}` : ""}`;
  const descripcion = `${LINEAS_FOTOLIBRO[medida.linea]} · ${hojas} ${hojas === 1 ? "hoja" : "hojas"} · libro de ${describirCerrado(medida)}`;

  try {
    const creado = await prisma.$transaction(async (tx) => {
      const template = await tx.templateV2.create({
        data: {
          ownerUserId: input.userId,
          workspaceId: input.workspaceId,
          name: nombre,
          description: descripcion,
          status: "DRAFT",
        },
        select: { id: true },
      });

      const version = await tx.templateV2Version.create({
        data: {
          templateId: template.id,
          versionNumber: 1,
          canvasJson: {
            ...lienzo,
            background: "#ffffff",
            dpi: DPI_FOTOLIBRO,
            bleedMm: 0,
            safeAreaMm: ZONA_SEGURA_MM,
          },
          metaJson: {
            templateKey: FOTOLIBRO_TEMPLATE_KEY,
            product: "fotoffice",
            origin: "fotolibro",
            templatePageCount: hojas,
            pageLabels: Array.from({ length: hojas }, (_, i) => `Hoja ${i + 1}`),
            fotolibro: {
              medidaId: medida.id,
              linea: medida.linea,
              altoMm: medida.altoMm,
              anchoMm: medida.anchoMm,
              hojas,
              proveedorId: proveedor?.id ?? null,
              proveedorNombre: proveedor?.name ?? null,
            },
          },
          createdByUserId: input.userId,
        },
        select: { id: true },
      });

      // Un fondo blanco por hoja, bloqueado: es lo que el editor espera encontrar en cada una.
      await tx.templateV2Block.createMany({
        data: Array.from({ length: hojas }, (_, pageIndex) => ({
          id: randomUUID(),
          templateVersionId: version.id,
          pageIndex,
          type: "BACKGROUND" as const,
          name: "Fondo",
          x: 0,
          y: 0,
          width: lienzo.width,
          height: lienzo.height,
          rotation: 0,
          zIndex: 0,
          opacity: 1,
          locked: true,
          visible: true,
          configJson: { backgroundColor: "#ffffff", src: "", fit: "cover" },
        })),
      });

      await tx.templateV2.update({
        where: { id: template.id },
        data: { currentVersionId: version.id },
      });

      return { templateId: template.id, versionId: version.id };
    });
    return { ok: true, ...creado };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/(?:table|relation).*does not exist/i.test(message)) {
      return { ok: false, error: "El módulo de diseño todavía no está habilitado en esta base." };
    }
    throw error;
  }
}
