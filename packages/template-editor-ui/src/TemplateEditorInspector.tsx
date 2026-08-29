"use client";

import { useMemo } from "react";
import { ColorField } from "./inspector/ColorField";
import { ImageBlockUploadSection } from "./inspector/ImageBlockUploadSection";
import { FieldLabel, InspectorPanel } from "./inspector/InspectorPanel";
import { NumberSliderField } from "./inspector/NumberSliderField";
import { SegmentedControl } from "./inspector/SegmentedControl";
import type { CanvasQuickAlignment } from "@repo/template-editor-core";
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
  "w-full rounded-lg border border-[color:var(--te-line)] bg-white px-2 py-2 text-xs text-[color:var(--te-ink)] shadow-sm focus:border-[color:var(--te-accent)] focus:outline-none focus:ring-1 focus:ring-[color:var(--te-accent-wash)]";

const selectBase =
  "w-full rounded-lg border border-[color:var(--te-line)] bg-white px-2 py-2 text-xs shadow-sm focus:border-[color:var(--te-accent)] focus:outline-none focus:ring-1 focus:ring-[color:var(--te-accent-wash)]";

const alignBtnClass =
  "rounded-lg border border-[color:var(--te-line)] bg-white px-2 py-1.5 text-[11px] font-medium text-[color:var(--te-ink)] shadow-sm transition-colors hover:border-[color:var(--te-line-strong)] hover:bg-[color:var(--te-chrome)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white";

/** Botón cuadrado con icono de alineación (zona segura / conjunto). */
const alignIconBtnClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--te-line)] bg-white text-[color:var(--te-ink)] shadow-sm transition-colors hover:border-[color:var(--te-accent)] hover:bg-[color:var(--te-accent-wash)] hover:text-[color:var(--te-accent)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-[color:var(--te-line)] disabled:hover:bg-white disabled:hover:text-[color:var(--te-ink)]";

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
    const bg = typeof canvas.background === "string" ? canvas.background : "var(--te-surface)";
    return (
      <div className={cn("w-full min-w-0 space-y-4", className)}>
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--te-ink)]">Inspector</h2>
          <p className="mt-0.5 text-[11px] text-[color:var(--te-ink-faint)]">Lienzo o bloques seleccionados.</p>
        </div>

        <InspectorPanel title="Fondo de la hoja">
          <p className="text-[11px] leading-relaxed text-[color:var(--te-ink-muted)]">
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

        <p className="text-xs leading-relaxed text-[color:var(--te-ink-muted)]">
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
        <h2 className="text-sm font-semibold text-[color:var(--te-ink)]">Inspector</h2>
        <p className="mt-0.5 text-[11px] text-[color:var(--te-ink-faint)]">Cambios locales hasta que guardes.</p>
      </div>

      {/*
        La opacidad estaba en cada fila de la lista de capas, con su deslizador siempre a la
        vista. Es una propiedad del bloque como el color o el tamaño, y vive donde viven las
        propiedades del bloque.
      */}
      <InspectorPanel title="Opacidad">
        <div className="flex items-center gap-3">
          <NumberSliderField
            value={Math.round((selectedBlock.layout.opacity ?? 1) * 100)}
            onChange={(v) => updateLayout({ opacity: v / 100 })}
            min={0}
            max={100}
            step={1}
            ariaLabel={`Opacidad de ${selectedBlock.name ?? "el bloque"}`}
            className="flex-1"
          />
          <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-[color:var(--te-ink-muted)]">
            {Math.round((selectedBlock.layout.opacity ?? 1) * 100)} %
          </span>
        </div>
      </InspectorPanel>

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
          <p className="text-[11px] leading-snug text-[color:var(--te-ink-muted)]">
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
              <p className="mt-1.5 text-[11px] leading-snug text-[color:var(--te-ink-muted)]">
                {variableCatalogHint.description}
              </p>
            ) : variableKeyStr ? (
              <p className="mt-1.5 text-[11px] text-amber-800/90">
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
        <InspectorPanel title="Fondo (legacy)">
          <ColorField
            label="Color de fondo"
            value={String(cfg.backgroundColor ?? "var(--te-surface)")}
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
          <p className="text-xs leading-relaxed text-[color:var(--te-ink-muted)]">
            Este tipo de bloque es heredado. Podés ajustar posición, tamaño y apariencia general arriba.
          </p>
        </InspectorPanel>
      )}
    </div>
  );
}
