import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { recortarPorDinero } from "./dinero";
import type { ContextoListado, DefinicionListado } from "./tipos";

/** Las filas de cada lista son de tipos distintos; el registro las trata de forma opaca. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ListadoCualquiera = DefinicionListado<any>;

type EntradaLista = {
  moduleKey: string;
  /** Ruta de la pantalla, para revalidar después de una acción. */
  ruta: string;
  /** Recibe el contexto porque algunas definiciones dependen del workspace (p. ej. vocabulario de Socios). */
  cargar: (ctx: ContextoListado) => Promise<ListadoCualquiera>;
};

export const LISTAS: Record<string, EntradaLista> = {
  // Clientes, Socios y Captación suman los campos personalizados del workspace (0.5).
  clientes: { moduleKey: "clients", ruta: "/clientes", cargar: async (ctx) => (await import("@/lib/clients/listado")).cargarListadoClientes(ctx) },
  socios: {
    moduleKey: "members",
    ruta: "/members",
    cargar: async (ctx) => {
      const [{ cargarListadoSocios }, { loadPersonVocabulary }] = await Promise.all([
        import("@/lib/members/listado"),
        import("@/lib/vocabulario/load"),
      ]);
      return cargarListadoSocios(ctx, await loadPersonVocabulary(ctx.workspaceId));
    },
  },
  captacion: {
    moduleKey: SERVICE_LEADS_MODULE_KEY,
    // La lista vive en su propia ruta: `vista` es parámetro reservado del motor (vistas guardadas).
    ruta: "/consultas/lista",
    cargar: async (ctx) => (await import("@/lib/service-leads/listado")).cargarListadoCaptacion(ctx),
  },
  "caja-movimientos": {
    moduleKey: "cash",
    ruta: "/caja/movimientos",
    cargar: async () => (await import("@/lib/cash/listado-movimientos")).listadoMovimientos,
  },
};

/**
 * La entrada de una lista, sólo si es propia del registro: claves heredadas del prototipo
 * (`constructor`, `__proto__`, `toString`…) cuentan como desconocidas. Toda búsqueda por clave
 * que llegue de afuera (dirección, formulario) pasa por acá, nunca por `LISTAS[clave]`.
 */
export function entradaDeLista(clave: string): EntradaLista | null {
  return typeof clave === "string" && Object.hasOwn(LISTAS, clave) ? LISTAS[clave] : null;
}

export async function definicionDe(clave: string, ctx: ContextoListado): Promise<ListadoCualquiera | null> {
  const l = entradaDeLista(clave);
  return l ? recortarPorDinero(await l.cargar(ctx), ctx) : null;
}
