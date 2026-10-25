"use client";

import {
  disengageSimulatorNavigation,
  engageSimulatorNavigation,
  getSimulatorNavSurface,
  isSimulatorNavEngaged,
  isSimulatorPointerLocked,
} from "@/lib/simulator/simulator-nav-surface";
import {
  registerSimulatorCameraYaw,
  unregisterSimulatorCameraYaw,
} from "@/lib/simulator/simulator-runtime";
import { getSceneMeta } from "@/lib/simulator/scenes";
import { simulatorRuntime } from "@/lib/simulator/simulator-runtime";
import { TOUCH_SPRINT_THRESHOLD, touchInput } from "@/lib/simulator/touch-input";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EYE_HEIGHT, getSimulatorSpawnPose } from "./simulator-camera-constants";

export const CAMERA_HEIGHT_MIN = 0.4;
export const CAMERA_HEIGHT_MAX = 2.75;
export const CAMERA_ROLL_MAX_RAD = THREE.MathUtils.degToRad(45);

const WALK_SPEED = 5.5;
const SPRINT_SPEED = 9.5;
const DAMPING = 9;
const HEIGHT_SPEED = 1.35;
const ROLL_SPEED = 1.15;
const ROLL_EPSILON = 1e-4;
const MAX_PITCH = THREE.MathUtils.degToRad(89);
const MOUSE_SENSITIVITY = 0.002;
/** En el celular el dedo recorre menos: gira un poco más por píxel. */
const TOUCH_LOOK_SENSITIVITY = 0.0042;

const _euler = new THREE.Euler(0, 0, 0, "YXZ");
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();

interface MovementKeys {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  heightUp: boolean;
  heightDown: boolean;
  rollLeft: boolean;
  rollRight: boolean;
}

interface FirstPersonControllerProps {
  onLockChange?: (locked: boolean) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function moveForward(camera: THREE.Camera, distance: number) {
  _forward.setFromMatrixColumn(camera.matrix, 0);
  _forward.crossVectors(camera.up, _forward);
  camera.position.addScaledVector(_forward, distance);
}

function moveRight(camera: THREE.Camera, distance: number) {
  _right.setFromMatrixColumn(camera.matrix, 0);
  camera.position.addScaledVector(_right, distance);
}

function syncCameraRoll(camera: THREE.Camera, euler: THREE.Euler, roll: number) {
  euler.setFromQuaternion(camera.quaternion, "YXZ");
  if (Math.abs(euler.z - roll) < ROLL_EPSILON) return;
  euler.z = roll;
  camera.quaternion.setFromEuler(euler);
}

export function resetCameraPose(camera: THREE.Camera) {
  const spawn = getSimulatorSpawnPose();
  camera.position.set(...spawn.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(...spawn.lookAt);
  camera.updateMatrixWorld();
}

function isCameraOrientationBroken(camera: THREE.Camera, euler: THREE.Euler): boolean {
  if (!Number.isFinite(camera.quaternion.x)) return true;
  euler.setFromQuaternion(camera.quaternion, "YXZ");
  return Math.abs(euler.x) > MAX_PITCH;
}

export default function FirstPersonController({ onLockChange }: FirstPersonControllerProps) {
  const { camera } = useThree();
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const onLockChangeRef = useRef(onLockChange);
  onLockChangeRef.current = onLockChange;

  const engagedRef = useRef(false);
  const mouseDownRef = useRef(false);
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const heightRef = useRef(EYE_HEIGHT);
  const rollRef = useRef(0);
  const eulerRef = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const keys = useRef<MovementKeys>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    heightUp: false,
    heightDown: false,
    rollLeft: false,
    rollRight: false,
  });
  const lastCameraLogMsRef = useRef(0);

  const syncEngagedState = () => {
    const engaged = isSimulatorNavEngaged();
    engagedRef.current = engaged;
    onLockChangeRef.current?.(engaged);
  };

  useEffect(() => {
    heightRef.current = EYE_HEIGHT;
    rollRef.current = 0;
  }, [camera]);

