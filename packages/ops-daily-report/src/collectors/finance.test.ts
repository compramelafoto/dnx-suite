import assert from "node:assert/strict";
import { test } from "node:test";

import type {
  FinanceMissingVendorsCheck,
  FinanceMonthTotals,
  FinanceOverdueInvoice,
  FinancePort,
} from "../contracts/ports";
import { resolveArgentinaDayWindow } from "../window/day-window";
import { createFinanceCollector } from "./finance";

const WINDOW = resolveArgentinaDayWindow(new Date("2026-09-13T03:00:00.000Z"));
const OPTIONS = { adminBaseUrl: "https://compramelafoto.com" };

function totals(overrides: Partial<FinanceMonthTotals> = {}): FinanceMonthTotals {
  return {
    billedArs: 0,
    paidArs: 0,
    accumulatedDebtArs: 0,
    ...overrides,
  };
}

function stubPort(input: {
  overdueInvoices?: FinanceOverdueInvoice[];
  missingVendors?: FinanceMissingVendorsCheck;
  totals?: FinanceMonthTotals;
}): FinancePort {
  return {
    async overdueInvoices() {
      return input.overdueInvoices ?? [];
    },
    async missingVendors() {
      return input.missingVendors ?? null;
    },
    async monthTotals() {
      return input.totals ?? totals();
    },
  };
}

function neonInvoice(overrides: Partial<FinanceOverdueInvoice> = {}): FinanceOverdueInvoice {
  return {
    vendorKey: "neon",
    vendorName: "Neon",
    periodMonth: 5,
    status: "IMPAGO",
    amountArs: 246_089,
    amountOriginal: 202.21,
    currency: "USD",
    daysOverdue: 127,
    dueDate: "2026-05-10T00:00:00.000Z",
    ...overrides,
  };
}

type RunResult = Awaited<ReturnType<ReturnType<typeof createFinanceCollector>["run"]>>;

function metricValue(result: RunResult, key: string): number {
  for (const group of result.section.groups) {
    for (const metric of group.metrics) {
      if (metric.key === key) return metric.value;
    }
  }
  throw new Error(`No se encontró la métrica ${key}`);
}

test("sin facturas vencidas ni proveedores faltantes, no hay alertas", async () => {
  const collector = createFinanceCollector(stubPort({}), WINDOW, OPTIONS);
  const result = await collector.run();

  assert.deepEqual(result.alerts, []);
  assert.equal(result.section.status, "ok");
});

