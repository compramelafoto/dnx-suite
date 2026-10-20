import { CANTIDAD_MAX } from "@/lib/impresion/lote";

/** Lo que hace cada tecla en el editor de una foto. */
export type AccionDeTecla = "ANTERIOR" | "SIGUIENTE" | "RECORTAR" | "ENCAJAR" | "CONFIRMAR";

type Tecla = {
  key: string;
  target: { tagName: string; isContentEditable: boolean } | null;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
};

const CAMPOS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
/**
 * Con el foco en un enlace, Enter es del enlace. En un botón (lo normal después de tocar Recortar,
 * Girar 90°…) Enter confirma: quien llama cancela la tecla, así el botón no se vuelve a activar.
 */
const ENLACE = "A";

/**
 * ← → foto anterior / siguiente, R recortar, E encajar, Enter confirma. Nada mientras se escribe
 * en un campo (cantidad, color, deslizadores), con Ctrl/Cmd/Alt (atajos del navegador) ni al
 * sostener la tecla (no saltea fotos ni confirma varias veces). Quien llama hace `preventDefault`
 * de toda tecla con acción.
 */
export function accionDeTecla(e: Tecla, pos: { primera: boolean; ultima: boolean }): AccionDeTecla | null {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null;
  const t = e.target;
  if (t && (CAMPOS.has(t.tagName) || t.isContentEditable)) return null;
  switch (e.key) {
    case "ArrowLeft":
      return pos.primera ? null : "ANTERIOR";
    case "ArrowRight":
      return pos.ultima ? null : "SIGUIENTE";
    case "r":
    case "R":
      return "RECORTAR";
    case "e":
    case "E":
      return "ENCAJAR";
    case "Enter":
      return t?.tagName === ENLACE ? null : "CONFIRMAR";
    default:
      return null;
  }
}

/** La cantidad de copias de lo que se escribió: entera, entre 1 y `CANTIDAD_MAX`. */
export function cantidadDesdeTexto(texto: string): number {
  const n = Math.round(Number(texto));
  return Number.isFinite(n) && n >= 1 ? Math.min(CANTIDAD_MAX, n) : 1;
}
