import { memberCanUpload } from "./rules";
import { findAgencyAlbumGate, findMembership } from "./queries";

export const AGENCY_UPLOAD_DENIED = "Este álbum es de una agencia: sólo su equipo puede subir fotos.";
const AGENCY_TERMS_PENDING =
  "La agencia cambió sus condiciones: aceptalas en Agencias → Mis agencias para seguir subiendo.";

/** ¿Este álbum es de una agencia y, si lo es, este usuario puede subirle fotos? */
export async function checkAgencyAlbumUpload(
  albumId: number,
  userId: number
): Promise<{ agencyAlbum: false } | { agencyAlbum: true; allowed: boolean; error?: string }> {
  const gate = await findAgencyAlbumGate(albumId);
  if (!gate) return { agencyAlbum: false };
  if (gate.ownerUserId === userId) return { agencyAlbum: true, allowed: true };
  const member = await findMembership(gate.agencyId, userId);
  if (memberCanUpload(member, gate)) return { agencyAlbum: true, allowed: true };
  if (member?.status === "ACTIVE") return { agencyAlbum: true, allowed: false, error: AGENCY_TERMS_PENDING };
  return { agencyAlbum: true, allowed: false, error: AGENCY_UPLOAD_DENIED };
}
