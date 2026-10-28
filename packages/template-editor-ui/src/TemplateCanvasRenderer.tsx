"use client";

import { QrBlockRenderer } from "./QrBlockRenderer";
import React, { useState } from "react";
import {
  computeCoverCropRect,
  getResolvedVariableText,
  normalizePhotoCrop,
  getTextVisualConfig,
  toRenderableBlocks,
  type TemplateV2Block,
  type PhotoCrop,
  type TemplateV2Canvas,
} from "@repo/template-editor-core";
import {
  CLIENT_PHOTO_ROLE_SLOTS,
  CLIENT_PHOTO_VARIABLE_PATTERN,
  SCHOOL_CLIENT_PHOTO_PLACEHOLDER,
  distributeCourseMosaic,
  isClassListConfig,
  isCourseMosaicConfig,
  layoutCourseMosaic,
  parseCourseMosaic,
  parseCourseMosaicOwner,
  readCourseMosaicOptions,
  type CourseMosaicCell,
  type CourseMosaicOptions,
  type CourseMosaicStudent,
  layoutClassListBlock,
  parseClassListGroups,
  readClassListOptions,
  resolveBracePlaceholdersInText,
  resolveClassListHeadingStyle,
  formatFontFamilyCss,
} from "@repo/template-editor-core";

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
  /** Si se pasa, solo se dibujan los bloques de esa cara. */
  pageIndex?: number;
  /**
   * Fotos concretas para bloques de imagen, por id de bloque, con su encuadre. Lo usa la revisión
   * de diseños: cada hueco de foto del cliente muestra la foto asignada tal como va a imprimirse.
   */
  photoOverrides?: Record<string, PhotoOverride>;
};

export type PhotoOverride = { src: string; crop?: PhotoCrop };

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

type TextVisual = ReturnType<typeof getTextVisualConfig>;

/** La tipografía del párrafo, sin el tamaño de la caja. */
function textBodyStyle(t: TextVisual): React.CSSProperties {
  return {
    color: t.color,
    fontFamily: t.fontFamilyCss,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
    fontStyle: t.fontStyle,
    textDecoration: t.textDecoration,
    textTransform: t.textTransform,
    lineHeight: String(t.lineHeight),
    letterSpacing: `${t.letterSpacing}px`,
    textAlign: t.textAlign,
    whiteSpace: "pre-wrap",
  };
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
  /*
   * Arriba es lo de siempre y se dibuja exactamente igual que antes. Centro y abajo envuelven el
   * párrafo en una columna flexible: el alto del texto es renglones × interlineado, la misma
   * cuenta que hace la impresión (`desplazamientoVertical` en design-studio). La caja gira con su
   * contenido, así que en un texto girado la alineación es en el marco de la caja.
   */
  if (t.verticalAlign !== "top") {
    return (
      <div
        data-vertical-align={t.verticalAlign}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: t.verticalAlign === "middle" ? "center" : "flex-end",
          overflow: "hidden",
        }}
      >
        <div style={{ ...textBodyStyle(t), width: "100%", flexShrink: 0 }}>{t.content}</div>
      </div>
    );
  }
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
        textTransform: t.textTransform,
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

/**
 * La foto de un compañero, con su encuadre: la misma cuenta que usa la impresión. Sin estado a
 * propósito (la comparación pantalla/PDF dibuja esto en el servidor): la proporción de la foto
 * sale de `sourceAspect`; sin ella, la foto se centra.
 */
function MosaicPhoto({ student, width, height }: { student: CourseMosaicStudent; width: number; height: number }) {
  let style: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    maxWidth: "none",
  };
  if (student.sourceAspect) {
    const srcWidth = 1000 * student.sourceAspect;
    const rect = computeCoverCropRect({ srcWidth, srcHeight: 1000, slotWidth: width, slotHeight: height, crop: student.crop });
    const scale = width / rect.width;
    style = { ...style, width: srcWidth * scale, height: 1000 * scale, left: -rect.left * scale, top: -rect.top * scale };
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={student.photoUrl} alt="" draggable={false} style={style} />;
}

function initialsOf(s: CourseMosaicStudent): string {
  return [s.firstName, s.lastName]
    .map((p) => p.trim().charAt(0).toUpperCase())
    .filter(Boolean)
    .join("");
}

