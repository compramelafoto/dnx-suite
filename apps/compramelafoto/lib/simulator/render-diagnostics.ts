/**
 * Diagnóstico del render para probar en teléfonos reales (`?diag=1`): qué chip
 * gráfico hay, sus límites y qué materiales no se pudieron dibujar.
 */

import type * as THREE from "three";

export interface RenderDiagnostics {
  gpu: string;
  limits: Record<string, number | boolean>;
  failures: string[];
  contextLost: boolean;
}

let state: RenderDiagnostics | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const renderDiagnostics = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get(): RenderDiagnostics | null {
    return state;
  },
};

export function diagnosticsRequested(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("diag") === "1";
}

/** Primer renglón útil del error de un shader (los registros completos son larguísimos). */
function firstError(log: string | null): string {
  const line = (log ?? "").split("\n").find((l) => /error/i.test(l)) ?? (log ?? "").trim().split("\n")[0] ?? "";
  return line.slice(0, 160);
}

/** Lee los límites del chip y engancha los errores de compilación de three.js. */
export function installRenderDiagnostics(renderer: THREE.WebGLRenderer) {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  state = {
    gpu,
    limits: {
      varyings: gl.getParameter(gl.MAX_VARYING_VECTORS),
      uniformesFrag: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      uniformesVert: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      texturas: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      texturasVert: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
      ladoTextura: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      float32: renderer.extensions.has("EXT_color_buffer_float"),
      float16: renderer.extensions.has("EXT_color_buffer_half_float"),
      precisionAlta: (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision ?? 0) > 0,
    },
    failures: [],
    contextLost: false,
  };
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (ctx, program, vertex, fragment) => {
    const msg =
      firstError(ctx.getProgramInfoLog(program)) ||
      firstError(ctx.getShaderInfoLog(vertex)) ||
      firstError(ctx.getShaderInfoLog(fragment)) ||
      "falló sin mensaje";
    if (state && !state.failures.includes(msg)) state = { ...state, failures: [...state.failures, msg] };
    emit();
  };
  renderer.domElement.addEventListener("webglcontextlost", () => {
    if (state) state = { ...state, contextLost: true };
    emit();
  });
  emit();
}
