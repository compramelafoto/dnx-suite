/** Copy for partner / finance panels (10D3I-I0). No secrets. */

export const PARTNER_ACCOUNT_UI_MESSAGES = {
  connected: "Tu cuenta está conectada",
  consentMissing: "Falta otorgar consentimiento",
  expired: "La conexión venció",
  reconnectRequired: "Debés volver a conectar",
  notEligibleReceiver:
    "Tu cuenta no está habilitada para recibir esta distribución",
  agreementBlocked:
    "El acuerdo no puede activarse hasta que todos los socios completen su conexión",
  percentagesLocked:
    "Los porcentajes son administrados por Clickatón y no se modifican desde esta pantalla",
  tokensNeverShown: "Los tokens de Mercado Pago nunca se muestran en esta pantalla",
  receiverIdHidden: "El identificador de cobro se gestiona de forma segura en el servidor",
} as const;

export const FINANCE_PANEL_UI_MESSAGES = {
  ownerPendingDecision:
    "Falta definir cuál será la cuenta Mercado Pago owner/collector de Clickatón",
  readinessIncomplete: "El acuerdo productivo no está listo: revisá los bloqueos",
  productionFlagsMustStayOff:
    "Los flags de producción deben permanecer OFF hasta cutover autorizado",
  noSecrets: "Esta vista no muestra tokens, secrets ni receiver IDs completos",
} as const;
