/**
 * Bicis, monopatines y motos de la Calle 3D: modelos de Sketchfab (CC BY 4.0,
 * ver CREDITOS.md) optimizados con scripts/camofduty/optimize-street-cars.mjs.
 *
 * Como los autos, cada modelo se lleva a su medida real al cargarlo (`yawDeg`
 * deja el frente en +Z, `lengthM` es el largo de punta a punta). Además cada
 * uno dice dónde se sienta la persona, dónde agarra el manubrio y dónde apoya
 * los pies, en metros del modelo ya normalizado (frente +Z, piso y = 0, centro
 * del largo en z = 0). Con eso se posan piernas y brazos.
 */

export type RideKind = "bike" | "kick" | "moto" | "scooter";

export type V3 = [number, number, number];

export interface RideRig {
  /** Dónde va la cadera (pelvis) de quien maneja. En el monopatín va parado. */
  seat: [number, number];
  /** Puños del manubrio: altura, adelante y media separación. */
  grip: [number, number, number];
  /** Pies: centro del pedalier (bici) o de los apoyapiés: altura, adelante y media separación. */
  feet: [number, number, number];
  /** Largo de la biela (bici): radio del círculo de los pedales. */
  crank?: number;
  /** Inclinación del torso hacia adelante (grados). */
  lean: number;
}

export interface StreetRideModel {
  id: string;
  label: string;
  kind: RideKind;
  yawDeg: number;
  lengthM: number;
  /** Radio de la rueda (m): marca el ritmo del pedaleo. */
  wheelRadius: number;
  rig: RideRig;
}

export const STREET_RIDES: StreetRideModel[] = [
  {
    id: "bici-clasica",
    label: "Bicicleta",
    kind: "bike",
    yawDeg: 0,
    lengthM: 1.75,
    wheelRadius: 0.34,
    rig: { seat: [0.98, -0.3], grip: [1.04, 0.42, 0.27], feet: [0.3, -0.03, 0.12], crank: 0.17, lean: 32 },
  },
  {
    id: "bici-amarilla",
    label: "Bicicleta playera",
    kind: "bike",
    yawDeg: -90,
    lengthM: 1.85,
    wheelRadius: 0.35,
    rig: { seat: [0.98, -0.28], grip: [1.08, 0.46, 0.3], feet: [0.3, 0.02, 0.12], crank: 0.17, lean: 16 },
  },
  {
    id: "triciclo",
    label: "Triciclo",
    kind: "bike",
    yawDeg: -90,
    lengthM: 1.65,
    wheelRadius: 0.3,
    rig: { seat: [0.92, -0.18], grip: [1.02, 0.42, 0.28], feet: [0.28, 0.12, 0.12], crank: 0.16, lean: 18 },
  },
  {
    id: "monopatin-xiaomi",
    label: "Monopatín eléctrico",
    kind: "kick",
    yawDeg: 0,
    lengthM: 1.1,
    wheelRadius: 0.11,
    rig: { seat: [0, 0.12], grip: [1.12, 0.46, 0.24], feet: [0.13, 0.04, 0.1], lean: 12 },
  },
  {
    id: "honda-cb750",
    label: "Honda CB 750",
    kind: "moto",
    yawDeg: 0,
    lengthM: 2.15,
    wheelRadius: 0.33,
    rig: { seat: [0.84, -0.22], grip: [1.02, 0.38, 0.34], feet: [0.36, -0.12, 0.2], lean: 38 },
  },
  {
    id: "moto-si",
    label: "Motomel SI",
    kind: "moto",
    yawDeg: 0,
    lengthM: 1.75,
    wheelRadius: 0.3,
    rig: { seat: [0.8, -0.26], grip: [1.02, 0.42, 0.3], feet: [0.3, 0.02, 0.14], lean: 20 },
  },
  {
    id: "yamaha-xmax",
    label: "Yamaha XMAX",
    kind: "scooter",
    yawDeg: 0,
    lengthM: 2.2,
    wheelRadius: 0.3,
    rig: { seat: [0.84, -0.3], grip: [1.08, 0.44, 0.34], feet: [0.4, 0.18, 0.16], lean: 14 },
  },
  {
    id: "suzuki-skywave",
    label: "Suzuki Skywave",
    kind: "scooter",
    yawDeg: 180,
    lengthM: 2.25,
    wheelRadius: 0.3,
    rig: { seat: [0.78, -0.3], grip: [1.02, 0.4, 0.34], feet: [0.38, 0.18, 0.16], lean: 14 },
  },
  {
    id: "vespa",
    label: "Vespa",
    kind: "scooter",
    yawDeg: -90,
    lengthM: 1.8,
    wheelRadius: 0.22,
    rig: { seat: [0.82, -0.25], grip: [1.02, 0.42, 0.32], feet: [0.32, 0.2, 0.14], lean: 12 },
  },
];

export function streetRideUrl(model: StreetRideModel): string {
  return `/camofduty/street/models/rides/${model.id}.glb`;
}

/** Las que van por la orilla de la calzada (bicis y monopatines) y las que van con los autos. */
export const CURB_RIDES = STREET_RIDES.filter((r) => r.kind === "bike" || r.kind === "kick");
export const MOTOR_RIDES = STREET_RIDES.filter((r) => r.kind === "moto" || r.kind === "scooter");

/** Velocidad deseada (m/s) según el tipo y un número entre 0 y 1. */
export function rideSpeed(kind: RideKind, r: number): number {
  if (kind === "bike") return 4 + r * 2;
  if (kind === "kick") return 4.2 + r * 1.3;
  return 10 + r * 3;
}

/**
 * Pedales de la bici: posición (en el modelo) de cada pie para un ángulo de
 * biela. Los dos van opuestos (medio giro) y a cada lado del cuadro.
 */
export function pedalPositions(rig: RideRig, angle: number): { left: V3; right: V3 } {
  const [y, z, half] = rig.feet;
  const r = rig.crank ?? 0;
  const at = (a: number, side: 1 | -1): V3 => [side * half, y + r * Math.sin(a), z + r * Math.cos(a)];
  // +X es la izquierda de quien maneja (mira a +Z).
  return { left: at(angle, 1), right: at(angle + Math.PI, -1) };
}

/** Cuánto gira la biela por metro recorrido (relación de cambio de paseo, ~2,4). */
export function crankRadiansPerMeter(model: StreetRideModel): number {
  return 1 / (model.wheelRadius * 2.4);
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.sqrt(dot(a, a));
const norm = (a: V3): V3 => scale(a, 1 / (len(a) || 1));

/**
 * Cinemática inversa de dos huesos (muslo y pantorrilla, o brazo y antebrazo):
 * dónde queda la articulación del medio (rodilla, codo) para que la punta
 * llegue a `target` desde `root`. `pole` indica hacia dónde se dobla. Si no
 * alcanza, estira todo hacia el objetivo.
 */
export function twoBoneJoint(root: V3, target: V3, upper: number, lower: number, pole: V3): V3 {
  const toTarget = sub(target, root);
  const d = Math.min(len(toTarget), (upper + lower) * 0.999);
  const dir = norm(toTarget);
  // Ley del coseno: distancia de la raíz al pie de la altura sobre el eje.
  const a = (upper * upper - lower * lower + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  // Dirección de doblez: el polo, sin su componente sobre el eje.
  let bend = sub(pole, scale(dir, dot(pole, dir)));
  if (len(bend) < 1e-6) bend = [0, 1, 0];
  return add(add(root, scale(dir, a)), scale(norm(bend), h));
}
