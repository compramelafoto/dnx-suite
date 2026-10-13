import { tipoPorId } from "./tipos";

/**
 * La portada con la respuesta ya dada, en un enlace.
 *
 * Quien vende manda la portada por correo a alguien que ya conoce su caso: que tenga que volver
 * a contestar «¿qué sos?» y buscar los módulos de los que se le habló es trabajo tirado. El
 * enlace lleva las dos cosas en la URL y la página las lee en el servidor, así abre con la
 * selección hecha y la conserva al recargar:
 *
 *   /?tipo=sociedad&modulos=members,membership-dues,carnets
 *
 * `tipo` es un id de `tipos.ts`; `modulos`, claves del catálogo (`catalogo.ts`). Lo que no se
 * reconoce se descarta en silencio: un enlace viejo o mal copiado abre la portada igual, con lo
 * que sí entiende.
 */

export const PARAM_TIPO = "tipo";
export const PARAM_MODULOS = "modulos";

export type SeleccionInicial = {
  tipoId: string | null;
  /** `null` cuando el enlace no trae módulos: valen los del tipo. */
  modulos: string[] | null;
};

type Params = Record<string, string | string[] | undefined>;

function primero(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export function leerSeleccion(params: Params, clavesValidas: ReadonlySet<string>): SeleccionInicial {
  const tipo = tipoPorId(primero(params[PARAM_TIPO])?.trim() ?? null);
  const crudo = primero(params[PARAM_MODULOS]);
  if (crudo === undefined) return { tipoId: tipo?.id ?? null, modulos: null };

  const vistas = new Set<string>();
  for (const k of crudo.split(",")) {
    const clave = k.trim();
    if (clavesValidas.has(clave)) vistas.add(clave);
  }
  return { tipoId: tipo?.id ?? null, modulos: vistas.size > 0 ? [...vistas] : null };
}

/** La parte `?…` del enlace. Las comas quedan legibles: nadie tiene que leer `%2C` en un mail. */
export function armarConsulta(seleccion: SeleccionInicial): string {
  const partes: string[] = [];
  if (seleccion.tipoId) partes.push(`${PARAM_TIPO}=${encodeURIComponent(seleccion.tipoId)}`);
  if (seleccion.modulos && seleccion.modulos.length > 0) {
    partes.push(`${PARAM_MODULOS}=${seleccion.modulos.map(encodeURIComponent).join(",")}`);
  }
  return partes.length > 0 ? `?${partes.join("&")}` : "";
}
