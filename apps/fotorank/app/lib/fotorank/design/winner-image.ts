import "server-only";
import { prisma } from "@repo/db";
import { createFotorankExampleData } from "@repo/template-editor-core";
import { WINNER_FORMAT_PX, type WinnerFormat } from "./constants";
import { winnerDesignDocument } from "./documents";
import { entryImageRef } from "./images";
import { renderDesign, slugArchivo, type DesignValues } from "./render";
import { findWinnerTemplate, loadDesignDocument, type LoadedDesign } from "./templates";
import type { Winner } from "./winners";

/**
 * La imagen de un ganador, en JPG.
 *
 * El motor dibuja PNG; se pasa a JPG de calidad alta porque una foto en PNG de 1080 × 1920 pesa
 * varios MB —cerca del tope de 4,5 MB de Vercel— y Instagram la recomprime igual.
 *
 * Se genera **a pedido** y no se guarda, como las placas de FOTOFFICE: si la organización
 * retoca el diseño o corrige el nombre del autor, la próxima descarga ya sale con lo vigente.
 * Si el concurso todavía no tiene diseño propio, sale con el diseño base.
 */
export async function renderWinnerImage(input: {
  organizationId: string;
  contestId: string;
  format: WinnerFormat;
  /** `null` dibuja un ganador de muestra (vista previa del diseño). */
  winner: Winner | null;
}): Promise<{ ok: true; jpg: Uint8Array; fileName: string } | { ok: false; errors: string[] }> {
  const concurso = await prisma.fotorankContest.findFirst({
    where: { id: input.contestId, organizationId: input.organizationId },
    select: { title: true, organization: { select: { name: true, logoUrl: true } } },
  });
  if (!concurso) return { ok: false, errors: ["Concurso no encontrado."] };

  const ref = await findWinnerTemplate(input);
  let design: LoadedDesign | null = ref
    ? await loadDesignDocument({
        organizationId: input.organizationId,
        templateId: ref.templateId,
        documentName: "Imagen de ganador",
        fallbackCanvas: WINNER_FORMAT_PX[input.format],
      })
    : null;
  if (!design) {
    design = {
      templateId: "",
      versionId: "",
      document: winnerDesignDocument(input.format),
      variablesSinteticas: [],
      avisos: [],
    };
  }

  const comunes: DesignValues = {
    contestTitle: concurso.title,
    organizerName: concurso.organization.name,
    organizerLogo: concurso.organization.logoUrl ?? null,
  };
  const muestra = createFotorankExampleData() as DesignValues;
  const values: DesignValues = input.winner
    ? {
        ...comunes,
        recipientName: input.winner.recipientName,
        entryTitle: input.winner.entryTitle,
        entryImage: entryImageRef(input.winner.entryId),
        prizeLabel: input.winner.prizeLabel,
        categoryName: input.winner.categoryName,
      }
    : {
        ...muestra,
        ...comunes,
        organizerLogo: comunes.organizerLogo ?? muestra.organizerLogo,
        diplomaCode: null,
        verificationUrl: null,
      };

  const nombre = slugArchivo(
    `${input.winner?.prizeLabel ?? "muestra"}-${input.winner?.recipientName ?? input.winner?.entryTitle ?? ""}`,
    "ganador",
  );
  const rendered = await renderDesign({
    design,
    values,
    formats: ["PNG"],
    fileBaseName: nombre,
  });
  if (!rendered.ok) return { ok: false, errors: rendered.errors };
  if (!rendered.png) return { ok: false, errors: ["El diseño no produjo ninguna imagen."] };
  const { default: sharp } = await import("sharp");
  const jpg = await sharp(rendered.png)
    .flatten({ background: "#000000" })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toBuffer();
  return { ok: true, jpg: new Uint8Array(jpg), fileName: `${nombre}-${input.format}.jpg` };
}
