import React from "react";
import {
  getResolvedVariableText,
  getTextVisualConfig,
  toRenderableBlocks,
  type TemplateV2Block,
  type TemplateV2Canvas,
} from "@/lib/template-v2/render-core";
import { resolveBracePlaceholdersInText } from "@/lib/template-v2/resolve-text-brace-variables";

type TemplateCanvasRendererProps = {
  canvas: TemplateV2Canvas;
  blocks: TemplateV2Block[];
  resolvedVariables?: Record<string, unknown>;
  readOnly: boolean;
  selectedBlockIds?: string[];
  /** Si el editor pinta el marco/handles del primario, evita outline duplicado en ese bloque. */
  primarySelectedBlockId?: string | null;
  /** Solo editor: resalta bloques con avisos de diagnóstico (no seleccionados). */
  diagnosticHighlightByBlockId?: Map<string, "strong" | "soft">;
  /** Editor: mientras se edita inline, oculta el cuerpo del texto para no duplicarlo bajo el contentEditable. */
  hideTextBodyForBlockId?: string | null;
  className?: string;
};

/** Multiselección: contorno liviano; el primario se pinta en TemplateEditorCanvas (handles). */
const SECONDARY_SELECTION_OUTLINE = "1.5px solid rgba(59, 130, 246, 0.42)";

function BlockContainer({
  block,
  outlineSelected,
  diagnosticHighlight,
  readOnly,
  children,
}: {
  block: TemplateV2Block;
  outlineSelected: boolean;
  diagnosticHighlight: "strong" | "soft" | null;
  readOnly: boolean;
  children: React.ReactNode;
}) {
  const { x, y, width, height, rotation, zIndex, opacity, locked } = block.layout;

  let outline: string = "none";
  let outlineOffset: number | undefined;
  if (outlineSelected) {
    outline = SECONDARY_SELECTION_OUTLINE;
    outlineOffset = 0;
  } else if (diagnosticHighlight === "strong") {
    outline = "2px solid rgba(220, 38, 38, 0.72)";
    outlineOffset = 0;
  } else if (diagnosticHighlight === "soft") {
    outline = "2px solid rgba(245, 158, 11, 0.55)";
    outlineOffset = 0;
  }

  return (
    <div
      data-block-id={block.id}
      data-block-type={block.type}
      data-locked={locked ? "1" : "0"}
      data-diagnostic={diagnosticHighlight ?? undefined}
      data-selection-secondary={outlineSelected ? "1" : undefined}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center center",
        zIndex,
        opacity: opacity ?? 1,
        outline,
        outlineOffset,
        transition: "outline-color 160ms ease, outline-width 160ms ease",
        pointerEvents: readOnly ? "none" : "auto",
      }}
      className={locked ? "template-v2-block--locked" : undefined}
    >
      {children}
    </div>
  );
}

function TextBlockRenderer({
  config,
  resolvedVariables,
}: {
  config: Record<string, unknown>;
  resolvedVariables?: Record<string, unknown>;
}) {
  const raw = String(config.content ?? "");
  /** Siempre resolver `{variables}` cuando no se edita inline: catálogo + mapa opcional (nunca dejar solo el texto crudo si hay token conocido). */
  const display = resolveBracePlaceholdersInText(raw, resolvedVariables);
  const t = getTextVisualConfig({ ...config, content: display });
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        color: t.color,
        fontFamily: t.fontFamilyCss,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        fontStyle: t.fontStyle,
        textDecoration: t.textDecoration,
        lineHeight: String(t.lineHeight),
        letterSpacing: `${t.letterSpacing}px`,
        textAlign: t.textAlign,
        whiteSpace: "pre-wrap",
        overflow: "hidden",
      }}
    >
      {t.content}
    </div>
  );
}

function VariableTextBlockRenderer({
  config,
  resolvedVariables,
}: {
  config: Record<string, unknown>;
  resolvedVariables?: Record<string, unknown>;
}) {
  const content = getResolvedVariableText(config, resolvedVariables);
  const display = resolveBracePlaceholdersInText(content, resolvedVariables);
  return <TextBlockRenderer config={{ ...config, content: display }} resolvedVariables={resolvedVariables} />;
}

