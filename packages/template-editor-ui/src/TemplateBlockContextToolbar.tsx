"use client";

import { useRef, useState } from "react";
import {
  duplicateBlock,
  getPrimarySelectedBlockId,
  removeBlock,
  removeBlocks,
  updateBlock,
  type TemplateV2EditorDispatch,
  type TemplateV2EditorState,
} from "@repo/template-editor-core";
import { asObject, normalizeBlockConfig, type TemplateV2Block } from "@repo/template-editor-core";
import { requestTemplateVersionImageUpload } from "@repo/template-editor-core";
import { TemplateBlockSafeAreaAlignmentStrip } from "./TemplateBlockSafeAreaAlignmentStrip";
import { cn } from "./primitives/cn";

type Props = {
  state: TemplateV2EditorState;
  dispatch: TemplateV2EditorDispatch;
  /**
   * Reemplaza el contenedor propio (dirección, cromo y espaciado). La barra de propiedades la
   * monta en una sola línea sin borde ni fondo; suelta, envuelve y crece en alto.
   */
  shellClassName?: string;
  templateId: string;
  versionId: string;
};

const btnBase =
  "rounded-md border border-[color:var(--te-line)] bg-white px-2 py-1 text-[10px] font-medium text-[color:var(--te-ink)] shadow-sm transition-colors hover:border-[color:var(--te-line-strong)] hover:bg-[color:var(--te-chrome)] disabled:cursor-not-allowed disabled:opacity-40";

function mergeConfigJson(block: TemplateV2Block, patch: Record<string, unknown>) {
  const base = asObject(normalizeBlockConfig(block.type, block.configJson));
  return { ...base, ...patch };
}

/** Acciones mínimas para imagen y forma; la tipografía va en la barra superior. */
export function TemplateBlockContextToolbar({
  state,
  dispatch,
  templateId,
  versionId,
  shellClassName,
}: Props) {
  const primaryId = getPrimarySelectedBlockId(state);
  const block = primaryId ? state.blocks.find((b) => b.id === primaryId) ?? null : null;
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);

  if (!block || state.selectedBlockIds.length === 0) {
    return null;
  }

  if (block.type === "TEXT" || block.type === "VARIABLE_TEXT") {
    return null;
  }

  const selectedBlock: TemplateV2Block = block;
  const locked = selectedBlock.layout.locked ?? false;

  function patchConfig(patch: Record<string, unknown>) {
    dispatch(updateBlock(selectedBlock.id, { configJson: mergeConfigJson(selectedBlock, patch) }));
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImageUploading(true);
    void requestTemplateVersionImageUpload(templateId, versionId, file)
      .then((url) => {
        const cfg = normalizeBlockConfig("IMAGE", selectedBlock.configJson);
        const source = asObject(cfg.source);
        patchConfig({ src: url, source: { ...source, variableKey: "" } });
      })
      .catch(() => {})
      .finally(() => setImageUploading(false));
  }

  const shapeCfg = selectedBlock.type === "SHAPE" ? normalizeBlockConfig("SHAPE", selectedBlock.configJson) : null;
  const radius = shapeCfg && typeof shapeCfg.radius === "number" ? shapeCfg.radius : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-x-1 gap-y-1.5",
        shellClassName ??
          "flex-wrap border-t border-[color:var(--te-line)] bg-[color:var(--te-chrome-sunken)] px-2 py-1.5",
      )}
      role="toolbar"
      aria-label="Acciones del bloque"
    >
      <span className="mr-1 hidden text-[10px] font-medium text-[color:var(--te-ink-faint)] sm:inline">Bloque</span>

      <div className="flex items-center gap-1.5">
        <span className="hidden shrink-0 text-[10px] font-medium text-[color:var(--te-ink-faint)] sm:inline">Posición</span>
        <TemplateBlockSafeAreaAlignmentStrip state={state} dispatch={dispatch} />
      </div>

      <span className="mx-0.5 hidden h-8 w-px shrink-0 bg-[color:var(--te-line)] sm:inline" aria-hidden />

      <button
        type="button"
        className={btnBase}
        disabled={locked}
        title="Duplicar (⌘D)"
        onClick={() => dispatch(duplicateBlock(selectedBlock.id))}
      >
        Duplicar
      </button>
      <button
        type="button"
        className={btnBase}
        disabled={locked}
        title="Eliminar"
        onClick={() =>
          state.selectedBlockIds.length > 1
            ? dispatch(removeBlocks(state.selectedBlockIds))
            : dispatch(removeBlock(selectedBlock.id))
        }
      >
        Eliminar
      </button>

      {selectedBlock.type === "IMAGE" ? (
        <>
          <span className="mx-0.5 hidden h-4 w-px bg-[color:var(--te-line)] sm:inline" aria-hidden />
          <input
            ref={imageFileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={handleImageFile}
          />
          <button
            type="button"
            className={btnBase}
            disabled={locked || imageUploading}
            title="Reemplazar imagen"
            onClick={() => imageFileRef.current?.click()}
          >
            {imageUploading ? "…" : "Reemplazar"}
          </button>
        </>
      ) : null}

      {selectedBlock.type === "SHAPE" && shapeCfg ? (
        <>
          <span className="mx-0.5 hidden h-4 w-px bg-[color:var(--te-line)] sm:inline" aria-hidden />
          <button
            type="button"
            className={btnBase}
            disabled={locked || radius <= 0}
            title="Menos redondez"
            onClick={() => patchConfig({ radius: Math.max(0, radius - 4) })}
          >
            ⌒−
          </button>
          <button
            type="button"
            className={btnBase}
            disabled={locked}
            title="Más redondez"
            onClick={() => patchConfig({ radius: radius + 4 })}
          >
            ⌒+
          </button>
        </>
      ) : null}
    </div>
  );
}
