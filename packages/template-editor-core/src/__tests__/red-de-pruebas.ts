/**
 * Ayudantes para las pruebas que salen a internet de verdad.
 *
 * La prueba que baja cada tipografía del editor fallaba de a ratos en CI con "fetch failed": un
 * corte de red, no un error nuestro. Se reintentan solo esos cortes (y las respuestas que dicen
 * "probá de nuevo": 408, 425, 429, 5xx). Un 404 —una familia mal escrita— se devuelve en el acto,
 * para que la prueba siga frenando lo que tiene que frenar.
 */

type Fetch = typeof fetch;

export type OpcionesDeReintento = {
  /** Intentos en total, contando el primero. */
  intentos?: number;
  /** Espera antes del primer reintento; se duplica en cada uno. */
  esperaInicialMs?: number;
  /** Tiempo máximo de cada intento. */
  tiempoPorIntentoMs?: number;
  dormir?: (ms: number) => Promise<void>;
  alReintentar?: (mensaje: string) => void;
};

const ESTADOS_PASAJEROS = new Set([408, 425, 429, 500, 502, 503, 504]);

/** Un error de red o de tiempo agotado, no uno de programación. */
function esCorteDeRed(e: unknown): boolean {
  if (e instanceof TypeError) return true; // undici: "fetch failed", con la causa adentro
  return e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
}

function descripcion(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const causa = (e as { cause?: unknown }).cause;
  return causa instanceof Error ? `${e.message}: ${causa.message}` : e.message;
}

export function fetchConReintentos(base: Fetch, opciones: OpcionesDeReintento = {}): Fetch {
  const {
    intentos = 4,
    esperaInicialMs = 500,
    tiempoPorIntentoMs = 20_000,
    dormir = (ms) => new Promise((r) => setTimeout(r, ms)),
    alReintentar = (m) => console.warn(m),
  } = opciones;

  return (async (entrada: Parameters<Fetch>[0], init?: Parameters<Fetch>[1]) => {
    const url = entrada instanceof Request ? entrada.url : String(entrada);
    for (let intento = 1; ; intento++) {
      const ultimo = intento >= intentos;
      // Cada intento con su propio reloj: la señal de quien llama ya pudo haber vencido.
      const conReloj = { ...init, signal: AbortSignal.timeout(tiempoPorIntentoMs) };
      let motivo: string;
      try {
        const res = await base(entrada, conReloj);
        if (!ESTADOS_PASAJEROS.has(res.status) || ultimo) return res;
        motivo = `respuesta ${res.status}`;
      } catch (e) {
        if (!esCorteDeRed(e) || ultimo) throw e;
        motivo = descripcion(e);
      }
      const espera = esperaInicialMs * 2 ** (intento - 1);
      alReintentar(`Reintento ${intento}/${intentos - 1} de ${url} en ${espera} ms (${motivo})`);
      await dormir(espera);
    }
  }) as Fetch;
}

/** Corre `tarea` sobre cada elemento con, como mucho, `limite` a la vez. */
export async function enParalelo<T>(
  elementos: readonly T[],
  limite: number,
  tarea: (elemento: T) => Promise<void>,
): Promise<void> {
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < elementos.length) await tarea(elementos[siguiente++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limite, elementos.length) }, trabajador));
}

/** Los primeros bytes de un TrueType, OpenType, colección o WOFF; no una página de error. */
export function esArchivoDeFuente(bytes: Uint8Array): boolean {
  if (bytes.length < 1000) return false;
  const firma = String.fromCharCode(...bytes.subarray(0, 4));
  return firma === "\x00\x01\x00\x00" || ["OTTO", "true", "ttcf", "wOFF", "wOF2"].includes(firma);
}
