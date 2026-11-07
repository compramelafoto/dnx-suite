/**
 * Resumen público de un álbum: lo que FOTOFFICE necesita para vincular un pedido con su álbum de CLF
 * (etapa 1 de la conexión FOTOFFICE ↔ CLF). Módulo puro.
 *
 * La lista de campos es cerrada a propósito: nunca datos de compradores ni de alumnos. La prueba
 * `resumen.test.ts` falla si alguien agrega un campo.
 */

export type ResumenAlbumPublico = {
  id: number;
  titulo: string;
  slug: string;
  /** Si el álbum tiene o tuvo packs de preventa (activos o no). */
  tienePreventa: boolean;
  /** ISO del vencimiento del pack que cierra último; null si ninguno tiene vencimiento. */
  preventaCierraEl: string | null;
};

export type AlbumParaResumen = {
  id: number;
  title: string;
  publicSlug: string;
  isTest: boolean;
  deletedAt: Date | null;
};

/** Álbumes de prueba y borrados no tienen resumen público (la ruta responde 404). */
export function armarResumen(album: AlbumParaResumen, packs: ReadonlyArray<{ validUntil: Date | null }>): ResumenAlbumPublico | null {
  if (album.isTest || album.deletedAt) return null;
  const vencimientos = packs.flatMap((p) => (p.validUntil ? [p.validUntil.getTime()] : []));
  return {
    id: album.id,
    titulo: album.title,
    slug: album.publicSlug,
    tienePreventa: packs.length > 0,
    preventaCierraEl: vencimientos.length ? new Date(Math.max(...vencimientos)).toISOString() : null,
  };
}

/** `/a/<id>`: un segmento sólo de dígitos (entero positivo de Postgres) se busca por id. */
export function esIdDeAlbum(segmento: string): number | null {
  if (!/^\d{1,10}$/.test(segmento)) return null;
  const n = Number(segmento);
  return n > 0 && n <= 2_147_483_647 ? n : null;
}
