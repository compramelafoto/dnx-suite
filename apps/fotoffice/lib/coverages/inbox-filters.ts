import { REQUEST_LIVE_STATUSES } from "./states";

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

/**
 * Las dos mitades de la bandeja.
 *
 * `pendientes` es trabajo: algo tiene que pasar con esos pedidos. `archivo` es historia: están
 * ahí para consultarlos. La distinción no es decorativa — una institución que viene usando esto
 * hace tiempo tiene sesenta y pico de pedidos cerrados y uno vivo, y con las siete pestañas
 * mezcladas en una fila el que importa se busca entre los que no.
 */
export type InboxFilterGroup = "pendientes" | "archivo";

export const INBOX_FILTERS: readonly {
  key: InboxFilterKey;
  label: string;
  grupo: InboxFilterGroup;
  /** Qué se lee cuando esa pestaña no tiene nada. Decir dónde mirar vale más que «no hay nada». */
  vacio: string;
}[] = [
  {
    key: "nuevas",
    label: "Nuevas",
    grupo: "pendientes",
    vacio: "Ningún pedido sin abrir. Los que ya se están evaluando están en «En evaluación».",
  },
  {
    key: "evaluacion",
    label: "En evaluación",
    grupo: "pendientes",
    vacio: "No hay ningún pedido en evaluación ahora mismo.",
  },
  {
    key: "incompletas",
    label: "Esperando información",
    grupo: "pendientes",
    vacio: "No estamos esperando ningún dato de nadie.",
  },
  {
    key: "proximas",
    label: "Próximas",
    grupo: "pendientes",
    vacio: "No hay actividades tomadas por delante.",
  },
  {
    key: "urgentes",
    label: "Urgentes",
    grupo: "pendientes",
    vacio: "Nada ocurre dentro de los próximos siete días.",
  },
  {
    key: "cerradas",
    label: "Cerradas",
    grupo: "archivo",
    vacio: "Todavía no se cerró ni se rechazó ningún pedido.",
  },
  {
    key: "canceladas",
    label: "Canceladas",
    grupo: "archivo",
    vacio: "Nadie canceló ningún pedido.",
  },
];

export function inboxFilterByKey(key: string) {
  return INBOX_FILTERS.find((f) => f.key === key) ?? null;
}

export function isInboxFilter(value: unknown): value is InboxFilterKey {
  return typeof value === "string" && INBOX_FILTERS.some((f) => f.key === value);
}

/** Qué se considera "urgente": que ocurra dentro de los próximos siete días. */
const DIAS_URGENTE = 7;

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
        status: { in: [...REQUEST_LIVE_STATUSES] },
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
