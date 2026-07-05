/**
 * Validación de teléfono para compras.
 * Solo exige que haya un número con suficientes dígitos (mín. 8).
 * Sin formato específico: el cliente puede escribir como quiera (11 1234-5678, +54 9 11..., etc.)
 */

/** Normaliza a solo dígitos */
export function digitsOnly(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * Valida que el teléfono tenga suficientes dígitos para ser válido.
 * Mínimo 8 dígitos. Sin restricción de formato.
 */
export function isValidPhoneForPurchase(phone: string | null | undefined): boolean {
  const d = digitsOnly(phone);
  return d.length >= 8;
}

/**
 * @deprecated Usar isValidPhoneForPurchase para compras de clientes.
 * Valida que el teléfono sea un número de WhatsApp válido para Argentina.
 */
export function isValidArgentinaWhatsApp(phone: string | null | undefined): boolean {
  const d = digitsOnly(phone);
  if (d.length < 10) return false;
  // Con prefijo 54: debe ser 54 9 XX... (12-14 dígitos)
  if (d.startsWith("54")) {
    return d.length >= 12 && d[2] === "9";
  }
  // Formato 9 XX XXXX-XXXX (10-12 dígitos)
  if (d.startsWith("9") && d.length >= 10 && d.length <= 12) {
    return true;
  }
  // 011 15... (Buenos Aires) -> 0111512345678
  if (d.startsWith("0")) {
    const without = d.replace(/^0+/, "");
    return without.length >= 10 && (without.startsWith("54") || without.startsWith("9") || without.startsWith("15"));
  }
  // 11 XXXX-XXXX o 15 XXXX-XXXX (BA, 10 dígitos) - aceptamos sin 54 para flexibilidad
  if (d.length === 10 && (d.startsWith("11") || d.startsWith("15"))) {
    return true;
  }
  // 341, 351, etc. (otras provincias, 10-11 dígitos)
  if (d.length >= 10 && d.length <= 11 && d.startsWith("3")) {
    return true;
  }
  return false;
}

/**
 * Normaliza el teléfono al formato internacional para WhatsApp: 549XXXXXXXX
 */
export function normalizeArgentinaWhatsApp(phone: string | null | undefined): string | null {
  const d = digitsOnly(phone);
  if (d.length < 10) return null;
  let normalized = d;
  if (normalized.startsWith("0")) {
    normalized = normalized.replace(/^0+/, "");
  }
  if (!normalized.startsWith("54")) {
    if (normalized.startsWith("9")) {
      normalized = "54" + normalized;
    } else {
      normalized = "549" + normalized;
    }
  }
  return normalized.length >= 12 ? normalized : null;
}

export const PHONE_PLACEHOLDER = "Ej: 11 1234-5678";
