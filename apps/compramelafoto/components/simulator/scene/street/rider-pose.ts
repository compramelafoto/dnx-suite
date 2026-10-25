"use client";

import { pedalPositions, twoBoneJoint, type StreetRideModel, type V3 } from "@/lib/simulator/street/street-rides";
import * as THREE from "three";

/**
 * Postura de quien anda en bici, monopatín o moto: sentado (o parado en el
 * monopatín), el torso inclinado, las manos en los puños y los pies en los
 * pedales o los apoyapiés. Piernas y brazos se resuelven con cinemática
 * inversa de dos huesos en el marco del rodado (frente +Z, piso y = 0).
 */

const DEG = Math.PI / 180;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _t = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qFrame = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();
const _inv = new THREE.Matrix4();

interface Limb {
  upper: THREE.Bone;
  lower: THREE.Bone;
  end: THREE.Bone;
  upperLen: number;
  lowerLen: number;
}

export interface Rider {
  ride: StreetRideModel;
  /** El rodado (marco de referencia) y el avatar que va encima. */
  frame: THREE.Object3D;
  avatar: THREE.Object3D;
  legs: { left: Limb; right: Limb };
  rest: Map<THREE.Bone, THREE.Quaternion>;
  /** Ángulo de la biela (bici). */
  crank: number;
}

function bone(model: THREE.Object3D, name: string): THREE.Bone {
  const b = model.getObjectByName(`Bip01_${name}`) as THREE.Bone | undefined;
  if (!b) throw new Error(`Falta el hueso ${name}`);
  return b;
}

/** Posición de un hueso en el marco del rodado. */
function inFrame(frame: THREE.Object3D, o: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
  _inv.copy(frame.matrixWorld).invert();
  return o.getWorldPosition(out).applyMatrix4(_inv);
}

/** Aplica a un hueso una rotación expresada en el marco del rodado. */
function rotateInFrame(frame: THREE.Object3D, b: THREE.Bone, q: THREE.Quaternion) {
  if (!b.parent) return;
  frame.getWorldQuaternion(_qFrame).invert();
  b.parent.getWorldQuaternion(_qParent).premultiply(_qFrame);
  b.quaternion.premultiply(_qParent).premultiply(q).premultiply(_qParent.invert());
  b.updateMatrixWorld(true);
}

/** Gira `b` para que su hijo `child` quede en la dirección de `target` (marco del rodado). */
function aim(frame: THREE.Object3D, b: THREE.Bone, child: THREE.Object3D, target: THREE.Vector3) {
  inFrame(frame, b, _a);
  inFrame(frame, child, _b);
  const current = _b.sub(_a).normalize();
  const wanted = _t.copy(target).sub(_a).normalize();
  rotateInFrame(frame, b, _q.setFromUnitVectors(current, wanted));
}

function limb(model: THREE.Object3D, upper: string, lower: string, end: string): Limb {
  const u = bone(model, upper);
  const l = bone(model, lower);
  const e = bone(model, end);
  const p = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
  return { upper: u, lower: l, end: e, upperLen: p(u).distanceTo(p(l)), lowerLen: p(l).distanceTo(p(e)) };
}

const v3 = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];

/** Pone muslo y pantorrilla para que el tobillo llegue a `foot`, con la rodilla hacia `pole`. */
function solve(frame: THREE.Object3D, l: Limb, foot: V3, pole: V3) {
  const root = v3(inFrame(frame, l.upper, _a));
  const joint = twoBoneJoint(root, foot, l.upperLen, l.lowerLen, pole);
  aim(frame, l.upper, l.lower, new THREE.Vector3(...joint));
  aim(frame, l.lower, l.end, new THREE.Vector3(...foot));
}

/**
 * Sube al avatar al rodado y lo deja en postura. `avatar` es el grupo de
 * instantiateAvatar (pies en y = 0, mira a +Z); queda como hijo de `frame`.
 */
