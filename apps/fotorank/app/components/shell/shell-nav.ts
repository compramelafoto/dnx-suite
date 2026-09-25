/**
 * La única fuente del menú del panel.
 *
 * El panel dibuja su navegación dos veces: en la barra lateral y en el menú a pantalla
 * completa del encabezado. Hasta el 2026-09-21 eran dos listas escritas a mano en archivos
 * distintos, y habían divergido — la barra tenía 14 entradas agrupadas y el encabezado 7
 * sueltas. Quien miraba una y otra veía dos productos distintos.
 *
 * Ahora el encabezado se deriva de las secciones de la barra. No pueden volver a separarse
 * sin que falle el test.
 */

/** Una entrada del menú. `roles` vacío o ausente significa "la ve cualquiera". */
export type ShellNavItem = {
  label: string;
  href: string;
  /** Nombre del ícono en el design system compartido. */
  icon: string;
  roles?: string[];
  /** Un número al costado: cuánto trabajo espera ahí adentro. */
  badge?: number;
};

export type ShellSection = {
  title: string;
  items: ShellNavItem[];
};

export type ShellMenuLink = {
  href: string;
  label: string;
  primary?: boolean;
};

/** La salida al sitio público. Va siempre última y destacada: es la única que sale del panel. */
const SALIDA_AL_SITIO: ShellMenuLink = {
  href: "/",
  label: "Ir al inicio",
  primary: true,
};

/**
 * Aplana las secciones en la lista del menú a pantalla completa.
 *
 * Conserva el orden y el nombre exacto de cada entrada: si un nombre no entra en la barra
 * lateral, el arreglo es acortar el nombre en la sección —una sola vez, para los dos menús—
 * y no abreviarlo acá.
 */
export function menuLinksFromSections(
  sections: ShellSection[],
): ShellMenuLink[] {
  const links = sections.flatMap((section) =>
    section.items.map((item) => ({ href: item.href, label: item.label })),
  );
  return [...links, SALIDA_AL_SITIO];
}

/** Cuántas entradas tiene un menú. Sirve para vigilar que no se desborde. */
export function contarItems(sections: ShellSection[]): number {
  return sections.reduce((total, section) => total + section.items.length, 0);
}
