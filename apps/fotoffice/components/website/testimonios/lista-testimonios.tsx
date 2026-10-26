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
import { Check, EyeOff, GripVertical, Pencil, RotateCcw, Star, Trash2, X } from "lucide-react";
import {
  borrarTestimonioAction,
  destacarTestimonioAction,
  editarTestimonioAction,
  moderarTestimonioAction,
  reordenarTestimoniosAction,
} from "@/app/actions/testimonios";
import {
  ETIQUETA_ORIGEN_TESTIMONIO,
  LARGO_LEER_MAS,
  MAX_DETALLE,
  MAX_EXTRACTO,
  MENSAJES_TESTIMONIO,
  type EstadoTestimonio,
  type OrigenTestimonio,
} from "@/lib/testimonios/dominio";

export type TestimonioDeLista = {
  id: string;
  texto: string;
  extracto: string | null;
  autorNombre: string;
  autorDetalle: string | null;
  autorFotoUrl: string | null;
  autorEnlace: string | null;
  autorEmail: string | null;
  calificacion: number | null;
  estado: EstadoTestimonio;
  consentimiento: boolean;
  consentimientoTexto: string | null;
  origen: string;
  destacado: boolean;
  /** ISO. */
  creado: string;
};

type Resultado = { ok: boolean; error?: string };

/**
 * Las tarjetas de una pestaña (Pendientes, Publicados o Rechazados) con sus acciones. En Publicados
 * se ordenan arrastrando desde ☰: ese orden es el del sitio (los destacados salen primero). Cada
 * acción vuelve a pasar por el servidor, que exige el permiso del autor para publicar.
 */
