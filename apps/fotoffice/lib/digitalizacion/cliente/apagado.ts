/**
 * Apagar la computadora al terminar (decisión F3). La estación no puede apagar Windows: le pide
 * a un ayudante que se instala una vez (`public/digitalizacion/ayudante-apagado.ps1`) y escucha
 * sólo en 127.0.0.1. Acá vive la parte pura: la máquina de estados del apagado, "¿terminó todo?",
 * la validación del código de emparejamiento y la charla con el ayudante (con `fetch` inyectable).
 */

export const PUERTO_AYUDANTE = 47231;
export const URL_AYUDANTE = `http://127.0.0.1:${PUERTO_AYUDANTE}`;
/** Aviso en pantalla antes de pedir el apagado. Después Windows da 30 s más (`shutdown /a`). */
export const SEGUNDOS_AVISO = 60;
export const CONSULTAR_AYUDANTE_CADA_MS = 30_000;
export const CLAVE_CODIGO_AYUDANTE = "fo-digitalizacion-ayudante-codigo";
export const RUTA_DESCARGA_AYUDANTE = "/digitalizacion/ayudante-apagado.ps1";
export const COMANDO_INSTALAR = `powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\\Downloads\\ayudante-apagado.ps1" -Instalar`;

// ── Código de emparejamiento ─────────────────────────────────────────────────

/** Acepta "123 456" o "123-456" (así lo puede leer de la pantalla); guarda sólo los 6 dígitos. */
export function validarCodigo(texto: string): { ok: true; codigo: string } | { ok: false; error: string } {
  const limpio = texto.replace(/[\s-]/g, "");
  if (limpio === "") return { ok: false, error: "Escribí el código de 6 números que mostró el ayudante." };
  if (!/^\d+$/.test(limpio)) return { ok: false, error: "El código tiene sólo números." };
  if (limpio.length !== 6) return { ok: false, error: `El código tiene 6 números (escribiste ${limpio.length}).` };
  return { ok: true, codigo: limpio };
}

// ── ¿Terminó todo? ───────────────────────────────────────────────────────────

export type FaseEstacion = "preparando" | "iniciando" | "grabando" | "terminando" | "terminada";

export type EntradaFin = {
  fase: FaseEstacion;
  /** El cierre en el servidor falló (la estación se queda en "terminando" con "Reintentar cierre"). */
  cierreFallido: string | null;
  /** Pedacitos que todavía no subieron, y los que el servidor rechazó para siempre. */
  pendientes: number;
  descartadas: number;
};

/**
 * "Terminó todo" = la grabación se cerró en el servidor (eso pasa después de que la cola quedó
 * vacía) y no queda ni falta ningún pedacito. Si algo salió mal, no se apaga y se dice por qué:
 * con la máquina apagada nadie se entera hasta el otro día.
 */
export type EvaluacionFin = { tipo: "esperar" } | { tipo: "listo" } | { tipo: "no-apagar"; motivo: string };

export function evaluarFin(e: EntradaFin): EvaluacionFin {
  if (e.fase === "terminando" && e.cierreFallido) {
    return { tipo: "no-apagar", motivo: `No apagamos la computadora: no pudimos cerrar la grabación (${e.cierreFallido}). Tocá «Reintentar cierre».` };
  }
  if (e.fase !== "terminada") return { tipo: "esperar" };
  if (e.descartadas > 0) {
    return { tipo: "no-apagar", motivo: `No apagamos la computadora: ${e.descartadas === 1 ? "un pedacito no se pudo subir" : `${e.descartadas} pedacitos no se pudieron subir`}. Revisá la grabación.` };
  }
  // Puede quedar algo de una grabación anterior subiendo: se espera a que termine.
  if (e.pendientes > 0) return { tipo: "esperar" };
  return { tipo: "listo" };
}

// ── Máquina de estados ───────────────────────────────────────────────────────

export type EstadoApagado =
  | { tipo: "inactivo" }
  | { tipo: "esperando" }
  | { tipo: "cuenta"; hasta: number }
  | { tipo: "apagando"; pedido: boolean }
  | { tipo: "cancelado" }
  | { tipo: "error"; motivo: string };

export type EventoApagado =
  | { tipo: "marcar" }
  | { tipo: "desmarcar" }
  | { tipo: "evaluar"; fin: EvaluacionFin; ahora: number }
  | { tipo: "tic"; ahora: number }
  | { tipo: "cancelar" }
  | { tipo: "pedido-enviado" }
  | { tipo: "pedido-fallo"; motivo: string };

export const APAGADO_INICIAL: EstadoApagado = { tipo: "inactivo" };

