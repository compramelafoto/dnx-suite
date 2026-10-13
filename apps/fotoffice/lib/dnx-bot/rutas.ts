import type { Capacidades } from "./acceso";

/**
 * Pantallas reales de FOTOFFICE a las que DNX Bot puede mandar (spec §6.6). Única fuente: de acá
 * salen la sección «Pantallas» de la guía y los prefijos que la burbuja convierte en enlace (sólo
 * los que la persona puede abrir). `pagina` es el page.tsx real: lo verifica `rutas.test.ts`.
 */
export type RutaBot = {
  /** Con tramos {x} para lo que cambia (el id del presupuesto o de la consulta). */
  ruta: string;
  proposito: string;
  pagina: string;
  /** Capacidad que hace falta para abrirla (ver `capacidadesDe`); "ver" = cualquiera que pasó las puertas. */
  requiere: "ver" | keyof Capacidades;
};

export const RUTAS_BOT: readonly RutaBot[] = [
  { ruta: "/workspace/configuracion/precios", proposito: "perfil de precios de ¿Cuánto Cobro? (valor hora, gastos, horas)", pagina: "app/workspace/configuracion/precios/page.tsx", requiere: "configurar" },
  { ruta: "/workspace/configuracion/presupuestos", proposito: "ajustes de presupuestos: validez, seguimiento automático, propuestas modelo", pagina: "app/workspace/configuracion/presupuestos/page.tsx", requiere: "configurar" },
  { ruta: "/presupuestos", proposito: "lista de presupuestos", pagina: "app/(shell)/presupuestos/page.tsx", requiere: "ver" },
  { ruta: "/presupuestos/{id}", proposito: "un presupuesto: editor del borrador, envío, versiones", pagina: "app/(shell)/presupuestos/[id]/page.tsx", requiere: "ver" },
  { ruta: "/presupuestos/nuevo", proposito: "crear un presupuesto nuevo", pagina: "app/(shell)/presupuestos/nuevo/page.tsx", requiere: "gestionarPresupuestos" },
  { ruta: "/consultas", proposito: "lista de consultas", pagina: "app/(shell)/consultas/page.tsx", requiere: "verConsultas" },
  { ruta: "/consultas/{id}", proposito: "ficha de una consulta: contacto, evento, mensajes, presupuestos", pagina: "app/(shell)/consultas/[id]/page.tsx", requiere: "verConsultas" },
  { ruta: "/consultas/nueva", proposito: "cargar una consulta nueva", pagina: "app/(shell)/consultas/nueva/page.tsx", requiere: "verConsultas" },
  { ruta: "/ventas/catalogo", proposito: "catálogo de productos y servicios con precio de lista", pagina: "app/(shell)/ventas/catalogo/page.tsx", requiere: "gestionarPresupuestos" },
];

export function rutasPara(c: Capacidades): RutaBot[] {
  return RUTAS_BOT.filter((r) => r.requiere === "ver" || c[r.requiere]);
}

/** Prefijos para la burbuja: la ruta sin los tramos {x}, sin duplicados. "/presupuestos" cubre /presupuestos/12. */
export function prefijosPermitidos(c: Capacidades): string[] {
  return [...new Set(rutasPara(c).map((r) => r.ruta.replace(/\/\{[^}]*\}.*$/, "")))];
}

/** Sección «## Pantallas de FOTOFFICE» de la guía: todas, sin datos de nadie (se cachea). */
export function seccionPantallas(): string {
  return [
    "## Pantallas de FOTOFFICE",
    "Estas son las únicas pantallas a las que podés mandar. Los tramos entre llaves (como {id}) son el presupuesto o la consulta. Si lo que buscás no está en la lista, no inventes rutas: describí dónde está en el menú. Si la situación dice que la persona no puede abrir alguna, no se la ofrezcas.",
    ...RUTAS_BOT.map((r) => `- ${r.ruta}: ${r.proposito}`),
  ].join("\n");
}
