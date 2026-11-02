import "server-only";
import { prisma } from "@repo/db";
import { emitDesign, type ResourceResolver, type VariableContract } from "@repo/design-studio";
import { createTemplateWithKey, loadTemplateById } from "@/lib/template-v2/keyed-template";
import { pruneEmptyBlocks } from "@/lib/placas/prune";
import { prepararImagen, type ImagenLista } from "@/lib/placas/images";
import { EVENTO_VARIABLES } from "./diploma-variables";
import { PLACA_EVENTO_TEMPLATE_KEY } from "./diploma-constantes";
import { placaEventoDesignDocument, PLACA_EVENTO_DPI, PLACA_EVENTO_PX } from "./placa-diseno";
import { fechaDeEvento } from "./reglas";

/**
 * La placa de bienvenida de un inscripto: un PNG cuadrado (1080 × 1080, para Instagram) con su
 * foto, su nombre, su Instagram y el evento. Es lo que en Clickatón eran las placas de
 * participante; acá se dibuja con el mismo motor que las placas de Comunicación de FOTOFFICE
 * (`@repo/design-studio`: PDF rasterizado con `mupdf`, sin navegador) y se genera **a pedido**:
 * si la persona cambia su foto o se retoca el diseño, la placa sale con lo vigente.
 *
 * Cada evento puede tener su plantilla (`FotofficeEvento.placaTemplateId`, editable en el
 * diseñador); mientras no la tenga, sale con el diseño base.
 */

const CONTRATO: VariableContract = {
  variables: [
    ...EVENTO_VARIABLES,
    { key: "institutionName", type: "text", label: "Institución", required: false, sampleValue: "Rafaela en Foco" },
    { key: "institutionLogo", type: "image", label: "Logo de la institución", required: false, sampleValue: "logo.png" },
  ],
};

/** Crea la plantilla de placa del evento con el diseño base y la deja asignada. */
export async function crearPlantillaPlaca(workspaceId: string, userId: number, eventoId: string) {
  const evento = await prisma.fotofficeEvento.findFirst({ where: { id: eventoId, workspaceId }, select: { id: true, nombre: true } });
  if (!evento) return { ok: false as const, error: "No existe el evento." };
  const r = await createTemplateWithKey({
    workspaceId,
    userId,
    templateKey: PLACA_EVENTO_TEMPLATE_KEY,
    name: `Placa de bienvenida · ${evento.nombre}`,
    description: "Placa de bienvenida de los inscriptos del evento",
    document: placaEventoDesignDocument(),
  });
  if (!r.ok) return r;
  await prisma.fotofficeEvento.updateMany({ where: { id: eventoId, workspaceId }, data: { placaTemplateId: r.templateId } });
  return { ok: true as const, templateId: r.templateId, versionId: r.versionId };
}

function resolvedor(cache: Map<string, ImagenLista>): ResourceResolver {
  return {
    async read(ref: string) {
      const enCache = cache.get(ref);
      if (enCache) return enCache;
      // Imágenes fijas del diseño (un fondo subido en el editor): se preparan al pedirlas.
      const lista = await prepararImagen(ref);
      if (lista) cache.set(ref, lista);
      return lista;
    },
  };
}

export type ResultadoPlaca = { ok: true; png: Uint8Array; nombreArchivo: string } | { ok: false; error: string };

export async function renderPlacaBienvenida(workspaceId: string, inscriptoId: string): Promise<ResultadoPlaca> {
  const i = await prisma.fotofficeEventoInscripto.findFirst({
    where: { id: inscriptoId, workspaceId },
    include: { evento: true },
  });
  if (!i) return { ok: false, error: "No encontramos esa inscripción." };
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId },
    select: { commercialName: true, logoUrl: true },
  });

  const plantilla = i.evento.placaTemplateId
    ? await loadTemplateById({
        workspaceId,
        templateId: i.evento.placaTemplateId,
        documentName: `Placa de bienvenida · ${i.evento.nombre}`,
        fallbackCanvas: PLACA_EVENTO_PX,
      })
    : null;

  const valores: Record<string, string | null> = {
    attendeeName: i.nombre,
    eventName: i.evento.nombre,
    eventDate: fechaDeEvento(i.evento.fechaInicio, i.evento.fechaFin) || null,
    eventPlace: i.evento.lugar,
    ticketType: i.tipo,
    attendeeCode: i.codigo,
    attendeePhoto: i.fotoUrl,
    attendeeInstagram: i.instagram ? `@${i.instagram}` : null,
    institutionName: branding?.commercialName ?? null,
    institutionLogo: branding?.logoUrl || null,
  };
  const sinteticas = plantilla?.variablesSinteticas ?? [];
  for (const v of sinteticas) valores[v.key] = v.value;
  const contrato: VariableContract = {
    variables: [
      ...CONTRATO.variables,
      ...sinteticas.map((v) => ({ key: v.key, type: "qrPayload" as const, label: v.label, required: false, sampleValue: v.value })),
    ],
  };

  // Las imágenes de datos se preparan antes: una foto que no se puede leer se trata como ausente y
  // su bloque se poda, en vez de hacer fallar la placa entera.
  const cache = new Map<string, ImagenLista>();
  for (const clave of ["attendeePhoto", "institutionLogo"]) {
    const ref = valores[clave];
    if (!ref) continue;
    const lista = await prepararImagen(ref);
    if (lista) cache.set(ref, lista);
    else valores[clave] = null;
  }

  const { document } = pruneEmptyBlocks(plantilla?.document ?? placaEventoDesignDocument(), valores);
  const nombreArchivo = `bienvenida-${i.codigo}`;
  const salida = await emitDesign({
    document,
    contract: contrato,
    values: valores,
    formats: ["PNG_PER_SIDE"],
    pngDpi: PLACA_EVENTO_DPI,
    includeBleed: false,
    resources: resolvedor(cache),
    fileBaseName: nombreArchivo,
  });
  if (!salida.ok) {
    console.error("[fotoffice][eventos] la placa de bienvenida no se pudo dibujar", { eventoId: i.eventoId, errores: salida.errors });
    return { ok: false, error: `El diseño de la placa tiene un problema: ${salida.errors.join(" ")}` };
  }
  const png = salida.files.find((f) => f.contentType === "image/png");
  if (!png) return { ok: false, error: "El diseño no produjo ninguna imagen." };
  return { ok: true, png: png.bytes, nombreArchivo: `${nombreArchivo}.png` };
}
