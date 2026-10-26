"use client";

import { useMemo, useRef, useState } from "react";
import { LayoutTemplate, Menu, Palette, Rows3 } from "lucide-react";
import { saveWebsiteBlocksAction, saveWebsiteBrandingColorsAction } from "@/app/actions/website";
import {
  createEmptyBlock,
  type WebsiteBlock,
  type WebsiteBlockType,
  type WebsitePageMeta,
} from "@/lib/website/blocks";
import { HOME_PAGE_KEY, listCustomPages, nextPageKey } from "@/lib/website/pages";
import { MAX_CUSTOM_PAGES } from "@/lib/website/save-pages";
import type { WebsiteColors } from "@/lib/website/branding-defaults";
import type { WebsiteDesignPresets } from "@/lib/website/design-presets";
import type { WebsiteTemplate } from "@/lib/website/templates";
import type { SiteMenu } from "@/lib/website/site-menu";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import { useDraftAutosave, type AutosaveStatus } from "@/lib/website/use-draft-autosave";
import type { WebsiteChangeStatus } from "@/lib/website/change-status";
import type { FotofficeOrganizationTypeId } from "@/lib/onboarding-constants";
import { HeroEditingProvider } from "@/lib/website/hero-editing-context";
import { BuilderTopBar } from "./builder-top-bar";
import { SectionList } from "./section-list";
import { TemplatePickerPanel } from "./template-picker-panel";
import { DesignPanel } from "./design-panel";
import { MenuPanel } from "./menu-panel";
import { BlockInspectorPanel } from "./block-inspector-panel";
import { LivePreview } from "./live-preview";
import { PageSwitcher } from "./page-switcher";
import type { DeviceWidth } from "./device-toggle";
import { AddBlockPicker } from "../editor/add-block-picker";

export type BuilderMode = "PLANTILLAS" | "SECCIONES" | "MENU" | "DISENO";

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

/** Las páginas propias del borrador tal como las guardó el servidor. */
export type BuilderInitialPages = {
  /** Bloques de cada página, `home` incluida. */
  pages: Record<string, WebsiteBlock[]>;
  pageMeta: Record<string, WebsitePageMeta>;
};

