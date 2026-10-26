"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import {
  borrarCategoriaAction,
  crearCategoriaAction,
  editarCategoriaAction,
  reordenarCategoriasAction,
} from "@/app/actions/trabajos";

type Categoria = { id: string; nombre: string; slug: string; visible: boolean; trabajos: number };

/**
 * Crear, renombrar, ordenar (arrastrando desde ☰) y ocultar categorías. El orden y la
 * visibilidad se guardan solos; nombre y dirección, con «Guardar» en cada fila.
 */
export function CategoriasTrabajos({ categorias }: { categorias: Categoria[] }) {
  const [orden, setOrden] = useState(categorias);
  const [previas, setPrevias] = useState(categorias);
  if (previas !== categorias) {
    setPrevias(categorias);
    setOrden(categorias);
  }
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    empezar(async () => {
      const r = await crearCategoriaAction(nombre);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setNombre("");
      router.refresh();
    });
  }

  async function alSoltar(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const desde = orden.findIndex((c) => c.id === active.id);
    const hasta = orden.findIndex((c) => c.id === over.id);
    if (desde < 0 || hasta < 0) return;
    const anterior = orden;
    const nuevo = arrayMove(orden, desde, hasta);
    setOrden(nuevo);
    setError(null);
    const r = await reordenarCategoriasAction(nuevo.map((c) => c.id));
    if (!r.ok) {
      setOrden(anterior);
      setError(r.error);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={crear} className="fo-card flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="fo-label">Nueva categoría</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Casamientos"
            maxLength={80}
            className="fo-input"
          />
        </label>
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pendiente || !nombre.trim()}>
          <Plus size={16} aria-hidden /> Crear
        </button>
      </form>

      {error ? <p className="fo-alert-error text-sm">{error}</p> : null}

      {orden.length === 0 ? (
        <div className="fo-card py-10 text-center text-sm text-[var(--fo-muted)]">
          Todavía no hay categorías. Creá la primera: los trabajos sin categoría no se muestran en el sitio.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={alSoltar}>
          <SortableContext items={orden.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {orden.map((c) => (
                <FilaCategoria key={c.id} categoria={c} onError={setError} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function FilaCategoria({ categoria, onError }: { categoria: Categoria; onError: (m: string | null) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: categoria.id });
  const [nombre, setNombre] = useState(categoria.nombre);
  const [slug, setSlug] = useState(categoria.slug);
  const [visible, setVisible] = useState(categoria.visible);
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();
  const cambiada = nombre !== categoria.nombre || slug !== categoria.slug;

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>, alFallar?: () => void) {
    onError(null);
    empezar(async () => {
      const r = await fn();
      if (!r.ok) {
        alFallar?.();
        onError(r.error ?? "No pudimos guardar.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`fo-card flex flex-col gap-3 md:flex-row md:items-end ${isDragging ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        className="fo-btn fo-btn-ghost cursor-grab self-start p-1 md:self-center"
        aria-label={`Mover la categoría ${categoria.nombre}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden />
      </button>
      <label className="block flex-1">
        <span className="fo-label">Nombre</span>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} className="fo-input" />
      </label>
      <label className="block flex-1">
        <span className="fo-label">Dirección</span>
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          maxLength={80}
          className="fo-input font-mono text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs tabular-nums text-[var(--fo-muted)]">
          {categoria.trabajos} {categoria.trabajos === 1 ? "trabajo" : "trabajos"}
        </span>
        {cambiada ? (
          <button
            type="button"
            className="fo-btn fo-btn-primary text-sm"
            disabled={pendiente}
            onClick={() => correr(() => editarCategoriaAction(categoria.id, { nombre, slug }))}
          >
            Guardar
          </button>
        ) : null}
        <button
          type="button"
          className="fo-btn fo-btn-ghost text-sm"
          disabled={pendiente}
          aria-pressed={!visible}
          title={visible ? "Ocultar del sitio" : "Mostrar en el sitio"}
          onClick={() => {
            const siguiente = !visible;
            setVisible(siguiente);
            correr(() => editarCategoriaAction(categoria.id, { visible: siguiente }), () => setVisible(!siguiente));
          }}
        >
          {visible ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
          {visible ? "Visible" : "Oculta"}
        </button>
        {confirmando ? (
          <span className="fo-alert-warning flex flex-wrap items-center gap-2 text-xs">
            ¿Borrarla? {categoria.trabajos > 0 ? "Sus trabajos quedan sin categoría y dejan de verse en el sitio." : ""}
            <button
              type="button"
              className="fo-btn fo-btn-danger text-xs"
              disabled={pendiente}
              onClick={() => correr(() => borrarCategoriaAction(categoria.id))}
            >
              Sí, borrar
            </button>
            <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setConfirmando(false)}>
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="fo-btn fo-btn-ghost p-1"
            aria-label={`Borrar la categoría ${categoria.nombre}`}
            onClick={() => setConfirmando(true)}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}
