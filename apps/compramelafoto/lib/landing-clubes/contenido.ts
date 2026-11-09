/*
 * Textos de la página /clubes (clubes y organizadores de eventos). Todo el texto vive acá para que
 * Daniel lo revise en un solo lugar antes de publicarla.
 *
 * Regla: cada afirmación tiene que existir hoy en CLF. `fuente` dice qué archivos lo prueban
 * (rutas relativas a apps/compramelafoto, separadas por coma; el test chequea que existan).
 * Respaldo de los textos generales:
 * - Registrarse y crear el evento no cuesta nada: app/registro/organizador/page.tsx y
 *   app/api/organizer/events/route.ts (crear un evento no pide ningún pago); el recargo de CLF lo
 *   paga el comprador (lib/bot/guia/conocimiento.ts, sección «Plata y Mercado Pago»).
 * - No hace falta contratar fotógrafos: los fotógrafos se suman al evento y cobran por lo que venden
 *   (app/organizador/page.tsx, preguntas frecuentes; política OPEN / REQUEST / INVITE_ONLY en
 *   app/api/organizer/events/route.ts).
 * Sin porcentajes ni descuentos: la comisión la elige cada organizador en su evento.
 */

export type ClaveFuncionClubes =
  | "COMISION_ORGANIZADOR"
  | "FOTOGRAFOS_OFICIALES"
  | "VENTA_EN_ALBUM"
  | "RECONOCIMIENTO_FACIAL";

export type ContenidoClubes = {
  titulo: string;
  bajada: string;
  pasos: Array<{ titulo: string; texto: string }>;
  funciones: Array<{ clave: ClaveFuncionClubes; titulo: string; texto: string; fuente: string }>;
  cta: { texto: string; href: "/registro/organizador" };
};

export const CONTENIDO_CLUBES: ContenidoClubes = {
  titulo: "Tu club puede ganar dinero con las fotos de sus eventos, sin invertir dinero",
  bajada:
    "Torneos, carreras, encuentros y fiestas: en ComprameLaFoto creás el evento sin costo, los fotógrafos se suman y venden sus fotos, y vos cobrás una comisión por cada venta. No contratás a nadie ni ponés dinero por adelantado.",
  pasos: [
    {
      titulo: "Te registrás y creás el evento",
      texto: "Registrarte como organizador y crear el evento no tiene costo. Cargás la fecha, el lugar y cómo querés que se sumen los fotógrafos.",
    },
    {
      titulo: "Se suman los fotógrafos",
      texto: "El evento puede ser abierto, con tu aprobación o sólo por invitación. No tenés que contratarlos: ganan con las fotos que venden.",
    },
    {
      titulo: "La gente compra sus fotos",
      texto: "Cada fotógrafo sube sus fotos al evento. Deportistas, socios y familias las encuentran y las compran desde el celular, pagando por Mercado Pago.",
    },
    {
      titulo: "Vos cobrás tu comisión",
      texto: "Si la activás, cada venta pagada de fotos de tu evento suma tu comisión, y la seguís desde tu panel de organizador.",
    },
  ],
  funciones: [
    {
      clave: "COMISION_ORGANIZADOR",
      titulo: "Comisión del organizador",
      texto: "Elegís el porcentaje de comisión de tu evento. Queda registrada en cada venta pagada, la ves en tu panel y queda disponible después del período de seguridad de la plataforma.",
      fuente:
        "lib/event-organizer-commission-snapshot.ts, app/api/organizer/commissions/route.ts, app/api/organizer/commissions/withdrawal-request/route.ts",
    },
    {
      clave: "FOTOGRAFOS_OFICIALES",
      titulo: "Fotógrafos oficiales",
      texto: "Decidís quién cubre tu evento y, en la página pública de tu club u organización en ComprameLaFoto, mostrás a tus fotógrafos oficiales.",
      fuente:
        "app/api/organizer/landing/official-photographers/route.ts, lib/organizer-landing-modules.ts, app/api/organizer/events/route.ts",
    },
    {
      clave: "VENTA_EN_ALBUM",
      titulo: "Venta de fotos en el álbum",
      texto: "Las fotos se venden desde el álbum del evento: quien compra elige sus fotos, paga por Mercado Pago y las fotos digitales le llegan por mail con el link de descarga.",
      fuente: "lib/bot/guia/conocimiento.ts, lib/mercadopago/finalize-album-order-mp-approved.ts",
    },
    {
      clave: "RECONOCIMIENTO_FACIAL",
      titulo: "Búsqueda con una selfie",
      texto: "Con reconocimiento facial, cada persona busca sus fotos sacándose una selfie, sin recorrer cientos de imágenes. Así encuentra más rápido las fotos donde aparece.",
      fuente: "app/api/albums/[id]/search/face/route.ts, app/api/events/[id]/search/face/route.ts, lib/bot/guia/conocimiento.ts",
    },
  ],
  cta: { texto: "Registrar mi club como organizador", href: "/registro/organizador" },
};

/** Mientras Daniel no apruebe el texto, sólo la ve un admin. */
export function paginaClubesVisible(o: { publicada: boolean; esAdmin: boolean }): boolean {
  return o.publicada || o.esAdmin;
}
