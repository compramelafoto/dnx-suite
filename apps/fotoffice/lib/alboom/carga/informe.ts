import type { Decision } from "./tipos";

/**
 * Informe de una simulación o carga (`FotofficeAlboomCarga.report`). Puro.
 *
 * Privacidad: sólo cantidades, motivos (textos fijos) e ids de Alboom como ejemplo. Nunca nombres, correos ni
 * teléfonos: el informe se muestra entero en la pantalla.
 */

export type GrupoMotivo = "omitidos" | "conflictos" | "errores" | "dudas";

export type InformeEntidad = {
  leidos: number;
  crear: number;
  actualizar: number;
  iguales: number;
  /** De los anteriores, cuántos se ataron a un registro que ya existía en FOTOFFICE. */
  vinculados: number;
  omitidos: number;
  /** Registros con algún campo que se conservó como estaba en FOTOFFICE. */
  conflictos: number;
  errores: number;
  dudas: number;
  motivos: Record<GrupoMotivo, Record<string, number>>;
  /** Por motivo, hasta `MAX_EJEMPLOS` ids de Alboom. */
  ejemplos: Record<string, string[]>;
  /** Duplicados de Alboom fusionados: id fusionado → id que quedó. */
  fusionados: { alboomId: string; con: string }[];
};

export type Informe = { entidades: Record<string, InformeEntidad> };

export const MAX_EJEMPLOS = 5;
export const MAX_FUSIONADOS = 200;

export function informeVacio(): Informe {
  return { entidades: {} };
}

export function entidadVacia(): InformeEntidad {
  return {
    leidos: 0,
    crear: 0,
    actualizar: 0,
    iguales: 0,
    vinculados: 0,
    omitidos: 0,
    conflictos: 0,
    errores: 0,
    dudas: 0,
    motivos: { omitidos: {}, conflictos: {}, errores: {}, dudas: {} },
    ejemplos: {},
    fusionados: [],
  };
}

function de(inf: Informe, clave: string): InformeEntidad {
  return (inf.entidades[clave] ??= entidadVacia());
}

function anotar(e: InformeEntidad, grupo: GrupoMotivo, motivo: string, alboomId: string) {
  e.motivos[grupo][motivo] = (e.motivos[grupo][motivo] ?? 0) + 1;
  const ej = (e.ejemplos[motivo] ??= []);
  if (ej.length < MAX_EJEMPLOS && !ej.includes(alboomId)) ej.push(alboomId);
}

/** Nombre legible de cada campo que puede quedar conservado. */
export const ETIQUETA_CAMPO: Record<string, string> = {
  kind: "persona o empresa",
  firstName: "nombre",
  lastName: "apellido",
  businessName: "razón social",
  docType: "tipo de documento",
  docNumber: "documento",
  email: "correo",
  phone: "teléfono",
  address: "domicilio",
  city: "ciudad",
  category: "categoría de contacto",
  mobile: "celular",
  email2: "segundo correo",
  birthday: "cumpleaños",
  website: "web",
  province: "provincia",
  country: "país",
  postalCode: "código postal",
  about: "sobre",
  group: "grupo",
  sku: "código",
  description: "descripción",
  priceArs: "precio",
  costArs: "costo",
  isActive: "activo",
  categoria: "categoría de producto",
  inPriceList: "lista de precios",
  isCombo: "combo",
  quantity: "cantidad",
  concept: "concepto",
  amountArs: "importe",
  daysFromEvent: "días desde el evento",
  supplierClientId: "proveedor",
};

/** Motivo de un campo conservado (el nombre del campo, nunca su valor). */
export const motivoConservado = (campo: string) => `Se conservó lo de FOTOFFICE en: ${ETIQUETA_CAMPO[campo] ?? campo}`;

export function sumarDecision(inf: Informe, clave: string, alboomId: string, d: Decision): void {
  const e = de(inf, clave);
  e.leidos++;
  switch (d.accion) {
    case "CREAR":
      e.crear++;
      break;
    case "ACTUALIZAR":
      e.actualizar++;
      break;
    case "IGUAL":
      e.iguales++;
      break;
    case "OMITIR":
      e.omitidos++;
      anotar(e, "omitidos", d.motivo ?? "Sin motivo", alboomId);
      break;
  }
  if (d.vincula && d.accion !== "OMITIR") e.vinculados++;
  if (d.conservados && d.conservados.length > 0) {
    e.conflictos++;
    for (const c of d.conservados) anotar(e, "conflictos", motivoConservado(c), alboomId);
  }
  for (const duda of d.dudas ?? []) {
    e.dudas++;
    anotar(e, "dudas", duda, alboomId);
  }
  if (d.fusionadoCon && e.fusionados.length < MAX_FUSIONADOS) e.fusionados.push({ alboomId, con: d.fusionadoCon });
}

export function sumarError(inf: Informe, clave: string, alboomId: string, motivo: string): void {
  const e = de(inf, clave);
  e.leidos++;
  e.errores++;
  anotar(e, "errores", motivo, alboomId);
}

/** Totales de todo el informe (para el encabezado de la pantalla). */
export function totales(inf: Informe): Omit<InformeEntidad, "motivos" | "ejemplos" | "fusionados"> {
  const t = { leidos: 0, crear: 0, actualizar: 0, iguales: 0, vinculados: 0, omitidos: 0, conflictos: 0, errores: 0, dudas: 0 };
  for (const e of Object.values(inf.entidades)) for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += e[k];
  return t;
}

/** Lee el JSON guardado sin confiar en su forma. */
export function leerInforme(json: unknown): Informe {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return informeVacio();
  const ent = (json as { entidades?: unknown }).entidades;
  if (typeof ent !== "object" || ent === null || Array.isArray(ent)) return informeVacio();
  const out: Informe = { entidades: {} };
  for (const [k, v] of Object.entries(ent as Record<string, unknown>)) {
    if (typeof v !== "object" || v === null) continue;
    out.entidades[k] = { ...entidadVacia(), ...(v as Partial<InformeEntidad>) };
  }
  return out;
}
