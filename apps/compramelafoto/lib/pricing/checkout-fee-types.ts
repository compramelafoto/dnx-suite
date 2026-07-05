/**
 * Tipos compartidos para el resolver unificado de fee % en checkout (Fase 1.5).
 * Convención: montos en ARS enteros (*Cents en el resto del código).
 */

/** Componente de línea o desglose en el pedido. */
export type CheckoutFeeComponent = "DIGITAL" | "PRINT";

/**
 * Flujo de checkout. Alineado con `CheckoutFlow` del pricing-engine donde aplica.
 * Valores adicionales cubren packs y preventa sin acoplar aún el motor.
 */
export type CheckoutFeeFlow =
  | "ALBUM_ORDER"
  | "PREVENTA_PACK"
  | "ALBUM_PACK"
  | "PACK_REDEMPTION"
  | "PRINT_PHOTOGRAPHER"
  | "PRINT_PUBLIC"
  | "PRINT_LAB";

/** Para qué se necesita el % (línea, snapshot, MP, UI). */
export type CheckoutFeePurpose =
  | "CLIENT_LINE_UNIT"
  | "MARKETPLACE_FEE_TOTAL"
  | "ORGANIZER_BASE_EXTRACT"
  | "SNAPSHOT_PERSIST"
  | "DISPLAY";

export type CheckoutOrderOrigin =
  | "STANDARD_CHECKOUT"
  | "PREVENTA_PACK"
  | "PACK_REDEMPTION";

/** Identificador del resolver subyacente (auditoría R1/R2/R3). */
export type LegacyFeeResolverId = "R1" | "R2" | "R3";

/** Ruta canónica hacia la implementación existente que debe delegar el resolver. */
export type CheckoutFeeResolverImplementation =
  | "ALBUM_ORDER_DIGITAL_MARKETPLACE"
  | "PRINT_ALBUM_PLATFORM"
  | "PLATFORM_LEGACY"
  | "PRINT_PUBLIC_BPS"
  | "PRINT_PHOTOGRAPHER_BPS";

export type ResolveCheckoutFeePercentInput = {
  component: CheckoutFeeComponent;
  flow: CheckoutFeeFlow;
  purpose: CheckoutFeePurpose;
  photographerId?: number | null;
  labId?: number | null;
  albumId?: number | null;
  /** Pedido con al menos una línea PRINT (mixto digital + impresión). */
  hasPrintItems?: boolean;
  orderOrigin?: CheckoutOrderOrigin;
  labType?: "TYPE_A" | "TYPE_B" | null;
};

export type CheckoutFeePercentResult = {
  percent: number;
  implementation: CheckoutFeeResolverImplementation;
  /** Resolver legacy equivalente (R1/R2/R3) para trazabilidad. */
  legacyResolver: LegacyFeeResolverId;
  /**
   * Si el código en producción hoy usa otro % para el mismo contexto.
   * Útil en tests de migración sin cablear checkout/MP aún.
   */
  legacyDivergence?: {
    legacyResolver: LegacyFeeResolverId;
    codePath: string;
    note: string;
  };
};

/** BASE estándar de la suite financiera Fase 1.5 (ARS enteros). */
export const CHECKOUT_FEE_FINANCIAL_BASE_ARS = 10_000;
