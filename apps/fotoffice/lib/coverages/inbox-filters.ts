/**
 * Las pestañas de la bandeja, como criterios puros.
 *
 * Viven acá y no dentro de la pantalla porque la lista y el contador de cada pestaña tienen
 * que coincidir. Con cada uno armando su propia consulta, el número deja de corresponderse con
 * lo que se ve, y nadie se entera hasta que alguien cuenta a mano.
 *
 * **Ningún filtro incluye el workspace.** Eso lo pone el repositorio, siempre, para que el
 * aislamiento no dependa de qué pestaña se está mirando.
 */
export type InboxFilterKey =
  | "nuevas"
  | "incompletas"
  | "evaluacion"
  | "proximas"
  | "urgentes"
  | "cerradas"
  | "canceladas";

export const INBOX_FILTERS: readonly { key: InboxFilterKey; label: string }[] = [
  { key: "nuevas", label: "Nuevas" },
  { key: "evaluacion", label: "En evaluación" },
  { key: "incompletas", label: "Esperando información" },
  { key: "proximas", label: "Próximas" },
  { key: "urgentes", label: "Urgentes" },
  { key: "cerradas", label: "Cerradas" },
  { key: "canceladas", label: "Canceladas" },
];

export function isInboxFilter(value: unknown): value is InboxFilterKey {
  return typeof value === "string" && INBOX_FILTERS.some((f) => f.key === value);
}

/** Qué se considera "urgente": que ocurra dentro de los próximos siete días. */
const DIAS_URGENTE = 7;

const VIVAS = ["RECIBIDA", "EN_EVALUACION", "REQUIERE_INFO", "APROBADA"] as const;

type Where = {
  status?: string | { in: string[] };
  startsAt?: { gte?: Date; lte?: Date };
};

export function whereForFilter(filter: string, now: Date): Where {
  switch (filter) {
    case "nuevas":
      return { status: "RECIBIDA" };
    case "evaluacion":
      return { status: "EN_EVALUACION" };
    case "incompletas":
      return { status: "REQUIERE_INFO" };
    case "proximas":
      return { status: "APROBADA", startsAt: { gte: now } };
    case "urgentes":
      return {
        status: { in: [...VIVAS] },
        startsAt: {
          gte: now,
          lte: new Date(now.getTime() + DIAS_URGENTE * 24 * 60 * 60 * 1000),
        },
      };
    case "cerradas":
      return { status: { in: ["CERRADA", "RECHAZADA"] } };
    case "canceladas":
      return { status: { in: ["CANCELADA_SOLICITANTE", "CANCELADA_ORGANIZACION"] } };
    default:
      // Viene de la URL: lo puede escribir cualquiera. No filtrar es más sano que romper.
      return {};
  }
}
