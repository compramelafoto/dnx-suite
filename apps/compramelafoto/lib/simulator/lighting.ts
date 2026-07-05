/**
 * Cam Of Duty — escenarios y condiciones de luz.
 *
 * TODO (etapas futuras):
 * - Contraluces, interiores, exteriores, luz dura y luz suave
 * - Flash sobre cámara y fuera de cámara
 * - Modificadores: pantalla 5 en 1, softbox
 * - Integración con motor de iluminación Three.js
 */

/** Tipos de situación lumínica para entrenamiento. */
export type LightingScenarioType =
  | "backlight"
  | "interior"
  | "exterior"
  | "hard-light"
  | "soft-light";

export interface LightingScenario {
  type: LightingScenarioType;
  name: string;
  description: string;
}

/** Catálogo de escenarios de luz planificados (sin implementación 3D aún). */
export const PLANNED_LIGHTING_SCENARIOS: LightingScenario[] = [
  {
    type: "backlight",
    name: "Contraluz",
    description: "Practicá exponer correctamente con luz de fondo.",
  },
  {
    type: "interior",
    name: "Interior",
    description: "Luz artificial y ventanas en espacios cerrados.",
  },
  {
    type: "exterior",
    name: "Exterior",
    description: "Luz natural en exteriores urbanos y naturales.",
  },
  {
    type: "hard-light",
    name: "Luz dura",
    description: "Sombras marcadas y alto contraste.",
  },
  {
    type: "soft-light",
    name: "Luz suave",
    description: "Transiciones suaves y retratos favorecedores.",
  },
];
