"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import BookPreview3D from "@/components/design-v2/BookPreview3D";
import DesignEditor from "@/components/design-v2/DesignEditor";
import { countClientPhotoInputs } from "@repo/template-editor-core";
import type { DesignPhotoPayload, DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { isBookTemplate } from "@/lib/design-v2/book-leaves";
import { buildInitialDesignData, type DesignV2Data } from "@/lib/design-v2/design-data";
import {
  cursosDelPadronDeLaEscuela,
  etiquetaDelAlumno,
  moverAlumno,
  reemplazarValoresDelListado,
  valoresDeEjemplo,
  valoresDelAlumno,
  type CursoDelPadron,
  type FilaDelPadron,
} from "@/lib/design-v2/probar-con-listado";

type AlbumOption = { id: number; title: string; photoCount: number };
type SchoolOption = { id: number; name: string; logoUrl: string | null };

/** ¿La tecla viene de un campo donde se escribe? Ahí las flechas mueven el cursor, no el alumno. */
function teclaEnCampo(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Probar una plantilla con fotos reales antes de ofrecerla: el fotógrafo elige fotos de uno de
 * sus álbumes en el orden en que las elegiría un cliente, ve el armado automático, lo corrige y
 * descarga un PDF de prueba. No se guarda nada.
 */
export default function TemplateSandboxClient({ templateId }: { templateId: string }) {
  const [template, setTemplate] = useState<DesignTemplatePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [albums, setAlbums] = useState<AlbumOption[] | null>(null);
  const [albumId, setAlbumId] = useState<number | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<DesignPhotoPayload[] | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [data, setData] = useState<DesignV2Data | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showBook, setShowBook] = useState(false);
  // «Listado de alumnos»: el de ejemplo (sin escuela) o el padrón de un curso del fotógrafo.
  const [schools, setSchools] = useState<SchoolOption[] | null>(null);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [courses, setCourses] = useState<CursoDelPadron[] | null>(null);
  const [coursesTruncated, setCoursesTruncated] = useState(false);
  const [courseKey, setCourseKey] = useState<string | null>(null);
  const [studentIndex, setStudentIndex] = useState(0);

  useEffect(() => {
    void (async () => {
      const [tRes, aRes] = await Promise.all([
        fetch(`/api/fotografo/diseno/plantillas/${encodeURIComponent(templateId)}/probar`, { credentials: "include" }),
        fetch("/api/fotografo/diseno/fotos", { credentials: "include" }),
      ]);
      const t = await tRes.json().catch(() => ({}));
      const a = await aRes.json().catch(() => ({}));
      if (!tRes.ok || !t.ok) {
        setError(t.error || "No se pudo abrir la plantilla.");
        return;
      }
      setTemplate(t.template);
      setAlbums(a.albums ?? []);
    })();
  }, [templateId]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/fotografo/schools", { credentials: "include" });
      const body = await res.json().catch(() => null);
      setSchools(
        res.ok && Array.isArray(body)
          ? body.map((s: SchoolOption) => ({ id: s.id, name: s.name, logoUrl: s.logoUrl ?? null }))
          : [],
      );
    })();
  }, []);

  useEffect(() => {
    if (schoolId == null) return;
    setCourses(null);
    setCoursesTruncated(false);
    void (async () => {
      const res = await fetch(`/api/fotografo/schools/${schoolId}/roster-entries?take=800`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      const entries: FilaDelPadron[] = res.ok && Array.isArray(body.entries) ? body.entries : [];
      setCourses(cursosDelPadronDeLaEscuela(entries));
      setCoursesTruncated(res.ok && body.truncatedHint === true);
    })();
  }, [schoolId]);

  const school = schools?.find((s) => s.id === schoolId) ?? null;
  const course = (courseKey != null ? courses?.find((c) => c.key === courseKey) : null) ?? null;
  const studentCount = course?.students.length ?? 0;
  const listadoValues = useMemo(
    () =>
      course && course.students.length > 0
        ? valoresDelAlumno({
            curso: course,
            indice: studentIndex,
            schoolName: school?.name,
            schoolLogoUrl: school?.logoUrl,
          })
        : valoresDeEjemplo(),
    [course, studentIndex, school],
  );

  // Con el diseño ya armado, cambiar de curso o de alumno cambia sólo esos textos (el PDF usa los mismos).
  useEffect(() => {
    setData((prev) => (prev ? { ...prev, values: reemplazarValoresDelListado(prev.values, listadoValues) } : prev));
  }, [listadoValues]);

  // ← / → pasan de alumno, salvo que se esté escribiendo en un campo o mirando el librito en 3D.
  useEffect(() => {
    if (studentCount < 2 || showBook) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || teclaEnCampo(e.target)) return;
      e.preventDefault();
      setStudentIndex((i) => moverAlumno(i, studentCount, e.key === "ArrowLeft" ? -1 : 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studentCount, showBook]);

  useEffect(() => {
    if (albumId == null) return;
    setAlbumPhotos(null);
    void (async () => {
      const res = await fetch(`/api/fotografo/diseno/fotos?albumId=${albumId}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      setAlbumPhotos(res.ok && body.ok ? body.photos : []);
    })();
  }, [albumId]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-screen-xl px-5 py-8">
        <Card className="p-6">
          <p className="text-sm text-[#6b7280]">{error}</p>
        </Card>
      </div>
    );
  }
  if (!template) {
    return <div className="mx-auto w-full max-w-screen-xl px-5 py-8 text-sm text-[#6b7280]">Cargando plantilla…</div>;
  }

  const needed = countClientPhotoInputs(template.slots);
  const photoById = new Map((albumPhotos ?? []).map((p) => [p.id, p]));
  const pickedPhotos = picked.map((id) => ({ id, url: photoById.get(id)?.url ?? null }));

  function togglePhoto(id: number) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  function startEditor() {
    if (!template) return;
    setData(
      buildInitialDesignData({
        templateV2Id: template.templateId,
        templateV2VersionId: template.versionId,
        slots: template.slots,
        photoIds: picked,
        values: listadoValues,
      }),
    );
  }

  const listadoCard = (
    <Card className="mt-5 p-4">
      <p className="text-sm font-medium text-[#111827]">Listado de alumnos</p>
      <p className="mt-1 text-xs text-[#6b7280]">
        Con un curso tuyo, el listado y el mosaico llevan sus alumnos y el nombre es el del alumno elegido.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-[#6b7280]" htmlFor="sandbox-school">
            Escuela
          </label>
          <select
            id="sandbox-school"
            value={schoolId ?? ""}
            onChange={(e) => {
              setSchoolId(e.target.value ? Number(e.target.value) : null);
              setCourses(null);
              setCourseKey(null);
              setStudentIndex(0);
            }}
            className="mt-1 w-64 max-w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
          >
            <option value="">Ejemplo</option>
            {(schools ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {schoolId != null ? (
          <div>
            <label className="block text-xs text-[#6b7280]" htmlFor="sandbox-course">
              Curso
            </label>
            <select
              id="sandbox-course"
              value={courseKey ?? ""}
              disabled={courses == null || courses.length === 0}
              onChange={(e) => {
                setCourseKey(e.target.value || null);
                setStudentIndex(0);
              }}
              className="mt-1 w-64 max-w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
            >
              <option value="">
                {courses == null
                  ? "Cargando cursos…"
                  : courses.length === 0
                    ? "Esta escuela no tiene padrón cargado"
                    : "Elegí un curso"}
              </option>
              {(courses ?? []).map((c) => (
                <option key={c.key} value={c.key}>
                  {c.title}
                  {c.shift ? ` (${c.shift})` : ""} · {c.students.length} alumno{c.students.length === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {course && studentCount > 0 ? (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={studentCount < 2}
              onClick={() => setStudentIndex((i) => moverAlumno(i, studentCount, -1))}
            >
              ‹ Anterior
            </Button>
            <span className="text-sm text-[#374151]" aria-live="polite">
              {etiquetaDelAlumno(studentIndex, studentCount)}:{" "}
              <span className="font-semibold">{listadoValues["student.fullName"]}</span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={studentCount < 2}
              onClick={() => setStudentIndex((i) => moverAlumno(i, studentCount, 1))}
            >
              Siguiente ›
            </Button>
          </div>
        ) : null}
      </div>
      {course && studentCount > 1 ? (
        <p className="mt-2 text-xs text-[#6b7280]">También podés pasar de alumno con las flechas ← y → del teclado.</p>
      ) : null}
      {coursesTruncated ? (
        <p className="mt-2 text-xs text-amber-700">
          La escuela tiene un padrón muy grande: puede que algún curso no muestre a todos sus alumnos.
        </p>
      ) : null}
    </Card>
  );

  async function downloadPdf() {
    if (!data) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/fotografo/diseno/plantillas/${encodeURIComponent(templateId)}/probar/pdf`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo generar el PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prueba-${template?.name ?? "plantilla"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "No se pudo generar el PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-5 py-6 sm:px-8">
      <Link href="/fotografo/diseno/plantillas/v2" className="text-sm text-[#6b7280] hover:text-[#111827]">
        ← Plantillas
      </Link>
      <h1 className="mt-2 text-xl font-bold text-[#111827] sm:text-2xl">Probar “{template.name}” con fotos</h1>

      {needed === 0 ? (
        <Card className="mt-4 border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">
            Esta plantilla no tiene huecos para las fotos del cliente. En el editor, agregá una imagen y atala a la
            variable <span className="font-semibold">“Foto del cliente 1”</span> (y 2, 3… si querés más).
          </p>
        </Card>
      ) : null}

      {!data ? (
        <>
          <p className="mt-2 max-w-3xl text-sm text-[#6b7280]">
            Elegí fotos de uno de tus álbumes en el orden en que las elegiría un cliente: la primera va al hueco 1, la
            segunda al 2, y así. Esta plantilla usa {needed} foto{needed === 1 ? "" : "s"}. Nada de esto se guarda.
          </p>

          <Card className="mt-5 p-4">
            <label className="block text-sm font-medium text-[#111827]" htmlFor="sandbox-album">
              Álbum
            </label>
            <select
              id="sandbox-album"
              value={albumId ?? ""}
              onChange={(e) => {
                setAlbumId(e.target.value ? Number(e.target.value) : null);
                setPicked([]);
              }}
              className="mt-1 w-full max-w-md rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
            >
              <option value="">{albums && albums.length === 0 ? "No tenés álbumes con fotos" : "Elegí un álbum"}</option>
              {(albums ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.photoCount} fotos)
                </option>
              ))}
            </select>

            {albumId != null ? (
              albumPhotos == null ? (
                <p className="mt-4 text-sm text-[#6b7280]">Cargando fotos…</p>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-[#374151]">
                      Elegidas: <span className="font-semibold">{picked.length}</span>
                      {needed > 0 ? ` de ${needed}` : ""}
                    </p>
                    <Button size="sm" variant="primary" disabled={picked.length === 0} onClick={startEditor}>
                      Ver el diseño armado
                    </Button>
                  </div>
                  <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
                    {albumPhotos.map((p) => {
                      const order = picked.indexOf(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => togglePhoto(p.id)}
                            aria-pressed={order >= 0}
                            className={`relative block aspect-square w-full overflow-hidden rounded-md bg-[#f3f4f6] ring-2 ${
                              order >= 0 ? "ring-[#c27b3d]" : "ring-transparent hover:ring-[#e5e7eb]"
                            }`}
                          >
                            {p.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : null}
                            {order >= 0 ? (
                              <span className="absolute left-1 top-1 rounded-full bg-[#c27b3d] px-2 text-xs font-bold text-white">
                                {order + 1}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )
            ) : null}
          </Card>

          {listadoCard}
        </>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => void downloadPdf()} disabled={downloading}>
              {downloading ? "Generando PDF…" : "Descargar PDF de prueba"}
            </Button>
            {isBookTemplate(template) ? (
              <Button size="sm" variant="secondary" onClick={() => setShowBook(true)}>
                Ver librito en 3D
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => setData(null)} disabled={downloading}>
              Cambiar fotos
            </Button>
            <span className="text-xs text-[#6b7280]">
              {course
                ? "Así le va a llegar a cada familia del curso: con un pedido real salen sus datos."
                : "Así le va a llegar a tu cliente. Los textos son de ejemplo: con un pedido real salen sus datos."}
            </span>
          </div>
          {downloadError ? <p className="mt-2 text-sm text-red-600">{downloadError}</p> : null}
          {listadoCard}
          <div className="mt-5">
            <DesignEditor
              template={template}
              photos={pickedPhotos}
              data={data}
              onChange={(next) => setData(next)}
              photosTitle="Fotos elegidas para la prueba"
            />
          </div>
          {showBook ? (
            <BookPreview3D template={template} photos={pickedPhotos} data={data} onClose={() => setShowBook(false)} />
          ) : null}
        </>
      )}
    </div>
  );
}
