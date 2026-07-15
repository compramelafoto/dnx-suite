/**
 * Canal público que Clickatón consume de FotoRank Public API V1.
 * No es white-label: identidad fija de la app.
 */
export const CLICKATON_PUBLIC_CHANNEL = "clickaton" as const;

export type ClickatonPublicChannel = typeof CLICKATON_PUBLIC_CHANNEL;
