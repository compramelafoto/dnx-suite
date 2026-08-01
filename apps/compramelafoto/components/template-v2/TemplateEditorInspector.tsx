"use client";

import { useMemo } from "react";
import { ColorField } from "@/components/template-v2/inspector/ColorField";
import { ImageBlockUploadSection } from "@/components/template-v2/inspector/ImageBlockUploadSection";
import { FieldLabel, InspectorPanel } from "@/components/template-v2/inspector/InspectorPanel";
import { NumberSliderField } from "@/components/template-v2/inspector/NumberSliderField";
import { SegmentedControl } from "@/components/template-v2/inspector/SegmentedControl";
import type { CanvasQuickAlignment } from "@/lib/template-v2/align-block-to-canvas";
import {
  alignBlocksToSelectionBounds,
  anySelectedBlockLocked,
  distributeBlocksInSelection,
  type DistributeAxis,
} from "@/lib/template-v2/align-selection-bounds";
import { areTemplateV2BlockArraysEquivalent } from "@/lib/template-v2/block-arrays-equivalent";
import { getSafeAreaRectPx } from "@/lib/template-v2/get-safe-area-rect";
import { getLayoutSafeAreaStatus } from "@/lib/template-v2/layout-vs-safe-area";
import type { TemplateV2Block, TemplateV2Canvas } from "@/lib/template-v2/render-core";
import {
  getTextVariableGroupsForProduct,
  getVariableByKeyForProduct,
} from "@/lib/template-v2/variable-catalog-product";
import type { TemplateProductId } from "@/lib/template-v2/resolve-template-product";
import {
  setBlocks,
  setCanvas,
  type TemplateV2EditorDispatch,
  type TemplateV2VariableBinding,
} from "@/lib/template-v2/editor-store";
import { AlignmentGlyph } from "@/components/template-v2/alignment-glyph";
import { TemplateVariableBraceInsertPanel } from "@/components/template-v2/TemplateVariableBraceInsertPanel";
import { cn } from "@/lib/utils";

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
  "w-full rounded-lg border border-[#e5e7eb] bg-white px-2 py-2 text-xs text-[#111827] shadow-sm focus:border-[#c27b3d] focus:outline-none focus:ring-1 focus:ring-[#c27b3d]/40";

const selectBase =
  "w-full rounded-lg border border-[#e5e7eb] bg-white px-2 py-2 text-xs shadow-sm focus:border-[#c27b3d] focus:outline-none focus:ring-1 focus:ring-[#c27b3d]/40";

const alignBtnClass =
  "rounded-lg border border-[#e5e7eb] bg-white px-2 py-1.5 text-[11px] font-medium text-[#374151] shadow-sm transition-colors hover:border-[#d1d5db] hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white";

