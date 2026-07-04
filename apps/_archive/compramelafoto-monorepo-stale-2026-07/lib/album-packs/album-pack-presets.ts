import type {
  AlbumMode,
  AlbumPackAvailabilityPhase,
  AlbumPackType,
} from "@prisma/client";

export type AlbumPackPreset = {
  id: string;
  name: string;
  description: string;
  packType: AlbumPackType;
  availabilityPhase: AlbumPackAvailabilityPhase;
  requiresSelection: boolean;
  requiresDesign: boolean;
  includedPhotoCount: number | null;
  internalNote?: string;
};

export const albumPackSimpleModeReminder =
  "Foto individual: este modo está pensado para fotos sueltas. Recordá que la foto individual ya se vende desde la configuración normal del álbum.";

export const albumPackPresetsByMode: Record<AlbumMode, AlbumPackPreset[]> = {
  SIMPLE: [],
  EVENT: [
    {
      id: "event-digital-5",
      name: "Pack 5 fotos digitales",
      description: "Pack digital para selección posterior a la carga de fotos.",
      packType: "DIGITAL",
      availabilityPhase: "POST_UPLOAD",
      requiresSelection: true,
      requiresDesign: false,
      includedPhotoCount: 5,
    },
    {
      id: "event-digital-10",
      name: "Pack 10 fotos digitales",
      description:
        "Pack digital ampliado para clientes que quieren más variedad.",
      packType: "DIGITAL",
      availabilityPhase: "POST_UPLOAD",
      requiresSelection: true,
      requiresDesign: false,
      includedPhotoCount: 10,
    },
    {
      id: "event-all-photos",
      name: "Pack todas mis fotos",
      description: "Oferta digital con acceso completo sin selección manual.",
      packType: "DIGITAL",
      availabilityPhase: "POST_UPLOAD",
      requiresSelection: false,
      requiresDesign: false,
      includedPhotoCount: null,
      internalNote: "Este preset todavía no se conecta a checkout.",
    },
  ],
  SCHOOL: [
    {
      id: "school-folder-3",
      name: "Carpeta escolar 3 fotos",
      description: "Carpeta escolar con diseño y selección mínima.",
      packType: "SCHOOL_FOLDER",
      availabilityPhase: "POST_UPLOAD",
      requiresSelection: true,
      requiresDesign: true,
      includedPhotoCount: 3,
    },
    {
      id: "school-folder-4",
      name: "Carpeta escolar 4 fotos",
      description: "Carpeta escolar extendida con diseño personalizado.",
      packType: "SCHOOL_FOLDER",
      availabilityPhase: "POST_UPLOAD",
      requiresSelection: true,
      requiresDesign: true,
      includedPhotoCount: 4,
    },
    {
      id: "school-digital-5",
      name: "Pack digital 5 fotos",
      description: "Alternativa digital simple para familias.",
      packType: "DIGITAL",
      availabilityPhase: "POST_UPLOAD",
      requiresSelection: true,
      requiresDesign: false,
      includedPhotoCount: 5,
    },
  ],
  COLLABORATIVE: [
    {
      id: "collab-digital-5",
      name: "Pack 5 fotos digitales",
      description:
        "Pack digital sugerido para coberturas colaborativas con selección.",
      packType: "DIGITAL",
      availabilityPhase: "POST_UPLOAD",
      requiresSelection: true,
      requiresDesign: false,
      includedPhotoCount: 5,
    },
    {
      id: "collab-digital-10",
      name: "Pack 10 fotos digitales",
      description:
        "Pack digital ampliado para eventos con múltiples fotógrafos.",
      packType: "DIGITAL",
      availabilityPhase: "POST_UPLOAD",
      requiresSelection: true,
      requiresDesign: false,
      includedPhotoCount: 10,
    },
  ],
};
