/**
 * Cliente CLF read-only — reexporta @repo/db.
 * La app Info Spot no debe construir otro PrismaClient contra CLF.
 */

export {
  getClfReadonlyClient,
  getClfReadonlyConnectionInfo,
  probeClfReadonlyConnection,
  disconnectClfReadonlyClient,
  type ClfReadonlyConnectionInfo,
} from "@repo/db";
