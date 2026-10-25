/**
 * La comisión directiva tal como se muestra en la página pública Institucional.
 *
 * Sólo nombre y cargo: el correo y el resto de los datos del integrante nunca salen de acá.
 * Pura, para probarla sin base (ver `public-board.test.ts`).
 */

export type PublicBoardSeat = { officeName: string; names: string[] };

type Holder = { officeId: string; officeName: string; displayName: string };

/**
 * Agrupa por cargo respetando el orden que ya trae la lista (el del cargo en Configuración):
 * los tres vocales titulares van juntos bajo un solo "Vocal titular".
 */
export function groupBoardSeats(holders: readonly Holder[]): PublicBoardSeat[] {
  const seats: PublicBoardSeat[] = [];
  const byOffice = new Map<string, PublicBoardSeat>();
  for (const h of holders) {
    let seat = byOffice.get(h.officeId);
    if (!seat) {
      seat = { officeName: h.officeName, names: [] };
      byOffice.set(h.officeId, seat);
      seats.push(seat);
    }
    seat.names.push(h.displayName);
  }
  return seats;
}
