import { formatARS } from "@/lib/admin/helpers";

/**
 * Decisiones puras del aviso diario de Finanzas DNX. Sin Prisma, sin fetch,
 * sin fechas del sistema (salvo lo que ya viene calculado): todo lo que hay
 * que probar del aviso pasa por acá.
 */

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

function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? `mes ${mes}`;
}

/** Formatea un importe en su moneda original (USD), con coma decimal a la argentina. */
function formatOriginalAmount(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export type OverdueInvoiceAlert = {
  vendorName: string;
  /** Mes de la factura (el período que se cargó), 1-12. */
  periodMonth: number;
  status: "RECHAZADO" | "IMPAGO";
  /** Importe en pesos, ya convertido (Decimal → number en el borde). */
  amountArs: number;
  /** Importe en la moneda original de la factura. */
  amountOriginal: number;
  currency: "USD" | "ARS";
  daysOverdue: number;
};

export type MissingVendorAlert = {
  vendorName: string;
};

export type BuildAlertEmailInput = {
  overdueInvoices: OverdueInvoiceAlert[];
  missingVendors: MissingVendorAlert[];
  /** Año y mes del período que se está reclamando (el mes pasado). */
  missingPeriod: { year: number; month: number } | null;
};

export type AlertEmail = {
  subject: string;
  html: string;
};

/**
 * Antes del día 5 del mes es normal que todavía no esté cargado el gasto de
 * algún proveedor: las facturas no terminaron de llegar. Recién a partir del
 * día 5 la ausencia empieza a ser sospechosa y vale la pena reclamarla.
 */
export function shouldNagAboutMissingExpenses(day: number): boolean {
  return day >= 5;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderOverdueInvoicesBlock(invoices: OverdueInvoiceAlert[]): string {
  const filas = invoices
    .map((factura) => {
      const estado = factura.status === "RECHAZADO" ? "rechazada" : "impaga";
      const dias = factura.daysOverdue === 1 ? "1 día" : `${factura.daysOverdue} días`;
      const monto =
        factura.currency === "USD"
          ? `${formatARS(factura.amountArs)} (USD ${formatOriginalAmount(factura.amountOriginal)})`
          : formatARS(factura.amountArs);
      return `<li><strong>${escapeHtml(factura.vendorName)}</strong>: la factura de ${nombreMes(
        factura.periodMonth,
      )} venció hace ${dias} y sigue ${estado} — ${monto}.</li>`;
    })
    .join("\n");

  return `
    <h2>Facturas vencidas e impagas</h2>
    <p>Estas facturas ya pasaron su fecha de vencimiento y todavía no están pagadas. Conviene resolverlas antes de que el proveedor corte el servicio.</p>
    <ul>${filas}</ul>
  `;
}

function renderMissingVendorsBlock(
  vendors: MissingVendorAlert[],
  period: { year: number; month: number },
): string {
  const filas = vendors
    .map((vendor) => `<li>${escapeHtml(vendor.vendorName)}</li>`)
    .join("\n");

  return `
    <h2>Gastos de ${nombreMes(period.month)} de ${period.year} sin cargar</h2>
    <p>Estos proveedores tuvieron un gasto cargado el mes pasado, pero todavía no tienen ninguno cargado este mes. Si no corresponde, se puede ignorar; si falta cargarlo, mientras tanto el módulo va a mostrar un total más bajo que el real.</p>
    <ul>${filas}</ul>
  `;
}

/**
 * Arma el aviso diario, o decide que no hay nada que avisar.
 *
 * `null` es el contrato central de este módulo: silencio significa que todo
 * está en orden. Un aviso que llega todos los días deja de leerse.
 */
export function buildAlertEmail(input: BuildAlertEmailInput): AlertEmail | null {
  const { overdueInvoices, missingVendors, missingPeriod } = input;
  const hasOverdue = overdueInvoices.length > 0;
  const hasMissing = missingVendors.length > 0 && missingPeriod !== null;

  if (!hasOverdue && !hasMissing) {
    return null;
  }

  const partesAsunto: string[] = [];
  if (hasOverdue) {
    partesAsunto.push(
      overdueInvoices.length === 1
        ? "1 factura vencida"
        : `${overdueInvoices.length} facturas vencidas`,
    );
  }
  if (hasMissing) {
    partesAsunto.push(
      missingVendors.length === 1
        ? "1 proveedor sin cargar"
        : `${missingVendors.length} proveedores sin cargar`,
    );
  }
  const subject = `Finanzas DNX: ${partesAsunto.join(" y ")}`;

  const bloques: string[] = [];
  if (hasOverdue) {
    bloques.push(renderOverdueInvoicesBlock(overdueInvoices));
  }
  if (hasMissing && missingPeriod) {
    bloques.push(renderMissingVendorsBlock(missingVendors, missingPeriod));
  }

  const html = `<div>${bloques.join("\n")}</div>`;

  return { subject, html };
}
