import { Prisma } from "@prisma/client";

/** CTE `orders_base` — réplica de auditoría abandono / order-superseded. */
export function buildOrdersBaseCte(albumIds?: number[]): Prisma.Sql {
  const albumFilter =
    albumIds && albumIds.length > 0
      ? Prisma.sql`AND o."albumId" IN (${Prisma.join(albumIds)})`
      : Prisma.empty;

  return Prisma.sql`
    orders_base AS (
      SELECT
        o.id,
        o."albumId",
        o."buyerEmail",
        o."buyerPhone",
        o."buyerUserId",
        o.status,
        o."totalCents",
        o."createdAt",
        CASE
          WHEN o."buyerUserId" IS NOT NULL THEN 'u:' || o."buyerUserId"::text || '@' || o."albumId"::text
          WHEN length(trim(coalesce(o."buyerEmail", ''))) > 0
            THEN 'e:' || lower(trim(o."buyerEmail")) || '@' || o."albumId"::text
          WHEN length(regexp_replace(coalesce(o."buyerPhone", ''), '\\D', '', 'g')) >= 8
            THEN 'p:' || regexp_replace(o."buyerPhone", '\\D', '', 'g') || '@' || o."albumId"::text
          ELSE NULL
        END AS buyer_key_album
      FROM "Order" o
      WHERE o."isTest" = false
        AND o.origin IN ('STANDARD_CHECKOUT', 'PREVENTA_PACK')
        AND o."checkoutPaymentSource" = 'MERCADO_PAGO'
        ${albumFilter}
    )
  `;
}

export function periodCutoffSql(days: number): Prisma.Sql {
  return Prisma.sql`NOW() - (${days}::int * INTERVAL '1 day')`;
}
