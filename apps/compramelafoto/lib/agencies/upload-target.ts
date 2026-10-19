import { validateActiveAlbumForCameraConnection } from "@/lib/camera-connection/camera-connection-service";
import { findAgencyAlbumGate } from "@/lib/agencies/queries";

export const AGENCY_TARGET_DENIED = "Ya no podés subir a ese álbum de la agencia.";

/**
 * ¿Este usuario puede subir AHORA a este álbum, y el álbum es de ESTA agencia? Lo usan el FTP (etapa 2b) y
 * DNX FLUX (etapa 3a) en cada pedido: miembro ACTIVE con condiciones al día, álbum sin borrar.
 */
export async function checkAgencyUploadTarget(
  agencyId: number,
  albumId: number,
  userId: number,
  deniedMessage: string = AGENCY_TARGET_DENIED
): Promise<{ ok: true } | { ok: false; message: string }> {
  const album = await validateActiveAlbumForCameraConnection(userId, albumId);
  if (!album.ok) return { ok: false, message: album.error || deniedMessage };
  const gate = await findAgencyAlbumGate(albumId);
  if (!gate || gate.agencyId !== agencyId) return { ok: false, message: deniedMessage };
  return { ok: true };
}
