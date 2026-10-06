import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";

/**
 * El módulo de main que decide los permisos de cada tipo de registro de las etapas 0.2–0.6
 * (fichas, campos, plantillas, motor de etapas). Puro: lo usan guardas y chequeos internos.
 */
export const MODULO_POR_TIPO_DE_REGISTRO = {
  CLIENTE: CLIENTS_MODULE_KEY,
  SOCIO: MEMBERS_MODULE_KEY,
  CONSULTA: SERVICE_LEADS_MODULE_KEY,
} as const;

/** Los tres módulos: las guardas genéricas exigen `operar` en al menos uno. */
export const MODULOS_CRM: readonly string[] = Object.values(MODULO_POR_TIPO_DE_REGISTRO);

/** Módulo de un tipo de registro; undefined si el tipo no es uno de los tres. */
export function moduloDeTipo(tipo: unknown): string | undefined {
  return typeof tipo === "string" && Object.hasOwn(MODULO_POR_TIPO_DE_REGISTRO, tipo)
    ? MODULO_POR_TIPO_DE_REGISTRO[tipo as keyof typeof MODULO_POR_TIPO_DE_REGISTRO]
    : undefined;
}
