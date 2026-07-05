/** Formato ARS para UI de compra (valores numéricos del álbum suelen ser pesos, no centavos USD). */
export function formatPurchaseArs(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
