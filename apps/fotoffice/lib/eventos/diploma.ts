import "server-only";
import { PDFDocument } from "pdf-lib";
import { prisma } from "@repo/db";
import { emitDesign, type ResourceResolver, type VariableContract } from "@repo/design-studio";
import { createTemplateWithKey, loadTemplateById } from "@/lib/template-v2/keyed-template";
import { pruneEmptyBlocks } from "@/lib/placas/prune";
import { EVENTO_VARIABLES } from "./diploma-variables";
import { DIPLOMA_TEMPLATE_KEY } from "./diploma-constantes";
import { fechaDeEvento, tieneDiploma } from "./reglas";

/**
 * Diplomas de los inscriptos de un evento. Cada evento elige una plantilla del diseñador
 * (`FotofficeEvento.diplomaTemplateId`) y cada diploma se dibuja a pedido con `@repo/design-studio`
 * —sólo PDF: no toca binarios nativos y corre en Vercel—. No se guarda nada: el PDF sale siempre
 * de la plantilla actual, así un error de tipeo se corrige en el diseño y listo.
 */

export { DIPLOMA_TEMPLATE_KEY } from "./diploma-constantes";

/** A4 apaisado a 300 dpi, el lienzo del editor si la versión no guardó el suyo. */
const DIPLOMA_CANVAS_PX = { width: 3508, height: 2480 };

/** Tope de diplomas en un mismo PDF: una función de Vercel tiene 60 s y respuestas de 4,5 MB. */
export const DIPLOMAS_POR_ARCHIVO = 60;

const CONTRATO: VariableContract = {
  variables: [
    ...EVENTO_VARIABLES,
    { key: "institutionName", type: "text", label: "Institución", required: false, sampleValue: "Rafaela en Foco" },
    { key: "institutionLogo", type: "image", label: "Logo de la institución", required: false, sampleValue: "logo.png" },
  ],
};

/** Diseño inicial: A4 apaisado, fondo oscuro con marco dorado, logo, nombre en letra cursiva. */
export function diplomaDesignDocument(): unknown {
  const oro = "#c9a24a";
  const crema = "#f3ead2";
  return {
    schemaVersion: 1,
    metadata: { name: "Diploma", description: "Diploma de participación, versión 1" },
    format: { medium: "PRINT", width: 297, height: 210, dpi: 300, bleedMm: 0, safeAreaMm: 10 },
    sides: [
      {
        id: "frente",
        name: "Frente",
        background: "#0b0c0c",
        blocks: [
          { id: "marco", type: "rect", x: 10, y: 10, width: 277, height: 190, strokeColor: oro, strokeWidth: 0.8 },
          { id: "marco-fino", type: "rect", x: 13, y: 13, width: 271, height: 184, strokeColor: oro, strokeWidth: 0.3 },
          { id: "logo", type: "image", x: 108.5, y: 22, width: 80, height: 32, variableKey: "institutionLogo", fit: "contain" },
          { id: "titulo", type: "text", x: 30, y: 62, width: 237, height: 10, fontId: "cinzel", fontSize: 18, fontWeight: "bold", color: oro, align: "center", content: "CERTIFICADO DE PARTICIPACIÓN", maxLines: 1 },
          { id: "otorga", type: "text", x: 30, y: 78, width: 237, height: 8, fontId: "dmSans", fontSize: 12, color: crema, align: "center", content: "Se otorga el presente certificado a", maxLines: 1 },
          { id: "nombre", type: "text", x: 25, y: 89, width: 247, height: 26, fontId: "greatVibes", fontSize: 50, color: oro, align: "center", content: "{{attendeeName}}", maxLines: 1 },
          { id: "linea", type: "line", x: 78.5, y: 119, width: 140, height: 0.3, strokeColor: oro, strokeWidth: 0.4 },
          { id: "por", type: "text", x: 30, y: 126, width: 237, height: 8, fontId: "dmSans", fontSize: 12, color: crema, align: "center", content: "por su participación en", maxLines: 1 },
          { id: "evento", type: "text", x: 30, y: 136, width: 237, height: 12, fontId: "playfairDisplay", fontSize: 22, fontWeight: "bold", color: crema, align: "center", content: "{{eventName}}", maxLines: 1 },
          { id: "cuando", type: "text", x: 30, y: 152, width: 237, height: 8, fontId: "dmSans", fontSize: 11, color: crema, align: "center", content: "{{eventDate}} · {{eventPlace}}", maxLines: 2 },
          { id: "codigo", type: "text", x: 200, y: 186, width: 80, height: 6, fontId: "dmSans", fontSize: 7, color: oro, align: "right", content: "Código {{attendeeCode}}", maxLines: 1 },
        ],
      },
    ],
  };
}

