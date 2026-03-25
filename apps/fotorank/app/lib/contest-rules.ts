/**
 * Re-exporta desde contest-permissions para compatibilidad.
 * @deprecated Usar contest-permissions directamente.
 */

import {
  getDisplayStatus,
  formatDisplayStatus,
  getEditPermission,
  getRestrictionMessage,
  canEdit,
  type ContestStatus,
  type ContestModuleId,
  type EditPermission,
} from "./contest-permissions";

export type ContestDisplayStatus = ContestStatus;
export type { ContestModuleId, EditPermission };
export { getDisplayStatus, formatDisplayStatus, getEditPermission, getRestrictionMessage, canEdit };
