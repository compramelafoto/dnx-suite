import type { DesignBlock, DesignDocument, VariableContract } from "@repo/design-studio";
import { WELCOME_BG_JPEG_BASE64 } from "./welcome-story-background";

/**
 * Historia de bienvenida a un fotógrafo que sube su primer álbum (pedido 2026-11-24).
 *
 * Todo lo fijo (fondo negro con destellos, logo de CLF, «¡Te damos la bienvenida!» sin
 * género, la tarjeta blanca y el pie «Ya subió su primer álbum en COMPRAMELAFOTO.COM")
 * viene dibujado en `welcome-story-background.ts`. Encima van tres cosas del fotógrafo:
 * su logo adentro de la tarjeta blanca (así se ve aunque sea negro sobre transparente),
 * su @ bien grande y su nombre.
 */

export const WELCOME_TEMPLATE_ID = "clf-story-bienvenida";
export const WELCOME_BG_REF = "clf:bienvenida-fondo";
export const WELCOME_LOGO_REF = "clf:bienvenida-logo";

const W = 1080;
const H = 1920;

/** La tarjeta blanca dibujada en el fondo (ver scripts/social/bienvenida-fondo.mjs). */
export const WELCOME_CARD = { x: 190, y: 800, width: 700, height: 470, radius: 44, padding: 56 } as const;

/** El @ del fotógrafo: centrado, debajo de la tarjeta. */
export const WELCOME_HANDLE_BOX = { x: 60, y: 1322, width: W - 120, height: 100 } as const;

/** Lugar donde apoyar la etiqueta de Instagram (0…1): el centro del @ dibujado. */
export const WELCOME_TAG_ANCHOR = {
  x: 0.5,
  y: Math.round(((WELCOME_HANDLE_BOX.y + WELCOME_HANDLE_BOX.height / 2) / H) * 1000) / 1000,
};

export function readWelcomeBrandResource(ref: string): Uint8Array | null {
  if (ref === WELCOME_BG_REF) return new Uint8Array(Buffer.from(WELCOME_BG_JPEG_BASE64, "base64"));
  return null;
}

function texto(id: string, content: string, y: number, h: number, size: number, color: string, bold: boolean): DesignBlock {
  return {
    id,
    type: "text",
    x: WELCOME_HANDLE_BOX.x,
    y,
    width: WELCOME_HANDLE_BOX.width,
    height: h,
    fontId: "dmSans",
    fontSize: size,
    fontWeight: bold ? "bold" : "normal",
    color,
    align: "center",
    verticalAlign: "middle",
    content,
    maxLines: 1,
    lineHeight: 1.1,
  } as DesignBlock;
}

export const WELCOME_DOCUMENT: DesignDocument = {
  schemaVersion: 1,
  metadata: { name: WELCOME_TEMPLATE_ID, description: "Bienvenida a un fotógrafo nuevo (CompraMeLaFoto)." },
  format: { medium: "SCREEN", width: W, height: H },
  sides: [
    {
      id: "historia",
      name: "Historia",
      background: "#050505",
      blocks: [
        { id: "fondo", type: "image", x: 0, y: 0, width: W, height: H, resourceRef: WELCOME_BG_REF, fit: "cover" } as DesignBlock,
        // La tarjeta con el logo, encima de la tarjeta blanca del fondo y del mismo tamaño
        // (la arma `prepararTarjeta`: blanca, u oscura si el logo es claro).
        {
          id: "logo",
          type: "image",
          x: WELCOME_CARD.x,
          y: WELCOME_CARD.y,
          width: WELCOME_CARD.width,
          height: WELCOME_CARD.height,
          resourceRef: WELCOME_LOGO_REF,
          fit: "cover",
        } as DesignBlock,
        texto("handle", "{{handle}}", WELCOME_HANDLE_BOX.y, WELCOME_HANDLE_BOX.height, 76, "#ffffff", true),
        texto("nombre", "{{nombre}}", 1428, 56, 40, "#b8b8b8", false),
      ],
    },
  ],
};

export const WELCOME_CONTRACT: VariableContract = {
  variables: [
    { key: "handle", type: "text", label: "@ del fotógrafo", required: true, sampleValue: "@fotografo", maxLength: 32 },
    { key: "nombre", type: "text", label: "Nombre y ciudad", required: false, sampleValue: "Ana Pérez · Rosario", maxLength: 60 },
  ],
};

/**
 * «Rocío Cerdá · Rosario»; sin nombre, solo la ciudad; sin nada, vacío. La ciudad llega a
 * veces como «Municipio de Posadas» (autocompletado): se deja «Posadas».
 */
export function welcomeNameLine(name: string | null | undefined, city: string | null | undefined): string {
  const ciudad = (city ?? "").trim().replace(/^(municipio|partido|departamento|ciudad)\s+de\s+/i, "");
  const partes = [(name ?? "").trim(), ciudad].filter(Boolean);
  return partes.join(" · ").slice(0, 60);
}
