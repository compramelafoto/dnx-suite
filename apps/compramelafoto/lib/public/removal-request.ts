/**
 * Validación de POST /api/removal-requests (público; no elimina fotos).
 */

export type RemovalRequestPayload = {
  albumId: number;
  photoId: number;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  reason: string;
  declarationOk: true;
};

export function sanitizeRemovalRequestBody(body: Record<string, unknown>):
  | { ok: true; data: RemovalRequestPayload }
  | { ok: false; error: string; status: number } {
  const albumId = Number(body.albumId);
  const photoId = Number(body.photoId);
  const requesterName =
    typeof body.requesterName === "string" ? body.requesterName.trim() : "";
  const requesterEmail =
    typeof body.requesterEmail === "string"
      ? body.requesterEmail.trim().toLowerCase()
      : "";
  const requesterPhone =
    typeof body.requesterPhone === "string" ? body.requesterPhone.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!Number.isFinite(albumId) || albumId <= 0) {
    return { ok: false, error: "albumId es requerido", status: 400 };
  }
  if (!Number.isFinite(photoId) || photoId <= 0) {
    return { ok: false, error: "photoId es requerido", status: 400 };
  }
  if (requesterName.length < 2) {
    return {
      ok: false,
      error: "El nombre es requerido (mínimo 2 caracteres)",
      status: 400,
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) {
    return {
      ok: false,
      error: "El email es requerido y debe ser válido",
      status: 400,
    };
  }
  if (requesterPhone.length < 8) {
    return {
      ok: false,
      error: "El teléfono/WhatsApp es requerido (mínimo 8 caracteres)",
      status: 400,
    };
  }
  if (reason.length < 10) {
    return {
      ok: false,
      error: "El motivo es requerido (mínimo 10 caracteres)",
      status: 400,
    };
  }
  if (body.declarationOk !== true) {
    return {
      ok: false,
      error:
        "Debés confirmar que la solicitud es real y que sos la persona afectada o su representante",
      status: 400,
    };
  }

  return {
    ok: true,
    data: {
      albumId,
      photoId,
      requesterName,
      requesterEmail,
      requesterPhone,
      reason,
      declarationOk: true,
    },
  };
}
