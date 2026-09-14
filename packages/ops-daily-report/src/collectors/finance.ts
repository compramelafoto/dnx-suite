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
 * A partir de esta cantidad de días de atraso, la alerta pasa a ser
 * crítica/inmediata. Antes de eso es alta/hoy: un proveedor un día atrasado
 * por $500 no puede rankear igual que Neon con 127 días y $630.000 — eso es
 * justamente cómo esta alerta se había vuelto ruido.
 */
const CRITICAL_OVERDUE_DAYS = 7;

/**
 * Una frase corta con la acción concreta según el estado de las facturas.
 * Es el único dato accionable de todo el aviso: RECHAZADO es la tarjeta
 * rechazando el cobro (la acción es revisar el medio de pago, no pagar de
 * nuevo — el caso de Neon, cinco facturas rechazadas seguidas) e IMPAGO es
 * que nunca se pagó (la acción es pagarla).
 */
function accionTexto(invoices: FinanceOverdueInvoice[]): string {
  const hayRechazadas = invoices.some((invoice) => invoice.status === "RECHAZADO");
  const hayImpagas = invoices.some((invoice) => invoice.status === "IMPAGO");

  if (hayRechazadas && hayImpagas) {
    return "Algunas fueron rechazadas por la tarjeta (revisar el medio de pago) y otras nunca " +
      "se pagaron (hay que pagarlas).";
  }
  if (hayRechazadas) {
    return invoices.length === 1
      ? "La tarjeta rechazó el cobro: hay que revisar el medio de pago, no pagarla de nuevo."
      : "La tarjeta rechazó los cobros: hay que revisar el medio de pago, no pagarlas de nuevo.";
  }
  return invoices.length === 1 ? "Nunca se pagó: hay que pagarla." : "Nunca se pagaron: hay que pagarlas.";
}

/**
 * Arma la alerta de un proveedor con una o más facturas vencidas e impagas.
 * Es el caso que motivó este colector: Neon rechazando facturas desde mayo,
 * descubierto recién en septiembre porque nadie miraba esto todos los días.
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
  const esCritica = maxDiasAtraso >= CRITICAL_OVERDUE_DAYS;

  return {
    id: `finance:overdue-invoice:${vendorKey}`,
    platform: "platform",
    title: `Facturas vencidas sin pagar: ${vendorName}`,
    detail:
      `${vendorName} tiene ${cantidadTexto} y sin pagar, de ${meses}, por ${montoTexto}. ` +
      `La más atrasada lleva ${diasTexto} de atraso. ${accionTexto(invoices)}`,
    severity: esCritica ? "critical" : "high",
    urgency: esCritica ? "immediate" : "today",
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
  evidencePeriod: { year: number; month: number },
  adminBaseUrl: string,
): ReportAlert {
  const nombres = listFormatter.format(vendors.map((vendor) => vendor.vendorName));
  const esPlural = vendors.length > 1;
  const cantidadTexto = esPlural ? `${vendors.length} proveedores activos` : "Un proveedor activo";
  const tuvoTexto = esPlural ? "tuvieron" : "tuvo";
  const tieneTexto = esPlural ? "tienen" : "tiene";

  return {
    id: "finance:missing-vendors",
    platform: "platform",
    // El mes que falta cargar es el actual (`period`), no aquél del que hay
    // evidencia de gasto (`evidencePeriod`, el mes pasado) — nombrar el mes
    // equivocado acá hace que el dueño vaya a revisar el mes que sí está
    // cargado y aprenda a ignorar la alerta.
    title: `Gastos de ${monthName(period.month)} sin cargar`,
    detail:
      `${cantidadTexto} ${tuvoTexto} gasto en ${monthName(evidencePeriod.month)} de ` +
      `${evidencePeriod.year} y todavía no ${tieneTexto} ninguno cargado en ` +
      `${monthName(period.month)}: ${nombres}. Si no corresponde, se puede ignorar; si falta ` +
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
            missingVendorsCheck.evidencePeriod,
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
