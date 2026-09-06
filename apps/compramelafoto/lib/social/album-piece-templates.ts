import type { DesignDocument, VariableContract } from "@repo/design-studio";

/**
 * Plantillas del Designer para las piezas sociales del álbum (spec §8-9).
 *
 * Dos piezas, dos formas muy distintas:
 *
 * - El carrusel es UNA CARA POR FOTO. `PNG_PER_SIDE` (ver `emit.ts`) emite un PNG por cada
 *   elemento de `doc.sides`, así que cuatro huecos en una sola cara producirían un collage,
 *   no un carrusel de Instagram. Por eso `albumCarouselDocument` es una función, no una
 *   constante: arma exactamente tantas caras como fotos eligió el fotógrafo (3 o 4, ver
 *   `MIN_SOCIAL_PHOTOS`/`MAX_SOCIAL_PHOTOS` en `album-social-consent.ts`). Un documento fijo
 *   de 4 caras con solo 3 fotos falla la emisión: el `ResourceResolver` devuelve `null` para
 *   la variable que no llegó y eso detiene todo (ver `resources.ts`).
 * - La historia es UNA sola cara, la primera foto a sangre completa, con el nombre del
 *   álbum, el usuario de Instagram del fotógrafo y la dirección web impresos encima como
 *   texto. Un mosaico de 3/4 fotos habría que maquetarlo distinto según la cantidad y no
 *   suma nada. Y tiene que ser texto dibujado: Meta no deja poner stickers ni links
 *   tocables por API, así que lo que no está impreso en el píxel no está.
 *
 * Medidas en píxeles (medio SCREEN, sin sangrado): carrusel 1080×1350 (4:5, el aspecto que
 * Instagram no recorta), historia 1080×1920 (9:16).
 */

/**
 * Contrato de variables de las piezas del álbum.
 *
 * Prohibido a propósito: cualquier campo de documento de identidad. Estas piezas se
 * publican en una cuenta pública de Instagram; un DNI ahí sería una filtración de datos
 * personales, no una plantilla mal hecha. El test de privacidad revisa esto.
 */
export const ALBUM_VARIABLE_CONTRACT: VariableContract = {
  variables: [
    {
      key: "nombreAlbum",
      type: "text",
      label: "Nombre del álbum",
      required: true,
      sampleValue: "Maratón de Santa Fe 2026",
      maxLength: 60,
    },
    {
      key: "fecha",
      type: "date",
      label: "Fecha del evento",
      required: false,
      sampleValue: "30/08/2026",
      dateFormat: "es-AR-short",
    },
    {
      key: "arrobaFotografo",
      type: "text",
      label: "Usuario de Instagram del fotógrafo",
      required: false,
      sampleValue: "@fotografo",
      maxLength: 31,
    },
    {
      // Texto, no "url": se imprime tal cual en la pieza ("compramelafoto.com/a/…", sin
      // protocolo, igual que en el copy). El tipo "url" del Designer valida que el valor
      // empiece con "http" — acá no es un enlace navegable (Meta no permite links tocables
      // por API, ver Corrección 2), es una dirección decorativa dibujada como texto.
      key: "urlAlbum",
      type: "text",
      label: "Dirección del álbum",
      required: true,
      sampleValue: "compramelafoto.com/a/maraton",
      maxLength: 60,
    },
    {
      key: "foto1",
      type: "image",
      label: "Foto 1",
      required: true,
      sampleValue: "https://cdn/1.jpg",
    },
    {
      key: "foto2",
      type: "image",
      label: "Foto 2",
      required: true,
      sampleValue: "https://cdn/2.jpg",
    },
    {
      key: "foto3",
      type: "image",
      label: "Foto 3",
      required: true,
      sampleValue: "https://cdn/3.jpg",
    },
    {
      key: "foto4",
      type: "image",
      label: "Foto 4",
      required: false,
      sampleValue: "https://cdn/4.jpg",
    },
  ],
};

const CAROUSEL_WIDTH_PX = 1080;
const CAROUSEL_HEIGHT_PX = 1350;