const PHOTO_MODE_LABEL: Record<string, string> = {
  single: "Foto individual",
  group: "Foto grupal",
  free: "Libre",
};

/** Texto del placeholder sin imagen: escala con el marco (los 11px fijos se perdían en lienzos grandes). */
function imagePlaceholderTypography(layoutWidth: number, layoutHeight: number): {
  titlePx: number;
  subtitlePx: number;
  padPx: number;
} {
  const minSide = Math.min(Math.max(1, layoutWidth), Math.max(1, layoutHeight));
  /** ~11% del lado menor, p. ej. ~55px en ~500px (~5× sobre 11); tope para no desbordar. */
  const titlePx = Math.min(120, Math.max(40, Math.round(minSide * 0.11)));
  const subtitlePx = Math.max(26, Math.round(titlePx * 0.78));
  const padPx = Math.min(56, Math.max(14, Math.round(titlePx * 0.45)));
  return { titlePx, subtitlePx, padPx };
}

function ImageBlockRenderer({
  config,
  resolvedVariables,
  layoutWidth,
  layoutHeight,
}: {
  config: Record<string, unknown>;
  resolvedVariables?: Record<string, unknown>;
  layoutWidth: number;
  layoutHeight: number;
}) {
  const source = (config.source as Record<string, unknown> | undefined) ?? {};
  const variableKey = typeof source.variableKey === "string" ? source.variableKey : "";
  const srcCandidate = variableKey ? resolvedVariables?.[variableKey] : (config.src ?? source.src ?? source.url);
  const src = srcCandidate == null ? "" : String(srcCandidate);
  /** Siempre cover: proporción de la imagen + llenar el marco (recorte). */
  const objectFit = "cover" as const;
  const borderRadius = Number(config.borderRadius ?? 0);
  const photoMode = String(config.photoMode ?? "free").toLowerCase();
  const maskShape = String(config.maskShape ?? "rect").toLowerCase();
  const modeLabel = PHOTO_MODE_LABEL[photoMode] ?? PHOTO_MODE_LABEL.free;

  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit,
    display: "block",
  };

  if (!src) {
    const { titlePx, subtitlePx, padPx } = imagePlaceholderTypography(layoutWidth, layoutHeight);
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          placeItems: "center",
          border: "1px solid #94a3b8",
          background: "#f1f5f9",
          color: "#334155",
          textAlign: "center",
          padding: padPx,
          lineHeight: 1.2,
          boxSizing: "border-box",
        }}
      >
        <span style={{ fontSize: titlePx, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Imagen
          <br />
          <span style={{ fontSize: subtitlePx, fontWeight: 600, color: "#475569" }}>{modeLabel}</span>
        </span>
      </div>
    );
  }

  if (maskShape === "ellipse") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          overflow: "hidden",
          background: "#f1f5f9",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" style={{ ...imgStyle, borderRadius: 0 }} />
      </div>
    );
  }

  if (maskShape === "circle") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1f5f9",
        }}
      >
        <div
          style={{
            width: "auto",
            height: "auto",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: "1",
            borderRadius: "50%",
            overflow: "hidden",
            background: "#e2e8f0",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" style={{ ...imgStyle, width: "100%", height: "100%" }} />
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" style={{ ...imgStyle, borderRadius: Math.max(0, borderRadius) }} />
  );
}

function ShapeBlockRenderer({ config }: { config: Record<string, unknown> }) {
  const variant = String(config.variant ?? "rectangle").toLowerCase();
  const fill = typeof config.fill === "string" ? config.fill : "#e5e7eb";
  const stroke = typeof config.stroke === "string" ? config.stroke : "transparent";
  const strokeWidth = Number(config.strokeWidth ?? 0);
  const sw = Math.max(0, strokeWidth);
  const radius = Number(config.radius ?? 0);

  if (variant === "ellipse") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: fill,
          border: `${sw}px solid ${stroke}`,
          borderRadius: "50%",
          boxSizing: "border-box",
        }}
      />
    );
  }

  if (variant === "circle") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <div
          style={{
            width: "auto",
            height: "auto",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: "1",
            background: fill,
            border: `${sw}px solid ${stroke}`,
            borderRadius: "50%",
            boxSizing: "border-box",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: fill,
        border: `${sw}px solid ${stroke}`,
        borderRadius: Math.max(0, radius),
        boxSizing: "border-box",
      }}
    />
  );
}

