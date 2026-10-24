import type { VistaDemo } from "@/lib/demos/vistas";

/** Ids de lo sembrado, para armar las rutas de cada paso. */
export type CtxGuion = {
  albumId: number;
  albumSlug: string;
  schoolId: number;
  handler: string;
};

export type PasoGuion = {
  id: string;
  /** Con qué sesión se muestra el paso; el cuadro guía ofrece cambiar si no coincide. */
  vista: VistaDemo;
  /** Pantalla del paso. `null` en las tarjetas que no llevan a ninguna pantalla. */
  ruta: ((ctx: CtxGuion) => string) | null;
  titulo: string;
  /** Lo que el presentador muestra y cuenta en este paso. */
  texto: string;
  /** Tarjeta grande para el público, antes de mostrar el paso. */
  aclaracion?: { titulo: string; texto: string };
  /** Qué se le puede pedir al bot en este paso. */
  bot?: string;
};

export type Guion = {
  id: string;
  titulo: string;
  pasos: PasoGuion[];
};
