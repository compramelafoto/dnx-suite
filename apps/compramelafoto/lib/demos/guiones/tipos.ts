import type { VistaDemo } from "@/lib/demos/vistas";

/** Ids de lo sembrado, para armar las rutas de cada paso. */
export type CtxGuion = {
  albumId: number;
  albumSlug: string;
  schoolId: number;
  handler: string;
  /** Último pedido de la demo (para ir directo a su canje), si ya hubo una compra. */
  ultimoPedidoId: number | null;
  /** Plantilla del librito del fotógrafo demo (copia de la de sistema). */
  plantillaId: string | null;
};

export type PasoGuion = {
  id: string;
  /** Con qué sesión se muestra el paso; el cuadro guía ofrece cambiar si no coincide. */
  vista: VistaDemo;
  /** Pantalla del paso. `null` en las tarjetas que no llevan a ninguna pantalla. */
  ruta: ((ctx: CtxGuion) => string) | null;
  titulo: string;
  /** Etapa del recorrido a la que pertenece («2 · Acordar con el colegio»); agrupa la lista de pasos. */
  etapa: string;
  /** Lo que se ve en pantalla en este paso, en una o dos oraciones. */
  texto: string;
  /**
   * Hilo de la charla para el presentador, en el orden en que aparece en pantalla. Solo se ve en
   * la guía abierta en otra ventana (la del público no lo muestra).
   */
  puntos?: string[];
  /** Cómo enlazar con el paso siguiente, para que la charla no salte de tema. */
  puente?: string;
  /** Tarjeta grande para el público, antes de mostrar el paso. */
  aclaracion?: { titulo: string; texto: string };
  /** Qué se le puede pedir al bot en este paso. */
  bot?: string;
  /** Botón propio de la demo en el cuadro guía (por ejemplo, publicar las fotos de la toma). */
  accion?: { etiqueta: string; endpoint: string; hecho: string };
};

export type Guion = {
  id: string;
  titulo: string;
  pasos: PasoGuion[];
};
