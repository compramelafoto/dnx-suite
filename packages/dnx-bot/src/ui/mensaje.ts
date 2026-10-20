/**
 * Tarjeta «mensaje» (evento SSE `mensaje`, FOTOFFICE etapa 3): el texto que propone DNX Bot para
 * el cliente, con variables sin completar. La burbuja nunca envía: «Abrir para enviar» deja el
 * texto en sessionStorage (NUNCA en la dirección) y abre la pantalla de envío de siempre, que lo
 * toma una sola vez y lo borra.
 */
export type CanalMensaje = "EMAIL" | "WHATSAPP";
export type TipoDestino = "PRESUPUESTO" | "CONSULTA";
export type MensajePrecargado = { canal: CanalMensaje; asunto: string | null; cuerpo: string };
export type TarjetaMensaje = MensajePrecargado & {
  destino: { tipo: TipoDestino; id: string; ruta: string };
  avisos: string[];
};
export type AlmacenMensajes = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const RUTA: Record<TipoDestino, string> = { PRESUPUESTO: "/presupuestos/", CONSULTA: "/consultas/" };

function precargado(d: unknown): MensajePrecargado | null {
  if (!d || typeof d !== "object") return null;
  const m = d as Record<string, unknown>;
  if (m.canal !== "EMAIL" && m.canal !== "WHATSAPP") return null;
  if (typeof m.cuerpo !== "string" || !m.cuerpo.trim() || m.cuerpo.length > 10_000) return null;
  const asunto = typeof m.asunto === "string" && m.asunto.trim() ? m.asunto.slice(0, 200) : null;
  return { canal: m.canal, asunto, cuerpo: m.cuerpo };
}

export function parseTarjetaMensaje(d: unknown): TarjetaMensaje | null {
  const m = precargado(d);
  if (!m) return null;
  const destino = (d as { destino?: unknown }).destino as { tipo?: unknown; id?: unknown; ruta?: unknown } | undefined;
  if (!destino || (destino.tipo !== "PRESUPUESTO" && destino.tipo !== "CONSULTA")) return null;
  if (typeof destino.id !== "string" || !ID.test(destino.id)) return null;
  // Sólo la pantalla de ese destino: nada de direcciones de afuera ni de otras pantallas.
  if (destino.ruta !== `${RUTA[destino.tipo]}${destino.id}`) return null;
  const avisos = Array.isArray((d as { avisos?: unknown }).avisos)
    ? ((d as { avisos: unknown[] }).avisos.filter((a) => typeof a === "string").slice(0, 4) as string[])
    : [];
  return { ...m, destino: { tipo: destino.tipo, id: destino.id, ruta: destino.ruta }, avisos };
}

export function claveMensajePrecargado(tipo: TipoDestino, id: string): string {
  return `dnxbot:mensaje:${tipo}:${id}`;
}

export function guardarMensajePrecargado(almacen: AlmacenMensajes | null, destino: { tipo: TipoDestino; id: string }, m: MensajePrecargado): void {
  try {
    almacen?.setItem(claveMensajePrecargado(destino.tipo, destino.id), JSON.stringify(m));
  } catch {
    // Sin almacenamiento: la pantalla de envío se abre con su texto de siempre.
  }
}

/** Lee el mensaje que dejó la burbuja para esta pantalla, una sola vez (lo borra al leerlo). */
export function tomarMensajePrecargado(almacen: AlmacenMensajes | null, tipo: TipoDestino, id: string): MensajePrecargado | null {
  if (!almacen) return null;
  const clave = claveMensajePrecargado(tipo, id);
  try {
    const crudo = almacen.getItem(clave);
    if (crudo === null) return null;
    almacen.removeItem(clave);
    return precargado(JSON.parse(crudo));
  } catch {
    try {
      almacen.removeItem(clave);
    } catch {
      // nada
    }
    return null;
  }
}
