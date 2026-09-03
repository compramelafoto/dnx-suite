/** Rutas de la pantalla única del participante (sin dependencias de servidor). */

export function participantLivePath(registrationId: string): string {
  return `/en-vivo/${registrationId}`;
}

export function participantLiveStatusPath(registrationId: string): string {
  return `/api/account/registrations/${registrationId}/live`;
}

export function participantCredentialPath(registrationId: string): string {
  return `/mi-cuenta/inscripciones/${registrationId}`;
}
