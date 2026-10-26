"use client";

import { useRef, useState, useTransition } from "react";
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
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, Film, GripVertical, ImagePlus, Loader2, Star, Trash2, XCircle } from "lucide-react";
import {
  agregarVideoAction,
  borrarFotoAction,
  confirmarSubidaAction,
  editarAltFotoAction,
  elegirPortadaAction,
  reordenarFotosAction,
} from "@/app/actions/trabajos";
import {
  ALT_MAX,
  FORMATOS_FOTO_TRABAJO,
  MAX_BYTES_FOTO_TRABAJO,
  MAX_FOTOS_POR_TRABAJO,
  medidasReducidas,
} from "@/lib/trabajos/reglas";

export type FotoDelPanel = {
  id: string;
  tipo: string;
  url: string;
  alt: string | null;
  ancho: number | null;
  alto: number | null;
};

type EstadoArchivo = { id: number; nombre: string; estado: "esperando" | "subiendo" | "listo" | "error"; error?: string };

/** Archivos que se confirman juntos (una llamada al servidor por tanda). */
const TANDA = 6;
/** Fotos que se procesan y suben a la vez. */
const EN_PARALELO = 3;
const MB = 1024 * 1024;
/** Calidad con que se guarda la foto reducida (JPEG o WebP). */
const CALIDAD = 0.85;

/** PUT a la URL firmada con progreso (fetch no informa el avance de la subida). */
function subirConProgreso(url: string, archivo: Blob, alAvanzar: (bytes: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", archivo.type);
    xhr.upload.onprogress = (e) => alAvanzar(e.loaded);
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.onabort = () => resolve(false);
    xhr.send(archivo);
  });
}

type FotoLista = { archivo: Blob; ancho: number | null; alto: number | null };

async function codificar(bitmap: ImageBitmap, ancho: number, alto: number, tipo: string): Promise<Blob | null> {
  // Si termina en JPEG, lo transparente queda blanco (si no, saldría negro).
  const pintar = (ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D) => {
    if (tipo === "image/jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, ancho, alto);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
  };
  if (typeof OffscreenCanvas !== "undefined") {
    const lienzo = new OffscreenCanvas(ancho, alto);
    const ctx = lienzo.getContext("2d");
    if (ctx) {
      pintar(ctx);
      return lienzo.convertToBlob({ type: tipo, quality: CALIDAD }).catch(() => null);
    }
  }
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext("2d");
  if (!ctx) return null;
  pintar(ctx);
  return new Promise((resolve) => lienzo.toBlob((b) => resolve(b), tipo, CALIDAD));
}

/**
 * La foto como se guarda en el sitio: con el lado más largo en 2560 px como mucho (nunca se
 * agranda), en JPEG; las PNG y WebP pasan a WebP para no perder la transparencia. Un original de
 * 25 MB queda en 1 o 2 MB y el sitio carga rápido. Las medidas salen de este mismo paso.
 *
 * Si el navegador no puede (formato que no sabe leer, sin canvas), sube el original tal cual y el
 * servidor decide al verificarlo.
 */
async function prepararFoto(file: File): Promise<FotoLista> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { archivo: file, ancho: null, alto: null };
  }
  try {
    const { ancho, alto } = medidasReducidas(bitmap.width, bitmap.height);
    const reducida = ancho !== bitmap.width || alto !== bitmap.height;
    const destino = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
    let blob = await codificar(bitmap, ancho, alto, destino).catch(() => null);
    // Safari no sabe codificar WebP y devuelve PNG: sirve igual (conserva la transparencia).
    if (blob && !(FORMATOS_FOTO_TRABAJO as readonly string[]).includes(blob.type)) blob = null;
    if (!blob) return { archivo: file, ancho: reducida ? null : bitmap.width, alto: reducida ? null : bitmap.height };
    // Una foto chica que al recodificarla pesa más se sube como vino.
    if (!reducida && blob.size >= file.size) return { archivo: file, ancho: bitmap.width, alto: bitmap.height };
    return { archivo: blob, ancho, alto };
  } finally {
    bitmap.close();
  }
}