/** Una celda del mosaico: sombra, papel, foto (o silueta), borde, marco, cinta y nombre. */
function MosaicCellView({ cell, o, t, index }: { cell: CourseMosaicCell; o: CourseMosaicOptions; t: ReturnType<typeof getTextVisualConfig>; index: number }) {
  const round = o.frame === "circle" || o.frame === "ellipse";
  const radius = round ? "50%" : o.frame === "rounded" ? o.cornerRadius : 0;
  const rel = (r: { x: number; y: number; width: number; height: number }): React.CSSProperties => ({
    position: "absolute",
    left: r.x - cell.box.x,
    top: r.y - cell.box.y,
    width: r.width,
    height: r.height,
  });
  const paper = o.frame === "polaroid" ? cell.box : cell.photo;
  const s = cell.student;
  const src = s.photoUrl;
  return (
    <div
      data-mosaic-cell={index}
      style={{
        position: "absolute",
        left: cell.box.x,
        top: cell.box.y,
        width: cell.box.width,
        height: cell.box.height,
        transform: cell.rotation ? `rotate(${cell.rotation}deg)` : undefined,
      }}
    >
      {o.shadow && o.frame !== "ellipse" ? (
        <div
          style={{
            ...rel({ ...paper, x: paper.x + o.shadow.dx, y: paper.y + o.shadow.dy }),
            background: o.shadow.color,
            borderRadius: o.frame === "polaroid" ? 0 : radius,
          }}
        />
      ) : null}
      {o.frame === "polaroid" ? <div style={{ ...rel(cell.box), background: "#ffffff" }} /> : null}
      <div style={{ ...rel(cell.photo), overflow: "hidden", borderRadius: radius, background: o.emptyPhotos ? o.emptyFill : undefined }}>
        {o.emptyPhotos ? null : src ? (
          <MosaicPhoto student={s} width={cell.photo.width} height={cell.photo.height} />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              // La misma imagen gris que usa la impresión para la silueta.
              backgroundImage: `url("${SCHOOL_CLIENT_PHOTO_PLACEHOLDER}")`,
              backgroundSize: "cover",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#78716c",
              fontWeight: 700,
              fontFamily: t.fontFamilyCss,
              fontSize: cell.photo.width * 0.3,
            }}
          >
            {initialsOf(s)}
          </div>
        )}
      </div>
      {o.borderWidth > 0 && o.frame !== "ellipse" ? (
        <div
          style={{
            ...rel(cell.photo),
            border: `${o.borderWidth}px solid ${o.borderColor}`,
            borderRadius: radius,
            boxSizing: "border-box",
          }}
        />
      ) : null}
      {o.frameSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={o.frameSrc} alt="" draggable={false} style={{ ...rel(cell.photo), objectFit: "cover" }} />
      ) : null}
      {cell.name ? (
        <>
          {o.nameBackground ? (
            <div
              style={{
                ...rel({
                  x: cell.name.x,
                  y: cell.name.y - cell.name.fontSize * 0.15,
                  width: cell.name.width,
                  height: cell.name.height + cell.name.fontSize * 0.3,
                }),
                background: o.nameBackground,
              }}
            />
          ) : null}
          <div
            style={{
              ...rel(cell.name),
              color: t.color,
              fontFamily: t.fontFamilyCss,
              fontSize: cell.name.fontSize,
              fontWeight: t.fontWeight,
              fontStyle: t.fontStyle,
              textTransform: t.textTransform,
              lineHeight: String(t.lineHeight),
              textAlign: "center",
              whiteSpace: "pre",
              overflow: "hidden",
            }}
          >
            {cell.name.lines.join("\n")}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** «Mosaico del curso»: la misma cuenta de reparto que usa la impresión. */
function CourseMosaicBlockRenderer({
  config,
  students,
  layoutWidth,
  layoutHeight,
  readOnly,
}: {
  config: Record<string, unknown>;
  students: CourseMosaicStudent[];
  layoutWidth: number;
  layoutHeight: number;
  /** En las vistas de la familia un mosaico vacío no se ve, igual que en el papel. */
  readOnly: boolean;
}) {
  const o = readCourseMosaicOptions(config);
  const t = getTextVisualConfig(config);
  const { cells } = layoutCourseMosaic({
    students,
    options: o,
    width: layoutWidth,
    height: layoutHeight,
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
  });
  if (cells.length === 0) {
    if (readOnly) return null;
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed #94a3b8",
          color: "#64748b",
          fontSize: Math.max(12, Math.min(layoutWidth, layoutHeight) * 0.08),
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Mosaico del curso (sin compañeros)
      </div>
    );
  }
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {cells.map((cell, i) => (
        <MosaicCellView key={i} cell={cell} o={o} t={t} index={i} />
      ))}
    </div>
  );
}

