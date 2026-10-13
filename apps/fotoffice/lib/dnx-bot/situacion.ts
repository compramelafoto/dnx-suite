import type { Capacidades } from "./acceso";
import type { ContextoPedido, Pantalla } from "./contexto";
import { RUTAS_BOT, rutasPara } from "./rutas";

/**
 * La «situación» de cada turno (va después de la guía, sin caché): workspace, rol, pantalla y lo
 * que la persona puede hacer. Sin correos, teléfonos ni ids crudos del pedido.
 */

const ROLES: Record<string, string> = {
  WORKSPACE_OWNER: "dueño",
  WORKSPACE_ADMIN: "administrador",
  ADMIN: "administrador",
};

const PANTALLA: Record<Pantalla, string> = {
  precios: "Configuración → Precios (perfil de precios)",
  presupuestos: "lista de presupuestos",
  presupuesto: "un presupuesto",
  consulta: "ficha de una consulta",
  otra: "otra pantalla del panel",
};

export function armarSituacion(p: {
  rol: string | null;
  capacidades: Capacidades;
  contexto: ContextoPedido;
  workspaceNombre: string | null;
}): string {
  const lineas = ["# Situación"];
  if (p.workspaceNombre) lineas.push(`Workspace: «${p.workspaceNombre}»`);
  lineas.push(`Rol: ${ROLES[p.rol ?? ""] ?? "equipo"}`);
  lineas.push(`Pantalla: ${PANTALLA[p.contexto.pantalla]}`);
  if (p.capacidades.configurar) {
    lineas.push("Puede usar ¿Cuánto Cobro? (perfil de precios, cálculo y costos).");
  } else {
    lineas.push(
      "No puede usar ¿Cuánto Cobro?: el perfil de precios, el cálculo y los costos los usan el dueño y los administradores. Si lo pide, explicáselo y no des precios.",
    );
  }
  if (!p.capacidades.gestionarPresupuestos) lineas.push("Puede ver presupuestos, pero no armarlos ni editarlos.");
  const permitidas = new Set(rutasPara(p.capacidades).map((r) => r.ruta));
  const vedadas = RUTAS_BOT.filter((r) => !permitidas.has(r.ruta)).map((r) => r.ruta);
  if (vedadas.length) lineas.push(`No puede abrir: ${vedadas.join(", ")}`);
  return lineas.join("\n");
}
