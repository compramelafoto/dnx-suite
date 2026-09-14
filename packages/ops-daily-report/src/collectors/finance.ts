import type { ReportAlert } from "../contracts/alert";
import { buildMetric } from "../contracts/metric";
import type {
  FinanceMissingVendor,
  FinanceOverdueInvoice,
  FinancePort,
} from "../contracts/ports";
import type { Collector, CollectorResult } from "../report/run-collector";
import type { DayWindow } from "../window/day-window";

const SECTION_KEY = "finance";
const SECTION_TITLE = "Finanzas DNX";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function monthName(month: number): string {
  return MESES[month - 1] ?? `mes ${month}`;
}

const listFormatter = new Intl.ListFormat("es", { style: "long", type: "conjunction" });
const arsFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
/** Importe en la moneda original de la factura (USD), con coma decimal a la argentina. */
const originalFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type FinanceOptions = {
  adminBaseUrl: string;
};

function groupByVendor(
  invoices: FinanceOverdueInvoice[],
): Array<[string, FinanceOverdueInvoice[]]> {
  const groups = new Map<string, FinanceOverdueInvoice[]>();
  for (const invoice of invoices) {
    const list = groups.get(invoice.vendorKey) ?? [];
    list.push(invoice);
    groups.set(invoice.vendorKey, list);
  }
  // Orden estable por clave de proveedor: el informe no debería cambiar de
  // orden de un día a otro sólo porque Prisma devolvió las filas distinto.
  return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));
}

/**
 * Arma la alerta de un proveedor con una o más facturas vencidas e impagas.
 * Es el caso que motivó este colector: Neon rechazando facturas desde mayo,
 * descubierto recién en septiembre porque nadie miraba esto todos los días.
 * Por eso la gravedad es siempre crítica — plata que se debe por
 * infraestructura que puede cortarse no es una alerta "media".
 */
function buildOverdueInvoiceAlert(
  vendorKey: string,
  invoices: FinanceOverdueInvoice[],
  adminBaseUrl: string,
): ReportAlert {
  const vendorName = invoices[0]!.vendorName;
  const totalArs = invoices.reduce((sum, invoice) => sum + invoice.amountArs, 0);
  const totalOriginal = invoices.reduce((sum, invoice) => sum + invoice.amountOriginal, 0);
  const esTodoUsd = invoices.every((invoice) => invoice.currency === "USD");
  const meses = listFormatter.format(
    [...new Set(invoices.map((invoice) => monthName(invoice.periodMonth)))],
  );
  const maxDiasAtraso = Math.max(...invoices.map((invoice) => invoice.daysOverdue));
  const masVieja = [...invoices].sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0]!;

  const cantidadTexto =
    invoices.length === 1 ? "1 factura vencida" : `${invoices.length} facturas vencidas`;
  const diasTexto = maxDiasAtraso === 1 ? "1 día" : `${maxDiasAtraso} días`;
  const montoTexto = esTodoUsd
    ? `${arsFormatter.format(totalArs)} ARS (USD ${originalFormatter.format(totalOriginal)})`
    : `${arsFormatter.format(totalArs)} ARS`;

  return {
    id: `finance:overdue-invoice:${vendorKey}`,
    platform: "platform",
    title: `Facturas vencidas sin pagar: ${vendorName}`,
    detail:
      `${vendorName} tiene ${cantidadTexto} y sin pagar, de ${meses}, por ${montoTexto}. ` +
      `La más atrasada lleva ${diasTexto} de atraso. Si sigue así, el proveedor puede cortar ` +
      "el servicio.",
    severity: "critical",
    urgency: "immediate",
    affectedCount: invoices.length,
    since: masVieja.dueDate,
    actionUrl: `${adminBaseUrl}/admin/finanzas-dnx/gastos`,
  };
}

/**
 * Arma la alerta de proveedores activos que tuvieron gasto el mes pasado y
 * todavía no tienen ninguno cargado este mes. A diferencia de una factura
 * vencida, acá no hay plata en riesgo — puede ser un olvido de carga o
 * directamente que ese mes no corresponde — por eso la gravedad es baja.
 */
function buildMissingVendorsAlert(
  vendors: FinanceMissingVendor[],
  period: { year: number; month: number },
  adminBaseUrl: string,
): ReportAlert {
  const nombres = listFormatter.format(vendors.map((vendor) => vendor.vendorName));
  const cantidadTexto = vendors.length === 1 ? "Un proveedor activo" : `${vendors.length} proveedores activos`;

  return {
    id: "finance:missing-vendors",
    platform: "platform",
    title: `Gastos de ${monthName(period.month)} sin cargar`,
    detail:
      `${cantidadTexto} tuvo gasto en ${monthName(period.month)} de ${period.year} y todavía no ` +
      `tiene ninguno cargado este mes: ${nombres}. Si no corresponde, se puede ignorar; si falta ` +
      "cargarlo, mientras tanto el módulo va a mostrar un total más bajo que el real.",
    severity: "low",
    urgency: "thisWeek",
    affectedCount: vendors.length,
    since: null,
    actionUrl: `${adminBaseUrl}/admin/finanzas-dnx/gastos`,
  };
}

export function createFinanceCollector(
  port: FinancePort,
  _window: DayWindow,
  options: FinanceOptions,
): Collector {
  return {
    key: SECTION_KEY,
    title: SECTION_TITLE,
    async run(): Promise<CollectorResult> {
      const [overdueInvoices, missingVendorsCheck, totals] = await Promise.all([
        port.overdueInvoices(),
        port.missingVendors(),
        port.monthTotals(),
      ]);

      const alerts: ReportAlert[] = [];

      for (const [vendorKey, invoices] of groupByVendor(overdueInvoices)) {
        alerts.push(buildOverdueInvoiceAlert(vendorKey, invoices, options.adminBaseUrl));
      }

      if (missingVendorsCheck && missingVendorsCheck.vendors.length > 0) {
        alerts.push(
          buildMissingVendorsAlert(
            missingVendorsCheck.vendors,
            missingVendorsCheck.period,
            options.adminBaseUrl,
          ),
        );
      }

      return {
        alerts,
        section: {
          key: SECTION_KEY,
          title: SECTION_TITLE,
          status: "ok",
          error: null,
          groups: [
            {
              title: "Gastos del mes",
              metrics: [
                buildMetric({
                  key: "billedArs",
                  label: "Facturado",
                  value: totals.billedArs,
                  format: "currencyArs",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "paidArs",
                  label: "Pagado",
                  value: totals.paidArs,
                  format: "currencyArs",
                  previousValue: null,
                  sevenDayAverage: null,
                }),
                buildMetric({
                  key: "accumulatedDebtArs",
                  label: "Deuda acumulada",
                  value: totals.accumulatedDebtArs,
                  format: "currencyArs",
                  previousValue: null,
                  sevenDayAverage: null,
                  hint: "Todas las facturas rechazadas o impagas, de cualquier mes.",
                }),
              ],
            },
          ],
          tables: [],
        },
      };
    },
  };
}
