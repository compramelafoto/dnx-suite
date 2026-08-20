"use client";

import { useMemo, useState } from "react";
import { LayoutTemplate, Palette, Rows3 } from "lucide-react";
import { saveWebsiteBlocksAction, saveWebsiteBrandingColorsAction } from "@/app/actions/website";
import { createEmptyBlock, type WebsiteBlock, type WebsiteBlockType } from "@/lib/website/blocks";
import type { WebsiteColors } from "@/lib/website/branding-defaults";
import type { WebsiteDesignPresets } from "@/lib/website/design-presets";
import type { WebsiteTemplate } from "@/lib/website/templates";
import { useDraftAutosave, type AutosaveStatus } from "@/lib/website/use-draft-autosave";
import type { WebsiteChangeStatus } from "@/lib/website/change-status";
import type { FotofficeOrganizationTypeId } from "@/lib/onboarding-constants";
import { HeroEditingProvider } from "@/lib/website/hero-editing-context";
import { BuilderTopBar } from "./builder-top-bar";
import { SectionList } from "./section-list";
import { TemplatePickerPanel } from "./template-picker-panel";
import { DesignPanel } from "./design-panel";
import { BlockInspectorPanel } from "./block-inspector-panel";
import { LivePreview } from "./live-preview";
import type { DeviceWidth } from "./device-toggle";
import { AddBlockPicker } from "../editor/add-block-picker";

type BuilderMode = "PLANTILLAS" | "SECCIONES" | "DISENO";

function reorder(blocks: WebsiteBlock[]): WebsiteBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }) as WebsiteBlock);
}

/** Prioridad para combinar 2 autosaves independientes (secciones+diseño global vs.
 * colores/logo/favicon — tablas distintas, no pueden compartir un solo hook) en un único
 * indicador de la toolbar: mientras cualquiera esté guardando, mostrar "Guardando…"; si alguno
 * tiene error, mostrarlo; etc. Nunca hace que uno tape silenciosamente el estado del otro. */
function combineAutosaveStatus(a: AutosaveStatus, b: AutosaveStatus): AutosaveStatus {
  const order: AutosaveStatus[] = ["conflict", "error", "saving", "dirty", "saved", "idle"];
  return order.find((s) => a === s || b === s) ?? "idle";
}

