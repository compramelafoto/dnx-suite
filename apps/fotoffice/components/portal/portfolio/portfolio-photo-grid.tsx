"use client";

import { useState } from "react";
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
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Star, Trash2 } from "lucide-react";
import {
  deletePortfolioPhotoAction,
  reorderPortfolioPhotosAction,
  setPortfolioCoverAction,
  updatePortfolioPhotoAction,
} from "@/app/actions/portfolio";
import type { PortfolioPhotoView } from "@/lib/portfolio/repository";

/**
 * Las fotos del portfolio: ordenar arrastrando, elegir la destacada, poner título y año, borrar.
 *
 * El orden se guarda al soltar, no con un botón "guardar": arrastrar ya es la confirmación. La
 * grilla se reordena en pantalla antes de que el servidor conteste —si el guardado falla se avisa y
 * se vuelve al orden anterior—, porque esperar medio segundo por cada arrastre hace sentir que la
 * pantalla está trabada.
 *
 * El handle ☰ soporta teclado (Tab hasta él, Espacio para tomar, flechas para mover, Espacio para
 * soltar), como la lista de secciones del constructor de sitio.
 */
export function PortfolioPhotoGrid({ photos }: { photos: PortfolioPhotoView[] }) {
  const [orden, setOrden] = useState(photos);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (photos.length === 0) {
    return (
      <section className="fo-card">
        <p className="text-sm text-[var(--fo-muted)]">
          Todavía no subiste ninguna foto. Empezá por la que más te representa: es la que va a ver
          quien entre.
        </p>
      </section>
    );
  }

  async function alSoltar(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const desde = orden.findIndex((f) => f.id === active.id);
    const hasta = orden.findIndex((f) => f.id === over.id);
    if (desde < 0 || hasta < 0) return;

    const anterior = orden;
    const nuevo = arrayMove(orden, desde, hasta);
    setOrden(nuevo);
    setError(null);

    const r = await reorderPortfolioPhotosAction({ orderedIds: nuevo.map((f) => f.id) });
    if (!r.ok) {
      setOrden(anterior);
      setError(r.error ?? "No pudimos guardar el orden.");
      return;
    }
    router.refresh();
  }

  async function destacar(photoId: string) {
    setError(null);
    const r = await setPortfolioCoverAction({ photoId });
    if (!r.ok) {
      setError(r.error ?? "No pudimos cambiar la foto destacada.");
      return;
    }
    setOrden((previas) => previas.map((f) => ({ ...f, isCover: f.id === photoId })));
    router.refresh();
  }

  async function borrar(photoId: string) {
    setError(null);
    const r = await deletePortfolioPhotoAction({ photoId });
    if (!r.ok) {
      setError(r.error ?? "No pudimos borrar la foto.");
      return;
    }
    setOrden((previas) => previas.filter((f) => f.id !== photoId));
    router.refresh();
  }

  return (
    <section className="space-y-3">
      {error ? <p className="fo-alert-error text-sm">{error}</p> : null}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={alSoltar}>
        <SortableContext items={orden.map((f) => f.id)} strategy={rectSortingStrategy}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {orden.map((foto) => (
              <FotoOrdenable
                key={foto.id}
                foto={foto}
                onDestacar={destacar}
                onBorrar={borrar}
                onError={setError}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function FotoOrdenable({
  foto,
  onDestacar,
  onBorrar,
  onError,
}: {
  foto: PortfolioPhotoView;
  onDestacar: (id: string) => Promise<void>;
  onBorrar: (id: string) => Promise<void>;
  onError: (mensaje: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: foto.id,
  });
  const [titulo, setTitulo] = useState(foto.title ?? "");
  const [anio, setAnio] = useState(foto.year === null ? "" : String(foto.year));
  const [alt, setAlt] = useState(foto.altText ?? "");
  const [confirmando, setConfirmando] = useState(false);

  async function guardarDatos() {
    const anioLimpio = anio.trim();
    const r = await updatePortfolioPhotoAction({
      photoId: foto.id,
      title: titulo,
      year: anioLimpio === "" ? null : Number(anioLimpio),
      altText: alt,
    });
    if (!r.ok) onError(r.error ?? "No pudimos guardar los datos de la foto.");
    else onError(null);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`fo-card space-y-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="fo-btn fo-btn-ghost cursor-grab p-1"
          aria-label="Mover esta foto"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => void onDestacar(foto.id)}
            disabled={foto.isCover}
            className="fo-btn fo-btn-ghost p-1"
            aria-label={foto.isCover ? "Ya es tu foto destacada" : "Usar como foto destacada"}
            title={foto.isCover ? "Es tu foto destacada" : "Usar como destacada"}
          >
            <Star
              size={16}
              aria-hidden
              className={foto.isCover ? "fill-current text-[var(--fo-accent)]" : ""}
            />
          </button>
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="fo-btn fo-btn-ghost p-1"
            aria-label="Borrar esta foto"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>

      {/* Alto y ancho reservan el espacio: sin eso la grilla salta mientras cargan las fotos. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.url}
        alt={foto.title ?? "Foto de tu portfolio"}
        width={foto.width}
        height={foto.height}
        loading="lazy"
        className="w-full rounded object-contain"
      />

      {foto.isCover ? (
        <p className="text-xs text-[var(--fo-accent)]">Es tu foto destacada</p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_5rem]">
        <label className="text-xs">
          <span className="text-[var(--fo-muted)]">Título (opcional)</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={() => void guardarDatos()}
            maxLength={120}
            className="mt-1 w-full rounded border border-[var(--fo-border)] bg-transparent px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="text-[var(--fo-muted)]">Año</span>
          <input
            value={anio}
            onChange={(e) => setAnio(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
            onBlur={() => void guardarDatos()}
            inputMode="numeric"
            className="mt-1 w-full rounded border border-[var(--fo-border)] bg-transparent px-2 py-1 text-sm"
          />
        </label>
      </div>

      {/*
        La descripción va DEBAJO de título y año, y ocupa el ancho completo: es la que más se
        escribe de las tres y la que más texto lleva.
      */}
      <label className="block text-xs">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[var(--fo-muted)]">Descripción para Google</span>
          <span className="tabular-nums text-[var(--fo-muted)]">{alt.length}/180</span>
        </span>
        <textarea
          value={alt}
          onChange={(e) => setAlt(e.target.value.slice(0, 180))}
          onBlur={() => void guardarDatos()}
          rows={2}
          placeholder="Novia entrando a la iglesia, Rosario"
          className="mt-1 w-full rounded border border-[var(--fo-border)] bg-transparent px-2 py-1 text-sm"
        />
        <span className="mt-1 block text-[11px] leading-snug text-[var(--fo-muted)]">
          Contá qué se ve en la foto. Es lo que Google lee para encontrarla, y lo que escucha quien
          no puede verla.
        </span>
      </label>

      {confirmando ? (
        <div className="fo-alert-warning space-y-2 text-sm">
          <p>¿Borrar esta foto? No se puede recuperar.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void onBorrar(foto.id)}
              className="fo-btn fo-btn-danger text-sm"
            >
              Sí, borrarla
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="fo-btn fo-btn-ghost text-sm"
            >
              No
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