export function mountRider(frame: THREE.Object3D, avatar: THREE.Object3D, ride: StreetRideModel): Rider {
  frame.add(avatar);
  avatar.position.set(0, 0, 0);
  frame.updateMatrixWorld(true);
  const rest = new Map<THREE.Bone, THREE.Quaternion>();
  avatar.traverse((o) => {
    if ((o as THREE.Bone).isBone) rest.set(o as THREE.Bone, (o as THREE.Bone).quaternion.clone());
  });
  const rider: Rider = {
    ride,
    frame,
    avatar,
    legs: { left: limb(avatar, "L_Thigh", "L_Calf", "L_Foot"), right: limb(avatar, "R_Thigh", "R_Calf", "R_Foot") },
    rest,
    crank: Math.random() * Math.PI * 2,
  };

  const { rig, kind } = ride;
  // Altura: la pelvis sobre el asiento; en el monopatín, los pies sobre la tabla.
  const pelvis = bone(avatar, "Pelvis");
  const p = inFrame(frame, pelvis, new THREE.Vector3());
  if (kind === "kick") avatar.position.set(-p.x, rig.feet[0], rig.seat[1] - p.z);
  else avatar.position.set(-p.x, rig.seat[0] - p.y, rig.seat[1] - p.z);
  frame.updateMatrixWorld(true);

  // Torso hacia adelante desde la base de la columna y la cabeza que vuelve a mirar al frente.
  const x = new THREE.Vector3(1, 0, 0);
  rotateInFrame(frame, bone(avatar, "Spine"), new THREE.Quaternion().setFromAxisAngle(x, rig.lean * DEG));
  const neck = avatar.getObjectByName("Bip01_Neck") as THREE.Bone | undefined;
  if (neck) rotateInFrame(frame, neck, new THREE.Quaternion().setFromAxisAngle(x, -rig.lean * 0.6 * DEG));

  // Manos en los puños, con los codos un poco hacia afuera y abajo.
  const [gy, gz, gHalf] = rig.grip;
  for (const side of [1, -1] as const) {
    const s = side === 1 ? "L" : "R";
    const arm = limb(avatar, `${s}_UpperArm`, `${s}_Forearm`, `${s}_Hand`);
    solve(frame, arm, [side * gHalf, gy, gz], [side * 0.8, -0.6, -0.4]);
  }
  poseLegs(rider);
  return rider;
}

/** Piernas: pedaleando (bici), en los apoyapiés (moto) o paradas en la tabla (monopatín). */
function poseLegs(r: Rider) {
  const { rig, kind } = r.ride;
  const { left, right } = r.legs;
  for (const l of [left, right]) {
    l.upper.quaternion.copy(r.rest.get(l.upper)!);
    l.lower.quaternion.copy(r.rest.get(l.lower)!);
  }
  r.avatar.updateMatrixWorld(true);
  if (kind === "bike") {
    const pedals = pedalPositions(rig, r.crank);
    solve(r.frame, left, pedals.left, [0.15, 0.3, 1]);
    solve(r.frame, right, pedals.right, [-0.15, 0.3, 1]);
    return;
  }
  const [fy, fz, half] = rig.feet;
  if (kind === "kick") {
    // Un pie adelante y otro atrás sobre la tabla, rodillas apenas flojas.
    solve(r.frame, left, [0.06, fy + 0.08, fz + 0.18], [0, 0, 1]);
    solve(r.frame, right, [-0.06, fy + 0.08, fz - 0.12], [0, 0, 1]);
    return;
  }
  // Moto y scooter: rodillas adelante y un poco abiertas.
  solve(r.frame, left, [half, fy + 0.08, fz], [0.4, 0.4, 1]);
  solve(r.frame, right, [-half, fy + 0.08, fz], [-0.4, 0.4, 1]);
}

/** Avanza el pedaleo según los metros recorridos (sólo las bicis mueven las piernas). */
export function pedal(r: Rider, meters: number, radiansPerMeter: number) {
  if (r.ride.kind !== "bike" || meters <= 0) return;
  r.crank += meters * radiansPerMeter;
  r.frame.updateMatrixWorld(true);
  poseLegs(r);
}