/** Botón cuadrado con icono de alineación (zona segura / conjunto). */
const alignIconBtnClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#e5e7eb] bg-white text-[#374151] shadow-sm transition-colors hover:border-[#c27b3d] hover:bg-[#fdf8f4] hover:text-[#9a5f2e] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[#e5e7eb] disabled:hover:bg-white disabled:hover:text-[#374151]";

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
  const TEXT_VARIABLE_CATALOG_KEYS = new Set(
    TEXT_VARIABLE_GROUPS.flatMap((g) => g.variables.map((v) => v.key))
  );

  if (!selectedBlock) {
    const bg = typeof canvas.background === "string" ? canvas.background : "#ffffff";
    return (
      <div className={cn("w-full min-w-0 space-y-4", className)}>
        <div>
          <h2 className="text-sm font-semibold text-[#1a1a1a]">Inspector</h2>
          <p className="mt-0.5 text-[11px] text-[#9ca3af]">Lienzo o bloques seleccionados.</p>
        </div>

        <InspectorPanel title="Fondo de la hoja">
          <p className="text-[11px] leading-relaxed text-[#6b7280]">
            Hacé clic en un área vacía del lienzo (sin bloques) para quitar la selección y ajustar el color de fondo.
          </p>
          <div className="mt-3">
            <ColorField
              label="Color de fondo del lienzo"
              value={bg}
              onChange={(hex) => dispatch(setCanvas({ background: hex }))}
            />
          </div>
        </InspectorPanel>

        <p className="text-xs leading-relaxed text-[#6b7280]">
          Elegí un bloque en el lienzo para ver y editar sus propiedades aquí.
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
    <div className={cn("w-full min-w-[280px] space-y-4", className)}>
      <div>
        <h2 className="text-sm font-semibold text-[#1a1a1a]">Inspector</h2>
        <p className="mt-0.5 text-[11px] text-[#9ca3af]">Cambios locales hasta que guardes.</p>
      </div>

      <TemplateVariableBraceInsertPanel
        selectedBlockId={selectedBlock.id}
        selectedKind={
          selectedBlock.type === "TEXT" || selectedBlock.type === "VARIABLE_TEXT" ? selectedBlock.type : null
        }
        product={product}
      />

      {selectedBlockCount > 1 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
          Hay {selectedBlockCount} bloques seleccionados. Las propiedades de abajo siguen al{" "}
          <span className="font-medium">último seleccionado (primario)</span>. Usá la sección siguiente para alinear o
          distribuir todo el conjunto.
        </p>
      ) : null}

      {selectedBlockCount > 1 ? (
        <InspectorPanel title="Alineación del conjunto">
          <p className="text-[11px] leading-snug text-[#6b7280]">
            Respecto del rectángulo que envuelve los seleccionados (no del lienzo). La selección se mantiene.
          </p>
          {multiLocked ? (
            <p className="mt-1.5 text-[10px] leading-snug text-amber-900">
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
          <p className="mt-3 text-[11px] font-medium text-[#374151]">Distribución uniforme</p>
          <p className="text-[11px] leading-snug text-[#6b7280]">
            Iguala el espacio libre <span className="font-medium text-[#4b5563]">entre</span> bloques vecinos (entre
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
            <p className="mt-1.5 text-[10px] text-[#9ca3af]">
              Necesitás al menos tres bloques en la selección para repartir espacio intermedio.
            </p>
          ) : null}
          {canDistribute && multiLocked ? (
            <p className="mt-1.5 text-[10px] text-amber-900/90">Quitá el candado de todos los seleccionados para distribuir.</p>
          ) : null}
        </InspectorPanel>
      ) : null}

      {primarySafeAreaStatus !== "inside" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
          {primarySafeAreaStatus === "outside" ? (
            <>Fuera de la zona segura.</>
          ) : (
            <>Parcialmente fuera de la zona segura.</>
          )}{" "}
          <span className="text-[10px] text-amber-900/80">(rectángulo de layout)</span>
        </p>
      ) : null}

      {selectedBlock.type === "VARIABLE_TEXT" && (
        <InspectorPanel title="Contenido">
          <div>
            <FieldLabel>Variable de datos</FieldLabel>
            <select
              className={selectBase}
              value={String(cfg.variableKey ?? "")}
              onChange={(e) => updateConfig({ variableKey: e.target.value })}
            >
              <option value="">— Elegir variable —</option>
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
            {variableCatalogHint ? (
              <p className="mt-1.5 text-[11px] leading-snug text-[#6b7280]">
                {variableCatalogHint.description}
              </p>
            ) : variableKeyStr ? (
              <p className="mt-1.5 text-[11px] text-amber-800/90">
                Esta clave no está en el catálogo v1; se guarda igual por compatibilidad.
              </p>
            ) : null}
          </div>
          <details className="rounded-lg border border-dashed border-[#e5e7eb] bg-[#fafafa] px-2 py-1.5">
            <summary className="cursor-pointer select-none text-[11px] font-medium text-[#6b7280]">
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
              <p className="mt-1 text-[10px] text-[#9ca3af]">
                Preferí elegir arriba; usá esto solo si necesitás una clave exacta o legacy.
              </p>
            </div>
          </details>
          <p className="text-[11px] leading-relaxed text-[#5f6368]">
            El <span className="font-medium text-[#374151]">texto si falta dato</span> lo editás con{" "}
            <span className="font-medium text-[#374151]">doble clic</span> en el bloque del lienzo (mismo estilo que el
            texto visible cuando no hay variable resuelta).
          </p>
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
          />
          <InspectorPanel title="Contenedor de imagen">
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
            value={String(cfg.fill ?? "#e5e7eb")}
            onChange={(hex) => updateConfig({ fill: hex })}
          />
          <ColorField
            label="Borde"
            value={String(cfg.stroke ?? "#94a3b8")}
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
        <InspectorPanel title="Fondo (legacy)">
          <ColorField
            label="Color de fondo"
            value={String(cfg.backgroundColor ?? "#ffffff")}
            onChange={(hex) => updateConfig({ backgroundColor: hex })}
          />
          <div>
            <FieldLabel>Imagen (URL)</FieldLabel>
            <input
              className={inputBase}
              value={String(cfg.src ?? "")}
              onChange={(e) => updateConfig({ src: e.target.value })}
            />
          </div>
        </InspectorPanel>
      )}

      {selectedBlock.type === "PHOTO" && (
        <InspectorPanel title="Foto (legacy)">
          <p className="text-xs leading-relaxed text-[#6b7280]">
            Este tipo de bloque es heredado. Podés ajustar posición, tamaño y apariencia general arriba.
          </p>
        </InspectorPanel>
      )}
    </div>
  );
}
