/**
 * Las cuatro puertas del jurado, separadas:
 *   poder entrar   → accountStatus
 *   estar listado  → isListedInProfessionalDirectory + estado de revisión
 *   página pública → isPublic
 *   verificado     → isVerifiedByPlatform (fuera de este módulo)
 *
 * Ninguna implica otra. Un perfil puede entrar y trabajar en su ficha desde el
 * minuto cero; lo único que espera la aprobación es la visibilidad.
 */
export type EstadoDeRevision = "PENDING" | "APPROVED" | "REJECTED";

export type OrigenDeAlta = "ORGANIZER_CREATED" | "ORGANIZER_INVITATION" | "PUBLIC_SIGNUP";

export type PerfilParaRevision = {
  estado: EstadoDeRevision;
  emailVerificado: boolean;
  quiereEstarEnElDirectorio: boolean;
};

export type EfectoDeRevision = {
  estado: EstadoDeRevision;
  isPublic: boolean;
  isListedInProfessionalDirectory: boolean;
};

export function estadoInicialParaAlta(
  origen: OrigenDeAlta,
): { estado: EstadoDeRevision; isPublic: boolean } {
  // Un alta hecha por un organizador nace aprobada: ese organizador ya
  // respondió por esa persona.
  if (origen === "PUBLIC_SIGNUP") return { estado: "PENDING", isPublic: false };
  return { estado: "APPROVED", isPublic: true };
}

export function estaEnLaColaDeRevision(p: PerfilParaRevision): boolean {
  return p.estado === "PENDING" && p.emailVerificado;
}

export function aprobar(p: PerfilParaRevision): EfectoDeRevision {
  return {
    estado: "APPROVED",
    isPublic: true,
    isListedInProfessionalDirectory: p.quiereEstarEnElDirectorio,
  };
}

export function rechazar(
  p: PerfilParaRevision,
  motivo: string,
): { ok: true; efecto: EfectoDeRevision } | { ok: false; error: string } {
  if (!motivo.trim()) {
    return { ok: false, error: "Hace falta un motivo: el jurado lo va a leer para poder corregir." };
  }
  void p;
  return {
    ok: true,
    efecto: { estado: "REJECTED", isPublic: false, isListedInProfessionalDirectory: false },
  };
}

export function volverAPedirRevision(
  p: PerfilParaRevision,
): { ok: true; efecto: EfectoDeRevision } | { ok: false; error: string } {
  if (p.estado !== "REJECTED") {
    return { ok: false, error: "Sólo se puede volver a pedir revisión después de un rechazo." };
  }
  return {
    ok: true,
    efecto: { estado: "PENDING", isPublic: false, isListedInProfessionalDirectory: false },
  };
}
