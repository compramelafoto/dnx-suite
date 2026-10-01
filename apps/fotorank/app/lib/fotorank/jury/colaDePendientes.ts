/**
 * Lo que el jurado calificó y todavía no llegó a la base.
 *
 * Hasta ahora cada calificación se mandaba al servidor apenas se ponía, y si
 * el envío fallaba aparecía un aviso y nada más: quedaba sólo en la memoria
 * del navegador. Cerrar la pestaña, recargar o quedarse sin batería la perdía,
 * y el jurado seguía calificando convencido de que estaba guardada.
 *
 * Acá se decide qué se guarda, en qué orden se reintenta y cuándo se da por
 * confirmado. Sin base de datos y sin pantalla, para poder probarlo.
 */

export type Pendiente = {
  /** La obra en el lote congelado. Es lo que el servidor necesita. */
  snapshotId: string;
  /** La obra en el visor, para poder marcarla en la lista. */
  entryId: string;
  notas: Record<string, number>;
  /** `undefined` es "no lo toqué"; el servidor conserva el que hubiera. */
  comentario?: string;
  /** Cuándo se puso, en milisegundos. Ordena los reintentos. */
  momento: number;
  /** Cuántas veces se intentó mandar y falló. */
  intentos: number;
};

/**
 * Sólo importa el último estado de cada obra.
 *
 * El servidor recibe la tanda completa de la obra en cada guardado, así que
 * apilar los pasos intermedios no agregaría nada y multiplicaría los envíos:
 * poner cuatro criterios dejaría cuatro pendientes para el mismo resultado.
 */
export function encolar(cola: Pendiente[], nuevo: Pendiente): Pendiente[] {
  const otros = cola.filter((p) => p.snapshotId !== nuevo.snapshotId);
  const anterior = cola.find((p) => p.snapshotId === nuevo.snapshotId);
  // Un comentario que no se tocó conserva el que estaba en la cola: si no,
  // guardar una calificación borraría el comentario sin que nadie lo pida.
  const comentario = nuevo.comentario ?? anterior?.comentario;
  return [
    ...otros,
    {
      ...nuevo,
      // La clave se omite en vez de valer `undefined`: guardar la cola en el
      // aparato la convierte en texto, y ahí una clave indefinida desaparece.
      // Con la clave puesta, lo que se lee no sería igual a lo que se guardó.
      ...(comentario === undefined ? {} : { comentario }),
      intentos: 0,
    },
  ];
}

/** Lo saca de la cola: llegó a la base. */
export function confirmar(cola: Pendiente[], snapshotId: string): Pendiente[] {
  return cola.filter((p) => p.snapshotId !== snapshotId);
}

/**
 * Marca un intento fallido sin sacarlo de la cola.
 *
 * Contar los intentos es lo que permite no quedarse girando sobre la misma
 * obra: se manda al final de la fila y se prueba con la siguiente.
 */
export function fallo(cola: Pendiente[], snapshotId: string): Pendiente[] {
  const p = cola.find((x) => x.snapshotId === snapshotId);
  if (!p) return cola;
  return [
    ...cola.filter((x) => x.snapshotId !== snapshotId),
    { ...p, intentos: p.intentos + 1 },
  ];
}

/** El que se intenta ahora: el más viejo de los que menos fallaron. */
export function siguiente(cola: Pendiente[]): Pendiente | null {
  if (cola.length === 0) return null;
  const ordenada = [...cola].sort(
    (a, b) => a.intentos - b.intentos || a.momento - b.momento,
  );
  return ordenada[0] ?? null;
}

/** Cuántas obras esperan, para poder avisarlo. */
export function cuantasEsperan(cola: Pendiente[]): number {
  return cola.length;
}

/** Si esta obra tiene algo sin confirmar. */
export function estaPendiente(cola: Pendiente[], entryId: string): boolean {
  return cola.some((p) => p.entryId === entryId);
}

/* ---------- guardarlo en el aparato ---------- */

export function claveDeLaCola(contestId: string): string {
  return `fr-visor-pendientes-${contestId}`;
}

/**
 * Lee la cola guardada, tolerando que no haya nada o que esté rota.
 *
 * Una cola ilegible se descarta en silencio: si ya no se entiende, insistir
 * dejaría el visor trabado en cada arranque.
 */
export function leerCola(crudo: string | null): Pendiente[] {
  if (!crudo) return [];
  try {
    const dato: unknown = JSON.parse(crudo);
    if (!Array.isArray(dato)) return [];
    return dato.filter(esPendiente);
  } catch {
    return [];
  }
}

function esPendiente(x: unknown): x is Pendiente {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.snapshotId === "string" &&
    typeof p.entryId === "string" &&
    typeof p.momento === "number" &&
    typeof p.intentos === "number" &&
    Boolean(p.notas) &&
    typeof p.notas === "object"
  );
}

/**
 * Lo pendiente pisa lo que vino del servidor.
 *
 * Al volver a entrar, el servidor manda lo último que le llegó, que es
 * justamente lo viejo: lo que quedó en el aparato es más nuevo y todavía no
 * lo tiene. Si no se pisara, el jurado vería desaparecer su último trabajo.
 */
export function aplicarPendientes<
  T extends {
    entryId: string;
    notas: Record<string, number>;
    comentario: string;
  },
>(obras: T[], cola: Pendiente[]): T[] {
  if (cola.length === 0) return obras;
  const porEntry = new Map(cola.map((p) => [p.entryId, p]));
  return obras.map((o) => {
    const p = porEntry.get(o.entryId);
    if (!p) return o;
    return {
      ...o,
      notas: p.notas,
      comentario: p.comentario ?? o.comentario,
    };
  });
}