/**
 * Las fotos (y videos por enlace) de un trabajo.
 *
 * Subida: directo del navegador a R2. Cada foto se achica en el navegador, pide su URL firmada y
 * se sube; cada tanda se confirma junta. El servidor
 * verifica cada archivo ya subido y descarta lo que no es foto; acá se muestra el resultado por
 * archivo, porque cuando fallan tres de cuarenta hay que saber cuáles.
 *
 * Orden: se arrastra desde ☰ (también con teclado: Tab, Espacio, flechas, Espacio) y se guarda al
 * soltar; si el guardado falla, vuelve al orden anterior.
 */
export function TrabajoFotos({ trabajoId, fotos, portadaUrl }: { trabajoId: string; fotos: FotoDelPanel[]; portadaUrl: string | null }) {
  const [orden, setOrden] = useState(fotos);
  const [portada, setPortada] = useState(portadaUrl);
  // Cuando el servidor manda otra lista (después de subir o de refrescar), manda esa.
  const [previas, setPrevias] = useState({ fotos, portadaUrl });
  if (previas.fotos !== fotos || previas.portadaUrl !== portadaUrl) {
    setPrevias({ fotos, portadaUrl });
    setOrden(fotos);
    setPortada(portadaUrl);
  }

  const [archivos, setArchivos] = useState<EstadoArchivo[]>([]);
  const [progreso, setProgreso] = useState<{ subidos: number; total: number; cantidad: number } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [video, setVideo] = useState("");
  const [pendiente, empezar] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const disponibles = Math.max(0, MAX_FOTOS_POR_TRABAJO - orden.length);
  const subiendo = progreso !== null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function marcar(id: number, cambio: Partial<EstadoArchivo>) {
    setArchivos((prev) => prev.map((a) => (a.id === id ? { ...a, ...cambio } : a)));
  }

  /** Pide la URL firmada de UNA foto ya preparada. Se pide justo antes del PUT: vence al minuto si
   * la subida no empezó, así que entre una cosa y la otra no se hace nada pesado. */
  async function pedirUrl(nombre: string, archivo: Blob): Promise<{ uploadUrl: string; key: string } | { error: string }> {
    const permiso = await fetch(`/api/website/trabajos/${trabajoId}/upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivos: [{ nombre, tipo: archivo.type, bytes: archivo.size }] }),
    }).catch(() => null);
    const datos = (await permiso?.json().catch(() => null)) as {
      subidas?: { uploadUrl: string; key: string }[];
      error?: string;
    } | null;
    const subida = datos?.subidas?.[0];
    if (!permiso?.ok || !subida) return { error: datos?.error ?? "No pudimos preparar la subida." };
    return subida;
  }

  /** `cuenta.total` se ajusta cuando una foto se reduce o falla: la barra mide sólo lo que de verdad
   * se sube. */
  async function subirTanda(tanda: { id: number; file: File }[], avance: Map<number, number>, cuenta: { total: number }) {
    const refrescar = () =>
      setProgreso((p) => (p ? { ...p, subidos: [...avance.values()].reduce((a, b) => a + b, 0), total: cuenta.total } : p));
    const descontar = (id: number, bytes: number) => {
      avance.delete(id);
      cuenta.total -= bytes;
      refrescar();
    };

    const listas: { id: number; key: string }[] = [];
    const medidas: Record<string, { ancho: number; alto: number }> = {};
    let siguiente = 0;
    async function trabajador() {
      while (siguiente < tanda.length) {
        const { id, file } = tanda[siguiente++];
        marcar(id, { estado: "subiendo" });
        // Primero se achica (lo pesado); recién después se pide la URL, y enseguida se sube.
        const foto = await prepararFoto(file);
        cuenta.total -= file.size - foto.archivo.size;
        refrescar();
        const permiso = await pedirUrl(file.name, foto.archivo);
        if ("error" in permiso) {
          descontar(id, foto.archivo.size);
          marcar(id, { estado: "error", error: permiso.error });
          continue;
        }
        const ok = await subirConProgreso(permiso.uploadUrl, foto.archivo, (b) => {
          avance.set(id, b);
          refrescar();
        });
        if (ok) {
          avance.set(id, foto.archivo.size);
          refrescar();
          listas.push({ id, key: permiso.key });
          if (foto.ancho && foto.alto) medidas[permiso.key] = { ancho: foto.ancho, alto: foto.alto };
        } else {
          descontar(id, foto.archivo.size);
          marcar(id, { estado: "error", error: "La subida se cortó. Revisá tu conexión y probá de nuevo." });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(EN_PARALELO, tanda.length) }, trabajador));
    if (listas.length === 0) return;

    // En el orden en que se eligieron, no en el que terminaron de subir.
    const enOrden = tanda.flatMap((t) => listas.filter((l) => l.id === t.id));
    let r: Awaited<ReturnType<typeof confirmarSubidaAction>>;
    try {
      r = await confirmarSubidaAction(trabajoId, enOrden.map((l) => l.key), medidas);
    } catch {
      // Se cortó la conexión con el servidor: esta tanda queda con error y se sigue con la próxima.
      r = { ok: false, error: "No pudimos registrar las fotos. Revisá tu conexión y probá de nuevo." };
    }
    if (!r.ok) {
      for (const l of enOrden) marcar(l.id, { estado: "error", error: r.error });
      return;
    }
    const rechazo = new Map(r.valor.rechazadas.map((x) => [x.key, x.error]));
    for (const l of enOrden) {
      const e = rechazo.get(l.key);
      marcar(l.id, e ? { estado: "error", error: e } : { estado: "listo" });
    }
  }

  async function elegir(lista: FileList | null) {
    if (!lista || lista.length === 0 || subiendo) return;
    setError(null);
    const todos = Array.from(lista);
    const estados: EstadoArchivo[] = [];
    const aSubir: { id: number; file: File }[] = [];
    todos.forEach((file, id) => {
      // Lo que ya se sabe que no entra se avisa antes de subir.
      if (!(FORMATOS_FOTO_TRABAJO as readonly string[]).includes(file.type)) {
        estados.push({ id, nombre: file.name, estado: "error", error: "No es JPG, PNG ni WebP." });
      } else if (file.size > MAX_BYTES_FOTO_TRABAJO) {
        estados.push({ id, nombre: file.name, estado: "error", error: `Pesa más de ${MAX_BYTES_FOTO_TRABAJO / MB} MB.` });
      } else if (aSubir.length >= disponibles) {
        estados.push({
          id,
          nombre: file.name,
          estado: "error",
          error: `Cada trabajo admite hasta ${MAX_FOTOS_POR_TRABAJO} fotos.`,
        });
      } else {
        estados.push({ id, nombre: file.name, estado: "esperando" });
        aSubir.push({ id, file });
      }
    });
    setArchivos(estados);
    if (aSubir.length === 0) return;

    const total = aSubir.reduce((s, a) => s + a.file.size, 0);
    const avance = new Map<number, number>();
    setProgreso({ subidos: 0, total, cantidad: aSubir.length });
    try {
      const cuenta = { total };
      for (let i = 0; i < aSubir.length; i += TANDA) {
        const tanda = aSubir.slice(i, i + TANDA);
        try {
          await subirTanda(tanda, avance, cuenta);
        } catch {
          // Algo inesperado en esta tanda: lo que no terminó queda con error y se sigue.
          setArchivos((prev) =>
            prev.map((a) =>
              tanda.some((t) => t.id === a.id) && a.estado !== "listo" && a.estado !== "error"
                ? { ...a, estado: "error", error: "No pudimos subir esta foto. Probá de nuevo." }
                : a,
            ),
          );
        }
      }
    } finally {
      setProgreso(null);
      if (input.current) input.current.value = "";
      empezar(() => router.refresh());
    }
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
    const r = await reordenarFotosAction(trabajoId, nuevo.map((f) => f.id));
    if (!r.ok) {
      setOrden(anterior);
      setError(r.error);
    }
  }

  async function hacerPortada(foto: FotoDelPanel) {
    setError(null);
    const r = await elegirPortadaAction(trabajoId, foto.id);
    if (!r.ok) setError(r.error);
    else setPortada(foto.url);
  }

  async function borrar(fotoId: string) {
    setError(null);
    const r = await borrarFotoAction(trabajoId, fotoId);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setOrden((prev) => prev.filter((f) => f.id !== fotoId));
    // La portada puede haber pasado a otra foto.
    empezar(() => router.refresh());
  }

  function agregarVideo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    empezar(async () => {
      const r = await agregarVideoAction(trabajoId, video);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setVideo("");
      router.refresh();
    });
  }

  const listos = archivos.filter((a) => a.estado === "listo").length;
  const conError = archivos.filter((a) => a.estado === "error");

  return (
    <section className="fo-card space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Fotos y videos</h2>
        <p className="text-sm tabular-nums text-[var(--fo-muted)]">
          {orden.length} de {MAX_FOTOS_POR_TRABAJO}
        </p>
      </div>

      {disponibles === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--fo-border)] px-4 py-6 text-center text-sm text-[var(--fo-muted)]">
          Llegaste al máximo de {MAX_FOTOS_POR_TRABAJO}. Borrá alguna para subir otra.
        </p>
      ) : (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            void elegir(e.dataTransfer.files);
          }}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-200 focus-within:ring-2 focus-within:ring-[var(--fo-accent)] ${
            arrastrando
              ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]"
              : "border-[var(--fo-border)] hover:border-[var(--fo-accent)] hover:bg-[var(--fo-bg-elevated)]"
          }`}
        >
          <input
            ref={input}
            type="file"
            multiple
            accept={FORMATOS_FOTO_TRABAJO.join(",")}
            onChange={(e) => void elegir(e.target.files)}
            disabled={subiendo}
            className="sr-only"
          />
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--fo-accent-soft)] text-[var(--fo-accent)]">
            {subiendo ? <Loader2 size={22} className="animate-spin" aria-hidden /> : <ImagePlus size={22} aria-hidden />}
          </span>
          <span className="space-y-1">
            <span className="block font-medium">{subiendo ? "Subiendo las fotos…" : "Elegí las fotos o arrastralas acá"}</span>
            <span className="block text-xs text-[var(--fo-muted)]">
              JPG, PNG o WebP · hasta {MAX_BYTES_FOTO_TRABAJO / MB} MB cada una · te quedan {disponibles}{" "}
              {disponibles === 1 ? "lugar" : "lugares"}
            </span>
          </span>
          <span className="fo-btn fo-btn-primary pointer-events-none text-sm">Elegir fotos</span>
        </label>
      )}

      {progreso ? (
        <div className="space-y-1" aria-live="polite">
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-[var(--fo-border-muted)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((progreso.subidos / Math.max(1, progreso.total)) * 100)}
            aria-label="Avance de la subida"
          >
            <div
              className="h-full bg-[var(--fo-accent)] transition-[width] duration-200"
              style={{ width: `${Math.min(100, (progreso.subidos / Math.max(1, progreso.total)) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--fo-muted)]">
            {listos} de {progreso.cantidad} listas · {Math.round(progreso.subidos / MB)} de{" "}
            {Math.round(progreso.total / MB)} MB. No cierres esta pantalla.
          </p>
        </div>
      ) : archivos.length > 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">
          {listos} {listos === 1 ? "foto subida" : "fotos subidas"}
          {conError.length > 0 ? ` · ${conError.length} con problemas` : ""}.
        </p>
      ) : null}

      {conError.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {conError.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 rounded border border-[var(--fo-border-muted)] px-3 py-2">
              <span className="min-w-0 truncate">{a.nombre}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--fo-danger)]">
                <XCircle size={14} aria-hidden /> {a.error}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {subiendo ? (
        <ul className="space-y-1 text-xs text-[var(--fo-muted)]">
          {archivos
            .filter((a) => a.estado === "subiendo" || a.estado === "listo")
            .slice(-EN_PARALELO * 2)
            .map((a) => (
              <li key={a.id} className="flex items-center gap-1.5">
                {a.estado === "listo" ? (
                  <CheckCircle2 size={12} className="text-[var(--fo-accent)]" aria-hidden />
                ) : (
                  <Loader2 size={12} className="animate-spin" aria-hidden />
                )}
                <span className="truncate">{a.nombre}</span>
              </li>
            ))}
        </ul>
      ) : null}

      <form onSubmit={agregarVideo} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="fo-label">Agregar un video (YouTube o Vimeo)</span>
          <input
            value={video}
            onChange={(e) => setVideo(e.target.value)}
            placeholder="https://youtu.be/…"
            inputMode="url"
            className="fo-input"
          />
        </label>
        <button type="submit" className="fo-btn fo-btn-secondary" disabled={pendiente || !video.trim() || disponibles === 0}>
          <Film size={16} aria-hidden /> Agregar video
        </button>
      </form>

      {error ? <p className="fo-alert-error text-sm">{error}</p> : null}

      {orden.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay fotos. La primera que subas queda de portada.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={alSoltar}>
          <SortableContext items={orden.map((f) => f.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {orden.map((foto, i) => (
                <FotoOrdenable
                  key={foto.id}
                  foto={foto}
                  numero={i + 1}
                  esPortada={foto.tipo === "FOTO" && foto.url === portada}
                  trabajoId={trabajoId}
                  onPortada={hacerPortada}
                  onBorrar={borrar}
                  onError={setError}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function FotoOrdenable({
  foto,
  numero,
  esPortada,
  trabajoId,
  onPortada,
  onBorrar,
  onError,
}: {
  foto: FotoDelPanel;
  numero: number;
  esPortada: boolean;
  trabajoId: string;
  onPortada: (foto: FotoDelPanel) => Promise<void>;
  onBorrar: (id: string) => Promise<void>;
  onError: (mensaje: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: foto.id });
  const [alt, setAlt] = useState(foto.alt ?? "");
  const [guardado, setGuardado] = useState(foto.alt ?? "");
  const [confirmando, setConfirmando] = useState(false);
  const esVideo = foto.tipo === "VIDEO_URL";

  async function guardarAlt() {
    if (alt === guardado) return;
    const r = await editarAltFotoAction(trabajoId, foto.id, alt);
    if (!r.ok) onError(r.error);
    else {
      setGuardado(alt);
      onError(null);
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`space-y-2 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] p-2 ${isDragging ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          className="fo-btn fo-btn-ghost cursor-grab p-1"
          aria-label={`Mover ${esVideo ? "el video" : "la foto"} ${numero}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <span className="text-xs tabular-nums text-[var(--fo-muted)]">{numero}</span>
        <div className="flex gap-0.5">
          {esVideo ? null : (
            <button
              type="button"
              onClick={() => void onPortada(foto)}
              disabled={esPortada}
              className="fo-btn fo-btn-ghost p-1"
              aria-label={esPortada ? "Es la portada" : "Usar de portada"}
              title={esPortada ? "Es la portada" : "Usar de portada"}
            >
              <Star size={16} aria-hidden className={esPortada ? "fill-current text-[var(--fo-accent)]" : ""} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="fo-btn fo-btn-ghost p-1"
            aria-label={esVideo ? "Borrar el video" : "Borrar la foto"}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>

      {esVideo ? (
        <a
          href={foto.url}
          target="_blank"
          rel="noreferrer"
          className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 rounded bg-[var(--fo-bg-elevated)] p-2 text-center text-xs text-[var(--fo-muted)]"
        >
          <Film size={20} aria-hidden />
          <span className="line-clamp-2 break-all">{foto.url}</span>
        </a>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- las fotos viven en R2, sin redimensionador
        <img
          src={foto.url}
          alt={foto.alt ?? ""}
          width={foto.ancho ?? undefined}
          height={foto.alto ?? undefined}
          loading="lazy"
          decoding="async"
          className="aspect-[4/3] w-full rounded object-cover"
        />
      )}
      {esPortada ? <p className="text-xs text-[var(--fo-accent)]">Portada</p> : null}

      {esVideo ? null : (
        <label className="block text-xs">
          <span className="sr-only">Descripción de la foto {numero} para Google</span>
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value.slice(0, ALT_MAX))}
            onBlur={() => void guardarAlt()}
            placeholder="Qué se ve (para Google)"
            className="w-full rounded border border-[var(--fo-border)] bg-transparent px-2 py-1 text-xs"
          />
        </label>
      )}

      {confirmando ? (
        <div className="fo-alert-warning space-y-2 text-xs">
          <p>¿Borrar{esVideo ? " el video" : " la foto"}? No se puede recuperar.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void onBorrar(foto.id)} className="fo-btn fo-btn-danger text-xs">
              Sí, borrar
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="fo-btn fo-btn-ghost text-xs">
              No
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
