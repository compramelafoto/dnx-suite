/**
 * Cuenta de Mercado Pago que COBRA en Clickatón (producción).
 *
 * Es la única fuente de verdad del código: con su token se consultan los pagos
 * (webhook, retorno, conciliación) y se invita a los afiliados al reparto 1:N.
 * Tiene que coincidir con la cuenta a la que apunta el reparto activo de cada
 * edición (`DnxAgreementParticipant.paymentAccountId`): si el reparto cobra en
 * una cuenta y acá figura otra, los pagos no se pueden confirmar.
 *
 * Desde el 06/10/2026 cobra la cuenta de Tammy (conectada como socia desde
 * "Mi cuenta"). Antes cobraba Dnx Estudio: `pa_ba733fa7a35f4326` / MP 97484805.
 */
export const CLICKATON_LIVE_COLLECTOR_PAYMENT_ACCOUNT_ID = "pa_c938e72aed3a485c";
/** Usuario de MP de la cuenta cobradora: la cuenta "dueña" del permiso de split. */
export const CLICKATON_LIVE_COLLECTOR_PROVIDER_USER_ID = "200207816";
