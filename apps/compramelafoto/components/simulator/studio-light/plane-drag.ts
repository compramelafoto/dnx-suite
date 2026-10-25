import * as THREE from "three";

/** Punto del plano bajo el mouse; null si el rayo es casi paralelo o se va lejísimos. */
export function pointOnPlane(
  ev: { clientX: number; clientY: number },
  plane: THREE.Plane,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
): THREE.Vector3 | null {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  if (Math.abs(raycaster.ray.direction.dot(plane.normal)) < 0.06) return null;
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  return hit.distanceTo(camera.position) > 25 ? null : hit;
}

/**
 * Arrastre sobre un plano: llama a onMove con el desplazamiento desde el punto
 * inicial. Escucha toda la ventana para no perder el mouse si sale del objeto.
 * Devuelve false si el plano no se puede usar desde este punto de vista.
 */
export function startPlaneDrag(opts: {
  start: { clientX: number; clientY: number };
  plane: THREE.Plane;
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
  onMove: (delta: THREE.Vector3, hit: THREE.Vector3) => void;
  onEnd: () => void;
}): boolean {
  const startHit = pointOnPlane(opts.start, opts.plane, opts.camera, opts.canvas);
  if (!startHit) return false;
  document.body.style.cursor = "grabbing";
  const move = (ev: PointerEvent) => {
    const hit = pointOnPlane(ev, opts.plane, opts.camera, opts.canvas);
    if (hit) opts.onMove(hit.clone().sub(startHit), hit);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    document.body.style.cursor = "";
    opts.onEnd();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  return true;
}

/** Plano vertical que pasa por `point` y mira a la cámara (para cambiar alturas). */
export function verticalPlaneFacing(camera: THREE.Camera, point: THREE.Vector3): THREE.Plane {
  const normal = new THREE.Vector3().subVectors(camera.position, point).setY(0).normalize();
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
}
