import { veCostosDePedido } from "@/lib/pedidos/acceso";
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
  /**
   * Una condición más que "Ver" en el módulo, para las listas que son enteras de dinero (no basta
   * con sacar columnas). Sin ella, la lista no existe para esa persona: ni página, ni exportación,
   * ni acciones, ni vistas (`definicionDe` y `contextoDeListado` devuelven null).
   */
  permitido?: (ctx: ContextoListado) => boolean;
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
  // Presupuestos (etapa 2): módulo `quotes`. Sin columnas de plata con `dinero`: el total es el
  // precio al cliente, y el costo y el margen no están en la lista.
  presupuestos: {
    moduleKey: "quotes",
    ruta: "/presupuestos",
    cargar: async () => (await import("@/lib/presupuestos/listado")).listadoPresupuestos,
  },
  // Pedidos (etapa 3): módulo `orders`. Total, cobrado y saldo son precio al cliente: sin `dinero`.
  pedidos: {
    moduleKey: "orders",
    ruta: "/pedidos",
    cargar: async () => (await import("@/lib/pedidos/listado")).listadoPedidos,
  },
  // Proyectos (etapa 4, Entrega A): módulo `projects`. Sin plata.
  proyectos: {
    moduleKey: "projects",
    ruta: "/proyectos/lista",
    cargar: async () => (await import("@/lib/proyectos/listado")).listadoProyectos,
  },
  // "A pagar" (etapa 3, Entrega B1): todo es dinero de costos, así que la lista entera exige
  // `veCostosDePedido` (`configurar` o `verDinero`), además de "Ver" en Pedidos.
  "pedidos-a-pagar": {
    moduleKey: "orders",
    ruta: "/pedidos/a-pagar",
    cargar: async () => (await import("@/lib/pedidos/listado-a-pagar")).listadoAPagar,
    permitido: (ctx) => veCostosDePedido(ctx),
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

/** Si esta persona puede usar la lista, además de "Ver" en su módulo (ver `permitido`). */
export function listaPermitida(clave: string, ctx: ContextoListado): boolean {
  const l = entradaDeLista(clave);
  return l !== null && (!l.permitido || l.permitido(ctx));
}

export async function definicionDe(clave: string, ctx: ContextoListado): Promise<ListadoCualquiera | null> {
  const l = entradaDeLista(clave);
  if (!l || !listaPermitida(clave, ctx)) return null;
  return recortarPorDinero(await l.cargar(ctx), ctx);
}
