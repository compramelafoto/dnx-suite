/**
 * Tipos del ensayo de edición.
 *
 * Nada de Prisma acá: la capa de aplicación lee la base y arma una
 * `FotoDeEdicion`, y estas reglas trabajan sólo sobre esa foto. Así el chequeo
 * se puede probar con un reloj fijo y sin base de datos.
 */

export type Severidad = "BIEN" | "ATENCION" | "BLOQUEANTE";

export type Rubro =
  | "PUBLICACION"
  | "VENTA"
  | "CRONOGRAMA"
  | "CONSIGNAS"
  | "ACREDITACION"
  | "SUBIDA"
  | "ADMISION";

export type Hallazgo = {
  /** Identificador estable del control. Se usa en tests y para deduplicar. */
  id: string;
  rubro: Rubro;
  severidad: Severidad;
  /** Una línea, en castellano, que se lee de un vistazo. */
  titulo: string;
  /** Qué está pasando y qué consecuencia tiene para el participante. */
  detalle: string;
  /** Qué hacer para resolverlo. `null` cuando no hay nada que hacer. */
  comoArreglar: string | null;
  /** Ruta del panel donde se arregla, relativa a la edición. */
  enlace: string | null;
};

export type FaseDePrecio = {
  id: string;
  nombre: string;
  comienzaEl: Date | null;
  terminaEl: Date | null;
};

export type EntradaDeEdicion = {
  id: string;
  nombre: string;
  /** En la unidad que guarda la base (centavos). Cero = gratuita. */
  precio: number;
  agotada: boolean;
  cupo: number | null;
};

/** Estados posibles de una consigna, tal como los guarda la base. */
export type EstadoDeConsigna = "DRAFT" | "READY" | "RELEASED" | "CLOSED" | "CANCELLED";

export type ConsignaDeEdicion = {
  id: string;
  estado: EstadoDeConsigna;
  capturaAbreEl: Date | null;
  capturaCierraEl: Date | null;
  subidaAbreEl: Date | null;
  subidaCierraEl: Date | null;
};

export type EventoDeCronograma = {
  id: string;
  tipo: string;
  comienzaEl: Date | null;
  estado: string;
};

/** Foto de sólo lectura de una edición, suficiente para chequear y ensayar. */
export type FotoDeEdicion = {
  id: string;
  slug: string;
  nombre: string;
  publicada: boolean;
  inscripcionHabilitada: boolean;
  zonaHoraria: string;
  comienzaEl: Date | null;
  terminaEl: Date | null;
  inscripcionAbreEl: Date | null;
  inscripcionCierraEl: Date | null;
  fasesDePrecio: FaseDePrecio[];
  entradas: EntradaDeEdicion[];
  tieneCronogramaActivo: boolean;
  eventos: EventoDeCronograma[];
  consignas: ConsignaDeEdicion[];
  acreditacionHabilitada: boolean;
  hayConfiguracionDeSubida: boolean;
  hayConfiguracionDeAdmision: boolean;
  mercadoPagoConectado: boolean;
};

/** Un paso del recorrido del participante durante el ensayo. */
export type EstadoDePaso = "PASO" | "FALLO" | "NO_CORRESPONDE";

export type ResultadoPaso = {
  numero: number;
  nombre: string;
  estado: EstadoDePaso;
  /** Lo que vería la persona en la pantalla, en sus palabras. */
  queVeria: string;
  detalle: string;
  comoArreglar: string | null;
};

export type ResultadoEnsayo = {
  /** Momento simulado, en ISO. */
  momentoSimulado: string;
  pasos: ResultadoPaso[];
  veredicto: string;
};