  // Sólo en desarrollo: fijar la altura de la cámara desde la consola o Playwright.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    (globalThis as Record<string, unknown>).__codSetHeight = (h: number) => {
      heightRef.current = THREE.MathUtils.clamp(h, CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX);
    };
  }, []);

  useEffect(() => {
    const euler = eulerRef.current;
    registerSimulatorCameraYaw(() => {
      euler.setFromQuaternion(cameraRef.current.quaternion, "YXZ");
      return euler.y;
    });
    return () => unregisterSimulatorCameraYaw();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const nav = getSimulatorNavSurface();
      if (!nav || event.target !== nav) return;
      // En tercera persona arrastrar gira la vista de afuera: no se traba el mouse.
      if (simulatorRuntime.thirdPerson) return;
      mouseDownRef.current = true;
      void engageSimulatorNavigation().then(() => syncEngagedState());
    };

    const onPointerUp = () => {
      mouseDownRef.current = false;
    };

    const onPointerLockChange = () => {
      const locked = isSimulatorPointerLocked();
      engagedRef.current = isSimulatorNavEngaged();
      onLockChangeRef.current?.(engagedRef.current);

      if (locked && process.env.NODE_ENV === "development") {
        console.info("[Cam Of Duty] PointerLock locked (canvas)");
      }

      if (!locked && !isSimulatorNavEngaged()) {
        const cam = cameraRef.current;
        if (isCameraOrientationBroken(cam, eulerRef.current)) {
          resetCameraPose(cam);
          heightRef.current = EYE_HEIGHT;
          rollRef.current = 0;
        }
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape" && isSimulatorNavEngaged()) {
        disengageSimulatorNavigation();
        engagedRef.current = false;
        onLockChangeRef.current?.(false);
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      const canLook =
        isSimulatorPointerLocked() || (engagedRef.current && mouseDownRef.current);
      if (!canLook || simulatorRuntime.thirdPerson) return;

      const cam = cameraRef.current;
      _euler.setFromQuaternion(cam.quaternion, "YXZ");
      _euler.y -= event.movementX * MOUSE_SENSITIVITY;
      _euler.x -= event.movementY * MOUSE_SENSITIVITY;
      _euler.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, _euler.x));
      cam.quaternion.setFromEuler(_euler);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousemove", onMouseMove);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousemove", onMouseMove);
      disengageSimulatorNavigation();
      engagedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const movementKeyMap: Partial<Record<string, keyof MovementKeys>> = {
      KeyW: "forward",
      KeyS: "backward",
      KeyA: "left",
      KeyD: "right",
      KeyI: "heightUp",
      KeyK: "heightDown",
      KeyJ: "rollLeft",
      KeyL: "rollRight",
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        keys.current.sprint = true;
      }
      const movementKey = movementKeyMap[event.code];
      if (movementKey) {
        keys.current[movementKey] = true;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        keys.current.sprint = false;
      }
      const movementKey = movementKeyMap[event.code];
      if (movementKey) {
        keys.current[movementKey] = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useFrame((_, frameDelta) => {
    // Un cuadro largo (tirón o celular lento) no debe hacer saltar la cámara: el
    // freno se vuelve inestable con pasos de más de un par de décimas.
    const delta = Math.min(frameDelta, 0.05);
    // En tercera persona la cámara la maneja la vista de afuera (el fotógrafo queda quieto).
    if (simulatorRuntime.thirdPerson) return;
    if (process.env.NODE_ENV === "development") {
      const now = performance.now();
      if (now - lastCameraLogMsRef.current > 5000) {
        lastCameraLogMsRef.current = now;
        if (Number.isFinite(camera.position.x)) {
          console.info("[Cam Of Duty] Camera", {
            position: camera.position.toArray(),
            quaternion: camera.quaternion.toArray(),
          });
        }
      }
    }

    // Celular: mirar arrastrando el dedo (lo acumulado desde el último cuadro).
    if (touchInput.lookDX !== 0 || touchInput.lookDY !== 0) {
      _euler.setFromQuaternion(camera.quaternion, "YXZ");
      _euler.y -= touchInput.lookDX * TOUCH_LOOK_SENSITIVITY;
      _euler.x -= touchInput.lookDY * TOUCH_LOOK_SENSITIVITY;
      _euler.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, _euler.x));
      camera.quaternion.setFromEuler(_euler);
      touchInput.lookDX = 0;
      touchInput.lookDY = 0;
    }

    if (engagedRef.current || touchInput.active) {
      const { forward, backward, left, right, sprint, heightUp, heightDown, rollLeft, rollRight } =
        keys.current;
      const stick = Math.hypot(touchInput.moveX, touchInput.moveY);
      const speed = sprint || stick > TOUCH_SPRINT_THRESHOLD ? SPRINT_SPEED : WALK_SPEED;

      velocity.current.x -= velocity.current.x * DAMPING * delta;
      velocity.current.z -= velocity.current.z * DAMPING * delta;

      direction.current.set(0, 0, 0);
      if (forward) direction.current.z += 1;
      if (backward) direction.current.z -= 1;
      if (left) direction.current.x -= 1;
      if (right) direction.current.x += 1;

      if (direction.current.lengthSq() > 0) {
        direction.current.normalize();
      } else if (stick > 0.05) {
        // Joystick: cuanto más se lo empuja, más rápido (hasta caminar normal).
        direction.current.set(touchInput.moveX, 0, touchInput.moveY).multiplyScalar(Math.min(1, stick) / stick);
      }
      if (direction.current.lengthSq() > 0) {
        velocity.current.x -= direction.current.x * speed * delta * 60;
        velocity.current.z -= direction.current.z * speed * delta * 60;
      }

      moveRight(camera, -velocity.current.x * delta);
      moveForward(camera, -velocity.current.z * delta);

      if (heightUp) {
        heightRef.current = Math.min(CAMERA_HEIGHT_MAX, heightRef.current + HEIGHT_SPEED * delta);
      }
      if (heightDown) {
        heightRef.current = Math.max(CAMERA_HEIGHT_MIN, heightRef.current - HEIGHT_SPEED * delta);
      }

      if (rollLeft) {
        rollRef.current = Math.max(-CAMERA_ROLL_MAX_RAD, rollRef.current - ROLL_SPEED * delta);
      }
      if (rollRight) {
        rollRef.current = Math.min(CAMERA_ROLL_MAX_RAD, rollRef.current + ROLL_SPEED * delta);
      }
    }

    const bounds = getSceneMeta(simulatorRuntime.sceneId).bounds;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, bounds.xMin, bounds.xMax);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, bounds.zMin, bounds.zMax);
    // Escenas con edificios: no se los atraviesa, y la vereda levanta el punto de vista.
    const world = simulatorRuntime.walkableWorld;
    if (world) {
      const [x, z] = world.resolve(camera.position.x, camera.position.z);
      camera.position.x = x;
      camera.position.z = z;
    }
    camera.position.y = heightRef.current + (world ? world.groundHeight(camera.position.x, camera.position.z) : 0);

    if (Math.abs(rollRef.current) > ROLL_EPSILON) {
      syncCameraRoll(camera, eulerRef.current, rollRef.current);
    }
  });

  return null;
}

export { EYE_HEIGHT } from "./simulator-camera-constants";
