import { COD_NAV_SURFACE_SELECTOR } from "@/components/simulator/scene/simulator-camera-constants";

const SIM_CANVAS_SELECTOR = ".cod-sim__canvas";

let registeredNavSurface: HTMLElement | null = null;
let navEngaged = false;

/** Registra la capa de navegación actual (ref callback del viewport). */
export function setSimulatorNavSurface(el: HTMLElement | null) {
  registeredNavSurface = el;
}

export function getSimulatorNavSurface(): HTMLElement | null {
  if (registeredNavSurface?.isConnected) {
    return registeredNavSurface;
  }

  const found = document.querySelector(COD_NAV_SURFACE_SELECTOR);
  registeredNavSurface = found instanceof HTMLElement ? found : null;
  return registeredNavSurface?.isConnected ? registeredNavSurface : null;
}

export function getSimulatorCanvas(): HTMLCanvasElement | null {
  const canvas = document.querySelector(`${SIM_CANVAS_SELECTOR} canvas`);
  return canvas instanceof HTMLCanvasElement && canvas.isConnected ? canvas : null;
}

export function isSimulatorPointerLocked(): boolean {
  const locked = document.pointerLockElement;
  if (!locked) return false;
  const canvas = getSimulatorCanvas();
  const nav = getSimulatorNavSurface();
  return locked === canvas || locked === nav;
}

export function setSimulatorNavEngaged(engaged: boolean) {
  navEngaged = engaged;
}

export function isSimulatorNavEngaged(): boolean {
  return navEngaged || isSimulatorPointerLocked();
}

/** Intenta pointer lock en canvas; si falla, en la capa de navegación. */
export async function requestSimulatorPointerLock(): Promise<boolean> {
  const targets = [getSimulatorCanvas(), getSimulatorNavSurface()].filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.isConnected,
  );

  for (const el of targets) {
    if (document.pointerLockElement === el) return true;
    try {
      await el.requestPointerLock();
      if (document.pointerLockElement === el) return true;
    } catch {
      /* probar siguiente target */
    }
  }
  return false;
}

/** Activa navegación: WASD siempre; pointer lock para mirar con el mouse. */
export async function engageSimulatorNavigation(): Promise<void> {
  setSimulatorNavEngaged(true);
  await requestSimulatorPointerLock();
}

export function disengageSimulatorNavigation() {
  setSimulatorNavEngaged(false);
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
}
