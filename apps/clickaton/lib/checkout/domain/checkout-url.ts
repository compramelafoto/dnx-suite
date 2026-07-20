/**
 * Validación de checkout URL antes de redirect.
 * En local/test se permiten http://localhost y https://payments.test.
 */
export function assertSafeCheckoutUrl(
  url: string,
  opts?: { allowLocalHttp?: boolean },
): { ok: true } | { ok: false; code: "CHECKOUT_NOT_AVAILABLE"; message: string } {
  const allowLocal = opts?.allowLocalHttp ?? true;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, code: "CHECKOUT_NOT_AVAILABLE", message: "URL de checkout inválida." };
  }
  if (parsed.protocol === "javascript:") {
    return { ok: false, code: "CHECKOUT_NOT_AVAILABLE", message: "URL de checkout no permitida." };
  }
  const host = parsed.hostname.toLowerCase();
  const allowedHosts = new Set([
    "payments.test",
    "localhost",
    "127.0.0.1",
    "www.mercadopago.com",
    "www.mercadopago.com.ar",
    "mercadopago.com",
    "mercadopago.com.ar",
    "sandbox.mercadopago.com",
    "sandbox.mercadopago.com.ar",
  ]);
  const extra = (process.env.CLICKATON_CHECKOUT_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  for (const h of extra) allowedHosts.add(h);

  if (!allowedHosts.has(host)) {
    return {
      ok: false,
      code: "CHECKOUT_NOT_AVAILABLE",
      message: "Host de checkout no permitido.",
    };
  }
  if (parsed.protocol === "http:") {
    if (!allowLocal || (host !== "localhost" && host !== "127.0.0.1")) {
      return {
        ok: false,
        code: "CHECKOUT_NOT_AVAILABLE",
        message: "Checkout requiere HTTPS.",
      };
    }
  } else if (parsed.protocol !== "https:") {
    return { ok: false, code: "CHECKOUT_NOT_AVAILABLE", message: "Esquema de checkout inválido." };
  }
  return { ok: true };
}
