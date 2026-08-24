import type { ReportAlert } from "../contracts/alert";
import type { ReportSection } from "../contracts/snapshot";

export type CollectorResult = {
  section: ReportSection;
  alerts: ReportAlert[];
};

export type Collector = {
  key: string;
  title: string;
  run: () => Promise<CollectorResult>;
};

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Error desconocido.";
  }
}

/**
 * Ejecuta un colector aislando su fallo: si se cae, la sección queda marcada
 * como no disponible y se emite una alerta técnica, pero el informe sigue.
 */
export async function runCollector(collector: Collector): Promise<CollectorResult> {
  try {
    return await collector.run();
  } catch (error) {
    const message = describeError(error);

    return {
      section: {
        key: collector.key,
        title: collector.title,
        status: "failed",
        error: message,
        groups: [],
        tables: [],
      },
      alerts: [
        {
          id: `collector-failed:${collector.key}`,
          platform: "platform",
          title: `No se pudieron obtener los datos de ${collector.title}`,
          detail: `El informe se generó sin esta sección. Error: ${message}`,
          severity: "high",
          urgency: "today",
          affectedCount: null,
          since: null,
        },
      ],
    };
  }
}
