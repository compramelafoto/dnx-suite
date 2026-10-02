"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { SelectField, TextField, ToggleField } from "@/components/website/inspector/inspector-fields";
import type { WebsiteBlock } from "@/lib/website/blocks";
import type { PersonVocabulary } from "@/lib/vocabulario/personas";
import {
  HEADER_PRESETS,
  MENU_LAYOUTS,
  MENU_SIDES,
  menuLayoutHasSide,
  type MenuLayoutId,
  type WebsiteDesignPresets,
} from "@/lib/website/design-presets";
import {
  SITE_MENU_LABEL_MAX,
  SITE_MENU_MAX_ITEMS,
  availableMenuPages,
  availableMenuSections,
  isSafeMenuUrl,
  materializeSiteMenu,
  menuPageDefaultLabel,
  normalizeMenuUrl,
  type SiteMenu,
  type SiteMenuEntry,
} from "@/lib/website/site-menu";
import { RowIconButton } from "./section-list";

/**
 * Pestaña "Menú" del constructor: dónde vive el menú (disposición) y qué tiene (ítems).
 *
 * La disposición se guarda con el resto del diseño (`designPresetsJson`); los ítems, en
 * `navJson`. Mientras el dueño no toque la lista, `menu` es `null` y el menú se arma solo —
 * la lista que se ve acá es esa misma, materializada. Al primer cambio pasa a ser suya.
 */
