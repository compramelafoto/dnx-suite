/** Resultado de cada acción de Configuración → Migración desde Alboom (`useActionState`). Sin datos de la cuenta. */
export type EstadoAlboom = { error: string | null; ok?: string };

export const ESTADO_INICIAL: EstadoAlboom = { error: null };
