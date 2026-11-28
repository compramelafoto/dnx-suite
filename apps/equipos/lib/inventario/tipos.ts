import type { prisma } from "@repo/db";

/**
 * `@repo/db` todavía no reexporta los tipos de equipos; se derivan del cliente para no
 * tocar el paquete compartido.
 */
export type GearItem = NonNullable<Awaited<ReturnType<typeof prisma.gearItem.findFirst>>>;
export type GearItemEvent = NonNullable<
  Awaited<ReturnType<typeof prisma.gearItemEvent.findFirst>>
>;
export type GearItemKind = GearItem["kind"];
export type GearItemStatus = GearItem["status"];
