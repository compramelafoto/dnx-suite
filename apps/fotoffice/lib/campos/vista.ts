/**
 * Cómo se muestra y se edita un campo personalizado en "Más datos". Módulo PURO: sin base ni
 * `server-only`, así lo usan la tarjeta de servidor, el formulario de cliente y las pruebas.
 * Lo que viaja al navegador son sólo estos objetos planos (nada de Prisma ni de Decimal).
 */
import type { TipoCampo } from "./constantes";
import { textoLegible, type ValorCampo } from "./validacion";

export type OpcionEditable = { id: string; label: string };

export type CampoVista = {
  id: string;
  nombre: string;
  tipo: TipoCampo;
  obligatorio: boolean;
  /** Opciones elegibles (Lista): las activas y, si el valor actual es una archivada, también esa. */
  opciones: OpcionEditable[];
  /** Lo que va en el control del formulario ("" si está vacío; "si"/"no" en Sí/No; AAAA-MM-DD en Fecha). */
  crudo: string;
  /** Lo que se lee en la tarjeta ("" si está vacío). */
  legible: string;
  /** Sólo Enlace: la dirección, si es http(s). Cualquier otra cosa no se vuelve enlace. */
  href: string | null;
};

/** Un enlace sólo se vuelve clicable si es http o https. */
export function hrefSeguro(texto: string | undefined | null): string | null {
  if (typeof texto !== "string" || !texto) return null;
  try {
    const u = new URL(texto);
    return (u.protocol === "http:" || u.protocol === "https:") && /^https?:\/\//i.test(texto.trim()) ? texto.trim() : null;
  } catch {
    return null;
  }
}

function crudoDe(tipo: TipoCampo, v: ValorCampo | null): string {
  if (!v) return "";
  switch (tipo) {
    case "SI_NO":
      return v.booleano === undefined ? "" : v.booleano ? "si" : "no";
    case "FECHA":
      return v.fecha ?? "";
    case "LISTA":
      return v.opcionId ?? "";
    case "NUMERO":
      // En el control se escribe con coma, como se lee.
      return textoLegible("NUMERO", v, {});
    default:
      return v.texto ?? "";
  }
}

/**
 * Arma la vista de un campo activo con su valor guardado. La fecha es una fecha de calendario
 * (sin hora): se muestra dd/mm/aaaa tal cual, sin correrla de zona.
 */
export function vistaDeCampo(
  campo: {
    id: string;
    name: string;
    type: TipoCampo;
    required: boolean;
    opciones: { id: string; label: string }[];
    etiquetas: Record<string, string>;
  },
  valor: ValorCampo | null,
): CampoVista {
  const opciones = campo.opciones.map((o) => ({ id: o.id, label: o.label }));
  if (campo.type === "LISTA" && valor?.opcionId && !opciones.some((o) => o.id === valor.opcionId)) {
    const etiqueta = campo.etiquetas[valor.opcionId];
    if (etiqueta) opciones.push({ id: valor.opcionId, label: `${etiqueta} (archivada)` });
  }
  const legible = textoLegible(campo.type, valor, campo.etiquetas);
  return {
    id: campo.id,
    nombre: campo.name,
    tipo: campo.type,
    obligatorio: campo.required,
    opciones,
    crudo: crudoDe(campo.type, valor),
    legible,
    href: campo.type === "ENLACE" ? hrefSeguro(valor?.texto) : null,
  };
}

/** Un cambio de "Más datos" para un historial, en texto plano. */
export type CambioVista = { id: string; fecha: string; quien: string; campo: string; antes: string; despues: string };

/**
 * Lo que se manda al guardar: sólo los campos cuyo valor (sin espacios en los bordes) cambió
 * respecto de lo guardado; vacío → null. Los que no vienen, `guardarValores` los deja como
 * están (y un obligatorio ausente se exige contra lo ya guardado).
 */
export function valoresCambiados(
  campos: Pick<CampoVista, "id" | "crudo">[],
  valores: Record<string, string | undefined>,
): Record<string, string | null> {
  const salida: Record<string, string | null> = {};
  for (const c of campos) {
    const v = (valores[c.id] ?? "").trim();
    if (v === c.crudo.trim()) continue;
    salida[c.id] = v === "" ? null : v;
  }
  return salida;
}
