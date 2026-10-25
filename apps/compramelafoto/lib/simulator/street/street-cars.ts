/**
 * Autos de la Calle 3D: modelos de Sketchfab (CC BY 4.0, ver CREDITOS.md)
 * optimizados con scripts/camofduty/optimize-street-cars.mjs.
 *
 * Cada modelo viene con su escala (metros, centímetros o lo que sea) y su
 * orientación. Al cargarlo se lleva a la medida real: `yawDeg` lo gira para
 * que el frente mire a +Z y `lengthM` es el largo de fábrica del auto.
 */

export interface StreetCarModel {
  id: string;
  label: string;
  /** Giro (grados, eje vertical) que deja el frente mirando a +Z. */
  yawDeg: number;
  /** Largo real (m). */
  lengthM: number;
}

export const STREET_CARS: StreetCarModel[] = [
  { id: "fiat-uno-1994", label: "Fiat Uno", yawDeg: 90, lengthM: 3.65 },
  { id: "volkswagen-golf-ii", label: "Volkswagen Golf II", yawDeg: 0, lengthM: 3.98 },
  { id: "fiat-uno-2001", label: "Fiat Uno", yawDeg: 0, lengthM: 3.69 },
  { id: "2000-dacia-sandero", label: "Renault Sandero", yawDeg: 0, lengthM: 4.02 },
  { id: "2016-volkswagen-polo", label: "Volkswagen Polo", yawDeg: 180, lengthM: 3.97 },
  { id: "ford-ranger-2002", label: "Ford Ranger", yawDeg: 0, lengthM: 4.95 },
  { id: "renault-12", label: "Renault 12", yawDeg: -90, lengthM: 4.34 },
  { id: "ford-falcon", label: "Ford Falcon", yawDeg: 0, lengthM: 4.9 },
  { id: "peugeot-504", label: "Peugeot 504 rural", yawDeg: -90, lengthM: 4.8 },
  { id: "renault-logan", label: "Renault Logan", yawDeg: 0, lengthM: 4.25 },
  { id: "ford-focus", label: "Ford Focus", yawDeg: 0, lengthM: 4.36 },
  { id: "peugeot-405", label: "Peugeot 405", yawDeg: 0, lengthM: 4.41 },
  { id: "renault-duster", label: "Renault Duster", yawDeg: 0, lengthM: 4.31 },
];

export function streetCarUrl(model: StreetCarModel): string {
  return `/camofduty/street/models/cars/${model.id}.glb`;
}

/** Modelo para el auto número `index` (reparte sin repetir hasta agotar la lista). */
export function streetCarFor(index: number): StreetCarModel {
  return STREET_CARS[(index * 5 + 2) % STREET_CARS.length];
}