function recursos(): ResourceResolver {
  // Los logos y fotos del diseño son direcciones públicas de R2: se bajan una vez por emisión.
  const cache = new Map<string, Uint8Array | null>();
  return {
    async read(ref: string): Promise<Uint8Array | null> {
      if (!/^https?:\/\//.test(ref)) return null;
      if (cache.has(ref)) return cache.get(ref) ?? null;
      let bytes: Uint8Array | null = null;
      try {
        const r = await fetch(ref);
        if (r.ok) bytes = new Uint8Array(await r.arrayBuffer());
      } catch {
        bytes = null;
      }
      cache.set(ref, bytes);
      return bytes;
    },
  };
}

/** Crea la plantilla de diploma del evento con el diseño inicial y la deja asignada. */
export async function crearPlantillaDiploma(workspaceId: string, userId: number, eventoId: string) {
  const evento = await prisma.fotofficeEvento.findFirst({ where: { id: eventoId, workspaceId }, select: { id: true, nombre: true } });
  if (!evento) return { ok: false as const, error: "No existe el evento." };
  const r = await createTemplateWithKey({
    workspaceId,
    userId,
    templateKey: DIPLOMA_TEMPLATE_KEY,
    name: `Diploma · ${evento.nombre}`,
    description: "Diploma de participación del evento",
    document: diplomaDesignDocument(),
  });
  if (!r.ok) return r;
  await prisma.fotofficeEvento.updateMany({ where: { id: eventoId, workspaceId }, data: { diplomaTemplateId: r.templateId } });
  return { ok: true as const, templateId: r.templateId, versionId: r.versionId };
}

/** Las plantillas de diploma de la institución, para reutilizar un diseño en otro evento. */
export async function plantillasDeDiploma(workspaceId: string) {
  const plantillas = await prisma.templateV2.findMany({
    where: { workspaceId, status: { not: "ARCHIVED" }, currentVersionId: { not: null } },
    select: { id: true, name: true, currentVersionId: true },
    orderBy: { updatedAt: "desc" },
  });
  const versiones = await prisma.templateV2Version.findMany({
    where: { id: { in: plantillas.map((p) => p.currentVersionId!).filter(Boolean) } },
    select: { id: true, metaJson: true },
  });
  const esDiploma = new Set(
    versiones
      .filter((v) => (v.metaJson as { templateKey?: unknown } | null)?.templateKey === DIPLOMA_TEMPLATE_KEY)
      .map((v) => v.id),
  );
  return plantillas.filter((p) => p.currentVersionId && esDiploma.has(p.currentVersionId));
}

type InscriptoDiploma = {
  id: string;
  nombre: string;
  tipo: string | null;
  codigo: string;
  estadoPago: string;
  acreditadoAt: Date | null;
};

export type ResultadoDiploma =
  | { ok: true; bytes: Uint8Array; cantidad: number; nombreArchivo: string }
  | { ok: false; error: string; status: number };

/**
 * El PDF con los diplomas de esos inscriptos (uno por página). Sólo los que tienen diploma según
 * `diplomaPara` del evento; los demás se saltean en silencio.
 */
export async function emitirDiplomas(input: {
  workspaceId: string;
  eventoId: string;
  inscriptos: InscriptoDiploma[];
  nombreArchivo: string;
}): Promise<ResultadoDiploma> {
  const [evento, branding] = await Promise.all([
    prisma.fotofficeEvento.findFirst({ where: { id: input.eventoId, workspaceId: input.workspaceId } }),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: input.workspaceId },
      select: { commercialName: true, logoUrl: true },
    }),
  ]);
  if (!evento) return { ok: false, error: "No existe el evento.", status: 404 };
  if (!evento.diplomaTemplateId) return { ok: false, error: "Este evento todavía no tiene diseño de diploma.", status: 409 };

  const elegidos = input.inscriptos.filter((i) => tieneDiploma(i, evento.diplomaPara)).slice(0, DIPLOMAS_POR_ARCHIVO);
  if (elegidos.length === 0) return { ok: false, error: "No hay diplomas para emitir.", status: 404 };

  const plantilla = await loadTemplateById({
    workspaceId: input.workspaceId,
    templateId: evento.diplomaTemplateId,
    documentName: `Diploma · ${evento.nombre}`,
    fallbackCanvas: DIPLOMA_CANVAS_PX,
  });
  if (!plantilla) return { ok: false, error: "No se encontró el diseño del diploma.", status: 409 };

  const contrato: VariableContract = {
    variables: [
      ...CONTRATO.variables,
      ...plantilla.variablesSinteticas.map((v) => ({ key: v.key, type: "qrPayload" as const, label: v.label, required: false, sampleValue: v.value })),
    ],
  };
  const sinteticas = Object.fromEntries(plantilla.variablesSinteticas.map((v) => [v.key, v.value]));
  const fecha = fechaDeEvento(evento.fechaInicio, evento.fechaFin);
  const res = recursos();
  const salida = await PDFDocument.create();

  for (const i of elegidos) {
    const valores: Record<string, string | null> = {
      ...sinteticas,
      attendeeName: i.nombre,
      eventName: evento.nombre,
      eventDate: fecha || null,
      eventPlace: evento.lugar,
      ticketType: i.tipo,
      attendeeCode: i.codigo,
      institutionName: branding?.commercialName ?? null,
      institutionLogo: branding?.logoUrl || null,
    };
    // Un bloque cuya variable quedó vacía (el lugar, el logo) se saca en vez de imprimir un hueco.
    const { document } = pruneEmptyBlocks(plantilla.document, valores);
    const r = await emitDesign({
      document,
      contract: contrato,
      values: valores,
      formats: ["PDF"],
      includeBleed: false,
      resources: res,
      fileBaseName: `diploma-${i.codigo}`,
    });
    if (!r.ok) {
      console.error("[fotoffice][eventos] el diploma no se pudo dibujar", { eventoId: evento.id, errores: r.errors });
      return { ok: false, error: `El diseño del diploma tiene un problema: ${r.errors.join(" ")}`, status: 422 };
    }
    const pdf = r.files.find((f) => f.contentType === "application/pdf");
    if (!pdf) return { ok: false, error: "El diploma no salió en PDF.", status: 500 };
    const doc = await PDFDocument.load(pdf.bytes);
    for (const p of await salida.copyPages(doc, doc.getPageIndices())) salida.addPage(p);
  }

  return { ok: true, bytes: await salida.save(), cantidad: elegidos.length, nombreArchivo: input.nombreArchivo };
}

/** El nombre de archivo, sin tildes ni símbolos. */
export function nombreDeArchivo(...partes: string[]): string {
  return (
    partes
      .join("-")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() + ".pdf"
  );
}
