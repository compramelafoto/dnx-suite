"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Copy, ImageOff, Pencil, Plus, Trash2 } from "lucide-react";
import { ImageUploadField } from "@/components/image-upload-field";
import { SelectField, TextAreaField, TextField, ToggleField } from "@/components/website/inspector/inspector-fields";
import {
  addHeroSlide,
  duplicateHeroSlide,
  moveHeroSlide,
  removeHeroSlide,
  updateHeroSlide,
  HERO_INTERVAL_MS_OPTIONS,
  HERO_MAX_SLIDES,
  HERO_MIN_SLIDES,
  type HeroBlockConfig,
  type HeroSlide,
} from "@/lib/website/blocks";
import { useSetHeroEditingSlide } from "@/lib/website/hero-editing-context";

/**
 * Inspector del Hero / Banner — dos niveles (pedido "Parte 4-5"): lista de placas, o edición de
 * una sola. `useSetHeroEditingSlide` avisa a `HeroBlockView` (vía contexto, ver
 * `hero-editing-context.tsx`) qué placa mostrar en la preview central mientras está abierta acá
 * — así nunca se edita una placa mientras la preview muestra otra.
 */
export function HeroSlideEditor({
  config,
  onChange,
  blockId,
}: {
  config: HeroBlockConfig;
  onChange: (config: HeroBlockConfig) => void;
  blockId?: string;
}) {
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const setGlobalEditingSlide = useSetHeroEditingSlide();

  // Cubre toda forma de "dejar de editar esta placa" que no pasa por `closeSlide` (cerrar el
  // panel entero con la X, seleccionar otro bloque, cambiar de pestaña del builder) — sin esto,
  // el contexto quedaría apuntando a una placa que ya no se está editando y la preview no
  // volvería a su autoplay normal.
  useEffect(() => () => setGlobalEditingSlide(null), [setGlobalEditingSlide]);

  const editingSlide = config.slides.find((s) => s.id === editingSlideId) ?? null;

  function openSlide(id: string) {
    setEditingSlideId(id);
    if (blockId) setGlobalEditingSlide({ blockId, slideId: id });
  }
  function closeSlide() {
    setEditingSlideId(null);
    setGlobalEditingSlide(null);
  }

  if (editingSlide) {
    const index = config.slides.findIndex((s) => s.id === editingSlide.id);
    return (
      <div className="space-y-4">
        <button type="button" className="text-sm font-medium text-[var(--fo-accent)]" onClick={closeSlide}>
          ← Volver a placas
        </button>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">
          Placa {index + 1} de {config.slides.length}
        </p>

        <ImageUploadField
          name="_hero_slide_image"
          presetKey="websiteHeroImage"
          label="Imagen"
          initialUrl={editingSlide.imageUrl ?? null}
          onUploaded={(url) => onChange(updateHeroSlide(config, editingSlide.id, { imageUrl: url ?? undefined }))}
        />
        <TextField
          label="Texto alternativo de la imagen"
          value={editingSlide.imageAlt ?? ""}
          onChange={(v) => onChange(updateHeroSlide(config, editingSlide.id, { imageAlt: v }))}
          helper="Para lectores de pantalla y buscadores."
        />
        <SelectField
          label="Foco de la imagen"
          value={editingSlide.imageFocus}
          onChange={(v) => onChange(updateHeroSlide(config, editingSlide.id, { imageFocus: v as HeroSlide["imageFocus"] }))}
          options={[
            { value: "center", label: "Centro" },
            { value: "top", label: "Arriba" },
            { value: "bottom", label: "Abajo" },
            { value: "left", label: "Izquierda" },
            { value: "right", label: "Derecha" },
          ]}
        />

        <TextField label="Título" value={editingSlide.title ?? ""} onChange={(v) => onChange(updateHeroSlide(config, editingSlide.id, { title: v }))} />
        <TextAreaField label="Subtítulo" value={editingSlide.subtitle ?? ""} onChange={(v) => onChange(updateHeroSlide(config, editingSlide.id, { subtitle: v }))} rows={2} />

        <ToggleField label="Mostrar botón" checked={editingSlide.showButton} onChange={(v) => onChange(updateHeroSlide(config, editingSlide.id, { showButton: v }))} />
        {editingSlide.showButton ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Texto del botón" value={editingSlide.buttonLabel ?? ""} onChange={(v) => onChange(updateHeroSlide(config, editingSlide.id, { buttonLabel: v }))} />
              <TextField label="Enlace del botón" value={editingSlide.buttonUrl ?? ""} onChange={(v) => onChange(updateHeroSlide(config, editingSlide.id, { buttonUrl: v }))} />
            </div>
            <SelectField
              label="Estilo del botón"
              value={editingSlide.buttonStyle}
              onChange={(v) => onChange(updateHeroSlide(config, editingSlide.id, { buttonStyle: v as HeroSlide["buttonStyle"] }))}
              options={[
                { value: "solid", label: "Sólido" },
                { value: "outline", label: "Contorno" },
              ]}
            />
          </>
        ) : null}

        <SelectField
          label="Alineación del texto"
          value={editingSlide.align}
          onChange={(v) => onChange(updateHeroSlide(config, editingSlide.id, { align: v as HeroSlide["align"] }))}
          options={[
            { value: "left", label: "Izquierda" },
            { value: "center", label: "Centro" },
            { value: "right", label: "Derecha" },
          ]}
        />
        <SelectField
          label="Posición vertical del contenido"
          value={editingSlide.contentPosition}
          onChange={(v) => onChange(updateHeroSlide(config, editingSlide.id, { contentPosition: v as HeroSlide["contentPosition"] }))}
          options={[
            { value: "top", label: "Arriba" },
            { value: "center", label: "Centro" },
            { value: "bottom", label: "Abajo" },
          ]}
        />
        <SelectField
          label="Oscurecer imagen (legibilidad del texto)"
          value={editingSlide.overlay}
          onChange={(v) => onChange(updateHeroSlide(config, editingSlide.id, { overlay: v as HeroSlide["overlay"] }))}
          options={[
            { value: "none", label: "Ninguno" },
            { value: "soft", label: "Suave" },
            { value: "medium", label: "Medio" },
            { value: "dark", label: "Oscuro" },
          ]}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="fo-label mb-2">
          Placas ({config.slides.length}/{HERO_MAX_SLIDES})
        </p>
        <div className="space-y-2">
          {config.slides.map((slide, index) => (
            <HeroSlideRow
              key={slide.id}
              slide={slide}
              index={index}
              isFirst={index === 0}
              isLast={index === config.slides.length - 1}
              canDelete={config.slides.length > HERO_MIN_SLIDES}
              confirmingDelete={confirmingDeleteId === slide.id}
              onEdit={() => openSlide(slide.id)}
              onDuplicate={() => onChange(duplicateHeroSlide(config, slide.id))}
              onMoveUp={() => onChange(moveHeroSlide(config, slide.id, "up"))}
              onMoveDown={() => onChange(moveHeroSlide(config, slide.id, "down"))}
              onAskDelete={() => setConfirmingDeleteId(slide.id)}
              onCancelDelete={() => setConfirmingDeleteId(null)}
              onConfirmDelete={() => {
                onChange(removeHeroSlide(config, slide.id));
                setConfirmingDeleteId(null);
              }}
            />
          ))}
        </div>
        {config.slides.length < HERO_MAX_SLIDES ? (
          <button
            type="button"
            className="fo-btn fo-btn-secondary mt-2 w-full justify-center gap-2 text-sm"
            onClick={() => onChange(addHeroSlide(config))}
          >
            <Plus className="h-4 w-4" /> Agregar placa
          </button>
        ) : (
          <p className="fo-helper mt-2">Podés agregar hasta {HERO_MAX_SLIDES} placas.</p>
        )}
      </div>

      {config.slides.length > 1 ? (
        <div className="space-y-4 border-t border-[var(--fo-border)] pt-4">
          <p className="fo-label">Comportamiento del carrusel</p>
          <ToggleField label="Cambio automático" checked={config.autoplay} onChange={(v) => onChange({ ...config, autoplay: v })} />
          {config.autoplay ? (
            <SelectField
              label="Duración por placa"
              value={String(config.intervalMs)}
              onChange={(v) => onChange({ ...config, intervalMs: Number(v) as HeroBlockConfig["intervalMs"] })}
              options={HERO_INTERVAL_MS_OPTIONS.map((ms) => ({ value: String(ms), label: `${ms / 1000} segundos` }))}
            />
          ) : null}
          <SelectField
            label="Transición"
            value={config.transition}
            onChange={(v) => onChange({ ...config, transition: v as HeroBlockConfig["transition"] })}
            options={[
              { value: "fade", label: "Fundido" },
              { value: "slide", label: "Deslizamiento" },
            ]}
          />
          <ToggleField label="Repetir continuamente" checked={config.loop} onChange={(v) => onChange({ ...config, loop: v })} />
          <ToggleField label="Pausar al pasar el mouse (desktop)" checked={config.pauseOnHover} onChange={(v) => onChange({ ...config, pauseOnHover: v })} />
          <ToggleField label="Mostrar flechas" checked={config.showArrows} onChange={(v) => onChange({ ...config, showArrows: v })} />
          <ToggleField label="Mostrar indicadores" checked={config.showIndicators} onChange={(v) => onChange({ ...config, showIndicators: v })} />
        </div>
      ) : null}

      <div className="space-y-4 border-t border-[var(--fo-border)] pt-4">
        <SelectField
          label="Altura del banner"
          value={config.heightPreset}
          onChange={(v) => onChange({ ...config, heightPreset: v as HeroBlockConfig["heightPreset"] })}
          options={[
            { value: "compact", label: "Compacto" },
            { value: "normal", label: "Normal" },
            { value: "large", label: "Grande" },
            { value: "screen", label: "Pantalla completa" },
          ]}
        />
      </div>
    </div>
  );
}