export function WebsiteBuilder({
  initialBlocks,
  initialColors,
  initialLogoUrl,
  initialFaviconUrl,
  initialDesignPresets,
  workspaceName,
  organizationType,
  canEdit,
  draftUpdatedAt,
  status,
}: {
  initialBlocks: WebsiteBlock[];
  initialColors: WebsiteColors;
  initialLogoUrl: string | null;
  initialFaviconUrl: string | null;
  initialDesignPresets: WebsiteDesignPresets;
  workspaceName: string;
  organizationType: FotofficeOrganizationTypeId | null;
  canEdit: boolean;
  draftUpdatedAt: string;
  status: WebsiteChangeStatus;
}) {
  const [mode, setMode] = useState<BuilderMode>(initialBlocks.length === 0 ? "PLANTILLAS" : "SECCIONES");
  const [blocks, setBlocks] = useState<WebsiteBlock[]>(initialBlocks);
  const [presets, setPresets] = useState<WebsiteDesignPresets>(initialDesignPresets);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceWidth>("desktop");
  const [colors, setColors] = useState<WebsiteColors>(initialColors);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(initialFaviconUrl);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Secciones + diseño global viven en la MISMA fila (FotofficeWorkspaceWebsite) y comparten
  // updatedAt — por eso es UN SOLO autosave combinado, no dos compitiendo por la misma
  // referencia de concurrencia (ver comentario en saveWebsiteBlocksAction).
  const draftAutosave = useDraftAutosave({
    value: { blocks, presets },
    initialUpdatedAt: draftUpdatedAt,
    enabled: canEdit,
    save: async (value, expectedUpdatedAt) => {
      const fd = new FormData();
      fd.set("blocksJson", JSON.stringify(value.blocks));
      fd.set("designPresetsJson", JSON.stringify(value.presets));
      fd.set("draftUpdatedAt", expectedUpdatedAt);
      return saveWebsiteBlocksAction(undefined, fd);
    },
  });

  // Colores/logo/favicon viven en FotofficeWorkspaceBranding (tabla distinta, sin concurrencia
  // optimista propia — mismo criterio que la etapa anterior).
  const brandingAutosave = useDraftAutosave({
    value: { colors, logoUrl, faviconUrl },
    initialUpdatedAt: "",
    enabled: canEdit,
    save: async (value) => {
      const fd = new FormData();
      for (const [key, v] of Object.entries(value.colors)) fd.set(key, v);
      fd.set("logoUrl", value.logoUrl ?? "");
      fd.set("faviconUrl", value.faviconUrl ?? "");
      const res = await saveWebsiteBrandingColorsAction(undefined, fd);
      return { error: res.error };
    },
  });

  const autosaveStatus = combineAutosaveStatus(draftAutosave.status, brandingAutosave.status);
  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;
  const hasContent = blocks.length > 0;

  function handleBlockChange(updated: WebsiteBlock) {
    setBlocks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  function handleToggleVisible(id: string) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, visible: !b.visible } as WebsiteBlock) : b)));
  }

  function handleDuplicate(id: string) {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index === -1) return prev;
      // Clon profundo del config: nunca compartir referencias mutables con el original — editar
      // la copia no debe poder afectar accidentalmente al bloque de origen ni viceversa.
      const clone = { ...prev[index], id: crypto.randomUUID(), config: structuredClone(prev[index].config) } as WebsiteBlock;
      const next = [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)];
      return reorder(next);
    });
  }

  function handleDelete(id: string) {
    setBlocks((prev) => reorder(prev.filter((b) => b.id !== id)));
    setSelectedId((current) => (current === id ? null : current));
  }

  function handleMove(id: string, direction: "up" | "down") {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index === -1) return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return reorder(next);
    });
  }

  function handleReorder(orderedIds: string[]) {
    setBlocks((prev) => {
      const byId = new Map(prev.map((b) => [b.id, b]));
      const next = orderedIds.map((id) => byId.get(id)).filter((b): b is WebsiteBlock => Boolean(b));
      return reorder(next);
    });
  }

  function handleAddBlock(type: WebsiteBlockType) {
    setBlocks((prev) => {
      const next = reorder([...prev, createEmptyBlock(type, prev.length)]);
      setSelectedId(next[next.length - 1].id);
      return next;
    });
    setPickerOpen(false);
    setMode("SECCIONES");
  }

  function handleApplyTemplate(template: WebsiteTemplate, applyMode: "full" | "designOnly") {
    if (applyMode === "full") {
      setBlocks(reorder(template.seedSections()));
      setMode("SECCIONES");
    }
    setPresets(template.designPreset);
  }

  return (
    <HeroEditingProvider>
    <div className="flex h-[80vh] min-h-[560px] flex-col rounded-xl border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] overflow-hidden">
      <BuilderTopBar
        status={status}
        canEdit={canEdit}
        draftUpdatedAt={draftAutosave.draftUpdatedAt}
        device={device}
        onDeviceChange={setDevice}
        autosaveStatus={autosaveStatus}
        autosaveError={draftAutosave.error ?? brandingAutosave.error}
        onDraftUpdatedAtChange={draftAutosave.syncUpdatedAt}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-72 shrink-0 flex-col border-r border-[var(--fo-border)]">
          <ModeSwitcher mode={mode} onChange={setMode} />
          <div className="flex-1 overflow-hidden">
            {mode === "SECCIONES" ? (
              <SectionList
                blocks={blocks}
                selectedId={selectedId}
                canEdit={canEdit}
                onSelect={setSelectedId}
                onToggleVisible={handleToggleVisible}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onMove={handleMove}
                onReorder={handleReorder}
                onAddClick={() => setPickerOpen(true)}
              />
            ) : null}
            {mode === "PLANTILLAS" ? (
              <TemplatePickerPanel hasContent={hasContent} canEdit={canEdit} organizationType={organizationType} onApply={handleApplyTemplate} />
            ) : null}
            {mode === "DISENO" ? (
              <DesignPanel
                colors={colors}
                logoUrl={logoUrl}
                faviconUrl={faviconUrl}
                presets={presets}
                canEdit={canEdit}
                onColorsChange={setColors}
                onLogoChange={setLogoUrl}
                onFaviconChange={setFaviconUrl}
                onPresetsChange={setPresets}
              />
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <LivePreview blocks={blocks} colors={colors} designPresets={presets} logoUrl={logoUrl} workspaceName={workspaceName} device={device} />
        </div>

        {mode === "SECCIONES" && selectedBlock ? (
          <div className="w-80 shrink-0 border-l border-[var(--fo-border)]">
            <BlockInspectorPanel block={selectedBlock} canEdit={canEdit} onChange={handleBlockChange} onClose={() => setSelectedId(null)} />
          </div>
        ) : null}
      </div>

      {pickerOpen ? <AddBlockPicker onSelect={handleAddBlock} onClose={() => setPickerOpen(false)} /> : null}
    </div>
    </HeroEditingProvider>
  );
}

function ModeSwitcher({ mode, onChange }: { mode: BuilderMode; onChange: (m: BuilderMode) => void }) {
  const items = useMemo(
    () =>
      [
        { id: "PLANTILLAS" as const, label: "Plantillas", Icon: LayoutTemplate },
        { id: "SECCIONES" as const, label: "Secciones", Icon: Rows3 },
        { id: "DISENO" as const, label: "Diseño", Icon: Palette },
      ] satisfies { id: BuilderMode; label: string; Icon: typeof Rows3 }[],
    [],
  );
  return (
    <div className="flex border-b border-[var(--fo-border)]" role="tablist" aria-label="Modo del constructor">
      {items.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          className={[
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors",
            mode === id ? "border-[var(--fo-accent)] text-[var(--fo-text)]" : "border-transparent text-[var(--fo-muted)] hover:text-[var(--fo-text)]",
          ].join(" ")}
          onClick={() => onChange(id)}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
