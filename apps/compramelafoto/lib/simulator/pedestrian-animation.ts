import * as THREE from "three";

export function pickWalkClip(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  if (!clips.length) return null;
  return (
    clips.find((clip) => /walk/i.test(clip.name)) ??
    clips.find((clip) => /run/i.test(clip.name)) ??
    clips[0]
  );
}

export function pickIdleClip(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  if (!clips.length) return null;
  return (
    clips.find((clip) => /^idle$/i.test(clip.name)) ??
    clips.find((clip) => /idle/i.test(clip.name)) ??
    clips.find((clip) => /stand/i.test(clip.name)) ??
    null
  );
}

export interface PedestrianClipActions {
  mixer: THREE.AnimationMixer;
  walk: THREE.AnimationAction | null;
  idle: THREE.AnimationAction | null;
}

export function createPedestrianClipActions(
  model: THREE.Object3D,
  clips: THREE.AnimationClip[],
): PedestrianClipActions {
  const mixer = new THREE.AnimationMixer(model);
  const walkClip = pickWalkClip(clips);
  const idleClip = pickIdleClip(clips);

  const walk = walkClip ? mixer.clipAction(walkClip) : null;
  const idle = idleClip ? mixer.clipAction(idleClip) : null;

  if (walk) {
    walk.play();
  }

  return { mixer, walk, idle };
}

/** Pausa breve con idle al invertir sentido en un extremo del recorrido. */
export function beginTurnaroundPause(
  actions: PedestrianClipActions,
  pauseMs = 900,
): number {
  actions.walk?.fadeOut(0.18);
  if (actions.idle) {
    actions.idle.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.18).play();
  }
  return performance.now() + pauseMs;
}

export function resumeWalkAfterPause(actions: PedestrianClipActions): void {
  actions.idle?.fadeOut(0.18);
  if (actions.walk) {
    actions.walk.reset().fadeIn(0.18).play();
  }
}
