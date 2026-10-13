/**
 * Tipos de la carga desde Alboom (etapa 8B-1). Puro: sin base ni `server-only`.
 *
 * Cada traductor es una función pura `traducir(crudo, contexto) → Decision`. El motor la aplica (o, en una
 * simulación, sólo la cuenta) y la anota en el informe.
 */

/** Un valor de campo tal como lo guarda FOTOFFICE, normalizado para comparar (importes "1500.00", fechas "aaaa-mm-dd"). */
export type Valor = string | number | boolean | null;
export type Campos = Record<string, Valor>;

/** Un registro crudo de `FotofficeAlboomCrudo`. */
export type Crudo = { entity: string; alboomId: string; payload: unknown; hash: string };

/** Una fila de `FotofficeAlboomMapa`. */
export type EntradaMapa = {
  entity: string;
  alboomId: string;
  targetType: string;
  targetId: string;
  /** Huella del crudo con que se cargó por última vez. */
  payloadHash: string;
  /** Huella de cada campo tal como vino de Alboom en la última carga (para no pisar lo editado en FOTOFFICE). */
  fieldHashes: Record<string, string>;
};

/** Fila del mapa a escribir. `targetId` lo completa el escritor cuando el registro se crea. */
export type FilaMapa = Omit<EntradaMapa, "targetId"> & { targetId?: string };

export type Accion = "CREAR" | "ACTUALIZAR" | "IGUAL" | "OMITIR";

export type Decision = {
  accion: Accion;
  /** Registro de FOTOFFICE: el que se actualiza, el que quedó igual, o con el que se fusionó un duplicado. */
  targetId?: string;
  /** CREAR: todos los datos. ACTUALIZAR: sólo los campos que cambian. */
  datos?: Campos;
  /** Datos que no son campos sueltos (etiquetas a asignar, por ejemplo). */
  extra?: Record<string, unknown>;
  /** OMITIR: por qué. Texto fijo, nunca datos del registro. */
  motivo?: string;
  /** Primera vez que este id de Alboom se ata a un registro que ya existía en FOTOFFICE. */
  vincula?: boolean;
  /** Campos que traían otro valor y se dejaron como están en FOTOFFICE. */
  conservados?: string[];
  /** Cosas que no cerraron (textos fijos). */
  dudas?: string[];
  /** Huella por campo de lo que vino de Alboom (va al mapa). */
  huellas?: Record<string, string>;
  /** Id de Alboom del registro con el que se fusionó un duplicado de Alboom. */
  fusionadoCon?: string;
  /** Más filas del mapa que apuntan al mismo registro (p. ej. la posición de una etapa). */
  otrasClaves?: { entity: string; alboomId: string }[];
  /**
   * Hay que escribir la fila del mapa aunque el registro no cambie (vínculo nuevo o crudo con otra huella). El
   * motor lo deduce si no viene.
   */
  escribirMapa?: boolean;
};

export type ModoCarga = "SIMULACION" | "CARGA";
export type EstadoCarga = "PENDIENTE" | "CORRIENDO" | "LISTA" | "ERROR" | "CANCELADA";

/** Prefijo de los ids que una simulación inventa para lo que se crearía. */
export const PREFIJO_SIMULADO = "sim:";
export const esSimulado = (id: string | undefined | null) => typeof id === "string" && id.startsWith(PREFIJO_SIMULADO);
