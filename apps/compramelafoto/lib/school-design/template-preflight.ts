/**
 * En legacy existía un módulo `template-preflight` no cableado al flujo principal.
 * La validación/render base vive en `build-preflight.ts` + `render-composite.ts`.
 * No importar este archivo desde el pipeline obligatorio.
 */
export {};