function HeroSlideRow({
  slide,
  index,
  isFirst,
  isLast,
  canDelete,
  confirmingDelete,
  onEdit,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  slide: HeroSlide;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  confirmingDelete: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--fo-border)] p-2">
      <button type="button" className="flex w-full items-center gap-3 text-left" onClick={onEdit}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--fo-border)] bg-[var(--fo-bg)]">
          {slide.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-4 w-4 text-[var(--fo-muted-soft)]" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-accent)]">Placa {index + 1}</p>
          <p className="truncate text-sm text-[var(--fo-text)]">{slide.title || "Sin título todavía"}</p>
        </div>
      </button>

      {confirmingDelete ? (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--fo-border)] pt-2">
          <p className="text-xs text-[var(--fo-danger)]">¿Eliminar esta placa?</p>
          <div className="flex gap-2">
            <button type="button" className="text-xs text-[var(--fo-muted)]" onClick={onCancelDelete}>
              Cancelar
            </button>
            <button type="button" className="text-xs font-medium text-[var(--fo-danger)]" onClick={onConfirmDelete}>
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center gap-0.5">
          <RowIconButton label="Editar placa" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </RowIconButton>
          <RowIconButton label="Duplicar placa" onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" />
          </RowIconButton>
          <RowIconButton label="Mover placa arriba" onClick={onMoveUp} disabled={isFirst}>
            <ChevronUp className="h-3.5 w-3.5" />
          </RowIconButton>
          <RowIconButton label="Mover placa abajo" onClick={onMoveDown} disabled={isLast}>
            <ChevronDown className="h-3.5 w-3.5" />
          </RowIconButton>
          {canDelete ? (
            <RowIconButton label="Eliminar placa" onClick={onAskDelete} danger>
              <Trash2 className="h-3.5 w-3.5" />
            </RowIconButton>
          ) : null}
        </div>
      )}
    </div>
  );
}

function RowIconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded p-1 disabled:opacity-30",
        danger ? "text-[var(--fo-danger)] hover:bg-[var(--fo-danger-soft)]" : "text-[var(--fo-muted)] hover:bg-[var(--fo-border-muted)] hover:text-[var(--fo-text)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
