/**
 * Clima de la Calle 3D: soleado, nublado o lluvia (la noche la da la hora).
 *
 * El fotómetro lee el brillo de lo que se dibuja contra una tabla calibrada
 * con sol, así que alcanza con que la escena se dibuje más oscura: nublado
 * queda ~3 pasos abajo del sol pleno (f/8 en lugar de f/16, como la regla del
 * "sol 16") y la lluvia ~4.
 */

export type WeatherId = "sunny" | "cloudy" | "rain";

export interface WeatherLook {
  label: string;
  hint: string;
  /** Multiplicador del sol directo (sombras duras). */
  sun: number;
  /** 0 = cielo despejado; 1 = cielo cubierto gris. */
  overcast: number;
  /** Luz del cielo (entorno) respecto del día despejado. */
  sky: number;
  /** Bruma más cerrada con lluvia. */
  fogNear: number;
  fogFar: number;
  /** 0–1: cuánta lluvia cae. */
  rain: number;
  /** 0–1: piso mojado (más oscuro y brillante). */
  wet: number;
  /** Pasos de luz por debajo del sol pleno (lo que debería medir el fotómetro). */
  evDrop: number;
}

export const WEATHER_LOOKS: Record<WeatherId, WeatherLook> = {
  sunny: { label: "Soleado", hint: "Sombras duras y contraste alto.", sun: 1, overcast: 0, sky: 1, fogNear: 45, fogFar: 190, rain: 0, wet: 0, evDrop: 0 },
  // Sin sol directo: la luz viene de todo el cielo y sólo quedan sombras suaves de
  // contacto. El aire no se pone brumoso por estar nublado (eso parecía niebla).
  cloudy: { label: "Nublado", hint: "Luz suave y pareja, sin sombras marcadas: ~3 pasos menos.", sun: 0, overcast: 1, sky: 0.55, fogNear: 45, fogFar: 190, rain: 0, wet: 0, evDrop: 3 },
  rain: { label: "Lluvia", hint: "Cielo plomizo, piso mojado y gotas: probá tiempos de exposición largos.", sun: 0, overcast: 1, sky: 0.36, fogNear: 40, fogFar: 175, rain: 1, wet: 1, evDrop: 4 },
};

export const WEATHER_IDS = Object.keys(WEATHER_LOOKS) as WeatherId[];

export function isWeatherId(id: unknown): id is WeatherId {
  return typeof id === "string" && id in WEATHER_LOOKS;
}

let current: WeatherId = "sunny";
const listeners = new Set<() => void>();

/** Almacén chico, sin React: lo leen la escena (cada cuadro) y el panel. */
export const weatherStore = {
  get(): WeatherId {
    return current;
  },
  set(id: WeatherId) {
    if (id === current) return;
    current = id;
    for (const l of listeners) l();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
