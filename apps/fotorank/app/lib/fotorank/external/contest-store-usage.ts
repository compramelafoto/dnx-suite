/**
 * ¿El concurso tiene obras en la tienda de alguna institución de FOTOFFICE? Si las tiene, la
 * base no deja borrarlo (claves foráneas `Restrict` desde la tienda): mejor avisar en castellano
 * antes de que Prisma tire P2003.
 */

type Contador = { count: (args: { where: { contestId: string } }) => Promise<number> };

export type ContestStoreUsageDb = {
  artworkListing: Contador;
  artworkConsent: Contador;
  contestStoreSettings: Contador;
  artworkRoyalty: Contador;
};

export const CONTEST_IN_STORE_ERROR = "Este concurso tiene obras en la tienda de una institución; no se puede borrar.";

export async function contestHasStoreArtworks(contestId: string, db: ContestStoreUsageDb): Promise<boolean> {
  const where = { contestId };
  const cuentas = await Promise.all([
    db.artworkListing.count({ where }),
    db.artworkConsent.count({ where }),
    db.contestStoreSettings.count({ where }),
    db.artworkRoyalty.count({ where }),
  ]);
  return cuentas.some((n) => n > 0);
}