/**
 * Marcar la casilla sólo deja el apagado "esperando": nunca apaga en el momento. Recién cuando
 * terminó todo arranca la cuenta de 60 s, y al llegar a 0 pasa a "apagando" (ahí la estación
 * le pide el apagado al ayudante). Cancelar desmarca la casilla.
 */
export function transicionApagado(estado: EstadoApagado, ev: EventoApagado): EstadoApagado {
  switch (ev.tipo) {
    case "marcar":
      return estado.tipo === "inactivo" || estado.tipo === "cancelado" || estado.tipo === "error" ? { tipo: "esperando" } : estado;
    case "desmarcar":
      return estado.tipo === "esperando" || estado.tipo === "cuenta" ? { tipo: "inactivo" } : estado;
    case "evaluar":
      if (estado.tipo !== "esperando") return estado;
      if (ev.fin.tipo === "listo") return { tipo: "cuenta", hasta: ev.ahora + SEGUNDOS_AVISO * 1000 };
      if (ev.fin.tipo === "no-apagar") return { tipo: "error", motivo: ev.fin.motivo };
      return estado;
    case "tic":
      // Por reloj de pared: con la pestaña en segundo plano Chrome frena los temporizadores.
      return estado.tipo === "cuenta" && ev.ahora >= estado.hasta ? { tipo: "apagando", pedido: false } : estado;
    case "cancelar":
      return estado.tipo === "esperando" || estado.tipo === "cuenta" || estado.tipo === "apagando" ? { tipo: "cancelado" } : estado;
    case "pedido-enviado":
      return estado.tipo === "apagando" ? { tipo: "apagando", pedido: true } : estado;
    case "pedido-fallo":
      return estado.tipo === "apagando" ? { tipo: "error", motivo: ev.motivo } : estado;
  }
}

/** La casilla se ve tildada mientras el apagado sigue en pie. */
export function casillaMarcada(e: EstadoApagado): boolean {
  return e.tipo === "esperando" || e.tipo === "cuenta" || e.tipo === "apagando";
}

export function segundosRestantes(e: EstadoApagado, ahora: number): number | null {
  if (e.tipo !== "cuenta") return null;
  return Math.max(0, Math.ceil((e.hasta - ahora) / 1000));
}

// ── Charla con el ayudante ───────────────────────────────────────────────────

export type EstadoAyudante = "sin-codigo" | "buscando" | "listo" | "codigo-incorrecto" | "bloqueado" | "no-detectado";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

async function pedir(f: Fetch, ruta: string, metodo: "GET" | "POST", codigo: string, timeoutMs: number): Promise<Response> {
  const corte = new AbortController();
  const t = setTimeout(() => corte.abort(), timeoutMs);
  try {
    // `targetAddressSpace` le avisa a Chrome que es la propia computadora (acceso a la red local).
    const init = { method: metodo, headers: { "X-Codigo": codigo }, signal: corte.signal, cache: "no-store", targetAddressSpace: "loopback" } as RequestInit;
    return await f(`${URL_AYUDANTE}${ruta}`, init);
  } finally {
    clearTimeout(t);
  }
}

/** Nunca tira: sin ayudante (apagado, bloqueado por Chrome o sin instalar) devuelve "no-detectado". */
export async function consultarAyudante(codigo: string, opciones: { fetch?: Fetch; timeoutMs?: number } = {}): Promise<EstadoAyudante> {
  try {
    const r = await pedir(opciones.fetch ?? fetch, "/estado", "GET", codigo, opciones.timeoutMs ?? 1500);
    if (r.status === 401) return "codigo-incorrecto";
    if (r.status === 429) return "bloqueado";
    if (!r.ok) return "no-detectado";
    const cuerpo = (await r.json().catch(() => null)) as { ok?: unknown } | null;
    return cuerpo?.ok === true ? "listo" : "no-detectado";
  } catch {
    return "no-detectado";
  }
}

/** Pide apagar (Windows apaga en 30 s) o cancelar un apagado ya pedido (`shutdown /a`). */
export async function pedirAlAyudante(accion: "apagar" | "cancelar", codigo: string, opciones: { fetch?: Fetch; timeoutMs?: number } = {}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const r = await pedir(opciones.fetch ?? fetch, `/${accion}`, "POST", codigo, opciones.timeoutMs ?? 5000);
    if (r.ok) return { ok: true };
    if (r.status === 401) return { ok: false, error: "El ayudante no reconoce el código. Volvé a escribirlo." };
    return { ok: false, error: `El ayudante respondió ${r.status}.` };
  } catch {
    return { ok: false, error: "No pudimos hablar con el ayudante: ¿sigue abierto en Windows?" };
  }
}
