import "server-only";
import sharp from "sharp";
import { CLASS_LIST_VARIABLE_KEY, serializeClassList } from "@repo/template-engine";
import { fileExistsInR2, readFromR2, uploadToR2 } from "@/lib/r2-client";
import { DESIGN_V2_SCHEMA_VERSION, type DesignV2Data } from "./design-data";
import { renderDesignV2 } from "./render";
import { loadDesignTemplateVersion } from "./template";
import { buildDesignValues } from "./values";

/**
 * Miniatura de una plantilla para los catálogos: la primera página, en JPG, con datos de muestra.
 *
 * La dibuja el mismo motor que imprime (`renderDesignV2`), una sola vez por versión, y la guarda
 * en R2: la siguiente vez se sirve guardada. Los huecos de foto del cliente se ven como un gris
 * suave con un ícono de cámara, para que se entienda dónde va cada foto, y los textos variables
 * llevan nombres de ejemplo.
 */

const LADO = 720;

function clave(templateId: string, versionId: string): string {
  return `template-thumbs/${templateId}/${versionId}-v1.jpg`;
}

/** Foto de muestra para los huecos: gris suave con una cámara en el centro. */
async function fotoDeMuestra(): Promise<Uint8Array> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <rect width="600" height="600" fill="#e6e1da"/>
    <g fill="none" stroke="#b9afa3" stroke-width="18" stroke-linejoin="round">
      <rect x="170" y="215" width="260" height="180" rx="28"/>
      <path d="M245 215l20-38h70l20 38"/>
      <circle cx="300" cy="305" r="50"/>
    </g>
  </svg>`;
  return new Uint8Array(await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer());
}

function valoresDeMuestra(): Record<string, string> {
  const alumnos = [
    ["Sofía", "Pérez"], ["Mateo", "Gómez"], ["Valentina", "Díaz"], ["Benjamín", "Álvarez"],
    ["Isabella", "Romero"], ["Thiago", "Sosa"], ["Emma", "Torres"], ["Joaquín", "Ruiz"],
    ["Martina", "Acosta"], ["Lautaro", "Medina"], ["Catalina", "Herrera"], ["Felipe", "Castro"],
  ];
  return {
    ...buildDesignValues({
      studentName: "Benjamín Álvarez",
      studentFirstName: "Benjamín",
      studentLastName: "Álvarez",
      courseName: "5.º A",
      schoolName: "Colegio",
      buyerName: "Familia",
      photographerName: "Fotógrafo",
      courseStudents: alumnos.map(([firstName, lastName], i) => ({ firstName, lastName, isOwner: i === 3 })),
    }),
  };
}

/** Devuelve la miniatura de la versión actual (o la pedida), generándola si no existe. */
export async function miniaturaDePlantilla(templateId: string, versionId?: string | null): Promise<Uint8Array | null> {
  const template = await loadDesignTemplateVersion({ templateId, versionId });
  if (!template) return null;
  const key = clave(template.templateId, template.versionId);
  try {
    if (await fileExistsInR2(key)) return new Uint8Array(await readFromR2(key));
  } catch {
    // Si no se puede leer la guardada, se vuelve a dibujar.
  }

  const muestra = await fotoDeMuestra();
  const slots = Object.fromEntries(
    template.slots.map((s) => [s.blockId, { photoId: 1, crop: { zoom: 1, x: 0, y: 0 } }]),
  );
  const values = valoresDeMuestra();
  if (!values[CLASS_LIST_VARIABLE_KEY]) {
    values[CLASS_LIST_VARIABLE_KEY] = serializeClassList([
      { firstName: "Benjamín", lastName: "Álvarez", isOwner: true },
    ]);
  }
  const data: DesignV2Data = {
    schemaVersion: DESIGN_V2_SCHEMA_VERSION,
    engine: "TEMPLATE_V2",
    templateV2Id: template.templateId,
    templateV2VersionId: template.versionId,
    photoIds: [1],
    slots,
    values,
    export: null,
    exportError: null,
  };
  const r = await renderDesignV2({
    template,
    data,
    loadPhoto: async () => muestra,
    formats: { pdf: false, jpg: true },
    jpgMaxSide: LADO,
    fileBaseName: "miniatura",
  });
  const jpg = r.ok ? r.jpgs[0] : null;
  if (!jpg) {
    if (!r.ok) console.error("[miniatura] no se pudo dibujar", templateId, r.errors);
    return null;
  }
  try {
    await uploadToR2(Buffer.from(jpg), key, "image/jpeg", { type: "template_thumbnail", templateId });
  } catch (err) {
    console.error("[miniatura] no se pudo guardar", templateId, err);
  }
  return jpg;
}
