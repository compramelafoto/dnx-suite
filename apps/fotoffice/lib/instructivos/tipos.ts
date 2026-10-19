/**
 * Instructivos: guías paso a paso para quien opera el panel: el mostrador de un estudio y la
 * comisión directiva o la administración de una institución.
 *
 * Son contenido, no configuración: viven en el código para que cada guía cambie junto con la
 * pantalla que explica, en el mismo PR. Las capturas van en `public/instructivos/<slug>/`.
 */

export type PasoInstructivo = {
  titulo: string;
  /** Uno o más párrafos. Lenguaje llano, sin términos técnicos. */
  texto: string[];
  /** Ruta pública de la captura (`/instructivos/<slug>/<archivo>.png`). Opcional. */
  imagen?: string;
  /** Qué muestra la captura, para quien no la ve. Obligatorio si hay imagen. */
  imagenAlt?: string;
  /**
   * Qué hace FOTOFFICE solo después de este paso (correos, Caja, stock, etapas). Se muestra en un
   * recuadro aparte para que quien atiende sepa qué no tiene que hacer a mano.
   */
  sistema?: string[];
  /** Un aviso o consejo destacado debajo del paso. */
  nota?: string;
};

export type Instructivo = {
  slug: string;
  titulo: string;
  /** Qué se logra con la guía, en una oración. */
  resumen: string;
  /** Agrupa las guías en el índice. */
  seccion:
    | "Primeros pasos"
    | "Caja"
    | "Mostrador"
    | "Trabajos y entregas"
    | "Clientes y pedidos"
    | "Galerías"
    | "Socios"
    | "Comunicación"
    | "Comisión"
    | "Cuotas"
    | "Actividades";
  /**
   * Módulo que hace falta poder ver para que la guía aparezca en el índice. Sin módulo, la ve
   * todo el equipo. Con la URL directa se puede leer igual: no es información reservada.
   */
  moduleKey?: string;
  /** Sólo para dueño y administradores: la pantalla que explica no la abre nadie más. */
  soloAdministracion?: boolean;
  /** Minutos aproximados de lectura y práctica. */
  minutos: number;
  pasos: PasoInstructivo[];
};
