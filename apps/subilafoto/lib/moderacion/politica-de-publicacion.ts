import type { Estado } from "./reglas";

/**
 * Qué estado le queda a la foto después de que decide la moderación.
 *
 * **Decisión del titular, 2026-10-09: sin cola de revisión manual.** Lo que Amazon no
 * bloquea con certeza, se publica. Vale tanto para lo dudoso como para cuando Amazon no
 * contesta.
 *
 * Lo que eso significa, dicho sin vueltas:
 *
 * - Una foto que Amazon marcó dudosa se proyecta en la pared del salón **sin que nadie
 *   la haya mirado**.
 * - Mientras Amazon esté caído —como desde el 2026-10-06, por la cuenta suspendida— no
 *   hay ninguna moderación: se publica todo.
 *
 * El titular lo pidió sabiendo esto. Antes el sistema fallaba cerrado y el resultado era
 * una pantalla vacía toda la noche, que para una fiesta es peor.
 *
 * **Lo que Amazon bloquea con certeza sigue bloqueado.** Esa es la moderación que él
 * quiso conservar, y es la única línea que esta función no cruza.
 *
 * El veredicto crudo de Amazon se sigue guardando entero en
 * `SubilafotoModerationDecision`: acá sólo se decide qué ve el salón, no se borra lo que
 * la máquina dijo. Sin eso no habría forma de revisar después qué pasó esa noche.
 */
export function estadoAlPublicar(
  decision: Estado,
  contexto?: {
    /**
     * Si se pudieron leer los bytes de la foto.
     *
     * **La política es sobre la moderación, no sobre nuestro propio almacenamiento.**
     * Si no pudimos bajar el archivo no hay nada que publicar: sin bytes no se genera
     * la versión reducida, y la pantalla no proyecta fotos sin versión. Publicarla
     * sería anotar como visible algo que nadie va a ver nunca.
     */
    seLeyoElArchivo?: boolean;
  },
): Estado {
  if (decision === "BLOCKED") return "BLOCKED";
  if (contexto?.seLeyoElArchivo === false) return "REVIEW_REQUIRED";
  return "APPROVED";
}
