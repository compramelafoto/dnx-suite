/**
 * FotOffice — Split de Pagos (1 a N) de DNX Payments: DESACTIVADO.
 *
 * Decisión (2026-08-26): FotOffice todavía no tiene un caso productivo que
 * requiera repartir un cobro entre varios destinatarios. Mientras el flujo
 * Orders API + Split (1 a N) sigue en homologación con Mercado Pago, FotOffice
 * no lo consume: no pide habilitación independiente de su MP App, no duplica
 * homologaciones ni consentimientos, y no condiciona sus otros cobros a una
 * funcionalidad todavía no aprobada.
 *
 * ALCANCE DE ESTE GUARD — sólo Split (1 a N).
 * NO afecta ningún otro cobro de FotOffice: cuotas de socios, cursos, reservas,
 * alquileres, tienda ni el Checkout Pro actual de inscripciones a cursos
 * (`app/api/payments/mercadopago/course-enrollment/create-preference`).
 * Split (1 a N) es una CAPACIDAD de DNX Payments, no un requisito para usarlo.
 *
 * POR QUÉ ES UNA CONSTANTE Y NO UNA VARIABLE DE ENTORNO:
 * el objetivo es que una configuración accidental (un env mal seteado en
 * staging o en Vercel) no pueda hacer que FotOffice empiece a generar Orders
 * con split. Reactivarlo exige un cambio de código revisado, no una variable.
 *
 * Para reactivar: poner `FOTOFFICE_SPLIT_1N_ENABLED = true`, agregar
 * `@repo/payments` a las dependencias de la app y actualizar
 * `lib/payments/split-1n.test.ts`.
 */

export const FOTOFFICE_SPLIT_1N_STATUS = "DISABLED_NOT_CURRENTLY_REQUIRED" as const;

/** Interruptor único. Debe permanecer en false hasta decisión expresa. */
export const FOTOFFICE_SPLIT_1N_ENABLED = false as const;

export type FotofficeSplit1nGuard =
  | { ok: true }
  | { ok: false; reason: "SPLIT_1N_DISABLED_FOR_FOTOFFICE"; status: typeof FOTOFFICE_SPLIT_1N_STATUS };

export function isFotofficeSplit1nEnabled(): boolean {
  return FOTOFFICE_SPLIT_1N_ENABLED;
}

/**
 * Llamar antes de cualquier intento de crear una Order con split desde FotOffice.
 * Falla cerrado: hoy siempre deniega.
 */
export function assertFotofficeSplit1nAllowed(): FotofficeSplit1nGuard {
  if (!FOTOFFICE_SPLIT_1N_ENABLED) {
    return {
      ok: false,
      reason: "SPLIT_1N_DISABLED_FOR_FOTOFFICE",
      status: FOTOFFICE_SPLIT_1N_STATUS,
    };
  }
  return { ok: true };
}
