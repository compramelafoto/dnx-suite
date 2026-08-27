import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOTOFFICE_SPLIT_1N_ENABLED,
  FOTOFFICE_SPLIT_1N_STATUS,
  assertFotofficeSplit1nAllowed,
  isFotofficeSplit1nEnabled,
} from "./split-1n";

const APP_ROOT = path.resolve(__dirname, "../..");

/**
 * Símbolos que sólo aparecen si FotOffice empieza a consumir Split (1 a N).
 *
 * `@repo/payments` estuvo en esta lista mientras FotOffice no cobraba nada: entonces
 * cualquier import del paquete delataba el consumo de Split. Dejó de servir como señal
 * cuando entraron las cuotas de socios, que usan Checkout Pro con `marketplace_fee` y
 * el consentimiento OAuth del cobrador — modelo marketplace clásico, no Orders API.
 * Lo que se vigila ahora son los símbolos propios de Split (1 a N).
 */
const FORBIDDEN_SPLIT_SYMBOLS = [
  "buildMercadoPagoSplitOrderRequest",
  "createSplitPaymentOrder",
  "observeOrdersWebhook",
  "parseMercadoPagoOrdersNotification",
  "DNX_MP_ORDERS_1N_STAGING_ENABLED",
  "DNX_MP_ORDERS_1N_WEBHOOK_OBSERVE_ENABLED",
  "DNX_MP_ORDERS_1N_PRODUCTION_ENABLED",
  "split_rules",
  "receiver_type",
];

const SKIP_DIRS = new Set(["node_modules", ".next", ".turbo", "dist", ".git"]);

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("FotOffice — Split de Pagos (1 a N) desactivado", () => {
  it("el interruptor está en OFF", () => {
    expect(FOTOFFICE_SPLIT_1N_ENABLED).toBe(false);
    expect(isFotofficeSplit1nEnabled()).toBe(false);
    expect(FOTOFFICE_SPLIT_1N_STATUS).toBe("DISABLED_NOT_CURRENTLY_REQUIRED");
  });

  it("el guard falla cerrado", () => {
    const guard = assertFotofficeSplit1nAllowed();
    expect(guard.ok).toBe(false);
    if (!guard.ok) expect(guard.reason).toBe("SPLIT_1N_DISABLED_FOR_FOTOFFICE");
  });

  it("si la app usa @repo/payments, no importa nada de Split (1 a N)", () => {
    const files = [
      ...collectSourceFiles(path.join(APP_ROOT, "app")),
      ...collectSourceFiles(path.join(APP_ROOT, "lib")),
    ].filter((file) => path.dirname(file) !== __dirname);

    const splitImports: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("@repo/payments")) continue;
      for (const symbol of FORBIDDEN_SPLIT_SYMBOLS) {
        if (source.includes(symbol)) {
          splitImports.push(`${path.relative(APP_ROOT, file)} → ${symbol}`);
        }
      }
    }
    expect(splitImports).toEqual([]);
  });

  it("ningún archivo de FotOffice referencia Split (1 a N) ni Orders API", () => {
    const files = [
      ...collectSourceFiles(path.join(APP_ROOT, "app")),
      ...collectSourceFiles(path.join(APP_ROOT, "lib")),
      ...collectSourceFiles(path.join(APP_ROOT, "components")),
      // El propio guard y su test documentan estos símbolos: no son consumo.
    ].filter((file) => path.dirname(file) !== __dirname);

    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const symbol of FORBIDDEN_SPLIT_SYMBOLS) {
        if (source.includes(symbol)) {
          offenders.push(`${path.relative(APP_ROOT, file)} → ${symbol}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("el cobro convencional de cursos (Checkout Pro) sigue intacto", () => {
    const preference = readFileSync(
      path.join(
        APP_ROOT,
        "app/api/payments/mercadopago/course-enrollment/create-preference/route.ts",
      ),
      "utf8",
    );
    // Preferencia de Checkout Pro, sin split ni receivers.
    expect(preference).toContain("createMercadoPagoPreference");
    expect(preference).not.toContain("splits");

    const mp = readFileSync(
      path.join(APP_ROOT, "lib/presential-courses/mercadopago.ts"),
      "utf8",
    );
    expect(mp).toContain("/checkout/preferences");
    expect(mp).toContain("/v1/payments/");
    expect(mp).not.toContain("/v1/orders");
  });
});
