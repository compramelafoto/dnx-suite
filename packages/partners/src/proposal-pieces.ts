/**
 * Catálogo de piezas que se muestran en una propuesta comercial.
 *
 * Cada pieza corresponde a un placement realmente montado hoy. El fondo es una
 * captura de la página pública, servida desde `public/propuesta/backgrounds/`.
 */

export type ProposalPieceKind = "WELCOME" | "BANNER" | "MARQUEE";

export type ProposalPiece = {
  /** Identificador estable, usado en URLs y nombres de archivo. */
  id: string;
  kind: ProposalPieceKind;
  /** Placement del catálogo de DNX Partners al que corresponde. */
  placementKey: string;
  /** Nombre de la plataforma, para mostrar. */
  platformLabel: string;
  /** Nombre de la pieza, para mostrar. */
  label: string;
  /** Dónde aparece, en una frase. */
  location: string;
  /** Archivo de fondo en `public/propuesta/backgrounds/`. */
  background: string;
  /** Orden de aparición en la vista previa y en el PDF. */
  sortOrder: number;
};

export const PROPOSAL_PIECES: readonly ProposalPiece[] = [
  {
    id: "infospot-welcome",
    kind: "WELCOME",
    placementKey: "INFOSPOT_HOME_WELCOME",
    platformLabel: "InfoSpot",
    label: "Placa de bienvenida",
    location: "Al entrar a la portada, una vez cada 24 horas por visitante.",
    background: "bg-infospot.jpg",
    sortOrder: 10,
  },
  {
    id: "clickaton-welcome",
    kind: "WELCOME",
    placementKey: "CLICKATON_EVENT_WELCOME",
    platformLabel: "Clickatón",
    label: "Placa de bienvenida",
    location: "Al entrar a la página de una maratón.",
    background: "bg-clickaton.jpg",
    sortOrder: 20,
  },
  {
    id: "fotorank-welcome",
    kind: "WELCOME",
    placementKey: "FOTORANK_CONTEST_WELCOME",
    platformLabel: "FotoRank",
    label: "Placa de bienvenida",
    location: "Al entrar a la página de un concurso.",
    background: "bg-fotorank.jpg",
    sortOrder: 30,
  },
  {
    id: "clf-welcome",
    kind: "WELCOME",
    placementKey: "CLF_ALBUM_WELCOME",
    platformLabel: "ComprameLaFoto",
    label: "Placa de bienvenida",
    location: "Al entrar a un álbum público de fotos.",
    background: "bg-clf.jpg",
    sortOrder: 40,
  },
  {
    id: "infospot-banner",
    kind: "BANNER",
    placementKey: "INFOSPOT_HOME_TOP",
    platformLabel: "InfoSpot",
    label: "Banner horizontal",
    location: "En la portada, debajo de las noticias principales.",
    background: "bg-infospot.jpg",
    sortOrder: 50,
  },
  {
    id: "clf-banner",
    kind: "BANNER",
    placementKey: "CLF_HOME_PROMO",
    platformLabel: "ComprameLaFoto",
    label: "Banner horizontal",
    location: "En la portada, debajo del buscador.",
    background: "bg-clf.jpg",
    sortOrder: 60,
  },
  {
    id: "infospot-marquee",
    kind: "MARQUEE",
    placementKey: "INFOSPOT_HOME_MARQUEE",
    platformLabel: "InfoSpot",
    label: "Franja de logos",
    location: "Bloque «Nos acompañan», al pie de la portada.",
    background: "bg-infospot.jpg",
    sortOrder: 70,
  },
  {
    id: "clickaton-marquee",
    kind: "MARQUEE",
    placementKey: "CLICKATON_HOME_MARQUEE",
    platformLabel: "Clickatón",
    label: "Franja de logos",
    location: "Al pie de la portada y de cada maratón.",
    background: "bg-clickaton.jpg",
    sortOrder: 80,
  },
  {
    id: "clf-marquee",
    kind: "MARQUEE",
    placementKey: "CLF_LOGO_MARQUEE",
    platformLabel: "ComprameLaFoto",
    label: "Franja de logos",
    location: "Al pie de la portada.",
    background: "bg-clf.jpg",
    sortOrder: 90,
  },
];

export function getProposalPiece(id: string): ProposalPiece | undefined {
  return PROPOSAL_PIECES.find((p) => p.id === id);
}
