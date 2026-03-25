/**
 * Barrel export del módulo antifraude.
 * Funciones clave del diseño:
 * - getOrderVisibilityContext(user, order)
 * - sanitizeOrderForRole(order, user)
 * - canViewCustomerData(user, order)
 * - canViewOrderItems(user, order)
 * - shouldReleaseToLab(order)
 * - registerAuditEvent(...)
 * - evaluateFraudRisk(...)
 */

export {
  getOrderVisibilityContext,
  canViewCustomerData,
  canViewOrderItems,
  shouldReleaseToLab,
  sanitizeOrderForRole,
  type VisibilityContext,
  type VisibilityUser,
  type OrderType,
} from "./visibility";

export {
  registerAuditEvent,
  getRequestMetadata,
  type OrderAuditEventType,
  type RegisterAuditEventParams,
} from "./audit";

export {
  evaluateFraudRisk,
  getActiveRestriction,
  type FraudRiskResult,
  type RiskLevel,
} from "./risk";
