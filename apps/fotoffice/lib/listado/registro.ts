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
  clientes: { moduleKey: "clients", ruta: "/clientes", cargar: async () => (await import("@/lib/clients/listado")).listadoClientes },
  socios: { moduleKey: "members", ruta: "/members", cargar: async () => (await import("@/lib/members/listado")).listadoSocios },
  "caja-movimientos": {
    moduleKey: "cash",
    ruta: "/caja/movimientos",
    cargar: async () => (await import("@/lib/cash/listado-movimientos")).listadoMovimientos,
  },
};

export async function definicionDe(clave: string, ctx: ContextoListado): Promise<ListadoCualquiera | null> {
  const l = LISTAS[clave];
  return l ? l.cargar(ctx) : null;
}