function BackgroundLegacyRenderer({ config }: { config: Record<string, unknown> }) {
  const bg = typeof config.backgroundColor === "string" ? config.backgroundColor : "#ffffff";
  const src = typeof config.src === "string" ? config.src.trim() : "";
  const objectFit = "cover" as const;
  if (src) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: bg,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit, display: "block" }} />
      </div>
    );
  }
  return <div style={{ width: "100%", height: "100%", background: bg }} />;
}

function PhotoLegacyRenderer({ layoutWidth, layoutHeight }: { layoutWidth: number; layoutHeight: number }) {
  const { titlePx, padPx } = imagePlaceholderTypography(layoutWidth, layoutHeight);
  const slotPx = Math.max(Math.round(titlePx * 0.65), 22);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: "1px dashed #64748b",
        background: "#e2e8f0",
        display: "grid",
        placeItems: "center",
        color: "#1e293b",
        padding: padPx,
        textAlign: "center",
        lineHeight: 1.15,
        fontWeight: 700,
        fontSize: slotPx,
        letterSpacing: "0.02em",
        boxSizing: "border-box",
      }}
    >
      PHOTO SLOT
    </div>
  );
}

export function TemplateCanvasRenderer({
  canvas,
  blocks,
  resolvedVariables,
  readOnly,
  selectedBlockIds = [],
  primarySelectedBlockId = null,
  diagnosticHighlightByBlockId,
  hideTextBodyForBlockId = null,
  className,
}: TemplateCanvasRendererProps) {
  const canvasBackground = typeof canvas.background === "string" ? canvas.background : "#ffffff";
  const renderableBlocks = toRenderableBlocks(blocks);
  const selectedSet = new Set(selectedBlockIds);

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: canvas.width,
        height: canvas.height,
        background: canvasBackground,
        overflow: "hidden",
      }}
    >
      {renderableBlocks.map((block) => {
        const inSelection = selectedSet.has(block.id);
        const outlineSelected =
          inSelection && (primarySelectedBlockId == null || block.id !== primarySelectedBlockId);
        const rawDiag = diagnosticHighlightByBlockId?.get(block.id);
        const diagnosticHighlight: "strong" | "soft" | null =
          inSelection || !rawDiag ? null : rawDiag;
        return (
          <BlockContainer
            key={block.id}
            block={block}
            outlineSelected={outlineSelected}
            diagnosticHighlight={diagnosticHighlight}
            readOnly={readOnly}
          >
            {block.type === "TEXT" ? (
              hideTextBodyForBlockId === block.id ? (
                <div style={{ width: "100%", height: "100%" }} aria-hidden />
              ) : (
                <TextBlockRenderer config={block.configJson} resolvedVariables={resolvedVariables} />
              )
            ) : null}
            {block.type === "VARIABLE_TEXT" ? (
              hideTextBodyForBlockId === block.id ? (
                <div style={{ width: "100%", height: "100%" }} aria-hidden />
              ) : (
                <VariableTextBlockRenderer config={block.configJson} resolvedVariables={resolvedVariables} />
              )
            ) : null}
            {block.type === "IMAGE" ? (
              <ImageBlockRenderer
                config={block.configJson}
                resolvedVariables={resolvedVariables}
                layoutWidth={block.layout.width}
                layoutHeight={block.layout.height}
              />
            ) : null}
            {block.type === "SHAPE" ? <ShapeBlockRenderer config={block.configJson} /> : null}
            {block.type === "BACKGROUND" ? <BackgroundLegacyRenderer config={block.configJson} /> : null}
            {block.type === "PHOTO" ? (
              <PhotoLegacyRenderer layoutWidth={block.layout.width} layoutHeight={block.layout.height} />
            ) : null}
          </BlockContainer>
        );
      })}
    </div>
  );
}
