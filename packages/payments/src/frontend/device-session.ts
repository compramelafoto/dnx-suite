/**
 * Official Mercado Pago Device ID / Session ID capture.
 *
 * Sources (never invent UUIDs):
 * 1. `window.MP_DEVICE_SESSION_ID` (classic MercadoPago.js contract)
 * 2. `#deviceId` input sink (Brick/security script)
 * 3. Security/device profiling property on `window` whose name is the
 *    session id itself (`armor.…`) — observed with Card Payment Brick + MLA
 *    after `www.mercadolibre.com/jms/lgz/background` loads (`dps=armor.…`).
 *
 * Value MUST be sent as header `X-Meli-Session-Id` on Order create.
 */

export type MercadoPagoDeviceWindow = Window & {
  MP_DEVICE_SESSION_ID?: string;
};

const ARMOR_SESSION_RE = /^armor\.[A-Za-z0-9._-]{20,}$/;

/** Official armor.* session key set on window by MP/ML device profiling. */
export function readArmorDeviceSessionFromWindow(
  win: MercadoPagoDeviceWindow,
): string | null {
  try {
    for (const key of Object.getOwnPropertyNames(win)) {
      if (ARMOR_SESSION_RE.test(key)) return key;
    }
  } catch {
    // ignore
  }
  return null;
}

export function readMercadoPagoDeviceSessionId(
  win: MercadoPagoDeviceWindow | undefined = typeof window !== "undefined"
    ? (window as MercadoPagoDeviceWindow)
    : undefined,
): string | null {
  if (!win) return null;
  const fromGlobal = win.MP_DEVICE_SESSION_ID?.trim();
  if (fromGlobal) return fromGlobal;

  try {
    const el = win.document?.getElementById("deviceId") as
      | HTMLInputElement
      | HTMLElement
      | null;
    if (el && "value" in el && typeof el.value === "string" && el.value.trim()) {
      return el.value.trim();
    }
    if (el?.textContent?.trim()) return el.textContent.trim();
  } catch {
    // ignore DOM access errors in non-browser test doubles
  }

  const fromArmor = readArmorDeviceSessionFromWindow(win);
  if (fromArmor) return fromArmor;

  return null;
}

export function assertMercadoPagoDeviceSessionId(
  win?: MercadoPagoDeviceWindow,
): string {
  const id = readMercadoPagoDeviceSessionId(win);
  if (!id) {
    throw new Error(
      "DEVICE_SESSION_REQUIRED: MP_DEVICE_SESSION_ID missing — wait for MercadoPago.js/Brick init",
    );
  }
  return id;
}
