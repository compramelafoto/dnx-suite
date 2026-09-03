/**
 * Guardado en el dispositivo.
 *
 * En la calle la señal falla. La regla es: primero se escribe en el teléfono y
 * después se intenta el servidor, nunca al revés. Si la señal no vuelve, la
 * nota igual está.
 *
 * Sin dependencias de React ni del servidor, para poder probarlo aparte.
 */

export type NotaLocal = {
  promptId: string;
  body: string;
  solved: boolean;
  /** Hora del dispositivo. Decide quién gana si también escribiste en la compu. */
  clientUpdatedAt: string;
  /** `true` mientras el servidor no la haya aceptado. */
  pending: boolean;
};

export type NotasLocales = Record<string, NotaLocal>;

export function claveDeAlmacenamiento(registrationId: string): string {
  return `ck-notes:${registrationId}`;
}

export function leerNotasLocales(registrationId: string): NotasLocales {
  try {
    const crudo = window.localStorage.getItem(claveDeAlmacenamiento(registrationId));
    if (!crudo) return {};
    const dato = JSON.parse(crudo) as unknown;
    return dato && typeof dato === "object" ? (dato as NotasLocales) : {};
  } catch {
    // Modo privado, cuota llena o dato corrupto: se sigue sin memoria local.
    return {};
  }
}

export function guardarNotasLocales(registrationId: string, notas: NotasLocales): void {
  try {
    window.localStorage.setItem(claveDeAlmacenamiento(registrationId), JSON.stringify(notas));
  } catch {
    /* sin espacio: la nota vive en memoria hasta que se sincronice */
  }
}

/**
 * Mezcla lo que vino del servidor con lo que hay en el dispositivo.
 *
 * Lo pendiente de sincronizar siempre gana: es lo que la persona escribió y
 * todavía no llegó. Para el resto vale lo del servidor, que puede traer algo
 * escrito desde otro dispositivo.
 */
export function combinarNotas(input: {
  delServidor: Array<{ promptId: string; body: string; solved: boolean }>;
  delDispositivo: NotasLocales;
}): NotasLocales {
  const resultado: NotasLocales = {};

  for (const nota of input.delServidor) {
    resultado[nota.promptId] = {
      promptId: nota.promptId,
      body: nota.body,
      solved: nota.solved,
      clientUpdatedAt: input.delDispositivo[nota.promptId]?.clientUpdatedAt ?? "",
      pending: false,
    };
  }

  for (const [promptId, local] of Object.entries(input.delDispositivo)) {
    if (local.pending || !resultado[promptId]) {
      resultado[promptId] = local;
    }
  }

  return resultado;
}