export function MenuPanel({
  menu,
  presets,
  blocks,
  enabledModuleKeys,
  personVocabulary,
  canEdit,
  onMenuChange,
  onPresetsChange,
}: {
  menu: SiteMenu | null;
  presets: WebsiteDesignPresets;
  blocks: WebsiteBlock[];
  enabledModuleKeys: ReadonlySet<string>;
  personVocabulary: PersonVocabulary;
  canEdit: boolean;
  onMenuChange: (menu: SiteMenu | null) => void;
  onPresetsChange: (presets: WebsiteDesignPresets) => void;
}) {
  const items = useMemo(() => materializeSiteMenu(menu, enabledModuleKeys).items, [menu, enabledModuleKeys]);
  const paginas = useMemo(
    () => new Map(availableMenuPages(enabledModuleKeys, personVocabulary).map((p) => [p.page, p])),
    [enabledModuleKeys, personVocabulary],
  );
  const secciones = useMemo(() => availableMenuSections(blocks), [blocks]);
  const seccionesPorId = useMemo(() => new Map(secciones.map((s) => [s.blockId, s])), [secciones]);

  const cambiarItems = (next: SiteMenuEntry[]) => onMenuChange({ version: 2, items: next });
  const actualizar = (id: string, cambio: Partial<SiteMenuEntry>) =>
    cambiarItems(items.map((i) => (i.id === id ? ({ ...i, ...cambio } as SiteMenuEntry) : i)));
  const mover = (index: number, delta: -1 | 1) => {
    const destino = index + delta;
    if (destino < 0 || destino >= items.length) return;
    const next = [...items];
    [next[index], next[destino]] = [next[destino], next[index]];
    cambiarItems(next);
  };
  const quitar = (id: string) => cambiarItems(items.filter((i) => i.id !== id));
  const agregar = (entry: SiteMenuEntry) => cambiarItems([...items, entry]);

  const lleno = items.length >= SITE_MENU_MAX_ITEMS;
  const paginasParaAgregar = [...paginas.values()].filter((p) => !items.some((i) => i.kind === "page" && i.page === p.page));
  const seccionesParaAgregar = secciones.filter((s) => !items.some((i) => i.kind === "section" && i.blockId === s.blockId));

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 border-b border-[var(--fo-border)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">Menú</p>
      </div>
      <fieldset disabled={!canEdit} className="flex-1 overflow-y-auto p-4 space-y-6 border-0">
        <section className="space-y-3">
          <p className="text-xs font-semibold text-[var(--fo-text)]">Disposición</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Disposición del menú">
            {MENU_LAYOUTS.map((layout) => {
              const activo = presets.menuLayout === layout.id;
              return (
                <button
                  key={layout.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  title={layout.description}
                  onClick={() => onPresetsChange({ ...presets, menuLayout: layout.id })}
                  className={[
                    "rounded-lg border p-2 text-left transition-colors",
                    activo ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]" : "border-[var(--fo-border)] hover:border-[var(--fo-muted-soft)]",
                  ].join(" ")}
                >
                  <LayoutThumb layout={layout.id} side={presets.menuSide} />
                  <span className="mt-1.5 block text-xs font-medium text-[var(--fo-text)]">{layout.label}</span>
                </button>
              );
            })}
          </div>
          <p className="fo-helper">
            {MENU_LAYOUTS.find((l) => l.id === presets.menuLayout)?.description} En el celular, el menú siempre se abre con el botón ☰.
          </p>

          {menuLayoutHasSide(presets.menuLayout) ? (
            <div className="space-y-1.5">
              <span className="fo-label text-xs">Lado</span>
              <div className="flex gap-2">
                {MENU_SIDES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={presets.menuSide === s.id}
                    onClick={() => onPresetsChange({ ...presets, menuSide: s.id })}
                    className={[
                      "flex-1 rounded-lg border px-3 py-1.5 text-xs",
                      presets.menuSide === s.id ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)] text-[var(--fo-text)]" : "border-[var(--fo-border)] text-[var(--fo-muted)]",
                    ].join(" ")}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {presets.menuLayout === "topbar" ? (
            <SelectField
              label="Estilo de la barra"
              value={presets.headerPreset}
              onChange={(v) => onPresetsChange({ ...presets, headerPreset: v as WebsiteDesignPresets["headerPreset"] })}
              options={HEADER_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            />
          ) : null}

          <ToggleField
            label='Mostrar botón "Iniciar sesión"'
            checked={presets.showLoginButton}
            onChange={(v) => onPresetsChange({ ...presets, showLoginButton: v })}
          />
          {presets.showLoginButton ? (
            <TextField
              label="Texto del botón"
              value={presets.loginButtonLabel}
              onChange={(v) => onPresetsChange({ ...presets, loginButtonLabel: v })}
            />
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--fo-text)]">Ítems del menú</p>
            {menu ? (
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
                onClick={() => {
                  if (window.confirm("¿Volver al menú automático? Se pierden los cambios que hiciste en la lista.")) onMenuChange(null);
                }}
              >
                <RotateCcw className="h-3 w-3" /> Automático
              </button>
            ) : null}
          </div>
          <p className="fo-helper">
            {menu
              ? "Lo armaste vos. Si encendés un módulo nuevo, su página se suma al final."
              : "Se arma solo con tus páginas. Cambiá cualquier cosa y pasa a ser tuyo."}
          </p>

          <ul className="space-y-1">
            {items.map((item, index) => (
              <MenuItemRow
                key={item.id}
                item={item}
                defaultLabel={
                  item.kind === "page"
                    ? (menuPageDefaultLabel(item.page, personVocabulary) ?? item.page)
                    : item.kind === "section"
                      ? (seccionesPorId.get(item.blockId)?.label ?? "Sección")
                      : item.label
                }
                problema={
                  item.kind === "page" && !paginas.has(item.page)
                    ? "Módulo apagado: no se muestra"
                    : item.kind === "section" && !seccionesPorId.has(item.blockId)
                      ? "Esa sección ya no existe o está oculta"
                      : null
                }
                // Las páginas automáticas no se borran (volverían solas): se ocultan.
                removable={item.kind !== "page" || !paginas.get(item.page)?.automatic}
                isFirst={index === 0}
                isLast={index === items.length - 1}
                canEdit={canEdit}
                onChange={(cambio) => actualizar(item.id, cambio)}
                onMove={(d) => mover(index, d)}
                onRemove={() => quitar(item.id)}
              />
            ))}
          </ul>

          {canEdit ? (
            <AddMenuItem
              disabled={lleno}
              paginas={paginasParaAgregar.map((p) => ({ value: p.page, label: p.label }))}
              secciones={seccionesParaAgregar.map((s) => ({ value: s.blockId, label: s.label }))}
              onAdd={agregar}
            />
          ) : null}
          {lleno ? <p className="fo-helper">Llegaste al máximo de {SITE_MENU_MAX_ITEMS} ítems.</p> : null}
        </section>
      </fieldset>
    </div>
  );
}

function MenuItemRow({
  item,
  defaultLabel,
  problema,
  removable,
  isFirst,
  isLast,
  canEdit,
  onChange,
  onMove,
  onRemove,
}: {
  item: SiteMenuEntry;
  defaultLabel: string;
  problema: string | null;
  removable: boolean;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
  onChange: (cambio: Partial<SiteMenuEntry>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const tipo = item.kind === "page" ? "Página" : item.kind === "section" ? "Sección" : "Link";

  return (
    <li
      className={[
        "group rounded-lg border border-transparent px-2 py-2 hover:border-[var(--fo-border)]",
        item.hidden || problema ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-accent)]">{tipo}</p>
          <p className="flex items-center gap-1 truncate text-sm text-[var(--fo-text)]">
            {item.kind === "link" ? item.label : item.label || defaultLabel}
            {item.kind === "link" && item.newTab ? <ExternalLink className="h-3 w-3 shrink-0 text-[var(--fo-muted)]" aria-label="Se abre en otra pestaña" /> : null}
          </p>
          {problema ? <p className="text-xs text-[var(--fo-muted)]">{problema}</p> : null}
        </div>
        {item.hidden ? <EyeOff className="h-3.5 w-3.5 shrink-0 text-[var(--fo-muted)]" aria-label="Oculto" /> : null}
      </div>

      {canEdit ? (
        <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <RowIconButton label="Editar" onClick={() => setEditando((v) => !v)}>
            <Pencil className="h-3.5 w-3.5" />
          </RowIconButton>
          <RowIconButton label={item.hidden ? "Mostrar en el menú" : "Ocultar del menú"} onClick={() => onChange({ hidden: !item.hidden })}>
            {item.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </RowIconButton>
          <RowIconButton label="Subir" onClick={() => onMove(-1)} disabled={isFirst}>
            <ChevronUp className="h-3.5 w-3.5" />
          </RowIconButton>
          <RowIconButton label="Bajar" onClick={() => onMove(1)} disabled={isLast}>
            <ChevronDown className="h-3.5 w-3.5" />
          </RowIconButton>
          {removable ? (
            <RowIconButton label="Quitar del menú" onClick={onRemove} danger>
              <Trash2 className="h-3.5 w-3.5" />
            </RowIconButton>
          ) : null}
        </div>
      ) : null}

      {editando ? (
        item.kind === "link" ? (
          <LinkForm
            initial={{ label: item.label, url: item.url, newTab: item.newTab }}
            submitLabel="Guardar"
            onCancel={() => setEditando(false)}
            onSubmit={(v) => {
              onChange(v);
              setEditando(false);
            }}
          />
        ) : (
          <div className="mt-2 space-y-1.5 border-t border-[var(--fo-border)] pt-2">
            <label className="block space-y-1">
              <span className="fo-label text-xs">Nombre en el menú</span>
              <input
                className="fo-input text-sm"
                value={item.label ?? ""}
                placeholder={defaultLabel}
                maxLength={SITE_MENU_LABEL_MAX}
                onChange={(e) => onChange({ label: e.target.value.trim() === "" ? null : e.target.value })}
              />
            </label>
            <p className="fo-helper">Vacío = “{defaultLabel}”.</p>
          </div>
        )
      ) : null}
    </li>
  );
}

type Opcion = { value: string; label: string };

function AddMenuItem({
  disabled,
  paginas,
  secciones,
  onAdd,
}: {
  disabled: boolean;
  paginas: Opcion[];
  secciones: Opcion[];
  onAdd: (entry: SiteMenuEntry) => void;
}) {
  const [modo, setModo] = useState<"cerrado" | "elegir" | "link">("cerrado");
  const nuevoId = () => crypto.randomUUID();

  if (modo === "link") {
    return (
      <LinkForm
        initial={{ label: "", url: "", newTab: true }}
        submitLabel="Agregar"
        onCancel={() => setModo("cerrado")}
        onSubmit={(v) => {
          onAdd({ id: nuevoId(), kind: "link", hidden: false, ...v });
          setModo("cerrado");
        }}
      />
    );
  }

  if (modo === "elegir") {
    return (
      <div className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3">
        <p className="text-xs font-semibold text-[var(--fo-text)]">Agregar un acceso directo</p>
        {paginas.length > 0 ? (
          <PickList
            titulo="Una página"
            opciones={paginas}
            onPick={(page) => {
              onAdd({ id: `page:${page}`, kind: "page", page, label: null, hidden: false });
              setModo("cerrado");
            }}
          />
        ) : null}
        {secciones.length > 0 ? (
          <PickList
            titulo="Una sección de la portada"
            opciones={secciones}
            onPick={(blockId) => {
              onAdd({ id: nuevoId(), kind: "section", blockId, label: null, hidden: false });
              setModo("cerrado");
            }}
          />
        ) : null}
        <button type="button" className="fo-btn fo-btn-secondary w-full justify-center text-sm" onClick={() => setModo("link")}>
          Un link (Instagram, un formulario, otra web…)
        </button>
        <button type="button" className="w-full text-xs text-[var(--fo-muted)]" onClick={() => setModo("cerrado")}>
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className="fo-btn fo-btn-secondary w-full justify-center gap-2 text-sm disabled:opacity-50"
      onClick={() => setModo("elegir")}
    >
      <Plus className="h-4 w-4" /> Agregar al menú
    </button>
  );
}

function PickList({ titulo, opciones, onPick }: { titulo: string; opciones: Opcion[]; onPick: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <p className="fo-label text-xs">{titulo}</p>
      <div className="flex flex-wrap gap-1.5">
        {opciones.map((o) => (
          <button
            key={o.value}
            type="button"
            className="rounded-full border border-[var(--fo-border)] px-2.5 py-1 text-xs text-[var(--fo-text)] hover:border-[var(--fo-accent)]"
            onClick={() => onPick(o.value)}
          >
            + {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LinkForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { label: string; url: string; newTab: boolean };
  submitLabel: string;
  onSubmit: (v: { label: string; url: string; newTab: boolean }) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial.label);
  const [url, setUrl] = useState(initial.url);
  const [newTab, setNewTab] = useState(initial.newTab);
  const [error, setError] = useState<string | null>(null);

  const enviar = () => {
    const nombre = label.trim();
    const destino = normalizeMenuUrl(url);
    if (!nombre) return setError("Poné el nombre que se va a ver en el menú.");
    if (!isSafeMenuUrl(destino)) return setError("Esa dirección no es válida. Ej.: instagram.com/tu-cuenta");
    onSubmit({ label: nombre, url: destino, newTab });
  };

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-[var(--fo-border)] p-3">
      <label className="block space-y-1">
        <span className="fo-label text-xs">Nombre en el menú</span>
        <input
          className="fo-input text-sm"
          value={label}
          maxLength={SITE_MENU_LABEL_MAX}
          placeholder="Instagram"
          onChange={(e) => {
            setLabel(e.target.value);
            setError(null);
          }}
        />
      </label>
      <label className="block space-y-1">
        <span className="fo-label text-xs">Dirección</span>
        <input
          className="fo-input text-sm"
          value={url}
          placeholder="instagram.com/tu-cuenta"
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
        />
      </label>
      <ToggleField label="Abrir en otra pestaña" checked={newTab} onChange={setNewTab} />
      {error ? <p className="text-xs text-[var(--fo-danger)]">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="text-xs text-[var(--fo-muted)]" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="fo-btn fo-btn-primary text-xs" onClick={enviar}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

/** Miniatura de cada disposición, dibujada con cajas: se entiende de un vistazo. */
function LayoutThumb({ layout, side }: { layout: MenuLayoutId; side: WebsiteDesignPresets["menuSide"] }) {
  const barra = "bg-[var(--fo-muted-soft)]";
  const izq = side === "left";
  return (
    <div className="relative h-12 overflow-hidden rounded border border-[var(--fo-border)] bg-[var(--fo-bg)]" aria-hidden="true">
      {layout === "topbar" ? (
        <>
          <div className="absolute inset-x-0 top-0 h-3 border-b border-[var(--fo-border)]" />
          <div className={`absolute left-1.5 top-1 h-1 w-3 rounded ${barra}`} />
          {[0, 1, 2].map((i) => (
            <div key={i} className={`absolute top-1 h-1 w-2.5 rounded ${barra}`} style={{ right: 6 + i * 13 }} />
          ))}
        </>
      ) : null}
      {layout === "drawer" ? (
        <>
          <div className="absolute inset-0 bg-black/10" />
          <div className={`absolute inset-y-0 w-2/5 bg-[var(--fo-bg-elevated)] p-1 ${izq ? "left-0 border-r" : "right-0 border-l"} border-[var(--fo-border)]`}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={`mt-1 h-1 w-4/5 rounded ${barra}`} />
            ))}
          </div>
        </>
      ) : null}
      {layout === "sidebar" ? (
        <div className={`absolute inset-y-0 w-1/3 p-1 ${izq ? "left-0 border-r" : "right-0 border-l"} border-[var(--fo-border)]`}>
          <div className="h-1.5 w-3/5 rounded bg-[var(--fo-muted)]" />
          {[0, 1, 2].map((i) => (
            <div key={i} className={`mt-1 h-1 w-4/5 rounded ${barra}`} />
          ))}
        </div>
      ) : null}
      {layout === "fullscreen" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[var(--fo-bg-elevated)]">
          {[10, 8, 10].map((w, i) => (
            <div key={i} className={`h-1.5 rounded ${barra}`} style={{ width: w * 3 }} />
          ))}
        </div>
      ) : null}
      {layout === "modal" ? (
        <>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute inset-x-1/4 inset-y-1.5 flex flex-col items-center justify-center gap-1 rounded border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`h-1 w-1/2 rounded ${barra}`} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
