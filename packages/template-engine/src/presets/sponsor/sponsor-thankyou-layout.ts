import { layout } from "../clickaton/preset-helpers";
import type { LegacyTemplateV2Payload } from "../../bridge";

export const SPONSOR_STORY_WIDTH = 1080;
export const SPONSOR_STORY_HEIGHT = 1920;

export type SponsorThankYouTheme = {
  /** Prefijo de los ids de bloque; distingue los presets entre sí. */
  idPrefix: string;
  background: string;
  /** Color de marca: barras, kicker y nombre del programa. */
  accent: string;
  /** Segundo acento (barra inferior). */
  accentSecondary: string;
  textPrimary: string;
  textMuted: string;
  /** Placa clara detrás del logo del sponsor: los logos suelen ser oscuros. */
  logoPlate: string;
  titleFont: string;
  bodyFont: string;
  title: string;
};

/**
 * Layout compartido de las placas de agradecimiento a sponsors.
 *
 * Clickatón y FotoRank comparten estructura y sólo cambian colores, tipografía
 * y copy: mantener un único constructor evita que las dos placas se separen
 * visualmente con cada retoque.
 */
export function buildSponsorThankYouPayload(
  theme: SponsorThankYouTheme
): LegacyTemplateV2Payload {
  const W = SPONSOR_STORY_WIDTH;
  const H = SPONSOR_STORY_HEIGHT;
  const id = (suffix: string) => `${theme.idPrefix}-${suffix}`;

  return {
    canvas: { width: W, height: H, background: theme.background, dpi: 72 },
    blocks: [
      {
        id: id("bg"),
        type: "BACKGROUND",
        pageIndex: 0,
        name: "Fondo",
        layout: layout(0, 0, W, H, 0, { locked: true }),
        configJson: { backgroundColor: theme.background, src: "", fit: "cover" },
      },
      {
        id: id("accent-top"),
        type: "SHAPE",
        pageIndex: 0,
        name: "Acento superior",
        layout: layout(0, 0, W, 28, 1),
        configJson: {
          variant: "rectangle",
          fill: theme.accent,
          stroke: theme.accent,
          strokeWidth: 0,
        },
      },
      {
        id: id("kicker"),
        type: "TEXT",
        pageIndex: 0,
        name: "Producto",
        layout: layout(64, 120, 952, 48, 10),
        configJson: {
          content: "{program.productLabel}",
          fontFamily: theme.bodyFont,
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: 8,
          textAlign: "CENTER",
          color: theme.accent,
          lineHeight: 1.2,
        },
      },
      {
        id: id("title"),
        type: "TEXT",
        pageIndex: 0,
        name: "Título",
        layout: layout(64, 196, 952, 120, 11),
        configJson: {
          content: theme.title,
          fontFamily: theme.titleFont,
          fontSize: 104,
          fontWeight: 800,
          letterSpacing: 2,
          textAlign: "CENTER",
          color: theme.textPrimary,
          lineHeight: 1.05,
        },
      },
      {
        id: id("tier"),
        type: "VARIABLE_TEXT",
        pageIndex: 0,
        name: "Categoría de sponsor",
        layout: layout(64, 340, 952, 44, 12),
        configJson: {
          variableKey: "sponsor.tierLabel",
          fallback: "",
          fontFamily: theme.bodyFont,
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: 4,
          textAlign: "CENTER",
          color: theme.textMuted,
          lineHeight: 1.2,
        },
      },
      {
        id: id("logo-plate"),
        type: "SHAPE",
        pageIndex: 0,
        name: "Placa del logo",
        layout: layout(180, 440, 720, 400, 19),
        configJson: {
          variant: "rectangle",
          fill: theme.logoPlate,
          stroke: theme.logoPlate,
          strokeWidth: 0,
          radius: 32,
        },
      },
      {
        id: id("sponsor-logo"),
        type: "IMAGE",
        pageIndex: 0,
        name: "Logo del sponsor",
        layout: layout(240, 490, 600, 300, 20),
        configJson: {
          src: "",
          fit: "contain",
          source: { variableKey: "sponsor.logoUrl" },
        },
      },
      {
        id: id("sponsor-name"),
        type: "VARIABLE_TEXT",
        pageIndex: 0,
        name: "Nombre del sponsor",
        layout: layout(64, 890, 952, 80, 30),
        configJson: {
          variableKey: "sponsor.name",
          fallback: "—",
          fontFamily: theme.titleFont,
          fontSize: 64,
          fontWeight: 700,
          textAlign: "CENTER",
          color: theme.textPrimary,
          lineHeight: 1.1,
        },
      },
      {
        id: id("sponsor-ig"),
        type: "VARIABLE_TEXT",
        pageIndex: 0,
        name: "Instagram del sponsor",
        layout: layout(64, 980, 952, 44, 31),
        configJson: {
          variableKey: "sponsor.instagram",
          fallback: "",
          fontFamily: theme.bodyFont,
          fontSize: 30,
          fontWeight: 500,
          textAlign: "CENTER",
          color: theme.accent,
          lineHeight: 1.2,
        },
      },
      {
        id: id("message"),
        type: "VARIABLE_TEXT",
        pageIndex: 0,
        name: "Mensaje de agradecimiento",
        layout: layout(120, 1080, 840, 280, 32),
        configJson: {
          variableKey: "sponsor.message",
          fallback: "",
          fontFamily: theme.bodyFont,
          fontSize: 34,
          fontWeight: 400,
          textAlign: "CENTER",
          color: theme.textMuted,
          lineHeight: 1.45,
        },
      },
      {
        id: id("divider"),
        type: "SHAPE",
        pageIndex: 0,
        name: "Separador",
        layout: layout(420, 1400, 240, 4, 33),
        configJson: {
          variant: "rectangle",
          fill: theme.accent,
          stroke: theme.accent,
          strokeWidth: 0,
        },
      },
      {
        id: id("program-name"),
        type: "VARIABLE_TEXT",
        pageIndex: 0,
        name: "Programa",
        layout: layout(64, 1460, 952, 60, 34),
        configJson: {
          variableKey: "program.name",
          fallback: "",
          fontFamily: theme.titleFont,
          fontSize: 46,
          fontWeight: 700,
          textAlign: "CENTER",
          color: theme.accent,
          lineHeight: 1.15,
        },
      },
      {
        id: id("program-meta"),
        type: "VARIABLE_TEXT",
        pageIndex: 0,
        name: "Fecha y ciudad",
        layout: layout(64, 1534, 952, 44, 35),
        configJson: {
          variableKey: "program.metaLine",
          fallback: "",
          fontFamily: theme.bodyFont,
          fontSize: 30,
          fontWeight: 500,
          textAlign: "CENTER",
          color: theme.textMuted,
          lineHeight: 1.2,
        },
      },
      {
        id: id("program-logo"),
        type: "IMAGE",
        pageIndex: 0,
        name: "Logo del programa",
        layout: layout(415, 1700, 250, 110, 40),
        configJson: {
          src: "",
          fit: "contain",
          source: { variableKey: "program.logoUrl" },
        },
      },
      {
        id: id("accent-bottom"),
        type: "SHAPE",
        pageIndex: 0,
        name: "Acento inferior",
        layout: layout(0, 1892, W, 28, 2),
        configJson: {
          variant: "rectangle",
          fill: theme.accentSecondary,
          stroke: theme.accentSecondary,
          strokeWidth: 0,
        },
      },
    ],
    variableBindings: [
      { blockId: id("tier"), targetPath: "variableKey", variableKey: "sponsor.tierLabel" },
      { blockId: id("sponsor-logo"), targetPath: "source.variableKey", variableKey: "sponsor.logoUrl" },
      { blockId: id("sponsor-name"), targetPath: "variableKey", variableKey: "sponsor.name" },
      { blockId: id("sponsor-ig"), targetPath: "variableKey", variableKey: "sponsor.instagram" },
      { blockId: id("message"), targetPath: "variableKey", variableKey: "sponsor.message" },
      { blockId: id("program-name"), targetPath: "variableKey", variableKey: "program.name" },
      { blockId: id("program-meta"), targetPath: "variableKey", variableKey: "program.metaLine" },
      { blockId: id("program-logo"), targetPath: "source.variableKey", variableKey: "program.logoUrl" },
    ],
    meta: {},
  } as LegacyTemplateV2Payload;
}