export function ListaTestimonios({ estado, testimonios }: { estado: EstadoTestimonio; testimonios: TestimonioDeLista[] }) {
  const [orden, setOrden] = useState(testimonios);
  const [previos, setPrevios] = useState(testimonios);
  if (previos !== testimonios) {
    setPrevios(testimonios);
    setOrden(testimonios);
  }
  const [error, setError] = useState<string | null>(null);
  const ordenable = estado === "PUBLICADO" && orden.length > 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function alSoltar(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const desde = orden.findIndex((t) => t.id === active.id);
    const hasta = orden.findIndex((t) => t.id === over.id);
    if (desde < 0 || hasta < 0) return;
    const anterior = orden;
    const nuevo = arrayMove(orden, desde, hasta);
    setOrden(nuevo);
    setError(null);
    try {
      const r = await reordenarTestimoniosAction(nuevo.map((t) => t.id));
      if (!r.ok) {
        setOrden(anterior);
        setError(r.error);
      }
    } catch {
      setOrden(anterior);
      setError("No pudimos conectar con el servidor. Probá de nuevo.");
    }
  }

  const tarjetas = orden.map((t) => <TarjetaTestimonio key={t.id} t={t} ordenable={ordenable} onError={setError} />);

  return (
    <div className="space-y-3">
      {ordenable ? (
        <p className="text-xs text-[var(--fo-muted)]">
          Arrastrá desde ☰ para cambiar el orden en el sitio. Los destacados salen siempre primero.
        </p>
      ) : null}
      {error ? (
        <p className="fo-alert-error text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={ordenable ? alSoltar : undefined}>
        <SortableContext items={orden.map((t) => t.id)} strategy={verticalListSortingStrategy} disabled={!ordenable}>
          <ul className="space-y-3">{tarjetas}</ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function iniciales(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

const FECHA = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", year: "numeric" });

function TarjetaTestimonio({ t, ordenable, onError }: { t: TestimonioDeLista; ordenable: boolean; onError: (m: string | null) => void }) {
  // Sólo en Publicados se arrastra; en las otras pestañas la tarjeta queda quieta.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id, disabled: !ordenable });
  const [pendiente, empezar] = useTransition();
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false);
  const [completo, setCompleto] = useState(false);
  const largo = t.texto.length > LARGO_LEER_MAS;

  function correr(fn: () => Promise<Resultado>, alTerminar?: () => void) {
    onError(null);
    empezar(async () => {
      try {
        const r = await fn();
        if (!r.ok) {
          onError(r.error ?? "No pudimos guardar.");
          return;
        }
        alTerminar?.();
        router.refresh();
      } catch {
        onError("No pudimos conectar con el servidor. Probá de nuevo.");
      }
    });
  }

  const moderar = (estado: EstadoTestimonio) => correr(() => moderarTestimonioAction(t.id, estado));
  const origen = ETIQUETA_ORIGEN_TESTIMONIO[t.origen as OrigenTestimonio] ?? t.origen;

  return (
    <li
      ref={ordenable ? setNodeRef : undefined}
      style={ordenable ? { transform: CSS.Transform.toString(transform), transition } : undefined}
      className={`fo-card space-y-3 ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        {ordenable ? (
          <button
            type="button"
            className="fo-btn fo-btn-ghost cursor-grab p-1"
            aria-label={`Mover el testimonio de ${t.autorNombre}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} aria-hidden />
          </button>
        ) : null}
        {t.autorFotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto chica de R2, sin redimensionador
          <img src={t.autorFotoUrl} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--fo-border-muted)] text-sm font-semibold text-[var(--fo-muted)]"
            aria-hidden
          >
            {iniciales(t.autorNombre)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--fo-text)]">
            {t.autorNombre}
            {t.destacado ? (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--fo-accent)]">
                <Star size={12} aria-hidden className="fill-current" /> Destacado
              </span>
            ) : null}
          </p>
          <p className="text-xs text-[var(--fo-muted)]">
            {[t.autorDetalle, origen, FECHA.format(new Date(t.creado))].filter(Boolean).join(" · ")}
          </p>
          {t.autorEmail || t.autorEnlace ? (
            <p className="break-all text-xs text-[var(--fo-muted)]">
              {t.autorEmail ? <span>{t.autorEmail}</span> : null}
              {t.autorEmail && t.autorEnlace ? " · " : null}
              {t.autorEnlace ? (
                <a href={t.autorEnlace} target="_blank" rel="noopener noreferrer nofollow" className="hover:underline">
                  {t.autorEnlace}
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
        {t.calificacion ? (
          <span className="shrink-0 text-sm text-[var(--fo-accent)]" aria-label={`${t.calificacion} de 5 estrellas`}>
            {"★".repeat(t.calificacion)}
            <span className="text-[var(--fo-border)]">{"★".repeat(5 - t.calificacion)}</span>
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--fo-text)]">
          {largo && !completo ? `${t.texto.slice(0, LARGO_LEER_MAS).trimEnd()}…` : t.texto}
        </p>
        {largo ? (
          <button type="button" className="text-xs font-medium text-[var(--fo-accent)] hover:underline" onClick={() => setCompleto(!completo)}>
            {completo ? "Ver menos" : "Leer todo"}
          </button>
        ) : null}
        {t.extracto ? (
          <p className="border-l-2 border-[var(--fo-accent)] pl-3 text-sm italic text-[var(--fo-muted)]">«{t.extracto}»</p>
        ) : null}
        <p className={`text-xs ${t.consentimiento ? "text-[var(--fo-success)]" : "text-[var(--fo-warning)]"}`}>
          {t.consentimiento ? (t.consentimientoTexto ?? "Con permiso del autor para publicarlo.") : `${MENSAJES_TESTIMONIO.sinPermiso} No se puede publicar.`}
        </p>
      </div>

      {editando ? (
        <EditarTestimonio
          t={t}
          pendiente={pendiente}
          onCancelar={() => setEditando(false)}
          onGuardar={(datos) => correr(() => editarTestimonioAction(t.id, datos), () => setEditando(false))}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {t.estado !== "PUBLICADO" ? (
            <button
              type="button"
              className="fo-btn fo-btn-primary text-sm"
              disabled={pendiente || !t.consentimiento}
              title={t.consentimiento ? undefined : MENSAJES_TESTIMONIO.sinPermiso}
              onClick={() => moderar("PUBLICADO")}
            >
              <Check size={16} aria-hidden /> Publicar
            </button>
          ) : (
            <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => moderar("PENDIENTE")}>
              <EyeOff size={16} aria-hidden /> Sacar del sitio
            </button>
          )}
          {t.estado === "PENDIENTE" ? (
            <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => moderar("RECHAZADO")}>
              <X size={16} aria-hidden /> Rechazar
            </button>
          ) : null}
          {t.estado === "RECHAZADO" ? (
            <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => moderar("PENDIENTE")}>
              <RotateCcw size={16} aria-hidden /> Volver a pendientes
            </button>
          ) : null}
          {t.estado !== "RECHAZADO" ? (
            <button
              type="button"
              className="fo-btn fo-btn-ghost text-sm"
              disabled={pendiente}
              aria-pressed={t.destacado}
              onClick={() => correr(() => destacarTestimonioAction(t.id, !t.destacado))}
            >
              <Star size={16} aria-hidden className={t.destacado ? "fill-current" : undefined} />
              {t.destacado ? "Quitar destacado" : "Destacar"}
            </button>
          ) : null}
          <button type="button" className="fo-btn fo-btn-ghost text-sm" disabled={pendiente} onClick={() => setEditando(true)}>
            <Pencil size={16} aria-hidden /> Editar
          </button>
          {confirmandoBorrar ? (
            <span className="fo-alert-warning flex flex-wrap items-center gap-2 text-xs">
              ¿Borrarlo para siempre?
              <button type="button" className="fo-btn fo-btn-danger text-xs" disabled={pendiente} onClick={() => correr(() => borrarTestimonioAction(t.id))}>
                Sí, borrar
              </button>
              <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={() => setConfirmandoBorrar(false)}>
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="fo-btn fo-btn-ghost p-1"
              aria-label={`Borrar el testimonio de ${t.autorNombre}`}
              onClick={() => setConfirmandoBorrar(true)}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function EditarTestimonio({
  t,
  pendiente,
  onCancelar,
  onGuardar,
}: {
  t: TestimonioDeLista;
  pendiente: boolean;
  onCancelar: () => void;
  onGuardar: (datos: { extracto: string; autorDetalle: string; permisoDelAutor: boolean }) => void;
}) {
  const [extracto, setExtracto] = useState(t.extracto ?? "");
  const [detalle, setDetalle] = useState(t.autorDetalle ?? "");
  const [permiso, setPermiso] = useState(false);

  return (
    <form
      className="space-y-3 rounded-[var(--fo-radius)] border border-[var(--fo-border)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar({ extracto, autorDetalle: detalle, permisoDelAutor: permiso });
      }}
    >
      <label className="block">
        <span className="fo-label">Frase destacada (opcional)</span>
        <textarea value={extracto} onChange={(e) => setExtracto(e.target.value)} maxLength={MAX_EXTRACTO} rows={2} className="fo-input" />
        <span className="text-xs text-[var(--fo-muted)]">
          La parte que más te gusta, para mostrarla resaltada. {extracto.length} / {MAX_EXTRACTO}
        </span>
      </label>
      <label className="block">
        <span className="fo-label">Detalle del autor (opcional)</span>
        <input
          value={detalle}
          onChange={(e) => setDetalle(e.target.value)}
          maxLength={MAX_DETALLE}
          placeholder="Fiesta de XV de Cami"
          className="fo-input"
        />
      </label>
      {!t.consentimiento ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={permiso} onChange={(e) => setPermiso(e.target.checked)} className="mt-1" />
          <span>
            Tengo permiso del autor para publicarlo. <span className="text-[var(--fo-muted)]">Queda asentado con tu nombre.</span>
          </span>
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
          Guardar
        </button>
        <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={onCancelar} disabled={pendiente}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
