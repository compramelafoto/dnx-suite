import "server-only";
import { COURSE_MOSAIC_VARIABLE_KEY } from "@repo/template-engine";
import { createHash } from "node:crypto";
import type { Prisma } from "@/lib/prisma";
import type { PreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { toDesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { loadAlbumCourses } from "@/lib/design-v2/class-list";
import { listadoPermiteSumarCursos, opcionesDelListado } from "@/lib/design-v2/listado-cursos";
import { loadDesignTemplateVersion } from "@/lib/design-v2/template";
import { contenidoCanonico, type RevisionDelCliente } from "./autorizacion";
import { aplicarRevisionDelCanje, type RevisionPedida } from "./revision-del-canje";

/** Los beneficios del pack que se arman como diseño (el librito, la carpeta). */
export function beneficiosConDiseno(snapshot: Pick<PreventaPackSnapshotV1, "benefits">) {
  return snapshot.benefits.filter((b) => b.templateV2Id && b.templatePolicy === "REQUIRED");
}

/** Un pack con librito no se canjea sin que la familia autorice la impresión. */
export function packRequiereAutorizacion(snapshot: Pick<PreventaPackSnapshotV1, "benefits">): boolean {
  return beneficiosConDiseno(snapshot).length > 0;
}

/** Lo que hay que aplicar a los textos del diseño y guardar con él, a partir de lo que mandó la familia. */
export type RevisionPreparada = {
  aplicar: (values: Record<string, string>) => Promise<{ values: Record<string, string>; clientReview: RevisionDelCliente }>;
};

/**
 * Prepara la revisión de la familia para un canje: lee las plantillas del pack (qué textos se
 * imprimen, si dejan sumar cursos) y los cursos del álbum, una sola vez. Después `aplicar` se
 * usa con los textos de cada diseño.
 */
export async function prepararRevisionDelCanje(
  db: Prisma.TransactionClient,
  input: {
    albumId: number;
    snapshot: PreventaPackSnapshotV1;
    revision: RevisionPedida;
    by: { name: string | null; email: string | null };
    userAgent: string | null;
    now: Date;
  },
): Promise<RevisionPreparada> {
  const beneficios = beneficiosConDiseno(input.snapshot);
  const plantillas = (
    await Promise.all(beneficios.map((b) => loadDesignTemplateVersion({ templateId: b.templateV2Id! }).catch(() => null)))
  ).filter((t) => t != null);
  const textVariables = [...new Set(plantillas.flatMap((t) => toDesignTemplatePayload(t).textVariables))];
  const permiteSumar = plantillas.some((t) =>
    listadoPermiteSumarCursos(t.legacy.blocks as Array<{ type: string; configJson?: unknown }>),
  );
  const opciones = plantillas[0]
    ? opcionesDelListado(plantillas[0].legacy.blocks as Array<{ type: string; configJson?: unknown }>)
    : undefined;
  let disponibles: Awaited<ReturnType<typeof loadAlbumCourses>> | null = null;
  const subject = beneficios[0]?.name?.trim() || input.snapshot.packName;
  return {
    aplicar: async (values) => {
      if (permiteSumar && disponibles == null) disponibles = await loadAlbumCourses(db, input.albumId);
      return aplicarRevisionDelCanje({
        values,
        textVariables,
        permiteSumar,
        opcionesDelListado: opciones,
        disponibles: disponibles ?? [],
        revision: input.revision,
        subject,
        by: input.by,
        userAgent: input.userAgent,
        now: input.now,
      });
    },
  };
}

/** La huella del contenido que se imprime (textos y fotos con su encuadre). */
export function huellaDelContenido(content: { values: Record<string, string>; slots: unknown }): string {
  // El mosaico del curso no entra: son los compañeros, que se completan después y no los revisa
  // la familia. Si entrara, el retrato de cualquier compañero anularía su autorización.
  const { [COURSE_MOSAIC_VARIABLE_KEY]: _mosaico, ...values } = content.values;
  return createHash("sha256").update(contenidoCanonico({ values, slots: content.slots })).digest("hex");
}
