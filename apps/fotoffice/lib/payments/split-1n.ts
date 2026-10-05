/**
 * FotOffice — Split de Pagos (1 a N) de DNX Payments: DESACTIVADO.
 *
 * Decisión (2026-08-26): FotOffice no tenía un caso productivo que requiriera repartir un cobro.
 * Actualización (2026-10-05): el mercado de cursos ES ese caso (cursos con varios beneficiarios o
 * revendidos). La orden se arma en `split-1n-cursos.ts` y queda APAGADA: este interruptor sigue
 * en false hasta que Mercado Pago habilite el split en producción para la aplicación de la suite.
 * Además vale el guard general `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` (`cobroConRepartoHabilitado`).
 *
 * Para encender: poner `FOTOFFICE_SPLIT_1N_ENABLED = true` en un cambio de código revisado,
 * actualizar `split-1n.test.ts` y seguir docs/payments/fotoffice-split-1n-disabled.md §7.
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

/**
 * ¿Se puede vender un curso con reparto (split 1:N)? Dos llaves, las dos tienen que estar:
 * el interruptor de FOTOFFICE (constante, cambio de código revisado) y el guard general de
 * producción de la suite (`DNX_MP_ORDERS_1N_PRODUCTION_ENABLED`). Hoy: siempre false.
 */
export function cobroConRepartoHabilitado(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isFotofficeSplit1nEnabled()) return false;
  const flag = (env.DNX_MP_ORDERS_1N_PRODUCTION_ENABLED ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes" || flag === "on";
}
