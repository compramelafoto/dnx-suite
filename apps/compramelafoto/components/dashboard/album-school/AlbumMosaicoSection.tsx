"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import AppModal from "@/components/ui/AppModal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

/* ---------------------------------- Tipos que devuelve la API ---------------------------------- */

type CursoDelAlbum = {
  courseKey: string;
  titulo: string;
  total: number;
  conRetrato: number;
  aRevisar: number;
  cerradoEl: string | null;
};

type Fuente = "FAMILY" | "PHOTOGRAPHER" | "SCHOOL";

type Alumno = {
  rosterEntryId: number;
  nombre: string;
  apellido: string;
  retrato: { photoId: number; url: string | null; fuente: Fuente | null; revisar: boolean } | null;
};

type Integrante = { role: string; name: string; photoId: number | null; url?: string | null };

type Resumen = {
  courseKey: string;
  titulo: string;
  cerradoEl: string | null;
  alumnos: Alumno[];
  integrantes: Integrante[];
  sinIdentificar: Array<{ photoId: number; url: string | null }>;
  enlaceVence: string | null;
};

type Carpeta = { id: number; name: string; path?: string | null };

/* ---------------------------------------- Utilidades ---------------------------------------- */

const PAGINA_DE_FOTOS = 200;

function miniatura(albumId: number, photoId: number) {
  return `/api/photos/${photoId}/view?albumId=${albumId}&mode=preview`;
}

function fechaArgentina(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function etiquetaDeFuente(fuente: Fuente | null) {
  if (fuente === "FAMILY") return "La puso la familia";
  if (fuente === "SCHOOL") return "La puso el colegio";
  return "La pusiste vos";
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "No se pudo completar. Probá de nuevo.");
  }
  return data;
}

/* ------------------------------------- Selector de fotos ------------------------------------- */

