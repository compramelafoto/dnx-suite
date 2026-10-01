/**
 * Guardián del borrado de las copias de ensayo.
 *
 * Función pura, sin Prisma, deliberadamente aburrida: es lo único que separa a
 * un ensayo de borrar una edición real con toda su gente adentro. Ante
 * cualquier duda, dice que no.
 *
 * El campo `isOpsFixture` del schema ya está documentado como
 * «Edición ops/fixture: nunca comercial. Cleanup solo permitido si true».
 * Este guardián hace cumplir esa regla.
 */

export type EdicionACandidataDeBorrado = {
  id: string;
  nombre: string;
  isOpsFixture: boolean;
  isPublished: boolean;
  cantidadDeInscripciones: number;
  /** Inscripciones creadas por el propio ensayo, que sí se pueden borrar. */
  inscripcionesDelEnsayo?: number;
};

export type VeredictoDeBorrado = { ok: boolean; motivo: string | null };

export function sePuedeDescartar(
  edicion: EdicionACandidataDeBorrado | null | undefined,
): VeredictoDeBorrado {
  if (!edicion) {
    return { ok: false, motivo: "No encontramos la edición que se quería borrar." };
  }

  if (!edicion.isOpsFixture) {
    return {
      ok: false,
      motivo:
        "Esta edición no es una copia de ensayo. El borrado sólo se permite sobre copias descartables, nunca sobre una edición de verdad.",
    };
  }

  if (edicion.isPublished) {
    return {
      ok: false,
      motivo:
        "La copia figura como publicada. Antes de borrarla conviene que alguien la mire: una copia de ensayo nunca debería estar publicada.",
    };
  }

  const ajenas = edicion.cantidadDeInscripciones - (edicion.inscripcionesDelEnsayo ?? 0);
  if (ajenas > 0) {
    return {
      ok: false,
      motivo: `La copia tiene ${ajenas} ${ajenas === 1 ? "inscripción que no es" : "inscripciones que no son"} del ensayo. No se borra nada con gente adentro.`,
    };
  }

  return { ok: true, motivo: null };
}
