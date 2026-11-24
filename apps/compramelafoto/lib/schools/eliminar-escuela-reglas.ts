/**
 * Reglas para eliminar una escuela completa.
 *
 * Borrar una escuela arrastra en la base (en cascada) cursos, alumnos,
 * inscripciones, ciclos lectivos, organizadores, invitaciones, listas de
 * alumnos de los álbumes, importaciones y comisiones de organizadores.
 * Los álbumes y los pedidos de preventa NO se borran: quedan sueltos, sin
 * escuela, sin curso y sin alumno. Por eso sólo se permite eliminar una
 * escuela que no tenga nada de eso todavía.
 */

export type BloqueosParaEliminarEscuela = {
  /** Álbumes vinculados a la escuela. */
  albumes: number;
  /** Pedidos de preventa que apuntan a un alumno o curso de la escuela. */
  pedidos: number;
  /** Comisiones de organizadores registradas en la escuela. */
  comisiones: number;
};

function plural(n: number, singular: string, varios: string) {
  return `${n} ${n === 1 ? singular : varios}`;
}

/** Devuelve por qué no se puede eliminar, o null si se puede. */
export function motivoParaNoEliminarEscuela(b: BloqueosParaEliminarEscuela): string | null {
  const partes: string[] = [];
  if (b.albumes > 0) partes.push(plural(b.albumes, "álbum vinculado", "álbumes vinculados"));
  if (b.pedidos > 0) partes.push(plural(b.pedidos, "pedido de preventa", "pedidos de preventa"));
  if (b.comisiones > 0) partes.push(plural(b.comisiones, "comisión de organizador", "comisiones de organizadores"));
  if (partes.length === 0) return null;

  const lista =
    partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
  const consejo =
    b.albumes > 0 && b.pedidos === 0 && b.comisiones === 0
      ? " Desvinculá los álbumes desde la pestaña de álbumes y volvé a intentar."
      : " Para no perder el historial de ventas, la escuela no se puede eliminar.";
  return `No se puede eliminar la escuela porque tiene ${lista}.${consejo}`;
}