test("una factura vencida en ARS arma una alerta crítica e inmediata", async () => {
  const collector = createFinanceCollector(
    stubPort({
      overdueInvoices: [
        neonInvoice({
          vendorKey: "cloudflare",
          vendorName: "Cloudflare",
          currency: "ARS",
          amountArs: 15_000,
          amountOriginal: 15_000,
          periodMonth: 3,
          daysOverdue: 1,
          dueDate: "2026-09-11T00:00:00.000Z",
        }),
      ],
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "finance:overdue-invoice:cloudflare");

  assert.ok(alert, "esperaba una alerta por la factura vencida");
  assert.equal(alert.severity, "critical");
  assert.equal(alert.urgency, "immediate");
  assert.equal(alert.affectedCount, 1);
  assert.equal(alert.since, "2026-09-11T00:00:00.000Z");
  assert.match(alert.title, /Cloudflare/);
  assert.match(alert.detail, /Cloudflare/);
  assert.match(alert.detail, /marzo/);
  assert.match(alert.detail, /1 día/);
  // ARS: no debería mostrar un paréntesis de USD.
  assert.doesNotMatch(alert.detail, /USD/);
  assert.equal(alert.actionUrl, "https://compramelafoto.com/admin/finanzas-dnx/gastos");
});

test("una factura vencida en USD muestra también el importe original", async () => {
  const collector = createFinanceCollector(
    stubPort({ overdueInvoices: [neonInvoice()] }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "finance:overdue-invoice:neon");

  assert.ok(alert);
  assert.match(alert.detail, /USD\s?202,21/);
  assert.match(alert.detail, /127 días/);
  assert.match(alert.detail, /mayo/);
});

test("varias facturas del mismo proveedor se agrupan en una sola alerta", async () => {
  const collector = createFinanceCollector(
    stubPort({
      overdueInvoices: [
        neonInvoice({ periodMonth: 5, amountArs: 200_000, amountOriginal: 165, daysOverdue: 127 }),
        neonInvoice({ periodMonth: 6, amountArs: 210_000, amountOriginal: 173, daysOverdue: 96, dueDate: "2026-06-10T00:00:00.000Z" }),
      ],
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alertasNeon = result.alerts.filter((item) => item.id === "finance:overdue-invoice:neon");

  assert.equal(alertasNeon.length, 1, "las dos facturas de Neon deberían quedar en una sola alerta");
  const alert = alertasNeon[0]!;
  assert.equal(alert.affectedCount, 2);
  assert.match(alert.detail, /mayo/);
  assert.match(alert.detail, /junio/);
  // El monto mostrado es la suma de ambas facturas.
  assert.match(alert.detail, /410\.000|410000/);
  // since = la fecha de vencimiento más vieja de las dos.
  assert.equal(alert.since, "2026-05-10T00:00:00.000Z");
  // La alerta reporta la mayor cantidad de días de atraso entre las dos.
  assert.match(alert.detail, /127 días/);
});

test("facturas de distintos proveedores generan alertas separadas", async () => {
  const collector = createFinanceCollector(
    stubPort({
      overdueInvoices: [
        neonInvoice(),
        neonInvoice({ vendorKey: "resend", vendorName: "Resend", currency: "ARS", amountOriginal: 8_000, amountArs: 8_000 }),
      ],
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const ids = result.alerts.map((item) => item.id).sort();

  assert.deepEqual(ids, ["finance:overdue-invoice:neon", "finance:overdue-invoice:resend"]);
});

test("antes del día 5 el port no habilita el aviso de proveedores sin cargar (null) y no hay alerta", async () => {
  const collector = createFinanceCollector(stubPort({ missingVendors: null }), WINDOW, OPTIONS);
  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "finance:missing-vendors"),
    undefined,
  );
});

test("con período habilitado pero sin proveedores faltantes, no hay alerta", async () => {
  const collector = createFinanceCollector(
    stubPort({ missingVendors: { vendors: [], period: { year: 2026, month: 8 } } }),
    WINDOW,
    OPTIONS,
  );
  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "finance:missing-vendors"),
    undefined,
  );
});

test("proveedores sin cargar este mes arman una alerta informativa con sus nombres", async () => {
  const collector = createFinanceCollector(
    stubPort({
      missingVendors: {
        vendors: [
          { vendorKey: "resend", vendorName: "Resend" },
          { vendorKey: "cloudflare", vendorName: "Cloudflare" },
        ],
        period: { year: 2026, month: 8 },
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "finance:missing-vendors");

  assert.ok(alert, "esperaba la alerta de proveedores sin cargar");
  assert.equal(alert.severity, "low");
  assert.equal(alert.urgency, "thisWeek");
  assert.equal(alert.affectedCount, 2);
  assert.match(alert.detail, /Resend/);
  assert.match(alert.detail, /Cloudflare/);
  assert.match(alert.detail, /agosto/);
});

test("las métricas muestran facturado, pagado y deuda acumulada del mes", async () => {
  const collector = createFinanceCollector(
    stubPort({
      totals: { billedArs: 500_000, paidArs: 350_000, accumulatedDebtArs: 1_024_397 },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();

  assert.equal(metricValue(result, "billedArs"), 500_000);
  assert.equal(metricValue(result, "paidArs"), 350_000);
  assert.equal(metricValue(result, "accumulatedDebtArs"), 1_024_397);
});