/** «Listado del curso»: la misma cuenta de columnas y cuerpo que usa la impresión. */
function ClassListBlockRenderer({
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
  const key = String(config.variableKey ?? "");
  const options = readClassListOptions(config);
  const t = getTextVisualConfig(config);
  // Un listado guardado antes de los cursos con título usa el curso del diseño como título.
  const fallbackTitle = resolvedVariables?.["course.displayName"];
  const schoolName = resolvedVariables?.["school.name"];
  const { cells } = layoutClassListBlock({
    groups: parseClassListGroups(resolvedVariables?.[key], typeof fallbackTitle === "string" ? fallbackTitle : null),
    options,
    width: layoutWidth,
    height: layoutHeight,
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    verticalAlign: t.verticalAlign,
    schoolName: typeof schoolName === "string" ? schoolName : null,
  });
  if (cells.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px dashed #94a3b8",
          color: "#64748b",
          fontSize: Math.max(12, Math.min(layoutWidth, layoutHeight) * 0.08),
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Listado del curso (sin alumnos)
      </div>
    );
  }
  // Los títulos (curso y colegio) llevan su propio estilo; lo que no tienen lo toman de los nombres.
  const titulo = resolveClassListHeadingStyle(options.headingStyle, {
    fontFamily: t.fontFamily,
    textTransform: t.textTransform,
    color: t.color,
    bold: t.fontWeight >= 600,
    italic: t.fontStyle === "italic",
    align: t.textAlign,
  });
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {cells.map((cell, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: cell.x,
            top: cell.y,
            width: cell.width,
            height: cell.height,
            color: cell.heading ? titulo.color : t.color,
            fontFamily: cell.heading ? formatFontFamilyCss(titulo.fontFamily) : t.fontFamilyCss,
            fontSize: cell.fontSize,
            fontWeight: cell.heading ? (titulo.bold ? 700 : 400) : cell.bold ? 700 : t.fontWeight,
            fontStyle: cell.heading ? (titulo.italic ? "italic" : "normal") : t.fontStyle,
            textDecoration: t.textDecoration,
            textTransform: cell.heading ? titulo.textTransform : t.textTransform,
            lineHeight: String(t.lineHeight),
            letterSpacing: `${t.letterSpacing}px`,
            textAlign: cell.heading ? titulo.align : t.textAlign,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {cell.text}
        </div>
      ))}
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

/**
 * El nombre de un hueco de foto del cliente para mostrar mientras se diseña: "Foto individual",
 * "Foto grupal" o "Foto del cliente 3". `null` si el bloque no es un hueco de foto del cliente.
 */
function clientPhotoSlotTitle(variableKey: string): string | null {
  const conNombre = CLIENT_PHOTO_ROLE_SLOTS[variableKey];
  if (conNombre) return conNombre.label;
  const m = CLIENT_PHOTO_VARIABLE_PATTERN.exec(variableKey);
  return m ? `Foto del cliente ${m[1]}` : null;
}

/**
 * Hueco de foto sin foto todavía. Dice qué foto va y dónde queda arriba: gira junto con el
 * recuadro, así quien diseña lo orienta como quiere que se coloque la foto.
 */
function ClientPhotoSlotPlaceholder({
  title,
  layoutWidth,
  layoutHeight,
}: {
  title: string;
  layoutWidth: number;
  layoutHeight: number;
}) {
  const minSide = Math.min(Math.max(1, layoutWidth), Math.max(1, layoutHeight));
  const titlePx = Math.max(18, Math.round(minSide * 0.12));
  const hintPx = Math.max(12, Math.round(titlePx * 0.5));
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        border: "2px dashed #64748b",
        background: "#e2e8f0",
        color: "#1e293b",
        textAlign: "center",
        boxSizing: "border-box",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: Math.round(hintPx * 0.6),
          left: 0,
          right: 0,
          fontSize: hintPx,
          fontWeight: 600,
          color: "#475569",
        }}
      >
        ▲ arriba
      </span>
      <span style={{ fontSize: titlePx, fontWeight: 700, lineHeight: 1.1, padding: "0 6%" }}>{title}</span>
    </div>
  );
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
  /*
   * `previewSrc`: una copia liviana de la misma foto, sólo para la pantalla. El fotolibro guarda el
   * original en `src` —es lo que se imprime— y dibujar veinte originales de 20 MB volvería lento el
   * editor. Misma proporción, así que el encuadre se ve igual.
   */
  const previewSrc = typeof config.previewSrc === "string" && config.previewSrc ? config.previewSrc : null;
  const srcCandidate = variableKey
    ? resolvedVariables?.[variableKey]
    : (previewSrc ?? config.src ?? source.src ?? source.url);
  const src = srcCandidate == null ? "" : String(srcCandidate);
  /*
   * Cover (llenar el marco recortando) salvo que el bloque pida "contain": un logo tiene que
   * entrar entero. El PDF (`editorADocumento`) ya respetaba "contain"; la pantalla recortaba igual
   * y lo que se aprobaba no era lo que se imprimía.
   */
  const objectFit = config.fit === "contain" ? ("contain" as const) : ("cover" as const);
  const borderRadius = Number(config.borderRadius ?? 0);
  const photoMode = String(config.photoMode ?? "free").toLowerCase();
  const maskShape = String(config.maskShape ?? "rect").toLowerCase();
  const modeLabel = PHOTO_MODE_LABEL[photoMode] ?? PHOTO_MODE_LABEL.free;
  const slotTitle = clientPhotoSlotTitle(variableKey);
  if (slotTitle && (!src || src === SCHOOL_CLIENT_PHOTO_PLACEHOLDER)) {
    return <ClientPhotoSlotPlaceholder title={slotTitle} layoutWidth={layoutWidth} layoutHeight={layoutHeight} />;
  }

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
          background: "var(--te-chrome-sunken)",
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
          <span style={{ fontSize: subtitlePx, fontWeight: 600, color: "var(--te-ink-muted)" }}>{modeLabel}</span>
        </span>
      </div>
    );
  }

  /*
   * Foto reencuadrada en su marco (zoom y corrimiento): se dibuja con la misma cuenta que la
   * impresión. Sin encuadre guardado sigue el camino de siempre, centrada.
   */
  if (objectFit === "cover" && config.crop) {
    return (
      <CroppedPhotoRenderer
        override={{ src, crop: normalizePhotoCrop(config.crop) }}
        config={config}
        layoutWidth={layoutWidth}
        layoutHeight={layoutHeight}
      />
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
          background: "var(--te-chrome-sunken)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" style={{ ...imgStyle, borderRadius: 0 }} />
      </div>
    );
  }

  if (maskShape === "circle") {
    /*
     * El círculo va inscripto en el lado corto, como en la impresión, y fuera de él no se pinta
     * nada: antes el recuadro llevaba un fondo gris que se veía en pantalla y no se imprimía.
     */
    const lado = Math.min(layoutWidth, layoutHeight);
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: lado,
            height: lado,
            flex: "none",
            borderRadius: "50%",
            overflow: "hidden",
            background: "var(--te-line)",
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

/**
 * Una foto encuadrada en su hueco, con la misma cuenta que usa la exportación
 * (`computeCoverCropRect`): lo que se aprueba en pantalla es lo que se imprime.
 */
function CroppedPhotoRenderer({
  override,
  config,
  layoutWidth,
  layoutHeight,
}: {
  override: PhotoOverride;
  config: Record<string, unknown>;
  layoutWidth: number;
  layoutHeight: number;
}) {
  const [natural, setNatural] = useState<{ src: string; w: number; h: number } | null>(null);
  const size = natural && natural.src === override.src ? natural : null;
  const maskShape = String(config.maskShape ?? "rect").toLowerCase();
  const borderRadius = Math.max(0, Number(config.borderRadius ?? 0));

  let imgStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    maxWidth: "none",
  };
  if (size) {
    const rect = computeCoverCropRect({
      srcWidth: size.w,
      srcHeight: size.h,
      slotWidth: layoutWidth,
      slotHeight: layoutHeight,
      crop: override.crop,
    });
    const scale = layoutWidth / rect.width;
    imgStyle = {
      ...imgStyle,
      width: size.w * scale,
      height: size.h * scale,
      left: -rect.left * scale,
      top: -rect.top * scale,
      objectFit: "fill",
    };
  }

  const clip: React.CSSProperties =
    maskShape === "ellipse"
      ? { borderRadius: "50%" }
      : maskShape === "circle"
        ? { clipPath: `circle(${Math.min(layoutWidth, layoutHeight) / 2}px at 50% 50%)` }
        : { borderRadius };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "var(--te-chrome-sunken, #eef0f2)",
        ...clip,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={override.src}
        alt=""
        draggable={false}
        style={imgStyle}
        onLoad={(e) => {
          const el = e.currentTarget;
          setNatural({ src: override.src, w: el.naturalWidth, h: el.naturalHeight });
        }}
      />
    </div>
  );
}

