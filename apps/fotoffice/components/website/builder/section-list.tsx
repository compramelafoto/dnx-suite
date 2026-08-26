"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { WEBSITE_BLOCK_DEFINITIONS, getBlockPreviewLabel, type WebsiteBlock } from "@/lib/website/blocks";

/**
 * Panel "Secciones" — la lista vertical de bloques de la Home. Clickear una tarjeta la
 * selecciona (el inspector lateral cambia a sus campos); los íconos de la fila son acciones
 * puntuales que NO requieren entrar en modo edición. El ☰ es el handle de drag & drop real
 * (@dnd-kit, con soporte de teclado — Tab hasta el handle, Espacio para tomarlo, flechas para
 * mover, Espacio para soltar). ↑/↓ quedan como fallback explícito, no como decoración.
 */
export function SectionList({
  blocks,
  selectedId,
  canEdit,
  onSelect,
  onToggleVisible,
  onDuplicate,
  onDelete,
  onMove,
  onReorder,
  onAddClick,
}: {
  blocks: WebsiteBlock[];
  selectedId: string | null;
  canEdit: boolean;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onReorder: (orderedIds: string[]) => void;
  onAddClick: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(blocks, oldIndex, newIndex).map((b) => b.id));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3 border-b border-[var(--fo-border)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted)]">Página de inicio</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {blocks.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[var(--fo-muted)]">Todavía no hay secciones.</p>
        ) : (
          <DndContext id="website-sections" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map((block, i) => (
                <SectionRow
                  key={block.id}
                  block={block}
                  selected={block.id === selectedId}
                  canEdit={canEdit}
                  isFirst={i === 0}
                  isLast={i === blocks.length - 1}
                  onSelect={() => onSelect(block.id)}
                  onToggleVisible={() => onToggleVisible(block.id)}
                  onDuplicate={() => onDuplicate(block.id)}
                  onDelete={() => onDelete(block.id)}
                  onMoveUp={() => onMove(block.id, "up")}
                  onMoveDown={() => onMove(block.id, "down")}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
      {canEdit ? (
        <div className="p-2 border-t border-[var(--fo-border)]">
          <button type="button" className="fo-btn fo-btn-secondary w-full justify-center gap-2 text-sm" onClick={onAddClick}>
            <Plus className="h-4 w-4" /> Agregar sección
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SectionRow({
  block,
  selected,
  canEdit,
  isFirst,
  isLast,
  onSelect,
  onToggleVisible,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  block: WebsiteBlock;
  selected: boolean;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const def = WEBSITE_BLOCK_DEFINITIONS[block.type];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: !canEdit });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "group rounded-lg border px-2 py-2 cursor-pointer transition-colors",
        selected ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]" : "border-transparent hover:border-[var(--fo-border)]",
        !block.visible ? "opacity-60" : "",
      ].join(" ")}
      onClick={onSelect}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Reordenar sección (arrastrar o usar flechas de teclado)"
          className={["shrink-0 rounded p-0.5 text-[var(--fo-muted-soft)]", canEdit ? "cursor-grab active:cursor-grabbing hover:text-[var(--fo-text)]" : "cursor-default"].join(" ")}
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-accent)]">{def.label}</p>
          <p className="truncate text-sm text-[var(--fo-text)]">
            {getBlockPreviewLabel(block)}
            {block.type === "HERO" && block.config.slides.length > 1 ? (
              <span className="text-[var(--fo-muted)]"> · {block.config.slides.length} placas</span>
            ) : null}
          </p>
        </div>
        {!block.visible ? <EyeOff className="h-3.5 w-3.5 shrink-0 text-[var(--fo-muted)]" aria-label="Sección oculta" /> : null}
      </div>

      {canEdit ? (
        confirmingDelete ? (
          <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-[var(--fo-border)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs text-[var(--fo-danger)]">¿Eliminar?</p>
            <div className="flex gap-2">
              <button type="button" className="text-xs text-[var(--fo-muted)]" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </button>
              <button type="button" className="text-xs font-medium text-[var(--fo-danger)]" onClick={onDelete}>
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <div
            className="mt-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <RowIconButton label={block.visible ? "Ocultar sección" : "Mostrar sección"} onClick={onToggleVisible}>
              {block.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </RowIconButton>
            <RowIconButton label="Duplicar sección" onClick={onDuplicate}>
              <Copy className="h-3.5 w-3.5" />
            </RowIconButton>
            <RowIconButton label="Mover sección arriba" onClick={onMoveUp} disabled={isFirst}>
              <ChevronUp className="h-3.5 w-3.5" />
            </RowIconButton>
            <RowIconButton label="Mover sección abajo" onClick={onMoveDown} disabled={isLast}>
              <ChevronDown className="h-3.5 w-3.5" />
            </RowIconButton>
            <RowIconButton label="Eliminar sección" onClick={() => setConfirmingDelete(true)} danger>
              <Trash2 className="h-3.5 w-3.5" />
            </RowIconButton>
          </div>
        )
      ) : null}
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
