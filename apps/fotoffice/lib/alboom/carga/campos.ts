import { huella } from "../huella";
import type { Campos, Crudo, Decision, EntradaMapa, Valor } from "./tipos";

/**
 * La regla de "no pisar lo editado en FOTOFFICE". Pura.
 *
 * El mapa guarda, por cada campo, la huella del valor que vino de Alboom en la última carga. Al volver a cargar:
 * - si Alboom no cambió ese campo → no se toca;
 * - si cambió y en FOTOFFICE el campo sigue como se cargó (misma huella) o está vacío → se actualiza;
 * - si cambió pero en FOTOFFICE alguien lo editó → se conserva lo de FOTOFFICE (y se informa como conflicto).
 * La primera vez que un registro de Alboom se ata a uno que ya existía en FOTOFFICE sólo se completan los campos
 * vacíos. Un valor vacío de Alboom nunca borra nada.
 */

export function vacio(v: Valor | undefined): boolean {
  return v === null || v === undefined || v === "";
}

/** Huella corta de un valor (32 hex). No guarda el dato: sólo sirve para comparar. */
export function huellaCampo(v: Valor | undefined): string {
  return huella(vacio(v) ? null : v).slice(0, 32);
}

export function huellasDe(nuevos: Campos): Record<string, string> {
  return Object.fromEntries(Object.entries(nuevos).map(([k, v]) => [k, huellaCampo(v)]));
}

export type ResultadoCampos = { cambios: Campos; conservados: string[]; huellas: Record<string, string> };

export function decidirCampos(nuevos: Campos, actual: Campos, previas: Record<string, string> | null): ResultadoCampos {
  const cambios: Campos = {};
  const conservados: string[] = [];
  for (const [campo, valor] of Object.entries(nuevos)) {
    if (vacio(valor)) continue;
    const hoy = actual[campo];
    if (huellaCampo(hoy) === huellaCampo(valor)) continue;
    const previa = previas?.[campo];
    if (previa !== undefined) {
      if (previa === huellaCampo(valor)) continue; // Alboom no lo cambió desde la última carga.
      if (vacio(hoy) || huellaCampo(hoy) === previa) cambios[campo] = valor;
      else conservados.push(campo);
    } else if (vacio(hoy)) {
      cambios[campo] = valor;
    } else {
      conservados.push(campo);
    }
  }
  return { cambios, conservados, huellas: huellasDe(nuevos) };
}

/**
 * Lo que vale para todo traductor cuando el registro ya está en el mapa: misma huella del crudo → IGUAL sin
 * escribir nada; el registro de FOTOFFICE ya no existe (lo borraron después de cargarlo) → OMITIR, no se vuelve a
 * crear. `null` = seguir traduciendo.
 */
export function porMapa(c: Crudo, mapa: EntradaMapa | undefined, existe: (id: string) => boolean): Decision | null {
  if (!mapa) return null;
  if (!existe(mapa.targetId)) return { accion: "OMITIR", motivo: MOTIVOS.borradoEnFotoffice };
  if (mapa.payloadHash === c.hash) return { accion: "IGUAL", targetId: mapa.targetId, escribirMapa: false };
  return null;
}

/** Arma ACTUALIZAR o IGUAL a partir de los campos (para un registro ya cargado o recién vinculado). */
export function actualizarOIgual(
  targetId: string,
  nuevos: Campos,
  actual: Campos,
  mapa: EntradaMapa | undefined,
  extra: Partial<Decision> = {},
): Decision {
  const r = decidirCampos(nuevos, actual, mapa ? mapa.fieldHashes : null);
  const base: Decision = {
    accion: Object.keys(r.cambios).length > 0 ? "ACTUALIZAR" : "IGUAL",
    targetId,
    huellas: r.huellas,
    vincula: !mapa,
    ...extra,
  };
  if (base.accion === "ACTUALIZAR") base.datos = r.cambios;
  if (r.conservados.length > 0) base.conservados = r.conservados;
  return base;
}

/** Motivos fijos (los mismos textos en el informe y en las pruebas). Nunca llevan datos del registro. */
export const MOTIVOS = {
  borradoEnFotoffice: "Se borró en FOTOFFICE después de cargarlo: no se vuelve a crear",
  sinNombre: "Sin nombre",
  sinCorreo: "Sin correo",
  sinMiembro: "Ningún miembro del equipo de FOTOFFICE tiene ese correo",
  esContacto: "Es un contacto, no un usuario del equipo",
  datoDePrueba: "Dato de prueba",
  duplicadoAlboom: "Duplicado en Alboom (mismo correo): se fusionó con el primero",
  sinCircuito: "Sin circuito equivalente en FOTOFFICE (en esta etapa no se crean)",
  sinEtapa: "Sin etapa equivalente en FOTOFFICE (en esta etapa no se crean)",
  circuitoSinCargar: "Su embudo o flujo no se emparejó",
  etiquetaDeOportunidad: "Etiqueta de oportunidades: se carga con las oportunidades (8B-2)",
  etiquetaLarga: "Etiqueta de más de 40 caracteres",
  noEsCategoriaDeConsulta: "No es una categoría de consulta",
  productoSinCargar: "El producto no se cargó",
  componenteSinCargar: "Un producto del combo no se cargó",
  componenteEsCombo: "El componente es otro combo",
  formaDesconocida: "Forma desconocida",
} as const;

export const DUDAS = {
  correoInvalido: "Correo con formato inválido (no se guardó)",
  telefonoRaro: "Teléfono que no parece argentino (se guardó tal cual)",
  categoriaContacto: "Categoría de contacto desconocida (quedó como Cliente)",
  etiquetaNueva: "Etiqueta usada en un contacto que no estaba en el catálogo (se creó)",
  grupoDesconocido: "Grupo de categoría desconocido (quedó como Trabajo sin fecha)",
  nombreLargo: "Nombre recortado",
  precioFaltante: "Producto sin precio (quedó en 0)",
  codigoRepetido: "Código usado por otro producto (se cargó sin código)",
  categoriaProductoNueva: "Categoría de producto nueva (se creó)",
  descuentoEnCombo: "El ítem del combo tenía precio o descuento propio (FOTOFFICE usa el del producto)",
  proveedorSinCargar: "El proveedor del costo no se cargó (quedó sin proveedor)",
  costoSinImporte: "Costo sin importe (quedó en 0)",
  documentoRaro: "Documento con formato raro (no se guardó)",
} as const;
