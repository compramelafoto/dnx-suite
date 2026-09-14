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

test("una factura vencida en ARS con pocos días de atraso arma una alerta alta para hoy, no crítica", async () => {
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
          status: "IMPAGO",
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
  // Un día de atraso no puede rankear igual que Neon con 127 días: por eso
  // no es "critical"/"immediate" sino "high"/"today".
  assert.equal(alert.severity, "high");
  assert.equal(alert.urgency, "today");
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

test("desde los 7 días de atraso la alerta pasa a ser crítica e inmediata", async () => {
  const collector = createFinanceCollector(
    stubPort({
      overdueInvoices: [
        neonInvoice({ vendorKey: "resend", vendorName: "Resend", daysOverdue: 7 }),
      ],
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "finance:overdue-invoice:resend")!;

  assert.equal(alert.severity, "critical");
  assert.equal(alert.urgency, "immediate");
});

test("con 6 días de atraso todavía no es crítica", async () => {
  const collector = createFinanceCollector(
    stubPort({
      overdueInvoices: [
        neonInvoice({ vendorKey: "resend", vendorName: "Resend", daysOverdue: 6 }),
      ],
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "finance:overdue-invoice:resend")!;

  assert.equal(alert.severity, "high");
  assert.equal(alert.urgency, "today");
});

test("facturas rechazadas piden revisar el medio de pago, no pagar de nuevo (caso Neon)", async () => {
  const collector = createFinanceCollector(
    stubPort({
      overdueInvoices: [
        neonInvoice({ status: "RECHAZADO", periodMonth: 5 }),
        neonInvoice({ status: "RECHAZADO", periodMonth: 6, dueDate: "2026-06-10T00:00:00.000Z" }),
      ],
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "finance:overdue-invoice:neon")!;

  assert.match(alert.detail, /rechaz/i);
  assert.match(alert.detail, /revisar el medio de pago/i);
  assert.doesNotMatch(alert.detail, /hay que pagarlas/i);
});

test("facturas impagas piden pagarlas", async () => {
  const collector = createFinanceCollector(
    stubPort({ overdueInvoices: [neonInvoice({ status: "IMPAGO" })] }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "finance:overdue-invoice:neon")!;

  assert.match(alert.detail, /nunca se pagó/i);
  assert.match(alert.detail, /hay que pagarla/i);
  assert.doesNotMatch(alert.detail, /medio de pago/i);
});

test("cuando un proveedor tiene facturas rechazadas e impagas, la alerta menciona ambas acciones", async () => {
  const collector = createFinanceCollector(
    stubPort({
      overdueInvoices: [
        neonInvoice({ status: "RECHAZADO", periodMonth: 5 }),
        neonInvoice({ status: "IMPAGO", periodMonth: 6, dueDate: "2026-06-10T00:00:00.000Z" }),
      ],
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "finance:overdue-invoice:neon")!;

  assert.match(alert.detail, /rechaz/i);
  assert.match(alert.detail, /nunca se pagaron|pagarlas/i);
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
    stubPort({
      missingVendors: {
        vendors: [],
        period: { year: 2026, month: 9 },
        evidencePeriod: { year: 2026, month: 8 },
      },
    }),
    WINDOW,
    OPTIONS,
  );
  const result = await collector.run();

  assert.equal(
    result.alerts.find((item) => item.id === "finance:missing-vendors"),
    undefined,
  );
});

test("proveedores sin cargar este mes arman una alerta informativa con sus nombres, y el título nombra el mes que falta, no el de evidencia", async () => {
  const collector = createFinanceCollector(
    stubPort({
      missingVendors: {
        vendors: [
          { vendorKey: "resend", vendorName: "Resend" },
          { vendorKey: "cloudflare", vendorName: "Cloudflare" },
        ],
        // El informe se genera el 13/9: agosto es el mes con evidencia de
        // gasto, septiembre es el mes que todavía no tiene nada cargado.
        period: { year: 2026, month: 9 },
        evidencePeriod: { year: 2026, month: 8 },
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
  // El título tiene que nombrar septiembre (el mes que falta cargar), no
  // agosto (el mes que sólo sirve de evidencia) — F-1: nombrar el mes
  // equivocado hace que el dueño vaya a revisar el mes que sí está cargado.
  assert.match(alert.title, /septiembre/);
  assert.doesNotMatch(alert.title, /agosto/);
  // El cuerpo sí menciona agosto: ahí es donde hubo gasto.
  assert.match(alert.detail, /agosto/);
  // Y el verbo va en plural: "2 proveedores activos tuvieron ... y todavía no tienen".
  assert.match(alert.detail, /proveedores activos tuvieron/);
  assert.match(alert.detail, /todavía no tienen/);
});

test("con un solo proveedor faltante, el verbo va en singular", async () => {
  const collector = createFinanceCollector(
    stubPort({
      missingVendors: {
        vendors: [{ vendorKey: "resend", vendorName: "Resend" }],
        period: { year: 2026, month: 9 },
        evidencePeriod: { year: 2026, month: 8 },
      },
    }),
    WINDOW,
    OPTIONS,
  );

  const result = await collector.run();
  const alert = result.alerts.find((item) => item.id === "finance:missing-vendors")!;

  assert.match(alert.detail, /Un proveedor activo tuvo/);
  assert.match(alert.detail, /todavía no tiene/);
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
