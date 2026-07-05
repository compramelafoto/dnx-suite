import { encodePackDescriptionWithQty } from "@/lib/album-packs/album-pack-quantity-mode";

export type AlbumModeValue = "SIMPLE" | "EVENT" | "SCHOOL" | "COLLABORATIVE";

export type AlbumPackPreset = {
  id: string;
  name: string;
  description: string;
  note?: string;
  price: number;
  packType: "DIGITAL" | "PRINT" | "SCHOOL_FOLDER";
  availabilityPhase: "PRE_UPLOAD" | "POST_UPLOAD" | "ALWAYS";
  requiresSelection: boolean;
  requiresDesign: boolean;
  includedPhotoCount: number | null;
};

const ALL_MY_PHOTOS_PRESET: AlbumPackPreset = {
  id: "pack-all-my-photos",
  name: "Todas mis fotos",
  description: encodePackDescriptionWithQty(
    "Todas las fotos donde aparece el cliente en el álbum.",
    "ALL_MY_PHOTOS"
  ),
  note: "El cliente usa reconocimiento facial (selfie) para armar el pack.",
  price: 0,
  packType: "DIGITAL",
  availabilityPhase: "POST_UPLOAD",
  requiresSelection: false,
  requiresDesign: false,
  includedPhotoCount: null,
};

const ALL_EVENT_PHOTOS_PRESET: AlbumPackPreset = {
  id: "pack-all-event-photos",
  name: "Todas las fotos",
  description: encodePackDescriptionWithQty(
    "Todas las fotos publicadas del álbum en un solo pack.",
    "ALL_EVENT_PHOTOS"
  ),
  note: "El cliente compra el conjunto de fotos del álbum sin usar selfie.",
  price: 0,
  packType: "DIGITAL",
  availabilityPhase: "POST_UPLOAD",
  requiresSelection: false,
  requiresDesign: false,
  includedPhotoCount: null,
};

export function getAlbumPackPresetsByMode(mode: AlbumModeValue): {
  reminder?: string;
  presets: AlbumPackPreset[];
} {
  const bulkPresets = [ALL_MY_PHOTOS_PRESET, ALL_EVENT_PHOTOS_PRESET];

  if (mode === "SIMPLE") {
    return {
      reminder: "Los packs complementan la venta suelta de fotos digitales o impresiones.",
      presets: bulkPresets,
    };
  }

  if (mode === "EVENT") {
    return {
      presets: [
        {
          id: "event-digital-5",
          name: "Pack 5 fotos digitales",
          description: "Selección de 5 fotos digitales del evento.",
          price: 0,
          packType: "DIGITAL",
          availabilityPhase: "POST_UPLOAD",
          requiresSelection: true,
          requiresDesign: false,
          includedPhotoCount: 5,
        },
        {
          id: "event-digital-10",
          name: "Pack 10 fotos digitales",
          description: "Selección de 10 fotos digitales del evento.",
          price: 0,
          packType: "DIGITAL",
          availabilityPhase: "POST_UPLOAD",
          requiresSelection: true,
          requiresDesign: false,
          includedPhotoCount: 10,
        },
        ...bulkPresets,
      ],
    };
  }

  if (mode === "SCHOOL") {
    return {
      presets: [
        {
          id: "school-folder-3",
          name: "Carpeta escolar 3 fotos",
          description: "Carpeta escolar con diseño y selección de 3 fotos.",
          price: 0,
          packType: "SCHOOL_FOLDER",
          availabilityPhase: "POST_UPLOAD",
          requiresSelection: true,
          requiresDesign: true,
          includedPhotoCount: 3,
        },
        {
          id: "school-folder-4",
          name: "Carpeta escolar 4 fotos",
          description: "Carpeta escolar con diseño y selección de 4 fotos.",
          price: 0,
          packType: "SCHOOL_FOLDER",
          availabilityPhase: "POST_UPLOAD",
          requiresSelection: true,
          requiresDesign: true,
          includedPhotoCount: 4,
        },
        {
          id: "school-digital-5",
          name: "Pack digital 5 fotos",
          description: "Selección de 5 fotos digitales para familias.",
          price: 0,
          packType: "DIGITAL",
          availabilityPhase: "POST_UPLOAD",
          requiresSelection: true,
          requiresDesign: false,
          includedPhotoCount: 5,
        },
        ...bulkPresets,
      ],
    };
  }

  return {
    presets: [
      {
        id: "collab-digital-5",
        name: "Pack 5 fotos digitales",
        description: "Selección de 5 fotos de la galería colaborativa.",
        price: 0,
        packType: "DIGITAL",
        availabilityPhase: "POST_UPLOAD",
        requiresSelection: true,
        requiresDesign: false,
        includedPhotoCount: 5,
      },
      {
        id: "collab-digital-10",
        name: "Pack 10 fotos digitales",
        description: "Selección de 10 fotos de la galería colaborativa.",
        price: 0,
        packType: "DIGITAL",
        availabilityPhase: "POST_UPLOAD",
        requiresSelection: true,
        requiresDesign: false,
        includedPhotoCount: 10,
      },
      ...bulkPresets,
    ],
  };
}
