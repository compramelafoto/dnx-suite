/**
 * Los renglones de obra de un pedido de la tienda (spec O9, §5.6; plan Task 9).
 *
 * Las obras no tienen stock (se imprimen a pedido): no se reservan. Lo que sí hay que evitar es
 * cobrar una obra cuyo autor acaba de retirar el permiso. Por eso, dentro de la transacción del
 * pedido, se bloquean (`FOR UPDATE`) primero los permisos (`ArtworkConsent`) y después las fichas
 * (`ArtworkListing`), cada grupo en orden de id: el MISMO orden que usan publicar
 * (`publishArtwork`) y la respuesta del autor (`respondConsent`), así nunca se esperan en cruz.
 * Con los permisos bloqueados, el que retira espera a que el pedido termine (y entonces
 * despublica), o el pedido espera al retiro y, al volver a leer, ya no la vende.
 *
 * Todo con `workspaceId`. Los ids van como `text[]` (son cuid), igual que `lockStockRows`.
 */
import "server-only";

import { Prisma } from "@repo/db";

import { minorToDecimalString } from "@/lib/membership/money";

import type { ValidatedArtworkLine } from "../storefront";
import { DEFAULT_ROYALTY_BPS } from "./royalty";

type LockTx = Pick<Prisma.TransactionClient, "$queryRaw" | "artworkListing" | "contestStoreSettings">;

/** Lo que el renglón congela de la obra y que el navegador nunca ve: regalía y autor. */
export type ArtworkOrderMeta = {
  contestId: string;
  entryId: string;
  /** Regalía del concurso al momento de la compra (bps). */
  royaltyBps: number;
  /** Autor de la obra en FotoRank; `null` sólo si no hay forma de saberlo (obra sin autor ni permiso). */
  authorUserId: number | null;
};

/**
 * Bloquea permisos y fichas de las obras del pedido y devuelve, por ficha, el concurso, la
 * regalía vigente y el autor. Va dentro de la transacción y ANTES de volver a decidir si la obra
 * se puede vender (`loadArtworkCartCatalog` con el mismo `tx`).
 */
export async function lockArtworkOrderRows(
  tx: LockTx,
  input: { workspaceId: string; listingIds: readonly string[] },
): Promise<Map<string, ArtworkOrderMeta>> {
  const { workspaceId } = input;
  const listingIds = [...new Set(input.listingIds)].sort();
  if (listingIds.length === 0) return new Map();

  // La obra y el concurso de una ficha no cambian: se leen sin bloqueo para saber qué permisos bloquear.
  const fichas = await tx.artworkListing.findMany({
    where: { workspaceId, id: { in: listingIds } },
    select: { id: true, contestId: true, entryId: true, entry: { select: { authorUserId: true } } },
  });
  const entryIds = [...new Set(fichas.map((f) => f.entryId))].sort();

  const permisos =
    entryIds.length > 0
      ? await tx.$queryRaw<{ entryId: string; authorUserId: number }[]>(
          Prisma.sql`SELECT "entryId", "authorUserId" FROM "ArtworkConsent" WHERE "workspaceId" = ${workspaceId} AND "entryId" = ANY(${entryIds}::text[]) ORDER BY "id" FOR UPDATE`,
        )
      : [];
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "ArtworkListing" WHERE "workspaceId" = ${workspaceId} AND "id" = ANY(${listingIds}::text[]) ORDER BY "id" FOR UPDATE`,
  );

  const contestIds = [...new Set(fichas.map((f) => f.contestId))];
  const ajustes =
    contestIds.length > 0
      ? await tx.contestStoreSettings.findMany({
          where: { workspaceId, contestId: { in: contestIds } },
          select: { contestId: true, royaltyBps: true },
        })
      : [];
  const regaliaPorConcurso = new Map(ajustes.map((a) => [a.contestId, a.royaltyBps]));
  const autorPorObra = new Map(permisos.map((p) => [p.entryId, p.authorUserId]));

  return new Map(
    fichas.map((f) => [
      f.id,
      {
        contestId: f.contestId,
        entryId: f.entryId,
        royaltyBps: regaliaPorConcurso.get(f.contestId) ?? DEFAULT_ROYALTY_BPS,
        authorUserId: f.entry.authorUserId ?? autorPorObra.get(f.entryId) ?? null,
      },
    ]),
  );
}

/**
 * El renglón del pedido para una obra: sin producto ni talle, con el título de la obra como
 * nombre y el formato como detalle (así lo leen la página del pedido, el panel y los correos:
 * "<título> — <formato>"), el precio del formato del servidor, la regalía y el autor.
 */
export function artworkOrderItemData(orderId: string, line: ValidatedArtworkLine, meta: ArtworkOrderMeta) {
  return {
    orderId,
    productId: null,
    variantId: null,
    productName: line.title,
    variantName: line.formatName,
    productSlug: line.slug,
    imageUrl: line.imageUrl,
    qty: line.qty,
    unitPriceArs: minorToDecimalString(line.unitPriceMinor),
    lineTotalArs: minorToDecimalString(line.unitPriceMinor * line.qty),
    artworkListingId: line.artworkListingId,
    printFormatId: line.printFormatId,
    printFormatName: line.formatName,
    royaltyBps: meta.royaltyBps,
    artworkAuthorUserId: meta.authorUserId,
  };
}
