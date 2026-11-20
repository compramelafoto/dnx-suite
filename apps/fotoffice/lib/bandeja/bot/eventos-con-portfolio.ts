/**
 * PURO. El circuito de XV y bodas del bot (spec 2026-11-20): qué categoría es un evento con
 * portfolio y paquetes, si la fecha está tomada, qué paquete eligió el cliente y los textos que
 * lee el bot. Sin base ni servidor: lo usan las herramientas, el servidor y las pruebas.
 */
import { ENLACE_PORTFOLIO_XV, esCategoriaXv, pesosConPunto } from "./presentacion-xv";

export type EventoConPortfolio = "XV" | "BODA";

/**
 * El portfolio de cada evento: la página con los trabajos y los paquetes (sin precios). No hay un
 * campo de dirección por categoría en FOTOFFICE: el enlace se cambia acá (el de XV, en
 * `ENLACE_PORTFOLIO_XV`, que también usa la presentación de XV), nunca en la guía.
 */
export const PORTFOLIO_DE_EVENTOS: Record<EventoConPortfolio, { nombre: string; enlace: string; reconoce: (categoria: string) => boolean }> = {
  XV: { nombre: "XV / 15 años", enlace: ENLACE_PORTFOLIO_XV, reconoce: esCategoriaXv },
  BODA: { nombre: "boda", enlace: "https://www.compramelafoto.com/dnx/bodas", reconoce: (c) => /(^|[^a-z])(boda|bodas|casamiento|casamientos)([^a-z]|$)/.test(normalizar(c)) },
};

const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** ¿La categoría (o el tipo que dijo el bot) es un evento con portfolio y paquetes? */
export function eventoDeCategoria(nombre: string | null | undefined): EventoConPortfolio | null {
  if (!nombre?.trim()) return null;
  if (PORTFOLIO_DE_EVENTOS.XV.reconoce(nombre)) return "XV";
  if (PORTFOLIO_DE_EVENTOS.BODA.reconoce(nombre)) return "BODA";
  return null;
}

// --- La fecha --------------------------------------------------------------------------------------

export type EstadoDeLaFecha = "LIBRE" | "DUENO_OCUPADO" | "COMPLETA";

/**
 * Con los eventos contratados ese día (pedidos no cancelados y consultas ganadas sin pedido, como el
 * semáforo de Consultas) y los que el estudio puede cubrir: libre, el dueño ya tiene un evento (el
 * primero del día lo cubre él) o completa.
 */
export function estadoDeLaFecha(contratados: number, capacidad: number): EstadoDeLaFecha {
  const cap = Math.max(1, Math.floor(capacidad) || 1);
  const n = Math.max(0, Math.floor(contratados) || 0);
  if (n === 0) return "LIBRE";
  return n >= cap ? "COMPLETA" : "DUENO_OCUPADO";
}

