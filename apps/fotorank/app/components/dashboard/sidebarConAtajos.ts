import type { SidebarSectionConfig } from "@repo/design-system";

import {
  PANEL_DE_JURADO_ETIQUETA,
  PANEL_DE_JURADO_HREF,
} from "../../lib/fotorank/access/judge-panel-entry";

/** La sección donde vive lo que la persona hace por sí misma, no por su institución. */
const SECCION_PROPIA = "Mi actividad";

export const COLA_DE_REVISION_HREF = "/super-admin/jurados";
const COLA_DE_REVISION_ETIQUETA = "Jurados por revisar";

export type Atajos = {
  /** La persona además tiene cuenta de jurado. */
  esJurado: boolean;
  /**
   * Fichas esperando revisión. `0` esconde la entrada a propósito: un atajo a
   * una cola vacía es una promesa de trabajo que no existe.
   *
   * Sólo llega con número quien puede revisar: la guardia está en
   * `contarJuradosPendientes`, que devuelve 0 a cualquier otro.
   */
  juradosPorRevisar: number;
};

/**
 * Agrega al menú lateral los atajos que dependen de quién es la persona.
 *
 * Existe porque el menú es una constante compartida por todas las pantallas
 * del panel: estas entradas no se pueden escribir ahí adentro, porque no las
 * ve todo el mundo.
 *
 * "Panel de jurado" va en "Mi actividad" y no en "Gestión" porque son dos
 * cosas distintas que se dicen casi igual: en "Gestión" está *Jurados*, donde
 * el organizador administra a los jurados de sus concursos; este atajo lleva
 * al panel donde la persona califica como jurado.
 *
 * Devuelve secciones nuevas: no modifica las que recibe.
 */
export function sidebarConAtajos(
  secciones: SidebarSectionConfig[],
  atajos: Atajos,
): SidebarSectionConfig[] {
  const nuevas: Array<{ label: string; href: string; icon: "user" | "search" }> = [];

  if (atajos.esJurado) {
    nuevas.push({
      label: PANEL_DE_JURADO_ETIQUETA,
      href: PANEL_DE_JURADO_HREF,
      icon: "user",
    });
  }

  if (atajos.juradosPorRevisar > 0) {
    nuevas.push({
      // El número va en el rótulo porque es la razón para entrar: sin él, la
      // entrada no se distingue de una sección más del menú.
      label: `${COLA_DE_REVISION_ETIQUETA} (${atajos.juradosPorRevisar})`,
      href: COLA_DE_REVISION_HREF,
      icon: "search",
    });
  }

  if (nuevas.length === 0) return secciones;

  const yaPresentes = new Set(
    secciones.flatMap((s) => s.items.map((i) => i.href)),
  );
  const faltantes = nuevas.filter((e) => !yaPresentes.has(e.href));
  if (faltantes.length === 0) return secciones;

  const destino = secciones.findIndex((s) => s.title === SECCION_PROPIA);
  if (destino === -1) {
    // Sin esa sección, los atajos abren el menú: es preferible a perderlos.
    return [{ title: SECCION_PROPIA, items: faltantes }, ...secciones];
  }

  return secciones.map((s, i) =>
    i === destino ? { ...s, items: [...s.items, ...faltantes] } : s,
  );
}
