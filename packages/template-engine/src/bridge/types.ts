import type { TemplateDocument } from "../schema/document";

/** Payload editor Template V2 (apps/compramelafoto validate-save-payload). */
export type LegacyTemplateV2BlockType =
  | "BACKGROUND"
  | "PHOTO"
  | "TEXT"
  | "VARIABLE_TEXT"
  | "IMAGE"
  | "SHAPE"
  | "QR";

export type LegacyTemplateV2Payload = {
  canvas: {
    width: number;
    height: number;
    background?: string;
    dpi?: number;
    bleedMm?: number;
    safeAreaMm?: number;
  };
  blocks: Array<{
    id: string;
    type: LegacyTemplateV2BlockType;
    name?: string;
    pageIndex?: number;
    layout: {
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      zIndex: number;
      opacity: number;
      locked?: boolean;
      visible: boolean;
    };
    configJson: Record<string, unknown>;
  }>;
  variableBindings: Array<{
    id?: string;
    blockId: string;
    targetPath: string;
    variableKey: string;
    formatter?: string;
    fallbackOverride?: string | null;
  }>;
  meta: Record<string, unknown>;
};

export type BridgeWarning = {
  code: string;
  message: string;
  field?: string;
};

export type FromLegacyResult = {
  document: TemplateDocument;
  warnings: BridgeWarning[];
};

export type ToLegacyResult = {
  payload: LegacyTemplateV2Payload;
  warnings: BridgeWarning[];
};
