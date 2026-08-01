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
        "Donde se gestionan jurados, evaluación artística, ranking y publicación de resultados. Clickatón prepara la admisión técnica y el congelamiento para el jurado.",
      owns: [
        "Invitaciones y asignaciones de jurado",
        "Evaluación anónima y puntajes",
        "Conflictos de interés",
        "Ranking preliminar y resultados confirmados",
        "Publicación de resultados",
      ],
      status: fotorankHref ? "pending" : "not_configured",
      statusLabel: fotorankHref
        ? "Disponible para continuar en FotoRank"
        : "Sin conectar",
      href: fotorankHref,
      hrefLabel: "Abrir evaluación y resultados en FotoRank",
    },
    payments: {
      id: "payments",
      name: "Mercado Pago",
      purpose:
        "Permite cobrar las inscripciones de la edición, verificar pagos y revisar la distribución. Clickatón consulta el estado operativo.",
      owns: [
        "Cobros e inscripciones pagas",
        "Actualizaciones automáticas de pagos",
        "Verificación de pagos",
        "Reembolsos",
        "Distribución de los pagos",
      ],
      status: paymentsHref ? "pending" : "not_configured",
      statusLabel: paymentsHref ? "Configuración incompleta" : "Sin conectar",
      href: paymentsHref,
      hrefLabel: "Abrir panel de pagos",
    },
  };
}
