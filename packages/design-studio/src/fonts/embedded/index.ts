// Generado por scripts/generar-fuentes-incrustadas.mts. No editar a mano.
/** Una familia por módulo: solo se carga la que la pieza usa. */
export const FUENTES_INCRUSTADAS: Record<string, () => Promise<Record<string, string>>> = {
  dmSans: () => import("./dmSans").then((m) => m.FUENTE),
  inter: () => import("./inter").then((m) => m.FUENTE),
  playfairDisplay: () => import("./playfairDisplay").then((m) => m.FUENTE),
  merriweather: () => import("./merriweather").then((m) => m.FUENTE),
  cinzel: () => import("./cinzel").then((m) => m.FUENTE),
  greatVibes: () => import("./greatVibes").then((m) => m.FUENTE),
};
