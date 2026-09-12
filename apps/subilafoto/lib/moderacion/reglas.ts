/**
 * Qué se hace con lo que devuelve la moderación automática.
 *
 * Es una función pura: recibe las etiquetas del proveedor y el perfil del
 * evento, y devuelve una decisión. No habla con la base ni con Amazon. Toda la
 * política de la plataforma vive acá, y por eso se puede leer, discutir y
 * probar sin levantar nada.
 *
 * La regla que manda sobre todas: **ante la duda, no se publica.**
 */

/** Cambiala cada vez que cambien los umbrales. Queda guardada en cada decisión. */
export const VERSION_DE_POLITICA = "2026-09-12.1";

export const PERFILES = ["FAMILIAR", "SOCIAL", "EMPRESARIAL"] as const;
export type Perfil = (typeof PERFILES)[number];

export type Etiqueta = {
  /** Nombre tal cual lo devuelve el proveedor. */
  nombre: string;
  /** Confianza de 0 a 100. */
  confianza: number;
};

export type Estado = "APPROVED" | "REVIEW_REQUIRED" | "BLOCKED";

export type Decision = {
  estado: Estado;
  /** La etiqueta que causó la decisión. Nulo si se aprobó sin objeciones. */
  motivo: string | null;
  confianza: number | null;
  versionDePolitica: string;
};

/**
 * Lo que no se proyecta en ninguna fiesta, sea del tipo que sea.
 *
 * No depende del perfil a propósito: el perfil sirve para graduar lo discutible
 * —una copa de vino, una malla— no para habilitar esto.
 */
export const CATEGORIAS_DE_RIESGO_ALTO = [
  "Explicit",
  "Non-Explicit Nudity of Intimate parts and Kissing",
  "Violence",
  "Visually Disturbing",
  "Hate Symbols",
] as const;

/** Umbrales de confianza, en porcentaje. `null` significa "no se controla". */
type Umbral = { bloquear: number | null; revisar: number };

/** Riesgo alto: se bloquea apenas hay señal y se revisa aunque la señal sea débil. */
const UMBRAL_DE_RIESGO_ALTO: Umbral = { bloquear: 50, revisar: 25 };

/**
 * Lo discutible, por perfil.
 *
 * FAMILIAR es un cumpleaños infantil o una comunión: hay chicos mirando la
 * pantalla. SOCIAL es un casamiento o un cumpleaños de quince, donde una copa
 * es parte del evento. EMPRESARIAL es un congreso: nadie se juega el puesto por
 * una foto proyectada.
 */
const UMBRALES: Record<Perfil, Record<string, Umbral>> = {
  FAMILIAR: {
    "Swimwear or Underwear": { bloquear: 90, revisar: 60 },
    "Drugs & Tobacco": { bloquear: 80, revisar: 50 },
    Alcohol: { bloquear: null, revisar: 80 },
    "Rude Gestures": { bloquear: 90, revisar: 60 },
    Gambling: { bloquear: null, revisar: 70 },
  },
  SOCIAL: {
    "Swimwear or Underwear": { bloquear: 95, revisar: 85 },
    "Drugs & Tobacco": { bloquear: 90, revisar: 70 },
    // El alcohol no se controla: en un casamiento, brindar es el evento.
    Alcohol: { bloquear: null, revisar: 101 },
    "Rude Gestures": { bloquear: 98, revisar: 85 },
    Gambling: { bloquear: null, revisar: 101 },
  },
  EMPRESARIAL: {
    "Swimwear or Underwear": { bloquear: 90, revisar: 60 },
    "Drugs & Tobacco": { bloquear: 85, revisar: 60 },
    Alcohol: { bloquear: null, revisar: 90 },
    "Rude Gestures": { bloquear: 95, revisar: 70 },
    Gambling: { bloquear: null, revisar: 80 },
  },
};

/**
 * Una categoría que la política no contempla, con esta confianza o más, va a
 * revisión en lugar de aprobarse.
 *
 * Amazon agrega categorías cuando publica un modelo nuevo. Sin esto, la primera
 * foto de una categoría que todavía no evaluamos se publicaría sola.
 */
const CONFIANZA_DE_LO_DESCONOCIDO = 80;

const SEVERIDAD: Record<Estado, number> = {
  APPROVED: 0,
  REVIEW_REQUIRED: 1,
  BLOCKED: 2,
};

function evaluar(etiqueta: Etiqueta, perfil: Perfil): Estado {
  const esDeRiesgoAlto = (CATEGORIAS_DE_RIESGO_ALTO as readonly string[]).includes(
    etiqueta.nombre,
  );
  const umbral = esDeRiesgoAlto ? UMBRAL_DE_RIESGO_ALTO : UMBRALES[perfil][etiqueta.nombre];

  if (!umbral) {
    return etiqueta.confianza >= CONFIANZA_DE_LO_DESCONOCIDO ? "REVIEW_REQUIRED" : "APPROVED";
  }
  if (umbral.bloquear !== null && etiqueta.confianza >= umbral.bloquear) return "BLOCKED";
  if (etiqueta.confianza >= umbral.revisar) return "REVIEW_REQUIRED";
  return "APPROVED";
}

/**
 * Decide qué pasa con una foto.
 *
 * Gana siempre la etiqueta más severa: alcanza con una para retener o bloquear,
 * por más que las otras nueve estén bien.
 */
export function decidir(etiquetas: readonly Etiqueta[], perfil: Perfil): Decision {
  let estado: Estado = "APPROVED";
  let culpable: Etiqueta | null = null;

  for (const etiqueta of etiquetas) {
    const resultado = evaluar(etiqueta, perfil);
    if (SEVERIDAD[resultado] > SEVERIDAD[estado]) {
      estado = resultado;
      culpable = etiqueta;
    }
  }

  return {
    estado,
    motivo: culpable?.nombre ?? null,
    confianza: culpable?.confianza ?? null,
    versionDePolitica: VERSION_DE_POLITICA,
  };
}

/** Lo que devuelve el proveedor de moderación, ya normalizado. */
export type ResultadoDeAnalisis =
  | { ok: true; etiquetas: readonly Etiqueta[] }
  | { ok: false; codigoDeError: string };

/**
 * Decide a partir del resultado del proveedor, contemplando que haya fallado.
 *
 * **Falla cerrada.** Si el análisis no se pudo hacer, la foto queda retenida y
 * nunca aprobada. Retenida y no bloqueada, que no es lo mismo: bloqueada es una
 * acusación y retenida es "todavía no la miramos". Si Amazon se cae una noche,
 * el fotógrafo revisa a mano; lo que no puede pasar es que se proyecte algo que
 * nadie evaluó.
 */
export function decidirDesdeElAnalisis(
  resultado: ResultadoDeAnalisis,
  perfil: Perfil,
): Decision {
  if (!resultado.ok) {
    return {
      estado: "REVIEW_REQUIRED",
      motivo: `error:${resultado.codigoDeError}`,
      confianza: null,
      versionDePolitica: VERSION_DE_POLITICA,
    };
  }
  return decidir(resultado.etiquetas, perfil);
}
