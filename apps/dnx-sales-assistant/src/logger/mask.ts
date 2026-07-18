/** Enmascara teléfono dejando solo últimos 4 dígitos. */
export function maskSender(from: string): string {
  const digits = from.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `***${digits.slice(-4)}`;
}
