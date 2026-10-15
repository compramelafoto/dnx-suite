import type { Capacidades } from "./acceso";
import type { ContextoPedido, Pantalla } from "./contexto";
import type { EnPantalla } from "./contexto-validado";
import { RUTAS_BOT, rutasPara } from "./rutas";

/**
 * La «situación» de cada turno (va después de la guía, sin caché): workspace, rol, pantalla y lo
 * que la persona puede hacer. Sin correos, teléfonos ni ids crudos del pedido.
 */

export type EstadoPerfil = {
  existe: boolean;
  completo: boolean;
  faltan: string[];
  origen: "manual" | "clf-import" | "dnx-bot" | null;
  /** Lo anotado en el borrador (antes de lo que se ve del historial), sin montos. Ausente si no hay. */
  borrador?: { anotado: string[]; faltan: string[]; rubrosSinDatos: string[] };
};

const ORIGEN: Record<string, string> = {
  manual: "cargado a mano",
  "clf-import": "importado de CompraMeLaFoto",
  "dnx-bot": "armado con DNX Bot",
};

/** El camino principal es el formulario: la entrevista conversada (cara) sólo si la persona la pide o no puede. */
const COMO_SE_COMPLETA =
  "Se completa en el formulario de /workspace/configuracion/precios; armarlo conversando, sólo si la persona lo pide o dice que no puede.";

function lineaBorrador(b: NonNullable<EstadoPerfil["borrador"]>): string {
  const partes = [`Borrador del perfil (lo que ya contó y quedó anotado, sin guardar todavía): ${b.anotado.join("; ")}.`];
  if (b.faltan.length) partes.push(`Con el borrador, todavía falta: ${b.faltan.join(", ")}.`);
  if (b.rubrosSinDatos.length) partes.push(`Rubros de gastos personales sin datos: ${b.rubrosSinDatos.join(", ")}.`);
  partes.push(
    "Si van a seguir con el perfil, retomá desde ahí («Seguimos donde quedamos: ya tengo … falta …») y no vuelvas a preguntar lo anotado; los montos y totales están en ver_perfil_de_precios.",
  );
  return partes.join(" ");
}

/** A mitad de la entrevista (hay borrador) no se la manda al formulario: se sigue conversando. */
const SIGUE_CONVERSANDO =
  "Ya lo está armando conversando (hay borrador): seguí la entrevista; no la mandes al formulario salvo que ella lo pida.";

function lineaPerfil(p: EstadoPerfil): string {
  const comoSeCompleta = p.borrador ? SIGUE_CONVERSANDO : COMO_SE_COMPLETA;
  if (!p.existe) return `Perfil de precios: todavía no está armado. ${comoSeCompleta}`;
  const origen = p.origen ? ` (${ORIGEN[p.origen]})` : "";
  if (p.completo) return `Perfil de precios: completo${origen}.`;
  return `Perfil de precios: incompleto${origen}. Falta: ${p.faltan.join(", ")}. ${comoSeCompleta}`;
}

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
  /** Sólo para quien tiene `configurar` (si no, null): estado, sin montos. */
  perfil?: EstadoPerfil | null;
  /** Lo que está mirando, ya revalidado contra el workspace (`revalidarContexto`). */
  enPantalla?: EnPantalla;
  /** Resumen de lo que quedó fuera de la ventana del historial (`windowHistory`). */
  antes?: string | null;
}): string {
  const lineas = ["# Situación"];
  if (p.workspaceNombre) lineas.push(`Workspace: «${p.workspaceNombre}»`);
  lineas.push(`Rol: ${ROLES[p.rol ?? ""] ?? "equipo"}`);
  lineas.push(`Pantalla: ${PANTALLA[p.contexto.pantalla]}`);
  const pr = p.enPantalla?.presupuesto;
  if (pr) {
    lineas.push(
      `Está mirando el presupuesto ${pr.numero ? `N.º ${pr.numero}` : "sin número"} (presupuestoId ${pr.id}), ${pr.esBorrador ? "en borrador" : `sin borrador editable (${pr.estado.toLowerCase()})`}.`,
    );
  }
  const co = p.enPantalla?.consulta;
  if (co) {
    const datos = [co.categoria, co.fechaEvento, co.nombreDePila ? `de ${co.nombreDePila}` : null].filter(Boolean).join(" · ");
    lineas.push(
      `Está mirando la consulta ${co.numero ? `N.º ${co.numero}` : "sin número"} (consultaLeadId ${co.leadId})${datos ? `: ${datos}` : ""}.${co.tieneFicha ? "" : " Le falta el contacto: hay que completarla antes de presupuestar."}`,
    );
  }
  if (p.capacidades.configurar) {
    lineas.push("Puede usar ¿Cuánto Cobro? (perfil de precios, cálculo y costos).");
  } else {
    lineas.push(
      "No puede usar ¿Cuánto Cobro?: el perfil de precios, el cálculo y los costos los usan el dueño y los administradores. Si lo pide, explicáselo y no des precios.",
    );
  }
  if (p.capacidades.configurar && p.perfil) {
    lineas.push(lineaPerfil(p.perfil));
    if (p.perfil.borrador) lineas.push(lineaBorrador(p.perfil.borrador));
  }
  if (!p.capacidades.gestionarPresupuestos) lineas.push("Puede ver presupuestos, pero no armarlos ni editarlos.");
  const permitidas = new Set(rutasPara(p.capacidades).map((r) => r.ruta));
  const vedadas = RUTAS_BOT.filter((r) => !permitidas.has(r.ruta)).map((r) => r.ruta);
  if (vedadas.length) lineas.push(`No puede abrir: ${vedadas.join(", ")}`);
  if (p.antes) lineas.push("", p.antes);
  return lineas.join("\n");
}
