import { editionVigencyScore } from "@/lib/public-store/resolve-store-slug";

/**
 * A dónde aterriza quien llega por un link de invitación.
 *
 * Reusa el criterio de vigencia del storefront en lugar de inventar una
 * segunda definición de "la edición actual", que se desincronizaría.
 */

export type EdicionCandidata = {
  slug: string;
  isPublished: boolean;
  registrationEnabled: boolean;
  status: string;
  isOpsFixture: boolean;
};

const LISTADO = "/maratones";

export function destinoDeLaInvitacion(candidatas: readonly EdicionCandidata[]): string {
  // Una edición oculta de prueba cobra de verdad por Mercado Pago: un
  // invitado real no puede aterrizar ahí.
  const publicas = candidatas.filter((e) => e.isPublished && !e.isOpsFixture);
  if (publicas.length === 0) return LISTADO;

  const [ganadora] = [...publicas].sort(
    (a, b) => editionVigencyScore(b) - editionVigencyScore(a),
  );
  if (!ganadora) return LISTADO;

  // Con la inscripción cerrada, mejor que vea de qué se trata a que choque
  // contra un formulario que no lo va a dejar pasar.
  return ganadora.registrationEnabled
    ? `${LISTADO}/${ganadora.slug}/inscripcion`
    : `${LISTADO}/${ganadora.slug}`;
}