export function WebsiteBuilder({
  initialPages,
  initialColors,
  initialLogoUrl,
  initialFaviconUrl,
  initialDesignPresets,
  initialMenu,
  enabledModuleKeys: enabledModuleKeyList,
  personVocabulary,
  initialPanel,
  workspaceName,
  organizationType,
  canEdit,
  canEditIdentity,
  draftUpdatedAt,
  status,
}: {
  initialPages: BuilderInitialPages;
  initialColors: WebsiteColors;
  initialLogoUrl: string | null;
  initialFaviconUrl: string | null;
  initialDesignPresets: WebsiteDesignPresets;
  initialMenu: SiteMenu | null;
  enabledModuleKeys: string[];
  personVocabulary: PersonVocabulary;
  initialPanel?: BuilderMode;
  workspaceName: string;
  organizationType: FotofficeOrganizationTypeId | null;
  canEdit: boolean;
  /** Logo y favicon: dueño/admin. Sin esto, se ven pero no se cambian ni se mandan. */
  canEditIdentity: boolean;
  draftUpdatedAt: string;
  status: WebsiteChangeStatus;
}) {
  const [mode, setMode] = useState<BuilderMode>(
    initialPanel ?? ((initialPages.pages[HOME_PAGE_KEY] ?? []).length === 0 ? "PLANTILLAS" : "SECCIONES"),
  );
  // Todas las páginas viven en memoria; `activeKey` dice cuál se está editando. Así cambiar de
  // página no pierde nada aunque el guardado vaya un paso atrás.
  const [pages, setPages] = useState<Record<string, WebsiteBlock[]>>(initialPages.pages);
  const [pageMeta, setPageMeta] = useState<Record<string, WebsitePageMeta>>(initialPages.pageMeta);
  const [activeKey, setActiveKey] = useState<string>(HOME_PAGE_KEY);
  // Lo último que el servidor confirmó, por página: el guardado sólo manda lo que cambió.
  const savedPagesRef = useRef<Record<string, string>>(
    Object.fromEntries(Object.entries(initialPages.pages).map(([k, v]) => [k, JSON.stringify(v)])),
  );
  const blocks = useMemo(() => pages[activeKey] ?? [], [pages, activeKey]);
  const homeBlocks = pages[HOME_PAGE_KEY] ?? [];
  const setBlocks = (next: WebsiteBlock[] | ((prev: WebsiteBlock[]) => WebsiteBlock[])) =>
    setPages((prev) => {
      const actual = prev[activeKey] ?? [];
      return { ...prev, [activeKey]: typeof next === "function" ? next(actual) : next };
    });
  const [presets, setPresets] = useState<WebsiteDesignPresets>(initialDesignPresets);
  const [menu, setMenu] = useState<SiteMenu | null>(initialMenu);
  const enabledModuleKeys = useMemo(() => new Set(enabledModuleKeyList), [enabledModuleKeyList]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<DeviceWidth>("desktop");
  const [colors, setColors] = useState<WebsiteColors>(initialColors);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(initialFaviconUrl);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Secciones + páginas + diseño global + menú viven en la MISMA fila (FotofficeWorkspaceWebsite)
  // y comparten updatedAt — por eso es UN SOLO autosave combinado, no varios compitiendo por la
  // misma referencia de concurrencia (ver comentario en saveWebsiteBlocksAction).
  //
  // El servidor guarda los bloques de UNA página por llamada. Acá se arma el guardado en pasos:
  // el primero lleva la lista de páginas, el diseño y el menú (y los bloques de la primera
  // página que cambió — la lista va antes, así una página recién creada ya existe); si cambiaron
  // más páginas, van una llamada cada una, encadenando el `updatedAt` que devuelve la anterior.
  const draftAutosave = useDraftAutosave({
    value: { pages, pageMeta, presets, menu },
    initialUpdatedAt: draftUpdatedAt,
    enabled: canEdit,
    save: async (value, expectedUpdatedAt) => {
      const cambiadas = Object.keys(value.pages).filter(
        (k) => (k === HOME_PAGE_KEY || Object.hasOwn(value.pageMeta, k)) && JSON.stringify(value.pages[k]) !== savedPagesRef.current[k],
      );
      let updatedAt = expectedUpdatedAt;
      for (let paso = 0; paso === 0 || paso < cambiadas.length; paso++) {
        const fd = new FormData();
        const key = cambiadas[paso];
        if (key !== undefined) {
          fd.set("pageKey", key);
          fd.set("blocksJson", JSON.stringify(value.pages[key]));
        }
        if (paso === 0) {
          fd.set("pagesMetaJson", JSON.stringify(value.pageMeta));
          fd.set("designPresetsJson", JSON.stringify(value.presets));
          fd.set("navJson", JSON.stringify(value.menu));
        }
        fd.set("draftUpdatedAt", updatedAt);
        const res = await saveWebsiteBlocksAction(undefined, fd);
        if (res.updatedAt) updatedAt = res.updatedAt;
        if (res.error) return { error: res.error, updatedAt: updatedAt === expectedUpdatedAt ? undefined : updatedAt };
        if (key !== undefined) savedPagesRef.current[key] = JSON.stringify(value.pages[key]);
      }
      return { error: null, updatedAt };
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
      if (canEditIdentity) {
        fd.set("logoUrl", value.logoUrl ?? "");
        fd.set("faviconUrl", value.faviconUrl ?? "");
      }
      const res = await saveWebsiteBrandingColorsAction(undefined, fd);
      return { error: res.error };
    },
  });

  const autosaveStatus = combineAutosaveStatus(draftAutosave.status, brandingAutosave.status);
  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;
  const hasContent = homeBlocks.length > 0;
  const customPages = listCustomPages({ pages, pageMeta });
  const activeTitle = activeKey === HOME_PAGE_KEY ? "Portada" : (pageMeta[activeKey]?.title ?? "Página");

  // Cambiar de página: primero se guarda lo pendiente de la actual. Si el guardado falla, igual
  // se cambia — nada se pierde porque todo sigue en memoria y el autosave reintenta.
  async function handleSelectPage(key: string) {
    if (key === activeKey) return;
    await draftAutosave.flush();
    setActiveKey(key);
    setSelectedId(null);
  }

  async function handleCreatePage(title: string, slug: string) {
    if (customPages.length >= MAX_CUSTOM_PAGES) return;
    await draftAutosave.flush();
    const key = nextPageKey([...Object.keys(pageMeta), ...Object.keys(pages)]);
    setPageMeta((prev) => ({ ...prev, [key]: { title, slug } }));
    setPages((prev) => ({ ...prev, [key]: [] }));
    setActiveKey(key);
    setSelectedId(null);
    setMode("SECCIONES");
  }

  function handleRenamePage(key: string, title: string) {
    setPageMeta((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], title } } : prev));
  }

  function handleChangeSlug(key: string, slug: string) {
    setPageMeta((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], slug } } : prev));
  }

  function handleDeletePage(key: string) {
    setPageMeta((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)));
    setPages((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)));
    delete savedPagesRef.current[key];
    if (activeKey === key) {
      setActiveKey(HOME_PAGE_KEY);
      setSelectedId(null);
    }
  }

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
      // Las plantillas arman la portada: se vuelve a ella para que el cambio se vea.
      setPages((prev) => ({ ...prev, [HOME_PAGE_KEY]: reorder(template.seedSections()) }));
      setActiveKey(HOME_PAGE_KEY);
      setSelectedId(null);
      setMode("SECCIONES");
    }
    // La disposición del menú se elige en su propia pestaña: una plantilla no la pisa.
    setPresets((prev) => ({ ...template.designPreset, menuLayout: prev.menuLayout, menuSide: prev.menuSide }));
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
              <div className="flex h-full min-h-0 flex-col">
              <PageSwitcher
                pages={customPages.map((p) => ({ key: p.key, title: p.title, slug: p.slug }))}
                activeKey={activeKey}
                canEdit={canEdit}
                limitReached={customPages.length >= MAX_CUSTOM_PAGES}
                onSelect={(k) => void handleSelectPage(k)}
                onCreate={(t, s) => void handleCreatePage(t, s)}
                onRename={handleRenamePage}
                onChangeSlug={handleChangeSlug}
                onDelete={handleDeletePage}
              />
              <div className="min-h-0 flex-1">
              <SectionList
                title={activeTitle}
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
              </div>
              </div>
            ) : null}
            {mode === "PLANTILLAS" ? (
              <TemplatePickerPanel hasContent={hasContent} canEdit={canEdit} organizationType={organizationType} onApply={handleApplyTemplate} />
            ) : null}
            {mode === "MENU" ? (
              <MenuPanel
                menu={menu}
                presets={presets}
                blocks={homeBlocks}
                enabledModuleKeys={enabledModuleKeys}
                personVocabulary={personVocabulary}
                canEdit={canEdit}
                onMenuChange={setMenu}
                onPresetsChange={setPresets}
              />
            ) : null}
            {mode === "DISENO" ? (
              <DesignPanel
                colors={colors}
                logoUrl={logoUrl}
                faviconUrl={faviconUrl}
                presets={presets}
                canEdit={canEdit}
                canEditIdentity={canEditIdentity}
                onColorsChange={setColors}
                onLogoChange={setLogoUrl}
                onFaviconChange={setFaviconUrl}
                onPresetsChange={setPresets}
              />
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <LivePreview
            blocks={blocks}
            homeBlocks={homeBlocks}
            colors={colors}
            designPresets={presets}
            menu={menu}
            enabledModuleKeys={enabledModuleKeys}
            personVocabulary={personVocabulary}
            logoUrl={logoUrl}
            workspaceName={workspaceName}
            device={device}
          />
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
        { id: "MENU" as const, label: "Menú", Icon: Menu },
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