function ShapeBlockRenderer({
  config,
  layoutWidth,
  layoutHeight,
}: {
  config: Record<string, unknown>;
  layoutWidth: number;
  layoutHeight: number;
}) {
  const variant = String(config.variant ?? "rectangle").toLowerCase();
  const fill = typeof config.fill === "string" ? config.fill : "var(--te-line)";
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
            // Con tamaño "auto" el círculo medía cero y no se veía; la impresión sí lo dibujaba.
            width: Math.min(layoutWidth, layoutHeight),
            height: Math.min(layoutWidth, layoutHeight),
            flex: "none",
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
  const bg = typeof config.backgroundColor === "string" ? config.backgroundColor : "var(--te-surface)";
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
        background: "var(--te-line)",
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
  pageIndex,
  photoOverrides,
}: TemplateCanvasRendererProps) {
  const canvasBackground = typeof canvas.background === "string" ? canvas.background : "var(--te-surface)";
  const renderableBlocks = toRenderableBlocks(
    pageIndex == null ? blocks : blocks.filter((b) => (b.pageIndex ?? 0) === pageIndex),
  );
  const selectedSet = new Set(selectedBlockIds);
  // Los bloques del mosaico se reparten los chicos entre todos (de todas las páginas), como en la
  // impresión. Sin valor, ninguno: el editor trae la muestra en sus variables de ejemplo, y una
  // carpeta real nunca muestra compañeros inventados.
  const mosaicValue = resolvedVariables?.["course.mosaic"];
  const mosaicOwner = resolvedVariables?.["course.mosaicOwner"];
  const studentsByMosaic = distributeCourseMosaic(
    blocks.map((b) => ({ id: b.id, configJson: b.type === "VARIABLE_TEXT" ? b.configJson : undefined })),
    typeof mosaicValue === "string" ? parseCourseMosaic(mosaicValue) : [],
    typeof mosaicOwner === "string" ? parseCourseMosaicOwner(mosaicOwner) : null,
  );

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
              ) : isCourseMosaicConfig(block.configJson) ? (
                <CourseMosaicBlockRenderer
                  config={block.configJson}
                  students={studentsByMosaic.get(block.id) ?? []}
                  layoutWidth={block.layout.width}
                  layoutHeight={block.layout.height}
                  readOnly={readOnly}
                />
              ) : isClassListConfig(block.configJson) ? (
                <ClassListBlockRenderer
                  config={block.configJson}
                  resolvedVariables={resolvedVariables}
                  layoutWidth={block.layout.width}
                  layoutHeight={block.layout.height}
                />
              ) : (
                <VariableTextBlockRenderer config={block.configJson} resolvedVariables={resolvedVariables} />
              )
            ) : null}
            {(block.type === "IMAGE" || block.type === "PHOTO") && photoOverrides?.[block.id]?.src ? (
              <CroppedPhotoRenderer
                override={photoOverrides[block.id]!}
                config={block.configJson}
                layoutWidth={block.layout.width}
                layoutHeight={block.layout.height}
              />
            ) : null}
            {block.type === "IMAGE" && !photoOverrides?.[block.id]?.src ? (
              <ImageBlockRenderer
                config={block.configJson}
                resolvedVariables={resolvedVariables}
                layoutWidth={block.layout.width}
                layoutHeight={block.layout.height}
              />
            ) : null}
            {block.type === "SHAPE" ? (
              <ShapeBlockRenderer
                config={block.configJson}
                layoutWidth={block.layout.width}
                layoutHeight={block.layout.height}
              />
            ) : null}
            {block.type === "QR" ? (
              <QrBlockRenderer
                config={block.configJson}
                resolvedVariables={resolvedVariables}
                layoutWidth={block.layout.width}
                layoutHeight={block.layout.height}
              />
            ) : null}
            {block.type === "BACKGROUND" ? <BackgroundLegacyRenderer config={block.configJson} /> : null}
            {block.type === "PHOTO" && !photoOverrides?.[block.id]?.src ? (
              <PhotoLegacyRenderer layoutWidth={block.layout.width} layoutHeight={block.layout.height} />
            ) : null}
          </BlockContainer>
        );
      })}
    </div>
  );
}
