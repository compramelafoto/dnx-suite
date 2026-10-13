"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DesignEditor from "@/components/design-v2/DesignEditor";
import {
  CLASS_LIST_SAMPLE,
  CLASS_LIST_VARIABLE_KEY,
  countClientPhotoInputs,
  serializeClassList,
} from "@repo/template-editor-core";
import type { DesignPhotoPayload, DesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { buildInitialDesignData, type DesignV2Data } from "@/lib/design-v2/design-data";

type AlbumOption = { id: number; title: string; photoCount: number };

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
        values: {
          "student.fullName": "Nombre del Alumno",
          "course.displayName": "5.º A",
          "school.name": "Escuela de prueba",
          [CLASS_LIST_VARIABLE_KEY]: serializeClassList(CLASS_LIST_SAMPLE),
        },
      }),
    );
  }

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
        </>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => void downloadPdf()} disabled={downloading}>
              {downloading ? "Generando PDF…" : "Descargar PDF de prueba"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setData(null)} disabled={downloading}>
              Cambiar fotos
            </Button>
            <span className="text-xs text-[#6b7280]">
              Así le va a llegar a tu cliente. Los textos son de ejemplo: con un pedido real salen sus datos.
            </span>
          </div>
          {downloadError ? <p className="mt-2 text-sm text-red-600">{downloadError}</p> : null}
          <div className="mt-5">
            <DesignEditor
              template={template}
              photos={picked.map((id) => ({ id, url: photoById.get(id)?.url ?? null }))}
              data={data}
              onChange={(next) => setData(next)}
              photosTitle="Fotos elegidas para la prueba"
            />
          </div>
        </>
      )}
    </div>
  );
}
