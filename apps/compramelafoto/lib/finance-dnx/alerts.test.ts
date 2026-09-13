import assert from "node:assert/strict";
import test from "node:test";

import { buildAlertEmail, shouldNagAboutMissingExpenses } from "./alerts";

test("día 4 del mes: todavía no hay que reclamar gastos sin cargar", () => {
  assert.equal(shouldNagAboutMissingExpenses(4), false);
});

test("día 5 del mes: ya hay que reclamar gastos sin cargar", () => {
  assert.equal(shouldNagAboutMissingExpenses(5), true);
});

test("día 1 del mes: todavía no", () => {
  assert.equal(shouldNagAboutMissingExpenses(1), false);
});

test("día 31 del mes: sigue valiendo el reclamo", () => {
  assert.equal(shouldNagAboutMissingExpenses(31), true);
});

test("sin nada que avisar, no se manda nada: null", () => {
  const resultado = buildAlertEmail({
    overdueInvoices: [],
    missingVendors: [],
    missingPeriod: null,
  });
  assert.equal(resultado, null);
});

test("sólo facturas vencidas: arma el correo con vendor, mes, monto y días", () => {
  const resultado = buildAlertEmail({
    overdueInvoices: [
      {
        vendorName: "Neon",
        periodMonth: 8,
        status: "IMPAGO",
        amountArs: 246089,
        amountOriginal: 202.21,
        currency: "USD",
        daysOverdue: 12,
      },
    ],
    missingVendors: [],
    missingPeriod: null,
  });

  assert.notEqual(resultado, null);
  assert.match(resultado!.subject, /1 factura vencida/);
  assert.match(resultado!.html, /Neon/);
  assert.match(resultado!.html, /agosto/);
  assert.match(resultado!.html, /12 días/);
  assert.match(resultado!.html, /impaga/);
  // Pesos con formatARS, y la moneda original porque es USD.
  assert.match(resultado!.html, /\$\s?246\.089/);
  assert.match(resultado!.html, /USD\s?202,21/);
  // No debería hablar de proveedores sin cargar si no hay ninguno.
  assert.doesNotMatch(resultado!.html, /sin cargar/);
});

test("factura rechazada en ARS: se dice 'rechazada' y no aparece paréntesis de moneda", () => {
  const resultado = buildAlertEmail({
    overdueInvoices: [
      {
        vendorName: "Cloudflare",
        periodMonth: 3,
        status: "RECHAZADO",
        amountArs: 15000,
        amountOriginal: 15000,
        currency: "ARS",
        daysOverdue: 1,
      },
    ],
    missingVendors: [],
    missingPeriod: null,
  });

  assert.match(resultado!.html, /rechazada/);
  assert.match(resultado!.html, /1 día\b/);
  assert.doesNotMatch(resultado!.html, /\(USD/);
});

test("sólo proveedores sin cargar: arma el correo con el mes y los nombres", () => {
  const resultado = buildAlertEmail({
    overdueInvoices: [],
    missingVendors: [{ vendorName: "Resend" }, { vendorName: "Cloudflare" }],
    missingPeriod: { year: 2026, month: 8 },
  });

  assert.notEqual(resultado, null);
  assert.match(resultado!.subject, /2 proveedores sin cargar/);
  assert.match(resultado!.html, /Resend/);
  assert.match(resultado!.html, /Cloudflare/);
  assert.match(resultado!.html, /agosto/);
  // No debería mencionar facturas vencidas si no hay ninguna.
  assert.doesNotMatch(resultado!.html, /vencid/);
});

test("un solo proveedor sin cargar: usa singular en el asunto", () => {
  const resultado = buildAlertEmail({
    overdueInvoices: [],
    missingVendors: [{ vendorName: "Resend" }],
    missingPeriod: { year: 2026, month: 8 },
  });

  assert.match(resultado!.subject, /1 proveedor sin cargar/);
});

test("ambos casos a la vez: los dos bloques aparecen en el mismo correo", () => {
  const resultado = buildAlertEmail({
    overdueInvoices: [
      {
        vendorName: "Neon",
        periodMonth: 8,
        status: "IMPAGO",
        amountArs: 246089,
        amountOriginal: 202.21,
        currency: "USD",
        daysOverdue: 12,
      },
    ],
    missingVendors: [{ vendorName: "Resend" }],
    missingPeriod: { year: 2026, month: 8 },
  });

  assert.notEqual(resultado, null);
  assert.match(resultado!.subject, /1 factura vencida/);
  assert.match(resultado!.subject, /1 proveedor sin cargar/);
  assert.match(resultado!.html, /Neon/);
  assert.match(resultado!.html, /Resend/);
});

test("el nombre del proveedor no rompe el HTML si trae caracteres especiales", () => {
  const resultado = buildAlertEmail({
    overdueInvoices: [],
    missingVendors: [{ vendorName: "Tienda <script>&Cía</script>" }],
    missingPeriod: { year: 2026, month: 8 },
  });

  assert.doesNotMatch(resultado!.html, /<script>/);
  assert.match(resultado!.html, /&lt;script&gt;/);
});