function SelectorDeFotos({
  albumId,
  abierto,
  multiple,
  titulo,
  descripcion,
  excluir,
  errorExterno,
  onCerrar,
  onElegir,
}: {
  albumId: number;
  abierto: boolean;
  multiple: boolean;
  titulo: string;
  descripcion?: string;
  excluir?: number[];
  errorExterno?: string | null;
  onCerrar: () => void;
  onElegir: (ids: number[]) => void | Promise<void>;
}) {
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [carpeta, setCarpeta] = useState<string>("");
  const [fotos, setFotos] = useState<number[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [guardando, setGuardando] = useState(false);

  const excluidas = useMemo(() => new Set(excluir ?? []), [excluir]);

  useEffect(() => {
    if (!abierto) return;
    setElegidas([]);
    setError(null);
    // Las carpetas son opcionales: si el álbum no las usa, se listan todas las fotos.
    fetch(`/api/dashboard/albums/${albumId}/folders`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { folders: [] }))
      .then((d: { folders?: Carpeta[] }) => setCarpetas(Array.isArray(d.folders) ? d.folders : []))
      .catch(() => setCarpetas([]));
  }, [abierto, albumId]);

  const cargar = useCallback(
    async (cursor: string | null) => {
      setCargando(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(PAGINA_DE_FOTOS) });
        if (carpeta) params.set("folderId", carpeta);
        if (cursor) params.set("cursor", cursor);
        const d = await pedir<{ photos?: Array<{ id: number }>; totalCount?: number; nextCursor?: string | null }>(
          `/api/dashboard/albums/${albumId}/photos?${params.toString()}`,
        );
        const ids = (d.photos ?? []).map((p) => p.id);
        setFotos((prev) => (cursor ? [...prev, ...ids.filter((id) => !prev.includes(id))] : ids));
        setTotal(typeof d.totalCount === "number" ? d.totalCount : null);
        setSiguiente(d.nextCursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron cargar las fotos.");
      } finally {
        setCargando(false);
      }
    },
    [albumId, carpeta],
  );

  useEffect(() => {
    if (abierto) void cargar(null);
  }, [abierto, cargar]);

  const tocar = (id: number) => {
    if (!multiple) {
      setElegidas([id]);
      return;
    }
    setElegidas((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const confirmar = async () => {
    if (elegidas.length === 0) return;
    setGuardando(true);
    try {
      await onElegir(elegidas);
    } finally {
      setGuardando(false);
    }
  };

  if (!abierto) return null;

  return (
    <AppModal
      open={abierto}
      onClose={() => {
        if (!guardando) onCerrar();
      }}
      size="xl"
      title={titulo}
      titleId="mosaico-selector-de-fotos"
      description={descripcion}
      closeOnBackdrop={!guardando}
      closeOnEscape={!guardando}
      panelClassName="overflow-hidden border-[#e5e7eb] shadow-xl"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8 space-y-4">
        {carpetas.length > 0 ? (
          <label className="flex flex-col gap-1 sm:max-w-sm">
            <span className="text-xs font-medium text-[#6b7280]">Carpeta</span>
            <select
              value={carpeta}
              onChange={(e) => setCarpeta(e.target.value)}
              className="w-full min-h-11 rounded-lg border border-[#d1d5db] bg-white px-3 text-[15px] text-[#111827]"
            >
              <option value="">Todas las fotos</option>
              <option value="none">Fotos sin carpeta</option>
              {carpetas.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.path?.trim() || c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {error || errorExterno ? (
          <p className="text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2">
            {error || errorExterno}
          </p>
        ) : null}

        {!cargando && fotos.length === 0 && !error ? (
          <p className="text-sm text-[#6b7280] m-0">No hay fotos acá.</p>
        ) : null}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {fotos.map((id) => {
            const elegida = elegidas.includes(id);
            const yaEsta = excluidas.has(id);
            return (
              <button
                key={id}
                type="button"
                disabled={yaEsta || guardando}
                onClick={() => tocar(id)}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-[#f3f4f6] transition ${
                  elegida ? "border-[#2563eb] ring-2 ring-[#93c5fd]" : "border-transparent hover:border-[#d1d5db]"
                } ${yaEsta ? "opacity-40 cursor-not-allowed" : ""}`}
                aria-pressed={elegida}
                title={yaEsta ? "Ya está agregada" : `Foto ${id}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={miniatura(albumId, id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                {elegida ? (
                  <span className="absolute right-1 top-1 rounded-full bg-[#2563eb] px-2 py-0.5 text-[11px] font-semibold text-white">
                    {multiple ? elegidas.indexOf(id) + 1 : "✓"}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#6b7280] m-0">
            {cargando
              ? "Cargando…"
              : total != null && total > fotos.length
                ? `Mostrando ${fotos.length} de ${total} fotos`
                : `${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}`}
          </p>
          {siguiente ? (
            <Button type="button" variant="secondary" size="sm" disabled={cargando} onClick={() => void cargar(siguiente)}>
              Cargar más fotos
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 justify-end border-t border-[#f3f4f6] px-5 py-4 sm:px-8">
        <Button type="button" variant="secondary" disabled={guardando} onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type="button" disabled={guardando || elegidas.length === 0} onClick={() => void confirmar()}>
          {guardando
            ? "Guardando…"
            : multiple
              ? elegidas.length > 0
                ? `Agregar ${elegidas.length} ${elegidas.length === 1 ? "foto" : "fotos"}`
                : "Agregar"
              : "Usar esta foto"}
        </Button>
      </div>
    </AppModal>
  );
}

/* ------------------------------------- Pantalla principal ------------------------------------- */

type SelectorPedido =
  | { tipo: "alumno"; rosterEntryId: number; nombre: string }
  | { tipo: "integrante"; indice: number }
  | { tipo: "sinIdentificar" };

export default function AlbumMosaicoSection({ albumId }: { albumId: number }) {
  const [cursos, setCursos] = useState<CursoDelAlbum[]>([]);
  const [cargandoCursos, setCargandoCursos] = useState(true);
  const [errorCursos, setErrorCursos] = useState<string | null>(null);

  const [courseKey, setCourseKey] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cargandoCurso, setCargandoCurso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const [integrantes, setIntegrantes] = useState<Integrante[]>([]);
  const [integrantesCambiados, setIntegrantesCambiados] = useState(false);

  const [selector, setSelector] = useState<SelectorPedido | null>(null);
  const [enlace, setEnlace] = useState<{ url: string; vence: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);

  const base = `/api/dashboard/albums/${albumId}/mosaico`;
  const urlDelCurso = (key: string) => `${base}/${encodeURIComponent(key)}`;

  const cargarCursos = useCallback(async () => {
    setCargandoCursos(true);
    setErrorCursos(null);
    try {
      const d = await pedir<{ cursos: CursoDelAlbum[] }>(base);
      setCursos(d.cursos ?? []);
    } catch (e) {
      setErrorCursos(e instanceof Error ? e.message : "No se pudieron cargar los cursos.");
    } finally {
      setCargandoCursos(false);
    }
  }, [base]);

  const cargarCurso = useCallback(
    async (key: string) => {
      setCargandoCurso(true);
      setError(null);
      try {
        const d = await pedir<{ resumen: Resumen }>(`${base}/${encodeURIComponent(key)}`);
        setResumen(d.resumen);
        setIntegrantes(d.resumen.integrantes.map((i) => ({ ...i })));
        setIntegrantesCambiados(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar el curso.");
      } finally {
        setCargandoCurso(false);
      }
    },
    [base],
  );

  useEffect(() => {
    void cargarCursos();
  }, [cargarCursos]);

  const abrirCurso = (key: string) => {
    setCourseKey(key);
    setResumen(null);
    setEnlace(null);
    setAviso(null);
    void cargarCurso(key);
  };

  const volver = () => {
    setCourseKey(null);
    setResumen(null);
    setEnlace(null);
    setAviso(null);
    setError(null);
    void cargarCursos();
  };

  /** Manda una acción al curso abierto y recarga. */
  const accion = async (nombre: string, cuerpo: Record<string, unknown>, okMsg?: string) => {
    if (!courseKey) return null;
    setOcupado(nombre);
    setError(null);
    setAviso(null);
    try {
      const d = await pedir<Record<string, unknown>>(urlDelCurso(courseKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (okMsg) setAviso(okMsg);
      await cargarCurso(courseKey);
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar.");
      return null;
    } finally {
      setOcupado(null);
    }
  };

  const cerrado = Boolean(resumen?.cerradoEl);
  const sinRetrato = resumen ? resumen.alumnos.filter((a) => !a.retrato).length : 0;
  const conRetrato = resumen ? resumen.alumnos.length - sinRetrato : 0;
  const aConfirmar = resumen ? resumen.alumnos.filter((a) => a.retrato?.revisar).length : 0;

  const elegirFotos = async (ids: number[]) => {
    if (!selector) return;
    if (selector.tipo === "alumno") {
      const r = await accion("retrato", { accion: "retrato", rosterEntryId: selector.rosterEntryId, photoId: ids[0] });
      if (r) setSelector(null);
    } else if (selector.tipo === "integrante") {
      const idx = selector.indice;
      setIntegrantes((prev) => prev.map((it, i) => (i === idx ? { ...it, photoId: ids[0] ?? null, url: null } : it)));
      setIntegrantesCambiados(true);
      setSelector(null);
    } else {
      const r = await accion("sinIdentificar", { accion: "sinIdentificar", agregar: ids }, "Listo, agregamos las fotos.");
      if (r) setSelector(null);
    }
  };

  const generarEnlace = async () => {
    const d = await accion("enlace", { accion: "enlace" });
    if (d && typeof d.url === "string" && typeof d.vence === "string") {
      setEnlace({ url: d.url, vence: d.vence });
      setCopiado(false);
    }
  };

  const copiarEnlace = async () => {
    if (!enlace) return;
    try {
      await navigator.clipboard.writeText(enlace.url);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  /* ------------------------------------ Lista de cursos ------------------------------------ */

  if (!courseKey) {
    return (
      <div className="w-full space-y-6">
        <Card className="w-full max-w-full !min-w-[min(100%,20rem)] !p-7 sm:!p-9 space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#111827]">Mosaico del curso</h2>
            <p className="ds-readable-text ds-readable-text--fluid text-sm leading-relaxed text-[#6b7280] m-0">
              Juntá el retrato de cada chico, la seño y los directivos para armar el mosaico de cada curso. Las familias
              eligen su foto al comprar; vos completás las que falten y el colegio puede ponerle nombre a los retratos que
              nadie reconoció. Cuando el curso está completo, lo cerrás y ya se pueden imprimir las carpetas con el mosaico.
            </p>
          </div>

          {errorCursos ? (
            <p className="text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2">{errorCursos}</p>
          ) : null}

          {cargandoCursos ? (
            <p className="text-sm text-[#6b7280] m-0">Cargando cursos…</p>
          ) : cursos.length === 0 && !errorCursos ? (
            <p className="text-sm text-[#6b7280] m-0">
              Todavía no hay alumnos en el padrón de este álbum. Cargalos en la pestaña «Escuela» y vuelvan acá.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
              {cursos.map((c) => {
                const completo = c.total > 0 && c.conRetrato === c.total;
                return (
                  <li key={c.courseKey}>
                    <button
                      type="button"
                      onClick={() => abrirCurso(c.courseKey)}
                      className="w-full h-full text-left rounded-xl border border-[#e5e7eb] bg-white px-4 py-4 shadow-sm transition hover:border-[#9ca3af] hover:shadow"
                    >
                      <p className="text-[15px] font-semibold text-[#111827] m-0 break-words">{c.titulo}</p>
                      <p className="mt-2 text-sm text-[#374151] m-0">
                        <strong className="tabular-nums">{c.conRetrato}</strong> de{" "}
                        <strong className="tabular-nums">{c.total}</strong> con retrato
                      </p>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#f3f4f6]">
                        <div
                          className={`h-full ${completo ? "bg-emerald-500" : "bg-[#2563eb]"}`}
                          style={{ width: `${c.total ? Math.round((c.conRetrato / c.total) * 100) : 0}%` }}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {c.aRevisar > 0 ? (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                            {c.aRevisar} {c.aRevisar === 1 ? "puesto" : "puestos"} por el colegio para confirmar
                          </span>
                        ) : null}
                        {c.cerradoEl ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                            Cerrado el {fechaArgentina(c.cerradoEl)}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex justify-end border-t border-[#f3f4f6] pt-4">
            <Button type="button" variant="secondary" onClick={() => void cargarCursos()} disabled={cargandoCursos}>
              {cargandoCursos ? "Actualizando…" : "Actualizar"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* ------------------------------------- Curso abierto ------------------------------------- */

  const fotoIdsSinIdentificar = resumen?.sinIdentificar.map((s) => s.photoId) ?? [];

  return (
    <div className="w-full space-y-6">
      <Card className="w-full max-w-full !min-w-[min(100%,20rem)] !p-7 sm:!p-9 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1 space-y-2">
            <button type="button" onClick={volver} className="text-sm font-medium text-[#2563eb] hover:underline">
              ← Todos los cursos
            </button>
            <h2 className="text-xl sm:text-2xl font-bold text-[#111827] leading-tight break-words">
              {resumen?.titulo ?? "Cargando curso…"}
            </h2>
            {resumen ? (
              <p className="text-sm text-[#4b5563] m-0">
                <strong className="tabular-nums">{conRetrato}</strong> de{" "}
                <strong className="tabular-nums">{resumen.alumnos.length}</strong> con retrato
                {aConfirmar > 0 ? ` · ${aConfirmar} para confirmar` : ""}
              </p>
            ) : null}
          </div>
          {resumen ? (
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              {cerrado ? (
                <>
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                    Curso cerrado el {fechaArgentina(resumen.cerradoEl!)}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={ocupado != null}
                    onClick={() => void accion("reabrir", { accion: "reabrir" }, "Reabriste el curso: ya podés cambiar retratos.")}
                  >
                    {ocupado === "reabrir" ? "Reabriendo…" : "Reabrir el curso"}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  disabled={ocupado != null}
                  onClick={() => {
                    setError(null);
                    setConfirmarCierre(true);
                  }}
                >
                  Cerrar el curso
                </Button>
              )}
            </div>
          ) : null}
        </div>

        {cerrado ? (
          <p className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 px-4 py-2.5 text-sm text-emerald-950 m-0">
            Con el curso cerrado ya se pueden imprimir las carpetas con el mosaico. Si tenés que cambiar algo, reabrilo.
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2 m-0">{error}</p>
        ) : null}
        {aviso ? (
          <p className="text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 m-0">{aviso}</p>
        ) : null}
      </Card>

      {cargandoCurso && !resumen ? <p className="text-sm text-[#6b7280]">Cargando…</p> : null}

      {resumen ? (
        <>
          {/* Alumnos */}
          <Card className="w-full max-w-full !min-w-[min(100%,20rem)] !p-7 sm:!p-9 space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-[#111827]">Alumnos</h3>
              <p className="ds-readable-text ds-readable-text--fluid text-sm leading-relaxed text-[#6b7280] m-0">
                El retrato de cada chico en el mosaico. Si falta alguno, elegí una foto del álbum. Los que puso el colegio
                tenés que confirmarlos antes de cerrar.
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 list-none p-0 m-0">
              {resumen.alumnos.map((a) => {
                const nombre = `${a.nombre} ${a.apellido}`.trim();
                return (
                  <li
                    key={a.rosterEntryId}
                    className={`flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm ${
                      a.retrato?.revisar ? "border-amber-300" : "border-[#e5e7eb]"
                    }`}
                  >
                    <div className="relative aspect-[4/5] w-full bg-[#f3f4f6]">
                      {a.retrato ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.retrato.url || miniatura(albumId, a.retrato.photoId)}
                          alt={`Retrato de ${nombre}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#9ca3af]">
                          <svg viewBox="0 0 24 24" className="h-12 w-12" fill="currentColor" aria-hidden>
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z" />
                          </svg>
                          <span className="text-xs font-medium">Sin retrato</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <p className="text-sm font-semibold text-[#111827] m-0 break-words leading-snug">
                        {a.apellido}, {a.nombre}
                      </p>
                      {a.retrato ? (
                        <span
                          className={`self-start rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            a.retrato.fuente === "SCHOOL"
                              ? "border border-amber-200 bg-amber-50 text-amber-900"
                              : a.retrato.fuente === "FAMILY"
                                ? "border border-sky-200 bg-sky-50 text-sky-900"
                                : "border border-[#e5e7eb] bg-[#f9fafb] text-[#374151]"
                          }`}
                        >
                          {etiquetaDeFuente(a.retrato.fuente)}
                          {a.retrato.revisar ? " · para confirmar" : ""}
                        </span>
                      ) : null}
                      <div className="mt-auto flex flex-wrap gap-2 pt-1">
                        {a.retrato?.revisar ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={ocupado != null}
                            onClick={() =>
                              void accion("confirmar", { accion: "confirmar", rosterEntryId: a.rosterEntryId }, `Confirmaste el retrato de ${nombre}.`)
                            }
                          >
                            Confirmar
                          </Button>
                        ) : null}
                        {!cerrado ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={ocupado != null}
                              onClick={() => setSelector({ tipo: "alumno", rosterEntryId: a.rosterEntryId, nombre })}
                            >
                              {a.retrato ? "Cambiar" : "Elegir foto"}
                            </Button>
                            {a.retrato ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={ocupado != null}
                                onClick={() =>
                                  void accion(
                                    "retrato",
                                    { accion: "retrato", rosterEntryId: a.rosterEntryId, photoId: null },
                                    `Sacaste el retrato de ${nombre}.`,
                                  )
                                }
                              >
                                Sacar
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Seño y directivos */}
          <Card className="w-full max-w-full !min-w-[min(100%,20rem)] !p-7 sm:!p-9 space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-[#111827]">Seño y directivos</h3>
              <p className="ds-readable-text ds-readable-text--fluid text-sm leading-relaxed text-[#6b7280] m-0">
                Quiénes aparecen en el mosaico además de los chicos: la seño, la directora, la auxiliar… Poné el cargo, el
                nombre y elegí su foto del álbum. Hasta 8 personas.
              </p>
            </div>

            {integrantes.length === 0 ? (
              <p className="text-sm text-[#6b7280] m-0">Todavía no cargaste a nadie.</p>
            ) : (
              <ul className="space-y-3 list-none p-0 m-0">
                {integrantes.map((it, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-3 rounded-xl border border-[#e5e7eb] bg-white p-3 sm:flex-row sm:items-end"
                  >
                    <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-[#f3f4f6]">
                      {it.photoId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.url || miniatura(albumId, it.photoId)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] text-[#9ca3af] text-center px-1">
                          Sin foto
                        </div>
                      )}
                    </div>
                    <label className="flex flex-1 flex-col gap-1 min-w-0">
                      <span className="text-xs font-medium text-[#6b7280]">Cargo</span>
                      <Input
                        value={it.role}
                        disabled={cerrado}
                        placeholder="Seño, Directora…"
                        onChange={(e) => {
                          const v = e.target.value;
                          setIntegrantes((prev) => prev.map((x, j) => (j === i ? { ...x, role: v } : x)));
                          setIntegrantesCambiados(true);
                        }}
                      />
                    </label>
                    <label className="flex flex-[2] flex-col gap-1 min-w-0">
                      <span className="text-xs font-medium text-[#6b7280]">Nombre</span>
                      <Input
                        value={it.name}
                        disabled={cerrado}
                        placeholder="Nombre y apellido"
                        onChange={(e) => {
                          const v = e.target.value;
                          setIntegrantes((prev) => prev.map((x, j) => (j === i ? { ...x, name: v } : x)));
                          setIntegrantesCambiados(true);
                        }}
                      />
                    </label>
                    {!cerrado ? (
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="secondary" onClick={() => setSelector({ tipo: "integrante", indice: i })}>
                          {it.photoId ? "Cambiar foto" : "Elegir foto"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIntegrantes((prev) => prev.filter((_, j) => j !== i));
                            setIntegrantesCambiados(true);
                          }}
                        >
                          Quitar
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {!cerrado ? (
              <div className="flex flex-col-reverse gap-3 border-t border-[#f3f4f6] pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={integrantes.length >= 8}
                  onClick={() => {
                    setIntegrantes((prev) => [...prev, { role: prev.length === 0 ? "Seño" : "", name: "", photoId: null }]);
                    setIntegrantesCambiados(true);
                  }}
                >
                  Agregar persona
                </Button>
                <Button
                  type="button"
                  disabled={!integrantesCambiados || ocupado != null}
                  onClick={() =>
                    void accion(
                      "integrantes",
                      {
                        accion: "integrantes",
                        integrantes: integrantes.map(({ role, name, photoId }) => ({ role, name, photoId })),
                      },
                      "Guardamos la seño y los directivos.",
                    )
                  }
                >
                  {ocupado === "integrantes" ? "Guardando…" : "Guardar"}
                </Button>
              </div>
            ) : null}
          </Card>

          {/* Retratos sin identificar */}
          <Card className="w-full max-w-full !min-w-[min(100%,20rem)] !p-7 sm:!p-9 space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-bold text-[#111827]">Retratos sin identificar</h3>
              <p className="ds-readable-text ds-readable-text--fluid text-sm leading-relaxed text-[#6b7280] m-0">
                Si tenés retratos y no sabés de qué chico son, agregalos acá. Con el enlace para el colegio, la seño o la
                secretaría les pone nombre; después vos confirmás cada uno en la lista de alumnos.
              </p>
            </div>

            {resumen.sinIdentificar.length === 0 ? (
              <p className="text-sm text-[#6b7280] m-0">No hay retratos esperando nombre.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8 list-none p-0 m-0">
                {resumen.sinIdentificar.map((s) => (
                  <li key={s.photoId} className="relative overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f3f4f6]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.url || miniatura(albumId, s.photoId)}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/5] w-full object-cover"
                    />
                    {!cerrado ? (
                      <button
                        type="button"
                        disabled={ocupado != null}
                        onClick={() => void accion("sinIdentificar", { accion: "sinIdentificar", quitar: [s.photoId] })}
                        className="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-[#b91c1c] shadow hover:bg-white"
                      >
                        Quitar
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {!cerrado ? (
              <div className="flex justify-end border-t border-[#f3f4f6] pt-4">
                <Button type="button" variant="secondary" disabled={ocupado != null} onClick={() => setSelector({ tipo: "sinIdentificar" })}>
                  Agregar fotos
                </Button>
              </div>
            ) : null}
          </Card>

          {/* Enlace para el colegio */}
          {!cerrado ? (
            <Card className="w-full max-w-full !min-w-[min(100%,20rem)] !p-7 sm:!p-9 space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-bold text-[#111827]">Enlace para el colegio</h3>
                <p className="ds-readable-text ds-readable-text--fluid text-sm leading-relaxed text-[#6b7280] m-0">
                  Mandale este enlace a la seño o a la secretaría: sin crear cuenta, pueden ponerle nombre a los retratos
                  sin identificar y corregir los nombres de la seño y los directivos. El enlace vence a los 15 días, y si
                  generás uno nuevo, el anterior deja de andar.
                </p>
              </div>

              {resumen.enlaceVence && !enlace ? (
                <p className="text-sm text-[#374151] m-0">
                  Ya hay un enlace vigente hasta el {fechaArgentina(resumen.enlaceVence)}. Por seguridad no lo podemos
                  volver a mostrar: si lo perdiste, generá uno nuevo.
                </p>
              ) : null}

              {enlace ? (
                <div className="space-y-2 rounded-lg border border-emerald-200/70 bg-emerald-50/40 p-4">
                  <p className="text-xs font-medium text-emerald-900 m-0">
                    Copialo ahora: después no se vuelve a mostrar. Vence el {fechaArgentina(enlace.vence)}.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input readOnly value={enlace.url} onFocus={(e) => e.currentTarget.select()} className="w-full min-h-11 text-[15px]" />
                    <Button type="button" onClick={() => void copiarEnlace()} className="shrink-0">
                      {copiado ? "¡Copiado!" : "Copiar"}
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end border-t border-[#f3f4f6] pt-4">
                <Button type="button" variant="secondary" disabled={ocupado != null} onClick={() => void generarEnlace()}>
                  {ocupado === "enlace"
                    ? "Generando…"
                    : resumen.enlaceVence || enlace
                      ? "Generar un enlace nuevo"
                      : "Generar enlace para el colegio"}
                </Button>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      <SelectorDeFotos
        albumId={albumId}
        abierto={selector != null}
        multiple={selector?.tipo === "sinIdentificar"}
        titulo={
          selector?.tipo === "alumno"
            ? `Retrato de ${selector.nombre}`
            : selector?.tipo === "integrante"
              ? "Foto para el mosaico"
              : "Agregar retratos sin identificar"
        }
        descripcion={
          selector?.tipo === "sinIdentificar"
            ? "Elegí una o varias fotos del álbum. El colegio les va a poner nombre."
            : "Elegí una foto del álbum."
        }
        excluir={selector?.tipo === "sinIdentificar" ? fotoIdsSinIdentificar : undefined}
        errorExterno={error}
        onCerrar={() => {
          setSelector(null);
          setError(null);
        }}
        onElegir={elegirFotos}
      />

      {confirmarCierre && resumen ? (
        <AppModal
          open={confirmarCierre}
          onClose={() => {
            if (ocupado !== "cerrar") setConfirmarCierre(false);
          }}
          size="sm"
          title="¿Cerrar el curso?"
          titleId="mosaico-cerrar-curso"
          panelClassName="overflow-hidden border-[#e5e7eb] shadow-xl"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-8 space-y-3 text-sm text-[#374151]">
            {sinRetrato > 0 ? (
              <p className="m-0">
                Quedan <strong>{sinRetrato}</strong> {sinRetrato === 1 ? "chico" : "chicos"} sin retrato: van a salir en el
                mosaico con una silueta.
              </p>
            ) : (
              <p className="m-0">Todos los chicos tienen retrato.</p>
            )}
            {aConfirmar > 0 ? (
              <p className="m-0">
                Hay <strong>{aConfirmar}</strong> {aConfirmar === 1 ? "retrato puesto" : "retratos puestos"} por el colegio
                que todavía no confirmaste.
              </p>
            ) : null}
            <p className="m-0">
              Con el curso cerrado ya se pueden imprimir las carpetas con el mosaico. El enlace del colegio deja de andar y
              nadie puede cambiar retratos hasta que lo reabras.
            </p>
            {error ? (
              <p className="text-sm text-[#b91c1c] bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2 m-0">{error}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3 justify-end border-t border-[#f3f4f6] px-5 py-4 sm:px-8">
            <Button type="button" variant="secondary" disabled={ocupado === "cerrar"} onClick={() => setConfirmarCierre(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={ocupado === "cerrar"}
              onClick={async () => {
                const r = await accion("cerrar", { accion: "cerrar" }, "Cerraste el curso. Ya se pueden imprimir las carpetas con el mosaico.");
                if (r) {
                  setConfirmarCierre(false);
                  setEnlace(null);
                }
              }}
            >
              {ocupado === "cerrar" ? "Cerrando…" : "Sí, cerrar el curso"}
            </Button>
          </div>
        </AppModal>
      ) : null}
    </div>
  );
}
