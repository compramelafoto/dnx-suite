/**
 * Quién puede abrir la pantalla "en vivo" de una inscripción.
 *
 * Regla de siempre: sólo su dueño, por usuario o por correo.
 *
 * Excepción para el ensayo de edición: un administrador puede mirar la pantalla
 * del participante ficticio para comprobar con sus propios ojos qué ve la
 * gente. La excepción vale **únicamente** si la edición está marcada como copia
 * de ensayo (`isOpsFixture`), que es una edición creada y borrada por la propia
 * herramienta. Sobre una inscripción de una persona real, un administrador no
 * entra: el panel tiene sus propias pantallas para eso.
 */

export type ActorDePantalla = {
  actorId: number;
  actorEmail: string;
  esAdmin: boolean;
};

export type InscripcionMirada = {
  userId: number | null;
  email: string;
  edicionEsCopiaDeEnsayo: boolean;
};

export function puedeVerLaPantallaDelParticipante(
  actor: ActorDePantalla,
  inscripcion: InscripcionMirada,
): boolean {
  const esElDueno =
    inscripcion.userId === actor.actorId ||
    inscripcion.email.trim().toLowerCase() === actor.actorEmail.trim().toLowerCase();

  if (esElDueno) return true;

  return actor.esAdmin && inscripcion.edicionEsCopiaDeEnsayo;
}
