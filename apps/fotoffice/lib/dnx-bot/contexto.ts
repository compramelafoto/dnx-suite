/**
 * El contexto que manda la burbuja con cada mensaje (spec §4.1): `{ pantalla, presupuestoId?,
 * consultaLeadId? }`. Acá sólo se sanea; los ids se revalidan contra el workspace activo recién en
 * las etapas que los usan (2 y 3): hasta entonces no llegan ni a la situación ni al modelo.
 */
export const PANTALLAS = ["precios", "presupuestos", "presupuesto", "consulta", "otra"] as const;
export type Pantalla = (typeof PANTALLAS)[number];

export type ContextoPedido = {
  pantalla: Pantalla;
  presupuestoId: string | null;
  consultaLeadId: string | null;
};

const ID = /^[A-Za-z0-9_-]{1,40}$/;

function id(v: unknown): string | null {
  return typeof v === "string" && ID.test(v) ? v : null;
}

export function pantallaDeRuta(pagePath: string | null): Pantalla {
  if (!pagePath) return "otra";
  const p = pagePath.split(/[?#]/)[0]!.replace(/\/+$/, "");
  if (p === "/workspace/configuracion/precios") return "precios";
  if (p === "/presupuestos" || p === "/presupuestos/nuevo") return "presupuestos";
  if (/^\/presupuestos\/[^/]+$/.test(p)) return "presupuesto";
  if (/^\/consultas\/[^/]+$/.test(p) && p !== "/consultas/nueva") return "consulta";
  return "otra";
}

export function leerContexto(body: unknown, pagePath: string | null): ContextoPedido {
  const c = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const pantalla = (PANTALLAS as readonly unknown[]).includes(c.pantalla) ? (c.pantalla as Pantalla) : pantallaDeRuta(pagePath);
  return { pantalla, presupuestoId: id(c.presupuestoId), consultaLeadId: id(c.consultaLeadId) };
}
