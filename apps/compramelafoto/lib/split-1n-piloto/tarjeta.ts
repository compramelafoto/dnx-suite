/**
 * El Card Payment Brick manda el tipo de tarjeta (crédito, débito, prepaga) aparte, en el
 * segundo parámetro de `onSubmit` (`additionalData.paymentTypeId`), no en `formData`. Sin él,
 * una Visa débito que el Brick identifica como `visa` (por ejemplo, Naranja X) se le informaba
 * a Mercado Pago como crédito (pedido 6082, 09/11/2026).
 */
export function conTipoDeTarjeta<T extends { payment_type_id?: string }>(
  formData: T,
  additionalData: { paymentTypeId?: string } | undefined,
): T {
  if (formData.payment_type_id?.trim()) return formData;
  const tipo = additionalData?.paymentTypeId?.trim();
  return tipo ? { ...formData, payment_type_id: tipo } : formData;
}
