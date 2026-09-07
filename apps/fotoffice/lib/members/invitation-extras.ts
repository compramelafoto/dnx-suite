import type { InvitationVideo } from "./invitation-email";

/**
 * Lo que cada institución suma a su invitación: por qué le llega, y su video.
 *
 * Vive fuera del armador del email a propósito. Ese armador es de todas las instituciones y
 * no tiene por qué saber quién es la SFPR ni de dónde migró; acá se guarda lo que es de una
 * sola. Una institución sin entrada recibe la invitación de siempre.
 *
 * Es un mapa en código y no una tabla porque hoy son datos de puesta en marcha, no algo que
 * la institución edite. El día que quieran cambiarlo sin programar, esto se muda a la
 * configuración del workspace — y el armador del email no se entera.
 */

export type InvitationExtras = {
  /** Explica el cambio de sistema. Vacío para quien no migró de ningún lado. */
  migrationNote: string | null;
  video: InvitationVideo | null;
};

const VACIO: InvitationExtras = { migrationNote: null, video: null };

const POR_WORKSPACE: Record<string, InvitationExtras> = {
  ws_sfpr_seed: {
    migrationNote:
      "La SFPR cambió de sistema. Todo lo tuyo —tu número de socio, tu antigüedad y tus " +
      "pagos— ya está cargado. No tenés que hacer ningún trámite: solo activar tu acceso.",
    video: {
      watchUrl: "https://www.youtube.com/watch?v=QffNEis8rho",
      // La portada la sirve Google. Se elige por eso: una imagen alojada en otro lado la
      // bloquean varios clientes de correo, y la que probamos en Gmail no llegaba a verse.
      posterUrl: "https://i.ytimg.com/vi/QffNEis8rho/maxresdefault.jpg",
      durationLabel: "3:47",
    },
  },
};

export function invitationExtrasFor(workspaceId: string): InvitationExtras {
  return POR_WORKSPACE[workspaceId] ?? VACIO;
}