/**
 * Documento del carrusel: una cara por foto, cada una a sangre completa referida a su
 * propia variable (`foto1`, `foto2`, …).
 *
 * `cantidadDeFotos` viene de la selección del fotógrafo, entre `MIN_SOCIAL_PHOTOS` (3) y
 * `MAX_SOCIAL_PHOTOS` (4). No se valida ese rango acá: quien arma los datos ya pasó por
 * `decideAlbumSocialGeneration`, que es donde vive esa regla. Acá solo se arma el
 * documento con la cantidad de caras que le pidan.
 */
export function albumCarouselDocument(cantidadDeFotos: number): DesignDocument {
  if (!Number.isInteger(cantidadDeFotos) || cantidadDeFotos < 1) {
    throw new Error(
      `El carrusel necesita al menos una foto; se pidieron ${cantidadDeFotos}.`,
    );
  }

  const sides = Array.from({ length: cantidadDeFotos }, (_, indice) => {
    const numero = indice + 1;
    return {
      id: `slide-${numero}`,
      name: `Diapositiva ${numero}`,
      background: "#000000",
      blocks: [
        {
          id: "foto",
          type: "image" as const,
          x: 0,
          y: 0,
          width: CAROUSEL_WIDTH_PX,
          height: CAROUSEL_HEIGHT_PX,
          variableKey: `foto${numero}`,
          fit: "cover" as const,
        },
      ],
    };
  });

  return {
    schemaVersion: 1,
    metadata: {
      name: "Carrusel del álbum",
      description: "Una cara por foto, generada según la cantidad elegida.",
    },
    format: { medium: "SCREEN", width: CAROUSEL_WIDTH_PX, height: CAROUSEL_HEIGHT_PX },
    sides,
  };
}

const STORY_WIDTH_PX = 1080;
const STORY_HEIGHT_PX = 1920;

/**
 * Documento de la historia: una sola cara, siempre igual, no depende de la cantidad de
 * fotos (usa solo la primera). Por eso es constante y no una función como el carrusel.
 */
export const ALBUM_STORY_DOCUMENT: DesignDocument = {
  schemaVersion: 1,
  metadata: {
    name: "Historia del álbum",
    description: "Primera foto a sangre completa, con el copy impreso encima.",
  },
  format: { medium: "SCREEN", width: STORY_WIDTH_PX, height: STORY_HEIGHT_PX },
  sides: [
    {
      id: "historia",
      name: "Historia",
      background: "#000000",
      blocks: [
        {
          id: "fondo",
          type: "image",
          x: 0,
          y: 0,
          width: STORY_WIDTH_PX,
          height: STORY_HEIGHT_PX,
          variableKey: "foto1",
          fit: "cover",
        },
        // Velo oscuro abajo para que el texto blanco se lea encima de cualquier foto.
        {
          id: "velo",
          type: "rect",
          x: 0,
          y: 1380,
          width: STORY_WIDTH_PX,
          height: 540,
          fillColor: "#000000",
          opacity: 0.55,
        },
        {
          id: "nombreAlbum",
          type: "text",
          x: 64,
          y: 1440,
          width: 952,
          height: 140,
          fontId: "dmSans",
          fontSize: 38,
          fontWeight: "bold",
          color: "#ffffff",
          align: "left",
          content: "{{nombreAlbum}}",
          maxLines: 2,
        },
        {
          id: "arrobaFotografo",
          type: "text",
          x: 64,
          y: 1610,
          width: 952,
          height: 60,
          fontId: "dmSans",
          fontSize: 26,
          fontWeight: "normal",
          color: "#ffffff",
          align: "left",
          content: "{{arrobaFotografo}}",
          maxLines: 1,
        },
        {
          id: "urlAlbum",
          type: "text",
          x: 64,
          y: 1680,
          width: 952,
          height: 60,
          fontId: "dmSans",
          fontSize: 26,
          fontWeight: "bold",
          color: "#ffffff",
          align: "left",
          content: "{{urlAlbum}}",
          maxLines: 1,
        },
      ],
    },
  ],
};
