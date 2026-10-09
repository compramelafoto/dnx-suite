import { CALL_TEXT_LIMITS, DEFAULT_WORKS_PER_PERSON, dayEndAr, dayStartAr, editableCallFields } from "@repo/muestras";

export type ConvocatoriaForm = {
  id: string | null;
  title: string;
  basesText: string;
  requirementsText: string | null;
  rightsText: string;
  opensDay: string;
  closesDay: string;
  maxWorksPerPerson: number;
};

/** Texto de derechos con el que arranca toda convocatoria; el organizador lo adapta. */
export const DERECHOS_SUGERIDOS =
  "Declaro que soy autor/a de las obras que envío y que tengo los derechos para hacerlo. Si alguna queda seleccionada, autorizo a la organización a exhibirla en la muestra y a publicarla en su galería virtual, con mi nombre como autor/a, sin fines comerciales. Conservo todos mis derechos sobre las obras.";

export const REQUISITOS_SUGERIDOS =
  "JPG o PNG, idealmente de al menos 2000 px de lado mayor (las achicamos para la web). Sin marcas de agua, firmas ni tu nombre en la imagen: la selección es anónima.";

const txt = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max).trim();

export function convocatoriaDesdeFormData(fd: FormData): ConvocatoriaForm {
  const max = Number(String(fd.get("maxWorksPerPerson") ?? ""));
  return {
    id: txt(fd, "id", 40) || null,
    title: txt(fd, "title", CALL_TEXT_LIMITS.title),
    basesText: txt(fd, "basesText", CALL_TEXT_LIMITS.basesText),
    requirementsText: txt(fd, "requirementsText", CALL_TEXT_LIMITS.requirementsText) || null,
    rightsText: txt(fd, "rightsText", CALL_TEXT_LIMITS.rightsText),
    opensDay: txt(fd, "opensDay", 10),
    closesDay: txt(fd, "closesDay", 10),
    maxWorksPerPerson: Number.isInteger(max) ? max : DEFAULT_WORKS_PER_PERSON,
  };
}

export type DatosConvocatoria = {
  title?: string;
  basesText?: string;
  requirementsText?: string | null;
  rightsText?: string;
  opensAt?: Date;
  closesAt?: Date;
  maxWorksPerPerson?: number;
};

/**
 * Sólo los campos que el estado deja cambiar (`editableCallFields`); el resto se ignora aunque
 * venga en el formulario. Tira `Error` si una fecha editable no es válida.
 */
export function datosParaGuardar(f: ConvocatoriaForm, status: string): DatosConvocatoria {
  const campos = new Set(editableCallFields(status));
  const d: DatosConvocatoria = {};
  if (campos.has("title")) d.title = f.title;
  if (campos.has("basesText")) d.basesText = f.basesText;
  if (campos.has("requirementsText")) d.requirementsText = f.requirementsText;
  if (campos.has("rightsText")) d.rightsText = f.rightsText;
  if (campos.has("opensDay")) d.opensAt = dayStartAr(f.opensDay);
  if (campos.has("closesDay")) d.closesAt = dayEndAr(f.closesDay);
  if (campos.has("maxWorksPerPerson")) d.maxWorksPerPerson = f.maxWorksPerPerson;
  return d;
}