/** "aaaa-mm-dd" del día de hoy en Argentina. */
export function hoyEnArgentina(ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

/** Lo que lee el bot de `fecha_disponible`. */
export function textoDeLaFecha(p: { fecha: string; ahora: Date; estado: EstadoDeLaFecha; dueno: string | null; estudio: string | null }): string {
  if (p.fecha < hoyEnArgentina(p.ahora)) return "Esa fecha ya pasó: confirmá con el cliente la fecha del evento (día, mes y año) y volvé a usar fecha_disponible.";
  if (p.estado === "LIBRE") return "La fecha está libre: seguí con el paso siguiente (el portfolio con paquetes_del_evento).";
  if (p.estado === "COMPLETA") {
    return 'Esa fecha ya está completa: el estudio no tiene más lugar ese día. No le prometas nada: decile que lo consultás y usá pasar_a_persona con el motivo "fecha completa: " y la fecha.';
  }
  const quien = p.dueno ? `${p.dueno}, el dueño${p.estudio ? ` de ${p.estudio}` : " del estudio"},` : `el dueño${p.estudio ? ` de ${p.estudio}` : " del estudio"}`;
  return [
    `Ese día el dueño ya tiene un evento. Decíselo así, con tus palabras si hace falta: "Ese día ${quien} ya tiene un evento. Pero somos un equipo de fotógrafos que trabajamos juntos y te garantizamos la misma calidad fotográfica y humana que nos caracteriza. ¿Te gustaría que avancemos igual?"`,
    'Si dice que sí, seguí con el paso siguiente (el portfolio). Si duda o dice que no, usá pasar_a_persona con el motivo "fecha ocupada: " y lo que dijo.',
  ].join("\n");
}

// --- Los paquetes ----------------------------------------------------------------------------------

export type Paquete = { nombre: string; total: number };

/** ¿Es el mismo nombre de paquete? Sin tildes ni mayúsculas; "el intermedio" o "pack premium" también. */
export function mismoPaquete(nombre: string, pedido: string): boolean {
  const n = normalizar(nombre);
  const p = normalizar(pedido).replace(/^((el|la|paquete|pack|opcion|plan)\s+)+/, "");
  if (!n || !p) return false;
  return n === p || n.split(/\s+/).includes(p) || p.split(/\s+/).includes(n);
}

export type PaqueteElegido = { ok: true; paquete: Paquete } | { ok: false; motivo: "SIN_PAQUETES" | "NO_ESTA" | "AMBIGUO" };

export function elegirPaquete(paquetes: readonly Paquete[], pedido: string): PaqueteElegido {
  const validos = paquetes.filter((p) => Number.isFinite(p.total) && p.total > 0);
  if (validos.length === 0) return { ok: false, motivo: "SIN_PAQUETES" };
  const iguales = validos.filter((p) => mismoPaquete(p.nombre, pedido));
  if (iguales.length === 1) return { ok: true, paquete: iguales[0]! };
  return { ok: false, motivo: iguales.length > 1 ? "AMBIGUO" : "NO_ESTA" };
}

/** Lo que lee el bot de `paquetes_del_evento`. Los precios, en pesos enteros con punto de miles. */
export function textoDePaquetes(evento: EventoConPortfolio, paquetes: readonly Paquete[]): string {
  const validos = paquetes.filter((p) => Number.isFinite(p.total) && p.total > 0);
  const enlace = PORTFOLIO_DE_EVENTOS[evento].enlace;
  if (validos.length === 0) {
    return [
      `Portfolio y paquetes: ${enlace}`,
      "No hay paquetes con precio cargados para este evento: pasale el enlace, seguí juntando los datos y después usá preparar_presupuesto (no digas ningún precio).",
    ].join("\n");
  }
  return [
    `Portfolio y paquetes: ${enlace} (la página no muestra precios).`,
    `Paquetes: ${validos.map((p) => p.nombre).join(", ")}.`,
    "Precios vigentes del estudio (ya aprobados; no los digas hasta que elija uno, y entonces sólo el de ese):",
    ...validos.map((p) => `- ${p.nombre}: ${pesosConPunto(p.total)}`),
    "Cuando elija uno, decile su precio y ofrecele dejarle la cotización con el botón para reservar la fecha. Si dice que sí, usá enviar_cotizacion_del_paquete. Si lo quiere con agregados o cambios, usá preparar_presupuesto con el paquete y los cambios en detalle.",
  ].join("\n");
}

// --- El pase a ventas ------------------------------------------------------------------------------

export function primerNombre(nombre: string | null | undefined): string | null {
  const p = nombre?.trim().split(/\s+/)[0];
  return p ? p : null;
}

/** La frase con la que el bot deja el chat a la persona de ventas (o al dueño, si no hay responsable). */
export function fraseDelPase(nombre: string | null, esResponsable: boolean): string {
  if (!nombre) return "Te dejo con nuestro equipo de ventas, que te va a acompañar para cerrar todo 😊";
  return esResponsable
    ? `Te dejo con ${nombre}, de nuestro equipo de ventas, que te va a acompañar para cerrar todo 😊`
    : `Te dejo con ${nombre}, que te va a acompañar para cerrar todo 😊`;
}

/** Lo que se suma al resultado de la herramienta cuando el chat pasa a ventas. */
export function instruccionDelPase(frase: string): string {
  return `Terminá tu mensaje con esta frase (es la única vez que decís que sigue otra persona): "${frase}". Después de tu mensaje el chat queda a cargo de esa persona.`;
}
