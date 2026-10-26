"use client";

import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { HOME_PAGE_KEY, slugifyPageTitle, validatePageSlug } from "@/lib/website/pages";

export type SwitcherPage = { key: string; title: string; slug: string };

type Formulario = { tipo: "nueva" } | { tipo: "renombrar" } | { tipo: "direccion" } | null;

/**
 * Selector de página arriba de la lista de secciones: la Portada, cada página propia y «Nueva
 * página». La Portada no tiene menú «⋯»: no se renombra, no cambia de dirección y no se borra.
 *
 * Las direcciones se validan en vivo con `validatePageSlug` — la misma regla que aplica el
 * servidor al guardar —, así el error aparece antes de intentar guardar.
 */
export function PageSwitcher({
  pages,
  activeKey,
  canEdit,
  limitReached,
  onSelect,
  onCreate,
  onRename,
  onChangeSlug,
  onDelete,
}: {
  pages: SwitcherPage[];
  activeKey: string;
  canEdit: boolean;
  limitReached: boolean;
  onSelect: (key: string) => void;
  onCreate: (title: string, slug: string) => void;
  onRename: (key: string, title: string) => void;
  onChangeSlug: (key: string, slug: string) => void;
  onDelete: (key: string) => void;
}) {
  const [form, setForm] = useState<Formulario>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const activa = pages.find((p) => p.key === activeKey) ?? null;
  const esPortada = activeKey === HOME_PAGE_KEY;

  return (
    <div className="space-y-2 border-b border-[var(--fo-border)] p-3">
      <div className="flex items-center gap-1.5">
        <select
          aria-label="Página que estás editando"
          className="fo-input min-w-0 flex-1 text-sm"
          value={activeKey}
          onChange={(e) => {
            setForm(null);
            setMenuAbierto(false);
            onSelect(e.target.value);
          }}
        >
          <option value={HOME_PAGE_KEY}>Portada</option>
          {pages.map((p) => (
            <option key={p.key} value={p.key}>
              {p.title}
            </option>
          ))}
        </select>
        {canEdit && !esPortada ? (
          <div className="relative">
            <button
              type="button"
              aria-label="Opciones de la página"
              aria-expanded={menuAbierto}
              className="rounded p-1.5 text-[var(--fo-muted)] hover:bg-[var(--fo-border-muted)] hover:text-[var(--fo-text)]"
              onClick={() => setMenuAbierto((v) => !v)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuAbierto ? (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] py-1 shadow-md" role="menu">
                <MenuItem
                  onClick={() => {
                    setForm({ tipo: "renombrar" });
                    setMenuAbierto(false);
                  }}
                >
                  Renombrar
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    setForm({ tipo: "direccion" });
                    setMenuAbierto(false);
                  }}
                >
                  Cambiar dirección
                </MenuItem>
                <MenuItem
                  danger
                  onClick={() => {
                    setMenuAbierto(false);
                    if (window.confirm(`¿Borrar la página «${activa?.title ?? ""}»? Se pierden sus secciones y su dirección deja de funcionar.`)) {
                      onDelete(activeKey);
                    }
                  }}
                >
                  Borrar
                </MenuItem>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {activa ? <p className="truncate text-xs text-[var(--fo-muted)]">Dirección: /{activa.slug}</p> : <p className="text-xs text-[var(--fo-muted)]">La portada es la página de inicio.</p>}

      {canEdit && form === null ? (
        <button
          type="button"
          disabled={limitReached}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--fo-border)] px-3 py-1.5 text-xs font-medium text-[var(--fo-text)] hover:border-[var(--fo-accent)] disabled:opacity-50"
          onClick={() => setForm({ tipo: "nueva" })}
        >
          <Plus className="h-3.5 w-3.5" /> Nueva página
        </button>
      ) : null}
      {limitReached ? <p className="text-xs text-[var(--fo-muted)]">Llegaste al máximo de páginas propias.</p> : null}

      {form?.tipo === "nueva" ? (
        <PageForm
          key="nueva"
          mostrarTitulo
          mostrarDireccion
          initial={{ title: "", slug: "" }}
          otrosSlugs={pages.map((p) => p.slug)}
          submitLabel="Crear página"
          onCancel={() => setForm(null)}
          onSubmit={(v) => {
            onCreate(v.title, v.slug);
            setForm(null);
          }}
        />
      ) : null}
      {form?.tipo === "renombrar" && activa ? (
        <PageForm
          key="renombrar"
          mostrarTitulo
          mostrarDireccion={false}
          initial={{ title: activa.title, slug: activa.slug }}
          otrosSlugs={[]}
          submitLabel="Guardar"
          onCancel={() => setForm(null)}
          onSubmit={(v) => {
            onRename(activa.key, v.title);
            setForm(null);
          }}
        />
      ) : null}
      {form?.tipo === "direccion" && activa ? (
        <PageForm
          key="direccion"
          mostrarTitulo={false}
          mostrarDireccion
          initial={{ title: activa.title, slug: activa.slug }}
          otrosSlugs={pages.filter((p) => p.key !== activa.key).map((p) => p.slug)}
          submitLabel="Guardar"
          onCancel={() => setForm(null)}
          onSubmit={(v) => {
            onChangeSlug(activa.key, v.slug);
            setForm(null);
          }}
        />
      ) : null}
    </div>
  );
}

function MenuItem({ children, danger, onClick }: { children: React.ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={["block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--fo-border-muted)]", danger ? "text-[var(--fo-danger)]" : "text-[var(--fo-text)]"].join(" ")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function PageForm({
  initial,
  mostrarTitulo,
  mostrarDireccion,
  otrosSlugs,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: { title: string; slug: string };
  mostrarTitulo: boolean;
  mostrarDireccion: boolean;
  otrosSlugs: string[];
  submitLabel: string;
  onSubmit: (v: { title: string; slug: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  // Mientras no toque la dirección a mano, sigue al título (al crear una página nueva).
  const [slugEditado, setSlugEditado] = useState(initial.slug !== "");

  const tituloOk = !mostrarTitulo || title.trim().length > 0;
  const errorDireccion = mostrarDireccion && slug !== "" ? validatePageSlug(slug, otrosSlugs) : null;
  const direccionOk = !mostrarDireccion || (slug !== "" && errorDireccion === null);
  const puedeEnviar = tituloOk && direccionOk;

  return (
    <div className="space-y-2 rounded-lg border border-[var(--fo-border)] p-3">
      {mostrarTitulo ? (
        <label className="block space-y-1">
          <span className="fo-label text-xs">Título de la página</span>
          <input
            className="fo-input text-sm"
            value={title}
            maxLength={120}
            placeholder="Quién soy"
            autoFocus
            onChange={(e) => {
              setTitle(e.target.value);
              if (mostrarDireccion && !slugEditado) setSlug(slugifyPageTitle(e.target.value));
            }}
          />
        </label>
      ) : null}
      {mostrarDireccion ? (
        <label className="block space-y-1">
          <span className="fo-label text-xs">Dirección</span>
          <input
            className="fo-input text-sm"
            value={slug}
            maxLength={60}
            placeholder="quien-soy"
            autoFocus={!mostrarTitulo}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugEditado(true);
            }}
          />
          {errorDireccion ? <span className="block text-xs text-[var(--fo-danger)]">{errorDireccion}</span> : null}
        </label>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className="text-xs text-[var(--fo-muted)]" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={!puedeEnviar}
          className="fo-btn fo-btn-primary text-xs disabled:opacity-50"
          onClick={() => onSubmit({ title: title.trim(), slug })}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
