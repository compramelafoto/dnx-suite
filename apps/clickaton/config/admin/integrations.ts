/**
 * Enlaces operativos hacia módulos externos (solo lectura / estado).
 * URLs privadas server-only — nunca NEXT_PUBLIC para secretos.
 */

function readOptionalHttpUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export type IntegrationStatus = "not_configured" | "pending";

export type AdminIntegrationInfo = {
  id: "fotorank" | "payments";
  name: string;
  purpose: string;
  owns: readonly string[];
  status: IntegrationStatus;
  statusLabel: string;
  href: string | null;
  hrefLabel: string;
};

export function getAdminIntegrations(): {
  fotorank: AdminIntegrationInfo;
  payments: AdminIntegrationInfo;
} {
  const fotorankHref =
    readOptionalHttpUrl(process.env.CLICKATON_FOTORANK_ADMIN_URL) ??
    readOptionalHttpUrl(process.env.FOTORANK_PUBLIC_WEB_BASE_URL);
  const paymentsHref = readOptionalHttpUrl(process.env.CLICKATON_PAYMENTS_ADMIN_URL);

  return {
    fotorank: {
      id: "fotorank",
      name: "FotoRank",
      purpose:
        "Motor de competencia: consignas, fotografías, validaciones, jurados, evaluación, rankings y resultados.",
      owns: [
        "Participantes competitivos",
        "Consignas y entregas",
        "Validaciones",
        "Jurados y evaluación",
        "Rankings y resultados",
      ],
      status: fotorankHref ? "pending" : "not_configured",
      statusLabel: fotorankHref ? "Pendiente de sincronización" : "No configurada",
      href: fotorankHref,
      hrefLabel: "Abrir FotoRank",
    },
    payments: {
      id: "payments",
      name: "DNX Payments",
      purpose:
        "Órdenes, cobros, webhooks, conciliación, reembolsos, split y collector. Clickatón solo consulta estado operativo.",
      owns: [
        "Órdenes y cobros",
        "Webhooks del proveedor",
        "Conciliación",
        "Reembolsos",
        "Split y collector",
      ],
      status: paymentsHref ? "pending" : "not_configured",
      statusLabel: paymentsHref ? "Pendiente de conexión" : "No configurada",
      href: paymentsHref,
      hrefLabel: "Abrir DNX Payments",
    },
  };
}
