import type { ClickatonTemplatePreset } from "./types";
import { layout } from "./layout";

const W = 1080;
const H = 1920;

/**
 * CLICKATON_MEMBER_STORY_V1 — Story 1080×1920
 * SOY PARTE DE CLICKATÓN
 */
export const CLICKATON_MEMBER_STORY_V1: ClickatonTemplatePreset = {
  presetId: "clickaton-member-story-v1",
  name: "Soy parte de Clickatón",
  description: "Placa de pertenencia Instagram Story para la comunidad.",
  meta: {
    product: "clickaton",
    templateKey: "CLICKATON_MEMBER_STORY_V1",
    templateVersion: 1,
    format: "instagram_story",
    purpose: "participant_member",
    status: "published",
    createdAt: "2026-08-01",
    official: true,
  },
  payload: {
    canvas: {
      width: W,
      height: H,
      background: "#000000",
      dpi: 72,
    },
    blocks: [
      {
        id: "member-bg",
        type: "BACKGROUND",
        pageIndex: 0,
        name: "Fondo",
        layout: layout(0, 0, W, H, 0, { locked: true }),
        configJson: { backgroundColor: "#000000", src: "", fit: "cover" },
      },
      {
        id: "member-photo",
        type: "PHOTO",
        pageIndex: 0,
        name: "Foto participante",
        layout: layout(90, 120, 900, 900, 10),
        configJson: {
          src: "",
          fit: "cover",
          maskShape: "rect",
          borderRadius: 24,
          source: { variableKey: "participant.photoUrl" },
        },
      },
      {
        id: "member-title",
        type: "TEXT",
        pageIndex: 0,
        name: "Título pertenencia",
        layout: layout(64, 1060, 952, 140, 20),
        configJson: {
          content: "SOY PARTE\nDE CLICKATÓN",
          fontFamily: "Barlow Condensed",
          fontSize: 68,
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: 1,
          textAlign: "CENTER",
          color: "#FFE600",
        },
      },
      {
        id: "member-name",
        type: "VARIABLE_TEXT",
        pageIndex: 0,
        name: "Nombre",
        layout: layout(64, 1220, 952, 64, 30),
        configJson: {
          variableKey: "participant.fullName",
          fallback: "—",
          fontFamily: "Barlow Condensed",
          fontSize: 48,
          fontWeight: 700,
          textAlign: "CENTER",
          color: "#FFFFFF",
          lineHeight: 1.1,
        },
      },
      {
        id: "member-ig",
        type: "VARIABLE_TEXT",
        pageIndex: 0,
        name: "Instagram",
        layout: layout(64, 1288, 952, 44, 31),
        configJson: {
          variableKey: "participant.instagramHandle",
          fallback: "",
          fontFamily: "DM Sans",
          fontSize: 28,
          fontWeight: 500,
          textAlign: "CENTER",
          color: "#FFE600",
          lineHeight: 1.2,
        },
      },
      {
        id: "member-city",
        type: "VARIABLE_TEXT",
        pageIndex: 0,
        name: "Ciudad",
        layout: layout(64, 1340, 952, 40, 32),
        configJson: {
          variableKey: "participant.city",
          fallback: "",
          fontFamily: "DM Sans",
          fontSize: 24,
          fontWeight: 500,
          textAlign: "CENTER",
          color: "#FFFFFF",
          lineHeight: 1.2,
        },
      },
      {
        id: "member-message",
        type: "VARIABLE_TEXT",
        pageIndex: 0,
        name: "Mensaje",
        layout: layout(96, 1420, 888, 120, 33),
        configJson: {
          variableKey: "card.message",
          fallback:
            "Una comunidad que recorre,\ncrea y muestra la ciudad\ndesde nuevas miradas.",
          fontFamily: "DM Sans",
          fontSize: 24,
          fontWeight: 400,
          textAlign: "CENTER",
          color: "#FFFFFF",
          lineHeight: 1.4,
        },
      },
      {
        id: "member-edition",
        type: "TEXT",
        pageIndex: 0,
        name: "Edición",
        layout: layout(64, 1680, 952, 72, 40),
        configJson: {
          content: "{edition.name} · {edition.eventDateFormatted}",
          fontFamily: "DM Sans",
          fontSize: 22,
          fontWeight: 500,
          textAlign: "CENTER",
          color: "#FFFFFF",
          lineHeight: 1.3,
        },
      },
      {
        id: "member-logo",
        type: "IMAGE",
        pageIndex: 0,
        name: "Logo",
        layout: layout(440, 1780, 200, 80, 41),
        configJson: {
          src: "",
          fit: "contain",
          source: { variableKey: "branding.logoUrl" },
        },
      },
      {
        id: "member-accent",
        type: "SHAPE",
        pageIndex: 0,
        name: "Barra amarilla",
        layout: layout(0, 1892, W, 28, 2),
        configJson: {
          variant: "rectangle",
          fill: "#FFE600",
          stroke: "#FFE600",
          strokeWidth: 0,
        },
      },
    ],
    variableBindings: [
      {
        blockId: "member-name",
        targetPath: "variableKey",
        variableKey: "participant.fullName",
      },
      {
        blockId: "member-ig",
        targetPath: "variableKey",
        variableKey: "participant.instagramHandle",
      },
      {
        blockId: "member-city",
        targetPath: "variableKey",
        variableKey: "participant.city",
      },
      {
        blockId: "member-message",
        targetPath: "variableKey",
        variableKey: "card.message",
      },
      {
        blockId: "member-photo",
        targetPath: "source.variableKey",
        variableKey: "participant.photoUrl",
      },
      {
        blockId: "member-logo",
        targetPath: "source.variableKey",
        variableKey: "branding.logoUrl",
      },
    ],
    meta: {
      product: "clickaton",
      templateKey: "CLICKATON_MEMBER_STORY_V1",
      templateVersion: 1,
      format: "instagram_story",
      purpose: "participant_member",
      templatePageCount: 1,
    },
  },
};
