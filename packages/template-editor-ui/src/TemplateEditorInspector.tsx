"use client";

import { useMemo } from "react";
import { BackgroundImageField } from "./inspector/BackgroundImageField";
import { BlockSizePanel } from "./inspector/BlockSizePanel";
import { ColorField } from "./inspector/ColorField";
import { ImageBlockUploadSection } from "./inspector/ImageBlockUploadSection";
import { ImageCropSection } from "./inspector/ImageCropSection";
import { FieldLabel, InspectorPanel } from "./inspector/InspectorPanel";
import { NumberSliderField } from "./inspector/NumberSliderField";
import { SegmentedControl } from "./inspector/SegmentedControl";
import { ToggleSwitch } from "./inspector/ToggleSwitch";
import type { CanvasQuickAlignment } from "@repo/template-editor-core";
import {
  canvasDpi,
  classListHeadingScale,
  ptFromPx,
  pxFromPt,
  roundPt,
  CLASS_LIST_MAX_COLUMNS,
  CLASS_LIST_VARIABLE_KEY,
  DEFAULT_CLASS_LIST_OPTIONS,
  isClassListConfig,
  readClassListOptions,
  resolveClassListHeadingStyle,
  getTextVisualConfig,
  EDITOR_FONT_CATALOG,
  EDITOR_FONT_CATEGORY_LABELS,
  type ClassListHeadingStyle,
  type ClassListOptions,
  type ClassListTextStyle,
  type EditorFontCategory,
  COURSE_MOSAIC_PHOTO_ASPECT_MAX,
  COURSE_MOSAIC_PHOTO_ASPECT_MIN,
  COURSE_MOSAIC_TILT_MAX,
  isCourseMosaicConfig,
  readCourseMosaicOptions,
  type CourseMosaicOptions,
} from "@repo/template-editor-core";
import {
  alignBlocksToSelectionBounds,
  anySelectedBlockLocked,
  distributeBlocksInSelection,
  type DistributeAxis,
} from "@repo/template-editor-core";
import { areTemplateV2BlockArraysEquivalent } from "@repo/template-editor-core";
import { getSafeAreaRectPx } from "@repo/template-editor-core";
import { getLayoutSafeAreaStatus } from "@repo/template-editor-core";
import type { TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";
import {
  getTextVariableGroupsForProduct,
  getVariableByKeyForProduct,
} from "@repo/template-editor-core";
import type { TemplateProductId } from "@repo/template-editor-core";
import {
  setBlocks,
  setCanvas,
  type TemplateV2EditorDispatch,
  type TemplateV2VariableBinding,
} from "@repo/template-editor-core";
import { AlignmentGlyph } from "./alignment-glyph";
import { TemplateVariableBraceInsertPanel } from "./TemplateVariableBraceInsertPanel";
import { variableTextFormatsFor } from "@repo/template-editor-core";
import { cn } from "./primitives/cn";

type Props = {
  selectedBlock: TemplateV2Block | null;
  /** Número de bloques seleccionados (incluye el primario). Si > 1, el inspector sigue editando el primario. */
  selectedBlockCount?: number;
  /** Ids de la selección actual (multiselección). */
  selectedBlockIds?: string[];
  /** Estado completo de bloques (alineación/distribución del conjunto). */
  blocks: TemplateV2Block[];
  canvas: TemplateV2Canvas;
  templateId: string;
  versionId: string;
  variableBindings: TemplateV2VariableBinding[];
  dispatch: TemplateV2EditorDispatch;
  /** Producto de la plantilla (catálogo de variables). */
  product?: TemplateProductId | "unknown";
  className?: string;
};

function asObject(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return v as Record<string, unknown>;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const inputBase =
  "h-6 w-full rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-1.5 text-[11px] text-[color:var(--te-ink)] focus:border-[color:var(--te-accent)] focus:outline-none";

const selectBase =
  "h-6 w-full rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-1.5 text-[11px] text-[color:var(--te-ink)] focus:border-[color:var(--te-accent)] focus:outline-none";

const alignBtnClass =
  "h-6 rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-2 text-[11px] font-medium text-[color:var(--te-ink)] transition-colors hover:border-[color:var(--te-line-strong)] hover:bg-[color:var(--te-chrome)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[color:var(--te-surface)]";

/** Botón cuadrado con icono de alineación (zona segura / conjunto). */
const alignIconBtnClass =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--te-radius)] border border-[color:var(--te-line)] bg-[color:var(--te-surface)] text-[color:var(--te-ink)] transition-colors hover:border-[color:var(--te-accent)] hover:bg-[color:var(--te-accent-wash)] hover:text-[color:var(--te-accent)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[color:var(--te-line)] disabled:hover:bg-[color:var(--te-surface)] disabled:hover:text-[color:var(--te-ink)]";

export function TemplateEditorInspector({
  selectedBlock,
  selectedBlockCount = 1,
  selectedBlockIds = [],
  blocks,
  canvas,
  templateId,
  versionId,
  variableBindings,
  dispatch,
  product = "school",
  className,
}: Props) {
  const TEXT_VARIABLE_GROUPS = getTextVariableGroupsForProduct(product);
  /** El listado del curso existe sólo en las plantillas escolares (CLF). */
  const offersClassList = product === "school" || product === "unknown";
  const TEXT_VARIABLE_CATALOG_KEYS = new Set(
    TEXT_VARIABLE_GROUPS.flatMap((g) => g.variables.map((v) => v.key))
  );

  if (!selectedBlock) {
    const bg = typeof canvas.background === "string" ? canvas.background : "var(--te-surface)";
    return (
      <div className={cn("w-full min-w-0", className)}>
        <InspectorPanel title="Hoja">
          <ColorField
            label="Color de fondo"
            value={bg}
            onChange={(hex) => dispatch(setCanvas({ background: hex }))}
          />
        </InspectorPanel>
        <p className="px-3 py-2 text-[11px] leading-snug text-[color:var(--te-ink-faint)]">
          Elegí un bloque en el lienzo para editar sus propiedades.
        </p>
      </div>
    );
  }

  const cfg = asObject(selectedBlock.configJson);
  const updateLayout = (patch: Partial<TemplateV2Block["layout"]>) => {
    dispatch({ type: "updateBlock", payload: { blockId: selectedBlock.id, patch: { layout: patch } } });
  };
  const updateConfig = (patch: Record<string, unknown>) => {
    dispatch({
      type: "updateBlock",
      payload: {
        blockId: selectedBlock.id,
        patch: { configJson: { ...cfg, ...patch } },
      },
    });
  };

  const layout = selectedBlock.layout;

  const variableKeyStr =
    selectedBlock.type === "VARIABLE_TEXT" ? String(cfg.variableKey ?? "") : "";
  const variableCatalogHint =
    selectedBlock.type === "VARIABLE_TEXT" && variableKeyStr
      ? getVariableByKeyForProduct(product, variableKeyStr)
      : undefined;

  const multiLocked =
    selectedBlockCount > 1 && selectedBlockIds.length > 0
      ? anySelectedBlockLocked(blocks, selectedBlockIds)
      : false;
  const canDistribute = selectedBlockCount >= 3;

  const primarySafeAreaStatus = useMemo(() => {
    const safe = getSafeAreaRectPx(canvas);
    return getLayoutSafeAreaStatus(selectedBlock.layout, safe);
  }, [selectedBlock.layout, canvas]);

  function applyMultiAlign(key: CanvasQuickAlignment) {
    const next = alignBlocksToSelectionBounds(key, canvas.width, canvas.height, blocks, selectedBlockIds);
    if (areTemplateV2BlockArraysEquivalent(blocks, next)) return;
    dispatch(setBlocks(next));
  }

  function applyDistribute(axis: DistributeAxis) {
    const next = distributeBlocksInSelection(axis, canvas.width, canvas.height, blocks, selectedBlockIds);
    if (areTemplateV2BlockArraysEquivalent(blocks, next)) return;
    dispatch(setBlocks(next));
  }

  return (
    <div className={cn("w-full min-w-[240px]", className)}>

      <BlockSizePanel block={selectedBlock} canvas={canvas} dispatch={dispatch} />

      {/*
        La opacidad estaba en cada fila de la lista de capas, con su deslizador siempre a la
        vista. Es una propiedad del bloque como el color o el tamaño, y vive donde viven las
        propiedades del bloque.
      */}
      <InspectorPanel title="Opacidad">
        {/* El número del deslizador ya muestra el valor; repetirlo con "%" al lado era ruido. */}
        <NumberSliderField
          value={Math.round((selectedBlock.layout.opacity ?? 1) * 100)}
          onChange={(v) => updateLayout({ opacity: v / 100 })}
          min={0}
          max={100}
          step={1}
          ariaLabel={`Opacidad de ${selectedBlock.name ?? "el bloque"}`}
        />
      </InspectorPanel>

      <TemplateVariableBraceInsertPanel
        selectedBlockId={selectedBlock.id}
        selectedKind={
          selectedBlock.type === "TEXT" || selectedBlock.type === "VARIABLE_TEXT" ? selectedBlock.type : null
        }
        product={product}
      />

      {selectedBlockCount > 1 ? (
        <p className="flex items-center gap-1.5 border-b border-[color:var(--te-line)] bg-amber-400/10 px-3 py-1.5 text-[11px] leading-snug text-amber-200">
          <span aria-hidden className="text-amber-400">⚠</span>
          Hay {selectedBlockCount} bloques seleccionados. Las propiedades de abajo siguen al{" "}
          <span className="font-medium">último seleccionado (primario)</span>. Usá la sección siguiente para alinear o
          distribuir todo el conjunto.
        </p>
      ) : null}

      {selectedBlockCount > 1 ? (
        <InspectorPanel title="Alineación del conjunto">
          <p className="text-[11px] leading-snug text-[color:var(--te-ink-muted)]">
            Respecto del rectángulo que envuelve los seleccionados (no del lienzo). La selección se mantiene.
          </p>
          {multiLocked ? (
            <p className="mt-1.5 text-[10px] leading-snug text-amber-200">
              Desbloqueá todos los bloques seleccionados para alinear, distribuir o mover el conjunto.
            </p>
          ) : null}
          <div className="mt-2 flex w-fit flex-nowrap items-center gap-1">
            {(
              [
                { key: "left" as const, title: "Alinear bordes izquierdos al conjunto" },
                { key: "center-x" as const, title: "Centrar horizontalmente en el conjunto" },
                { key: "right" as const, title: "Alinear bordes derechos al conjunto" },
                { key: "top" as const, title: "Alinear bordes superiores al conjunto" },
                { key: "center-y" as const, title: "Centrar verticalmente en el conjunto" },
                { key: "bottom" as const, title: "Alinear bordes inferiores al conjunto" },
              ] satisfies { key: CanvasQuickAlignment; title: string }[]
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                className={alignIconBtnClass}
                title={item.title}
                aria-label={item.title}
                disabled={multiLocked}
                onClick={() => applyMultiAlign(item.key)}
              >
                <AlignmentGlyph kind={item.key} />
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-medium text-[color:var(--te-ink)]">Distribución uniforme</p>
          <p className="text-[11px] leading-snug text-[color:var(--te-ink-muted)]">
            Iguala el espacio libre <span className="font-medium text-[color:var(--te-ink-muted)]">entre</span> bloques vecinos (entre
            bordes). Los extremos del conjunto son el borde más a la izquierda/derecha (↔) o arriba/abajo (↕) de la caja
            envolvente; el orden sigue la posición en ese eje.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              className={alignBtnClass}
              title="Distribuir espacio en horizontal (≥3 bloques, sin bloqueados)"
              disabled={multiLocked || !canDistribute}
              onClick={() => applyDistribute("horizontal")}
            >
              Distribuir ↔
            </button>
            <button
              type="button"
              className={alignBtnClass}
              title="Distribuir espacio en vertical (≥3 bloques, sin bloqueados)"
              disabled={multiLocked || !canDistribute}
              onClick={() => applyDistribute("vertical")}
            >
              Distribuir ↕
            </button>
          </div>
          {!canDistribute ? (
            <p className="mt-1.5 text-[10px] text-[color:var(--te-ink-faint)]">
              Necesitás al menos tres bloques en la selección para repartir espacio intermedio.
            </p>
          ) : null}
          {canDistribute && multiLocked ? (
            <p className="mt-1.5 text-[10px] text-amber-200">Quitá el candado de todos los seleccionados para distribuir.</p>
          ) : null}
        </InspectorPanel>
      ) : null}

      {primarySafeAreaStatus !== "inside" && selectedBlock.type !== "BACKGROUND" ? (
        <p className="flex items-center gap-1.5 border-b border-[color:var(--te-line)] bg-amber-400/10 px-3 py-1.5 text-[11px] leading-snug text-amber-200">
          <span aria-hidden className="text-amber-400">⚠</span>
          {primarySafeAreaStatus === "outside" ? (
            <>Fuera de la zona segura.</>
          ) : (
            <>Parcialmente fuera de la zona segura.</>
          )}{" "}

        </p>
      ) : null}

      {selectedBlock.type === "VARIABLE_TEXT" && isClassListConfig(cfg) && (
        <ClassListOptionsPanel
          options={readClassListOptions(cfg)}
          namesStyle={classListNamesStyle(cfg)}
          namesFontSize={getTextVisualConfig(cfg).fontSize}
          dpi={canvasDpi(canvas)}
          onChange={(patch) => updateConfig({ classList: { ...readClassListOptions(cfg), ...patch } })}
          onNamesChange={updateConfig}
          onUseOtherVariable={() => {
            const next: Record<string, unknown> = { ...cfg, variableKey: "student.fullName" };
            delete next.classList;
            dispatch({
              type: "updateBlock",
              payload: { blockId: selectedBlock.id, patch: { configJson: next } },
            });
          }}
        />
      )}

      {selectedBlock.type === "VARIABLE_TEXT" && isCourseMosaicConfig(cfg) && (
        <CourseMosaicOptionsPanel
          options={readCourseMosaicOptions(cfg)}
          templateId={templateId}
          versionId={versionId}
          onChange={(patch) => updateConfig({ courseMosaic: { ...readCourseMosaicOptions(cfg), ...patch } })}
        />
      )}

      {selectedBlock.type === "VARIABLE_TEXT" && !isClassListConfig(cfg) && !isCourseMosaicConfig(cfg) && (
        <InspectorPanel title="Contenido">
          <div>
            <FieldLabel>Variable de datos</FieldLabel>
            <select
              className={selectBase}
              value={String(cfg.variableKey ?? "")}
              onChange={(e) =>
                e.target.value === CLASS_LIST_VARIABLE_KEY
                  ? updateConfig({
                      variableKey: CLASS_LIST_VARIABLE_KEY,
                      classList: { ...DEFAULT_CLASS_LIST_OPTIONS },
                      textAlign: "LEFT",
                    })
                  : updateConfig({ variableKey: e.target.value })
              }
            >
              <option value="">— Elegir variable —</option>
              {offersClassList ? (
                <optgroup label="Listados">
                  <option value={CLASS_LIST_VARIABLE_KEY}>Listado de alumnos del curso</option>
                </optgroup>
              ) : null}
              {TEXT_VARIABLE_GROUPS.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {group.variables.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label} · {v.key}
                    </option>
                  ))}
                </optgroup>
              ))}
              {String(cfg.variableKey ?? "") !== "" &&
              !TEXT_VARIABLE_CATALOG_KEYS.has(String(cfg.variableKey ?? "")) ? (
                <optgroup label="Clave manual (no listada)">
                  <option value={String(cfg.variableKey ?? "")}>
                    {String(cfg.variableKey ?? "")}
                  </option>
                </optgroup>
              ) : null}
            </select>
            {variableTextFormatsFor(String(cfg.variableKey ?? "")) ? (
              <div className="mt-2">
                <FieldLabel>Formato</FieldLabel>
                <select
                  className={selectBase}
                  value={String(cfg.variableKey ?? "")}
                  onChange={(e) => updateConfig({ variableKey: e.target.value })}
                >
                  {variableTextFormatsFor(String(cfg.variableKey ?? ""))!.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {variableCatalogHint ? (
              <p className="mt-1.5 text-[11px] leading-snug text-[color:var(--te-ink-muted)]">
                {variableCatalogHint.description}
              </p>
            ) : variableKeyStr ? (
              <p className="mt-1.5 text-[11px] text-amber-300/90">
                Esta clave no está en el catálogo v1; se guarda igual por compatibilidad.
              </p>
            ) : null}
          </div>
          <details className="rounded-lg border border-dashed border-[color:var(--te-line)] bg-[color:var(--te-chrome)] px-2 py-1.5">
            <summary className="cursor-pointer select-none text-[11px] font-medium text-[color:var(--te-ink-muted)]">
              Editar clave manualmente (avanzado)
            </summary>
            <div className="mt-2">
              <input
                className={inputBase}
                value={String(cfg.variableKey ?? "")}
                placeholder="ej. student.fullName"
                spellCheck={false}
                onChange={(e) => updateConfig({ variableKey: e.target.value })}
              />
              <p className="mt-1 text-[10px] text-[color:var(--te-ink-faint)]">
                Preferí elegir arriba; usá esto solo si necesitás una clave exacta o legacy.
              </p>
            </div>
          </details>
          <p className="text-[11px] leading-relaxed text-[color:var(--te-ink-muted)]">
            El <span className="font-medium text-[color:var(--te-ink)]">texto si falta dato</span> lo editás con{" "}
            <span className="font-medium text-[color:var(--te-ink)]">doble clic</span> en el bloque del lienzo (mismo estilo que el
            texto visible cuando no hay variable resuelta).
          </p>
        </InspectorPanel>
      )}

      {selectedBlock.type === "QR" && (
        <InspectorPanel title="Código QR">
          <div>
            <FieldLabel>Qué codifica</FieldLabel>
            <select
              className={selectBase}
              value={cfg.mode === "FIXED" ? "FIXED" : "VARIABLE"}
              onChange={(e) => updateConfig({ mode: e.target.value })}
            >
              <option value="VARIABLE">Un dato de cada persona</option>
              <option value="FIXED">Una dirección fija</option>
            </select>
            <p className="mt-1 text-[11px] leading-snug text-[color:var(--te-ink-muted)]">
              {cfg.mode === "FIXED"
                ? "El mismo código en todas las piezas. Sirve para llevar al sitio de la institución."
                : "Cambia con cada pieza. Es lo que hace que el carnet verifique a ese socio y no a otro."}
            </p>
          </div>

          {cfg.mode === "FIXED" ? (
            <div>
              <FieldLabel>Dirección</FieldLabel>
              <input
                className={selectBase}
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={String(cfg.value ?? "")}
                onChange={(e) => updateConfig({ value: e.target.value })}
              />
            </div>
          ) : (
            <div>
              <FieldLabel>Dato a codificar</FieldLabel>
              <select
                className={selectBase}
                value={String(cfg.variableKey ?? "")}
                onChange={(e) => updateConfig({ variableKey: e.target.value })}
              >
                <option value="">— Elegir dato —</option>
                {TEXT_VARIABLE_GROUPS.map((group) => (
                  <optgroup key={group.id} label={group.label}>
                    {group.variables.map((v) => (
                      <option key={v.key} value={v.key}>
                        {v.label} · {v.key}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          <div>
            <FieldLabel>Corrección de errores</FieldLabel>
            <select
              className={selectBase}
              value={String(cfg.errorCorrection ?? "M")}
              onChange={(e) => updateConfig({ errorCorrection: e.target.value })}
            >
              <option value="L">Baja — código más chico</option>
              <option value="M">Media — la habitual</option>
              <option value="Q">Alta</option>
              <option value="H">Máxima — tolera desgaste y manchas</option>
            </select>
            <p className="mt-1 text-[11px] leading-snug text-[color:var(--te-ink-muted)]">
              Más corrección aguanta una tarjeta rayada, pero hace el dibujo más denso.
            </p>
          </div>
        </InspectorPanel>
      )}

      {selectedBlock.type === "IMAGE" && (
        <>
          <ImageBlockUploadSection
            templateId={templateId}
            versionId={versionId}
            blockId={selectedBlock.id}
            src={String(cfg.src ?? "")}
            sourceObj={asObject(cfg.source)}
            variableBindings={variableBindings}
            updateConfig={updateConfig}
            dispatch={dispatch}
            inputBase={inputBase}
            product={product}
          />
          {String(cfg.src ?? "").trim() !== "" && cfg.fit !== "contain" ? (
            <ImageCropSection
              src={String(cfg.src)}
              cfg={cfg}
              rotation={Number(selectedBlock.layout.rotation ?? 0)}
              updateConfig={updateConfig}
              setRotation={(deg) =>
                dispatch({
                  type: "updateBlock",
                  payload: { blockId: selectedBlock.id, patch: { layout: { rotation: deg } } },
                })
              }
            />
          ) : null}
          <InspectorPanel title="Contenedor de imagen">
            {/*
              "Uso del marco" distingue foto individual de foto grupal, que es una noción de
              Clickatón: sus plantillas encuadran distinto según cuánta gente entra. En un carnet
              de socio no significa nada, y aparecía igual porque estaba escrita para todos.
            */}
            {product === "clickaton" ? (
              <div>
                <FieldLabel>Uso del marco</FieldLabel>
                <select
                  className={selectBase}
                  value={String(cfg.photoMode ?? "free")}
                  onChange={(e) => updateConfig({ photoMode: e.target.value })}
                >
                  <option value="single">Foto individual</option>
                  <option value="group">Foto grupal</option>
                  <option value="free">Libre (genérico)</option>
                </select>
              </div>
            ) : null}
            <div>
              <FieldLabel>Forma del recorte</FieldLabel>
              <select
                className={selectBase}
                value={String(cfg.maskShape ?? "rect")}
                onChange={(e) => updateConfig({ maskShape: e.target.value })}
              >
                <option value="rect">Rectangular</option>
                <option value="circle">Circular</option>
                <option value="ellipse">Elipse</option>
              </select>
            </div>
            {String(cfg.maskShape ?? "rect") === "rect" ? (
              <div>
                <FieldLabel>Esquinas redondeadas (px)</FieldLabel>
                <NumberSliderField
                  ariaLabel="Esquinas redondeadas del recorte en píxeles"
                  value={Number(cfg.borderRadius ?? 0)}
                  min={0}
                  max={200}
                  step={1}
                  onChange={(v) => updateConfig({ borderRadius: Math.max(0, v) })}
                />
              </div>
            ) : null}
          </InspectorPanel>
        </>
      )}

      {selectedBlock.type === "SHAPE" && (
        <InspectorPanel title="Forma">
          <div>
            <FieldLabel>Tipo de forma</FieldLabel>
            <SegmentedControl
              value={String(cfg.variant ?? "rectangle") as "rectangle" | "circle" | "ellipse"}
              onChange={(v) => updateConfig({ variant: v })}
              options={[
                { value: "rectangle", label: "Rect" },
                { value: "circle", label: "Círculo" },
                { value: "ellipse", label: "Elipse" },
              ]}
              className="w-full"
            />
          </div>
          <ColorField
            label="Relleno"
            value={String(cfg.fill ?? "var(--te-line)")}
            onChange={(hex) => updateConfig({ fill: hex })}
          />
          <ColorField
            label="Borde"
            value={String(cfg.stroke ?? "var(--te-ink-faint)")}
            onChange={(hex) => updateConfig({ stroke: hex })}
          />
          <div>
            <FieldLabel>Grosor del borde</FieldLabel>
            <NumberSliderField
              ariaLabel="Grosor del borde en píxeles"
              value={Number(cfg.strokeWidth ?? 0)}
              min={0}
              max={64}
              step={1}
              onChange={(v) => updateConfig({ strokeWidth: Math.max(0, v) })}
            />
          </div>
          {String(cfg.variant ?? "rectangle") === "rectangle" ? (
            <div>
              <FieldLabel>Esquinas redondeadas</FieldLabel>
              <NumberSliderField
                ariaLabel="Radio de esquinas redondeadas en píxeles"
                value={Number(cfg.radius ?? 0)}
                min={0}
                max={400}
                step={1}
                onChange={(v) => updateConfig({ radius: Math.max(0, v) })}
              />
            </div>
          ) : null}
        </InspectorPanel>
      )}

      {selectedBlock.type === "BACKGROUND" && (
        <InspectorPanel title="Fondo">
          <ColorField
            label="Color de fondo"
            value={String(cfg.backgroundColor ?? "var(--te-surface)")}
            onChange={(hex) => updateConfig({ backgroundColor: hex })}
          />
          <div>
            <FieldLabel>Imagen</FieldLabel>
            <BackgroundImageField
              templateId={templateId}
              versionId={versionId}
              src={String(cfg.src ?? "")}
              onChange={(src) => updateConfig({ src, fit: "cover" })}
            />
          </div>
        </InspectorPanel>
      )}

      {selectedBlock.type === "PHOTO" && (
        <InspectorPanel title="Foto (legacy)">
          <p className="text-xs leading-relaxed text-[color:var(--te-ink-muted)]">
            Este tipo de bloque es heredado. Podés ajustar posición, tamaño y apariencia general arriba.
          </p>
        </InspectorPanel>
      )}
    </div>
  );
}

/** Cómo salen los nombres del listado: lo que se eligió en la barra de texto del bloque. */
function classListNamesStyle(cfg: Record<string, unknown>): ClassListTextStyle {
  const t = getTextVisualConfig(cfg);
  return {
    fontFamily: t.fontFamily,
    textTransform: t.textTransform,
    color: t.color,
    bold: t.fontWeight >= 600,
    italic: t.fontStyle === "italic",
    align: t.textAlign,
  };
}

const FONT_CATEGORY_ORDER: EditorFontCategory[] = ["Sans", "Serif", "Display", "Script", "Handwriting", "Mono"];

const CONVERSION_LABEL = {
  none: "Tal cual se cargó",
  uppercase: "MAYÚSCULAS",
  lowercase: "minúsculas",
  capitalize: "Iniciales En Mayúscula",
} as const;

/** Topes del cuerpo en píxeles del lienzo, los mismos de la barra de texto. */
const FONT_SIZE_MIN_PX = 8;
const FONT_SIZE_MAX_PX = 400;

/**
 * Un cuerpo tipográfico en puntos, el tamaño real impreso. Se guarda en píxeles del lienzo
 * (`px`); la cuenta sale de la resolución del lienzo, así 10 pt acá son 10 pt en el papel.
 */
function PointSizeField({
  label,
  px,
  dpi,
  onChange,
}: {
  label: string;
  px: number;
  dpi: number;
  onChange: (px: number) => void;
}) {
  const pt = roundPt(ptFromPx(px, dpi));
  const setPt = (v: number) =>
    onChange(Math.max(FONT_SIZE_MIN_PX, Math.min(FONT_SIZE_MAX_PX, pxFromPt(v, dpi))));
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="h-7 w-7 rounded border border-[color:var(--te-line)] text-[13px] text-[color:var(--te-ink)]"
          aria-label={`Reducir ${label.toLowerCase()}`}
          onClick={() => setPt(Math.ceil(pt) - 1)}
        >
          −
        </button>
        <input
          type="number"
          className="h-7 w-16 rounded border border-[color:var(--te-line)] bg-[color:var(--te-surface)] px-1 text-center text-[12px] text-[color:var(--te-ink)]"
          value={pt}
          step={0.5}
          min={roundPt(ptFromPx(FONT_SIZE_MIN_PX, dpi))}
          onChange={(e) => {
            const v = Number(e.target.value.replace(",", "."));
            if (Number.isFinite(v) && v > 0) setPt(v);
          }}
          aria-label={`${label} en puntos`}
        />
        <button
          type="button"
          className="h-7 w-7 rounded border border-[color:var(--te-line)] text-[13px] text-[color:var(--te-ink)]"
          aria-label={`Aumentar ${label.toLowerCase()}`}
          onClick={() => setPt(Math.floor(pt) + 1)}
        >
          +
        </button>
        <span className="text-[11px] text-[color:var(--te-ink-muted)]">pt</span>
      </div>
    </div>
  );
}

/**
 * Tamaño, negrita y cursiva de los nombres del listado. Son los mismos datos que la barra de
 * texto del bloque; están acá también para manejar nombres y título uno al lado del otro.
 */
function ClassListNamesStylePanel({
  namesStyle,
  fontSize,
  dpi,
  onChange,
}: {
  namesStyle: ClassListTextStyle;
  fontSize: number;
  dpi: number;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2 rounded-[var(--te-radius)] border border-[color:var(--te-line)] p-2">
      <p className="text-[11px] font-semibold text-[color:var(--te-ink)]">Estilo de los nombres</p>
      <PointSizeField label="Tamaño" px={fontSize} dpi={dpi} onChange={(px) => onChange({ fontSize: px })} />
      <ToggleSwitch
        checked={namesStyle.bold}
        onChange={(bold) => onChange({ fontWeight: bold ? 700 : 400 })}
        label="Negrita"
      />
      <ToggleSwitch checked={namesStyle.italic} onChange={(fontItalic) => onChange({ fontItalic })} label="Cursiva" />
      <p className="text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
        La tipografía, el color y las mayúsculas de los nombres se eligen en la barra de texto.
      </p>
    </div>
  );
}

/**
 * El estilo del título del listado (curso y colegio), aparte del de los nombres. Lo que no se
 * cambia acá sale igual que los nombres; «Igual que los nombres» vuelve a heredar.
 */
function ClassListHeadingStylePanel({
  style,
  namesStyle,
  headingFontSize,
  dpi,
  onChange,
}: {
  style: ClassListHeadingStyle;
  namesStyle: ClassListTextStyle;
  /** El cuerpo con que sale el título: el propio o el proporcional a los nombres. */
  headingFontSize: number;
  dpi: number;
  onChange: (next: ClassListHeadingStyle) => void;
}) {
  const efectivo = resolveClassListHeadingStyle(style, namesStyle);
  const set = <K extends keyof ClassListHeadingStyle>(key: K, value: ClassListHeadingStyle[K] | undefined) => {
    const next = { ...style };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  };
  return (
    <div className="space-y-2 rounded-[var(--te-radius)] border border-[color:var(--te-line)] p-2">
      <p className="text-[11px] font-semibold text-[color:var(--te-ink)]">Estilo del título</p>
      <p className="text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
        Aparte de los nombres. Lo que no cambies acá sale igual que los nombres.
      </p>
      <div>
        <PointSizeField label="Tamaño" px={headingFontSize} dpi={dpi} onChange={(px) => set("fontSize", px)} />
        {style.fontSize !== undefined ? (
          <button
            type="button"
            className="mt-0.5 text-[10px] text-[color:var(--te-ink-muted)] underline hover:text-[color:var(--te-ink)]"
            onClick={() => set("fontSize", undefined)}
          >
            Proporcional a los nombres
          </button>
        ) : (
          <p className="mt-0.5 text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
            Ahora sigue a los nombres: si les cambiás el tamaño, el título cambia con ellos.
          </p>
        )}
      </div>
      <div>
        <FieldLabel>Tipografía</FieldLabel>
        <select
          className={selectBase}
          value={style.fontFamily ?? ""}
          onChange={(e) => set("fontFamily", e.target.value || undefined)}
        >
          <option value="">Igual que los nombres</option>
          {FONT_CATEGORY_ORDER.map((cat) => {
            const fuentes = EDITOR_FONT_CATALOG.filter((f) => f.category === cat);
            if (fuentes.length === 0) return null;
            return (
              <optgroup key={cat} label={EDITOR_FONT_CATEGORY_LABELS[cat]}>
                {fuentes.map((f) => (
                  <option key={f.id} value={f.family}>
                    {f.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>
      <div>
        <FieldLabel>Mayúsculas y minúsculas</FieldLabel>
        <select
          className={selectBase}
          value={style.textTransform ?? ""}
          onChange={(e) =>
            set("textTransform", (e.target.value || undefined) as ClassListHeadingStyle["textTransform"])
          }
        >
          <option value="">Igual que los nombres ({CONVERSION_LABEL[namesStyle.textTransform]})</option>
          {(Object.keys(CONVERSION_LABEL) as Array<keyof typeof CONVERSION_LABEL>).map((k) => (
            <option key={k} value={k}>
              {CONVERSION_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <ColorField label="Color" value={efectivo.color} onChange={(color) => set("color", color)} />
        {style.color !== undefined ? (
          <button
            type="button"
            className="mt-0.5 text-[10px] text-[color:var(--te-ink-muted)] underline hover:text-[color:var(--te-ink)]"
            onClick={() => set("color", undefined)}
          >
            Igual que los nombres
          </button>
        ) : null}
      </div>
      <div>
        <FieldLabel>Alineación</FieldLabel>
        <SegmentedControl
          className="w-full"
          value={efectivo.align}
          onChange={(align) => set("align", align)}
          options={[
            { value: "left", label: "Izquierda" },
            { value: "center", label: "Centro" },
            { value: "right", label: "Derecha" },
          ]}
        />
      </div>
      <ToggleSwitch checked={efectivo.bold} onChange={(bold) => set("bold", bold)} label="Negrita" />
      <ToggleSwitch checked={efectivo.italic} onChange={(italic) => set("italic", italic)} label="Cursiva" />
    </div>
  );
}

/** Opciones del «Listado del curso»: orden, cómo se escribe cada nombre y el destacado. */
function ClassListOptionsPanel({
  options,
  namesStyle,
  namesFontSize,
  dpi,
  onChange,
  onNamesChange,
  onUseOtherVariable,
}: {
  options: ClassListOptions;
  namesStyle: ClassListTextStyle;
  /** El cuerpo de los nombres, en píxeles del lienzo (el `fontSize` del bloque). */
  namesFontSize: number;
  dpi: number;
  onChange: (patch: Partial<ClassListOptions>) => void;
  /** Cambia la tipografía de los nombres, que vive en la configuración del bloque. */
  onNamesChange: (patch: Record<string, unknown>) => void;
  onUseOtherVariable: () => void;
}) {
  return (
    <InspectorPanel title="Listado del curso">
      <p className="text-[11px] leading-snug text-[color:var(--te-ink-muted)]">
        Todos los alumnos del curso del diseño. En el lienzo se ve un curso de muestra; al armar cada diseño se
        usa el curso real del alumno.
      </p>
      <div>
        <FieldLabel>Ordenar por</FieldLabel>
        <SegmentedControl
          className="w-full"
          value={options.sortBy}
          onChange={(sortBy) => onChange({ sortBy })}
          options={[
            { value: "lastName", label: "Apellido" },
            { value: "firstName", label: "Nombre" },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Cómo se escribe</FieldLabel>
        <SegmentedControl
          className="w-full"
          value={options.nameOrder}
          onChange={(nameOrder) => onChange({ nameOrder })}
          options={[
            { value: "firstLast", label: "Nombre Apellido" },
            { value: "lastFirst", label: "Apellido, Nombre" },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Nombres</FieldLabel>
        <SegmentedControl
          className="w-full"
          value={options.givenNames}
          onChange={(givenNames) => onChange({ givenNames })}
          options={[
            { value: "all", label: "Todos (María Sol)" },
            { value: "first", label: "Sólo el primero (María)" },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Columnas</FieldLabel>
        <SegmentedControl
          className="w-full"
          value={String(options.columns)}
          onChange={(v) => onChange({ columns: Number(v) })}
          options={Array.from({ length: CLASS_LIST_MAX_COLUMNS }, (_, i) => ({
            value: String(i + 1),
            label: String(i + 1),
          }))}
        />
        <p className="mt-1 text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
          Con dos cursos o más, el listado usa siempre 4 columnas para que entren todos los nombres.
        </p>
      </div>
      <ToggleSwitch
        checked={options.highlightOwner}
        onChange={(highlightOwner) => onChange({ highlightOwner })}
        label="Destacar en negrita al alumno del diseño"
      />
      <ToggleSwitch
        checked={options.showHeading}
        onChange={(showHeading) => onChange({ showHeading })}
        label="Título con el nombre del curso (por ejemplo «7.° A»)"
      />
      {options.showHeading ? (
        <div>
          <p className="text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
            El título va arriba de cada curso. Con el título no hace falta un texto aparte con el curso. Su tamaño se
            elige en «Estilo del título».
          </p>
          <div className="mt-2">
            <ToggleSwitch
              checked={options.showShift}
              onChange={(showShift) => onChange({ showShift })}
              label="Mostrar turno (por ejemplo «3.° B Turno mañana»)"
            />
          </div>
          <p className="mt-1 text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
            Si el curso no tiene turno cargado, no se muestra nada. Si dos cursos del listado se llaman igual, el turno
            va siempre, para distinguirlos.
          </p>
        </div>
      ) : null}
      <ToggleSwitch
        checked={options.showSchoolName}
        onChange={(showSchoolName) => onChange({ showSchoolName })}
        label="Mostrar nombre del colegio arriba del listado"
      />
      <p className="text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
        Va una sola vez, arriba de todo y dentro del mismo recuadro del listado.
      </p>
      <ClassListNamesStylePanel namesStyle={namesStyle} fontSize={namesFontSize} dpi={dpi} onChange={onNamesChange} />
      {options.showHeading || options.showSchoolName ? (
        <ClassListHeadingStylePanel
          style={options.headingStyle}
          namesStyle={namesStyle}
          headingFontSize={namesFontSize * classListHeadingScale(options, namesFontSize)}
          dpi={dpi}
          onChange={(headingStyle) => onChange({ headingStyle })}
        />
      ) : null}
      <ToggleSwitch
        checked={options.allowExtraCourses}
        onChange={(allowExtraCourses) => onChange({ allowExtraCourses })}
        label="Permitir sumar otros cursos"
      />
      <p className="text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
        Para las fotos grupales con más de un curso (7.° A y 7.° B juntos). Encendido, el fotógrafo al revisar y la
        familia al confirmar pueden sumar otros cursos del mismo colegio; cada curso sale con su título.
      </p>
      <p className="text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
        Los tamaños están en puntos, el tamaño real impreso. Si la lista no entra en el recuadro, la letra se achica
        para todos por igual: agrandá el recuadro para que salga al tamaño elegido.
      </p>
      <button
        type="button"
        className="text-left text-[11px] font-medium text-[color:var(--te-ink-muted)] underline hover:text-[color:var(--te-ink)]"
        onClick={onUseOtherVariable}
      >
        Usar otro dato en este bloque
      </button>
    </InspectorPanel>
  );
}

/** Proporciones de retrato que se ofrecen: las de foto carné y las cuadradas. */
const MOSAIC_ASPECTS: Array<{ value: string; label: string }> = [
  { value: "0.75", label: "3:4" },
  { value: "0.8", label: "4:5" },
  { value: "1", label: "1:1" },
  { value: "0.6667", label: "2:3" },
];

function CourseMosaicOptionsPanel({
  options: o,
  templateId,
  versionId,
  onChange,
}: {
  options: CourseMosaicOptions;
  templateId: string;
  versionId: string;
  onChange: (patch: Partial<CourseMosaicOptions>) => void;
}) {
  const aspect = MOSAIC_ASPECTS.find((a) => Math.abs(Number(a.value) - o.photoAspect) < 0.01)?.value ?? "";
  const reserved = o.reserved ?? { x: 0.6, y: 0, width: 0.4, height: 0.3 };
  const pct = (v: number) => Math.round(v * 100);
  return (
    <InspectorPanel title="Mosaico del curso">
      <p className="text-[11px] leading-snug text-[color:var(--te-ink-muted)]">
        Los compañeros del alumno, cada uno con su retrato y su nombre. Se reparten solos: con más chicos, los
        retratos se achican. En el lienzo se ve un curso de muestra; el alumno dueño de la carpeta no aparece en su
        propio mosaico.
      </p>
      <div>
        <FieldLabel>Forma</FieldLabel>
        <SegmentedControl
          className="w-full"
          value={o.frame}
          onChange={(frame) => onChange({ frame })}
          options={[
            { value: "rect", label: "Recto" },
            { value: "rounded", label: "Redondeado" },
            { value: "circle", label: "Círculo" },
            { value: "ellipse", label: "Óvalo" },
            { value: "polaroid", label: "Polaroid" },
          ]}
        />
      </div>
      {o.frame === "rounded" ? (
        <div>
          <FieldLabel>Redondeo de las esquinas</FieldLabel>
          <NumberSliderField
            ariaLabel="Redondeo de las esquinas en píxeles"
            value={o.cornerRadius}
            min={0}
            max={200}
            onChange={(cornerRadius) => onChange({ cornerRadius })}
          />
        </div>
      ) : null}
      <ToggleSwitch
        checked={o.emptyPhotos}
        onChange={(emptyPhotos) => onChange({ emptyPhotos })}
        label="Recuadros vacíos, para pegar figuritas"
      />
      {o.emptyPhotos ? (
        <ColorField label="Color del lugar de cada figurita" value={o.emptyFill} onChange={(emptyFill) => onChange({ emptyFill })} />
      ) : null}
      <ToggleSwitch
        checked={o.includeOwner}
        onChange={(includeOwner) => onChange({ includeOwner })}
        label="Incluir al dueño de la carpeta (plancha de figuritas)"
      />
      <p className="text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
        Álbum de figuritas: una página con recuadros vacíos y el nombre de cada chico, y otra con las figuritas (fotos sin
        nombre, con el dueño incluido) para imprimir en papel autoadhesivo y recortar.
      </p>
      {o.frame === "circle" ? null : (
      <div>
        <FieldLabel>Proporción del retrato</FieldLabel>
        <SegmentedControl
          className="w-full"
          value={aspect}
          onChange={(v) =>
            onChange({
              photoAspect: Math.min(COURSE_MOSAIC_PHOTO_ASPECT_MAX, Math.max(COURSE_MOSAIC_PHOTO_ASPECT_MIN, Number(v))),
            })
          }
          options={MOSAIC_ASPECTS}
        />
      </div>
      )}
      <div>
        <FieldLabel>Separación entre retratos (a lo ancho)</FieldLabel>
        <NumberSliderField ariaLabel="Separación horizontal en píxeles" value={o.gapX} min={0} max={200} onChange={(gapX) => onChange({ gapX })} />
      </div>
      <div>
        <FieldLabel>Separación entre filas</FieldLabel>
        <NumberSliderField ariaLabel="Separación vertical en píxeles" value={o.gapY} min={0} max={200} onChange={(gapY) => onChange({ gapY })} />
        <p className="mt-1 text-[10px] leading-snug text-[color:var(--te-ink-faint)]">En 0 quedan pegados.</p>
      </div>
      <div>
        <FieldLabel>Borde</FieldLabel>
        <NumberSliderField
          ariaLabel="Grosor del borde en píxeles"
          value={o.borderWidth}
          min={0}
          max={60}
          onChange={(borderWidth) => onChange({ borderWidth })}
        />
        {o.borderWidth > 0 ? (
          <ColorField label="Color del borde" value={o.borderColor} onChange={(borderColor) => onChange({ borderColor })} />
        ) : null}
        {o.borderWidth > 0 && o.frame === "ellipse" ? (
          <p className="mt-1 text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
            El óvalo se imprime sin borde: la impresión no dibuja óvalos con borde.
          </p>
        ) : null}
      </div>
      <ToggleSwitch
        checked={o.shadow != null}
        onChange={(on) => onChange({ shadow: on ? { dx: 16, dy: 16, color: "#f5c518" } : null })}
        label="Recuadro de color corrido detrás de cada retrato"
      />
      {o.shadow && o.frame === "ellipse" ? (
        <p className="text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
          El óvalo va sin recuadro de color: la impresión no dibuja óvalos de color.
        </p>
      ) : null}
      {o.shadow ? (
        <div className="space-y-1">
          <ColorField label="Color" value={o.shadow.color} onChange={(color) => onChange({ shadow: { ...o.shadow!, color } })} />
          <FieldLabel>Corrimiento</FieldLabel>
          <NumberSliderField
            ariaLabel="Corrimiento del recuadro en píxeles"
            value={o.shadow.dx}
            min={-80}
            max={80}
            onChange={(d) => onChange({ shadow: { ...o.shadow!, dx: d, dy: d } })}
          />
        </div>
      ) : null}
      <div>
        <FieldLabel>Giro alternado (fotos pegadas a mano)</FieldLabel>
        <NumberSliderField
          ariaLabel="Giro alternado en grados"
          value={o.tilt}
          min={0}
          max={COURSE_MOSAIC_TILT_MAX}
          step={0.5}
          onChange={(tilt) => onChange({ tilt })}
        />
      </div>
      <div>
        <FieldLabel>Marco encima de cada retrato (PNG con transparencia)</FieldLabel>
        <BackgroundImageField
          templateId={templateId}
          versionId={versionId}
          src={o.frameSrc}
          onChange={(frameSrc) => onChange({ frameSrc })}
        />
      </div>
      <div>
        <FieldLabel>Nombre</FieldLabel>
        <SegmentedControl
          className="w-full"
          value={o.namePosition}
          onChange={(namePosition) => onChange({ namePosition })}
          options={[
            { value: "below", label: "Debajo" },
            { value: "above", label: "Arriba" },
            { value: "insideBottom", label: "Sobre la foto" },
            { value: "none", label: "Sin nombre" },
          ]}
        />
      </div>
      {o.namePosition !== "none" ? (
        <>
          <div>
            <FieldLabel>Líneas</FieldLabel>
            <SegmentedControl
              className="w-full"
              value={String(o.nameLines)}
              onChange={(v) => onChange({ nameLines: v === "1" ? 1 : 2 })}
              options={[
                { value: "2", label: "Nombre / Apellido" },
                { value: "1", label: "En una línea" },
              ]}
            />
          </div>
          <div>
            <FieldLabel>Nombres</FieldLabel>
            <SegmentedControl
              className="w-full"
              value={o.givenNames}
              onChange={(givenNames) => onChange({ givenNames })}
              options={[
                { value: "first", label: "Sólo el primero (María)" },
                { value: "all", label: "Todos (María Sol)" },
              ]}
            />
          </div>
          <ToggleSwitch
            checked={o.nameBackground !== ""}
            onChange={(on) => onChange({ nameBackground: on ? "#ffffff" : "" })}
            label="Cinta de color detrás del nombre"
          />
          {o.nameBackground ? (
            <ColorField label="Color de la cinta" value={o.nameBackground} onChange={(nameBackground) => onChange({ nameBackground })} />
          ) : null}
        </>
      ) : null}
      <div>
        <FieldLabel>Ordenar por</FieldLabel>
        <SegmentedControl
          className="w-full"
          value={o.sortBy}
          onChange={(sortBy) => onChange({ sortBy })}
          options={[
            { value: "lastName", label: "Apellido" },
            { value: "firstName", label: "Nombre" },
          ]}
        />
      </div>
      <div>
        <FieldLabel>Última fila incompleta</FieldLabel>
        <SegmentedControl
          className="w-full"
          value={o.lastRowAlign}
          onChange={(lastRowAlign) => onChange({ lastRowAlign })}
          options={[
            { value: "left", label: "Izquierda" },
            { value: "center", label: "Centro" },
            { value: "right", label: "Derecha" },
          ]}
        />
      </div>
      <ToggleSwitch
        checked={o.reserved != null}
        onChange={(on) => onChange({ reserved: on ? reserved : null })}
        label="Dejar una zona libre para un cartel"
      />
      {o.reserved ? (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["x", "Desde la izquierda %"],
              ["y", "Desde arriba %"],
              ["width", "Ancho %"],
              ["height", "Alto %"],
            ] as const
          ).map(([k, label]) => (
            <div key={k}>
              <FieldLabel>{label}</FieldLabel>
              <NumberSliderField
                ariaLabel={label}
                value={pct(o.reserved![k])}
                min={0}
                max={100}
                onChange={(v) => onChange({ reserved: { ...o.reserved!, [k]: v / 100 } })}
              />
            </div>
          ))}
        </div>
      ) : null}
      <div>
        <FieldLabel>Orden en la cadena</FieldLabel>
        <NumberSliderField
          ariaLabel="Orden en la cadena de mosaicos"
          value={o.chainOrder}
          min={1}
          max={6}
          onChange={(chainOrder) => onChange({ chainOrder })}
        />
        <FieldLabel>Cuántos chicos entran como máximo (0 = reparto parejo)</FieldLabel>
        <NumberSliderField
          ariaLabel="Tope de chicos en este mosaico"
          value={o.capacity}
          min={0}
          max={60}
          onChange={(capacity) => onChange({ capacity })}
        />
        <p className="mt-1 text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
          Para partir el mosaico en dos recuadros (por ejemplo, uno en cada página): dales orden 1 y 2. Sin tope se
          reparten parejo; con tope, el 1 se llena hasta ahí y los demás chicos siguen en el 2.
        </p>
      </div>
      <p className="text-[10px] leading-snug text-[color:var(--te-ink-faint)]">
        La tipografía, el tamaño y el color de los nombres se eligen en la barra de texto. Si un nombre no entra, se
        achica y, si hace falta, se corta con «…».
      </p>
    </InspectorPanel>
  );
}
