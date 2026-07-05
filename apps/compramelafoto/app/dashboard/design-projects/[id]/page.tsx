"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type EditorSlot = {
  id: number;
  role: string | null;
  pageIndex?: number | null;
  index?: number | null;
  bbox?: { x: number; y: number; width: number; height: number } | null;
};

type EditorTemplate = {
  id: number;
  imageUrl: string;
  widthCm: number;
  heightCm: number;
  textElementsJson?: Array<{ id: string; text: string }> | null;
  slots: EditorSlot[];
};

type SelectionPhoto = {
  id: number;
  role: string | null;
  position: number | null;
  photo: { id: number; previewUrl: string | null; originalKey: string | null };
};

type EditorDataJson = {
  schemaVersion: number;
  assignments: Array<{
    slotId: number;
    selectionPhotoId: number;
    slotRole: string | null;
    selectionPhotoRole: string | null;
    source?: string | null;
  }>;
  slotOverrides?: Record<
    string,
    {
      cropX?: number;
      cropY?: number;
      zoom?: number;
      rotation?: number;
      fitMode?: string;
      manualOverride?: boolean;
    }
  >;
  textOverrides?: Record<
    string,
    {
      overrideValue?: string | null;
      isOverridden?: boolean;
    }
  >;
  previewDirty?: boolean;
  previewStatus?: "DIRTY" | "RENDERING" | "READY" | "FAILED";
  previewGeneratedAt?: string | null;
  previewVersion?: number;
  previewError?: string | null;
  previewUrl?: string | null;
  exportStatus?: "EXPORTING" | "EXPORTED" | "FAILED";
  exportUrlJpg?: string | null;
  exportUrlPdf?: string | null;
  exportGeneratedAt?: string | null;
  exportVersion?: number;
  exportError?: string | null;
  preflight?: {
    slotRenderData?: Array<{ slotId: number; bbox?: { x: number; y: number; width: number; height: number } | null }>;
  };
};

type SchoolOrderContext = {
  studentFirstName: string | null;
  studentLastName: string | null;
  schoolCourse: { name: string; division: string | null } | null;
  album: {
    id: number;
    title: string | null;
    publicSlug: string | null;
    school: { id: number; name: string } | null;
  };
};

type EditorResponse = {
  project: { id: number; status: string; currentRevisionId: number | null };
  schoolOrderContext?: SchoolOrderContext;
  template: EditorTemplate | null;
  selection: SelectionPhoto[];
  revision: { id: number | null; dataJson: EditorDataJson };
};

function formatContextStudent(first: string | null, last: string | null): string {
  const n = [first?.trim(), last?.trim()].filter(Boolean).join(" ").trim();
  return n || "Sin alumno";
}

function formatContextSchool(school: { name: string } | null | undefined): string {
  if (school?.name && String(school.name).trim() !== "") return school.name;
  return "No escolar";
}

function formatContextCourse(course: { name: string; division: string | null } | null | undefined): string {
  if (!course?.name?.trim()) return "-";
  return `${course.name}${course.division ? ` ${course.division}` : ""}`;
}

function formatContextAlbum(album: { id: number; title: string | null; publicSlug: string | null }): string {
  const t = album.title?.trim();
  if (t) return t;
  const s = album.publicSlug?.trim();
  if (s) return s;
  return `Álbum #${album.id}`;
}

export default function DesignProjectEditorPage() {
  const params = useParams();
  const designProjectId = params?.id ? String(params.id) : "";
  const [data, setData] = useState<EditorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSlotId, setActiveSlotId] = useState<number | null>(null);
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [polling, setPolling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportPolling, setExportPolling] = useState(false);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!designProjectId) return;
    setLoading(true);
    fetch(`/api/dashboard/design-projects/${designProjectId}/editor`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No encontrado"))))
      .then((json) => {
        setData(json);
        const textOverrides =
          (json?.revision?.dataJson?.textOverrides as Record<
            string,
            { overrideValue?: string | null }
          > | undefined) ?? {};
        const next: Record<string, string> = {};
        Object.entries(textOverrides).forEach(([id, val]) => {
          if (val && typeof val.overrideValue === "string") next[id] = val.overrideValue;
        });
        setTextInputs(next);
      })
      .catch(() => setError("No se pudo cargar el diseño."))
      .finally(() => setLoading(false));
  }, [designProjectId]);

  async function handleApproveForExport() {
    if (!designProjectId) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/dashboard/design-projects/${designProjectId}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      let payload: { error?: unknown; message?: unknown } = {};
      try {
        payload = await res.json();
      } catch {
        payload = {};
      }
      if (res.ok) {
        const refetch = await fetch(`/api/dashboard/design-projects/${designProjectId}/editor`, { cache: "no-store" });
        if (refetch.ok) {
          const json = (await refetch.json()) as EditorResponse;
          setData(json);
          const textOverrides =
            (json?.revision?.dataJson?.textOverrides as Record<
              string,
              { overrideValue?: string | null }
            > | undefined) ?? {};
          const next: Record<string, string> = {};
          Object.entries(textOverrides).forEach(([id, val]) => {
            if (val && typeof val.overrideValue === "string") next[id] = val.overrideValue;
          });
          setTextInputs(next);
        }
        return;
      }
      const msg =
        (typeof payload.error === "string" && payload.error) ||
        (typeof payload.message === "string" && payload.message) ||
        "No se pudo aprobar el diseño.";
      alert(msg);
    } catch {
      alert("No se pudo aprobar el diseño.");
    } finally {
      setApproving(false);
    }
  }

  const slotAssignments = useMemo(() => {
    const assignments = data?.revision?.dataJson?.assignments ?? [];
    return new Map(assignments.map((a) => [a.slotId, a] as const));
  }, [data]);

  const selectionById = useMemo(() => {
    const list = data?.selection ?? [];
    return new Map(list.map((p) => [p.id, p] as const));
  }, [data]);

  const slots = data?.template?.slots ?? [];
  const slotOverrides = data?.revision?.dataJson?.slotOverrides ?? {};
  const activeSlot = slots.find((s) => s.id === activeSlotId) ?? null;
  const activeAssignment = activeSlot ? slotAssignments.get(activeSlot.id) ?? null : null;
  const activePhoto = activeAssignment ? selectionById.get(activeAssignment.selectionPhotoId) ?? null : null;
  const usedPhotoIds = useMemo(() => {
    const ids = new Set<number>();
    slotAssignments.forEach((a) => ids.add(a.selectionPhotoId));
    return ids;
  }, [slotAssignments]);
  const availablePhotos = useMemo(() => {
    return (data?.selection ?? []).map((p) => ({
      ...p,
      inUse: usedPhotoIds.has(p.id),
    }));
  }, [data, usedPhotoIds]);

  async function postRevisionAction(path: string, body: unknown) {
    const revisionId = data?.revision?.id;
    if (!revisionId) return;
    const res = await fetch(`/api/dashboard/design-revisions/${revisionId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError("No se pudo guardar el cambio.");
    } else {
      const refetch = await fetch(`/api/dashboard/design-projects/${designProjectId}/editor`, { cache: "no-store" });
      if (refetch.ok) {
        setData(await refetch.json());
      }
    }
  }

  async function regeneratePreview() {
    const revisionId = data?.revision?.id;
    if (!revisionId) return;
    setRegenerating(true);
    const res = await fetch(`/api/dashboard/design-revisions/${revisionId}/regenerate-preview`, {
      method: "POST",
    });
    if (!res.ok) {
      setError("No se pudo regenerar la preview.");
    } else {
      const refetch = await fetch(`/api/dashboard/design-projects/${designProjectId}/editor`, { cache: "no-store" });
      if (refetch.ok) {
        setData(await refetch.json());
      }
    }
    setRegenerating(false);
  }

  async function requestExport() {
    const projectId = data?.project?.id;
    if (!projectId) return;
    setExporting(true);
    const res = await fetch(`/api/dashboard/design-projects/${projectId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revisionId: data?.revision?.id ?? undefined }),
    });
    if (!res.ok) {
      setError("No se pudo iniciar el export final.");
    } else {
      const refetch = await fetch(`/api/dashboard/design-projects/${designProjectId}/editor`, { cache: "no-store" });
      if (refetch.ok) {
        setData(await refetch.json());
      }
    }
    setExporting(false);
  }

  useEffect(() => {
    const revisionId = data?.revision?.id;
    const status = data?.revision?.dataJson?.previewStatus;
    if (!revisionId || status !== "RENDERING") {
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    console.info("[school_design_preview_poll] poll_started", { revisionId });
    setPolling(true);

    const tick = async () => {
      if (!active) return;
      console.info("[school_design_preview_poll] poll_tick", { revisionId });
      const res = await fetch(`/api/dashboard/design-revisions/${revisionId}/preview-status`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!active) return;
      if (!data) return;
      if (json.previewStatus !== data.revision.dataJson.previewStatus) {
        console.info("[school_design_preview_poll] preview_status_changed", {
          from: data.revision.dataJson.previewStatus,
          to: json.previewStatus,
        });
      }
      if (json.previewStatus === "READY") {
        console.info("[school_design_preview_poll] preview_ready_detected", { revisionId });
      }
      if (json.previewStatus === "FAILED") {
        console.info("[school_design_preview_poll] preview_failed_detected", { revisionId });
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          revision: {
            ...prev.revision,
            dataJson: {
              ...prev.revision.dataJson,
              previewStatus: json.previewStatus ?? prev.revision.dataJson.previewStatus,
              previewDirty: json.previewDirty ?? prev.revision.dataJson.previewDirty,
              previewUrl: json.previewUrl ?? prev.revision.dataJson.previewUrl,
              previewGeneratedAt: json.previewGeneratedAt ?? prev.revision.dataJson.previewGeneratedAt,
              previewVersion: json.previewVersion ?? prev.revision.dataJson.previewVersion,
              previewError: json.previewError ?? prev.revision.dataJson.previewError,
            },
          },
        };
      });
      if (json.previewStatus && json.previewStatus !== "RENDERING") {
        if (timer) clearInterval(timer);
        timer = null;
        setPolling(false);
        console.info("[school_design_preview_poll] poll_stopped", { revisionId });
      }
    };

    timer = setInterval(tick, 4000);
    tick();

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      setPolling(false);
    };
  }, [data?.revision?.id, data?.revision?.dataJson?.previewStatus]);

  useEffect(() => {
    const revisionId = data?.revision?.id;
    const status = data?.revision?.dataJson?.exportStatus;
    if (!revisionId || status !== "EXPORTING") {
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    console.info("[school_design_export] poll_started", { revisionId });
    setExportPolling(true);

    const tick = async () => {
      if (!active) return;
      console.info("[school_design_export] poll_tick", { revisionId });
      const res = await fetch(`/api/dashboard/design-revisions/${revisionId}/export-status`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!active) return;
      if (!data) return;
      if (json.exportStatus !== data.revision.dataJson.exportStatus) {
        console.info("[school_design_export] export_status_changed", {
          from: data.revision.dataJson.exportStatus,
          to: json.exportStatus,
        });
      }
      if (json.exportStatus === "EXPORTED") {
        console.info("[school_design_export] export_ready_detected", { revisionId });
      }
      if (json.exportStatus === "FAILED") {
        console.info("[school_design_export] export_failed_detected", { revisionId });
      }
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          revision: {
            ...prev.revision,
            dataJson: {
              ...prev.revision.dataJson,
              exportStatus: json.exportStatus ?? prev.revision.dataJson.exportStatus,
              exportUrlJpg: json.exportUrlJpg ?? prev.revision.dataJson.exportUrlJpg,
              exportUrlPdf: json.exportUrlPdf ?? prev.revision.dataJson.exportUrlPdf,
              exportGeneratedAt: json.exportGeneratedAt ?? prev.revision.dataJson.exportGeneratedAt,
              exportVersion: json.exportVersion ?? prev.revision.dataJson.exportVersion,
              exportError: json.exportError ?? prev.revision.dataJson.exportError,
            },
          },
        };
      });
      if (json.exportStatus && json.exportStatus !== "EXPORTING") {
        if (timer) clearInterval(timer);
        timer = null;
        setExportPolling(false);
        console.info("[school_design_export] poll_stopped", { revisionId });
      }
    };

    timer = setInterval(tick, 5000);
    tick();

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      setExportPolling(false);
    };
  }, [data?.revision?.id, data?.revision?.dataJson?.exportStatus]);

  if (loading) {
    return <div className="p-6">Cargando editor…</div>;
  }
  if (error || !data) {
    return <div className="p-6 text-red-600">{error || "No disponible"}</div>;
  }

  const templateWidth = data.template?.widthCm ?? 20;
  const templateHeight = data.template?.heightCm ?? 20;
  const previewWidth = 680;
  const previewHeight = Math.round((previewWidth * templateHeight) / templateWidth);
  const scaleX = previewWidth / templateWidth;
  const scaleY = previewHeight / templateHeight;

  function slotStyle(slot: EditorSlot) {
    const bbox = slot.bbox ?? { x: 0, y: 0, width: 1, height: 1 };
    return {
      left: `${bbox.x * scaleX}px`,
      top: `${bbox.y * scaleY}px`,
      width: `${bbox.width * scaleX}px`,
      height: `${bbox.height * scaleY}px`,
    };
  }

  function buildImageStyle(slotId: number) {
    const override = slotOverrides[String(slotId)] ?? {};
    const zoom = typeof override.zoom === "number" && Number.isFinite(override.zoom) ? override.zoom : 1;
    const rotation = typeof override.rotation === "number" && Number.isFinite(override.rotation) ? override.rotation : 0;
    const cropX = typeof override.cropX === "number" && Number.isFinite(override.cropX) ? override.cropX : 0;
    const cropY = typeof override.cropY === "number" && Number.isFinite(override.cropY) ? override.cropY : 0;
    return {
      transform: `translate(${cropX}px, ${cropY}px) scale(${zoom}) rotate(${rotation}deg)`,
      transformOrigin: "center",
    } as React.CSSProperties;
  }

  function handleDragStartFromSlot(e: React.DragEvent<HTMLDivElement>, slotId: number) {
    e.dataTransfer.setData("text/slot", String(slotId));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragStartFromPhoto(e: React.DragEvent<HTMLDivElement>, photoId: number) {
    e.dataTransfer.setData("text/photo", String(photoId));
    e.dataTransfer.effectAllowed = "copy";
  }

  async function handleDropOnSlot(e: React.DragEvent<HTMLDivElement>, slotId: number) {
    e.preventDefault();
    const slotData = e.dataTransfer.getData("text/slot");
    const photoData = e.dataTransfer.getData("text/photo");
    if (slotData) {
      const slotIdA = parseInt(slotData, 10);
      if (Number.isFinite(slotIdA) && slotIdA !== slotId) {
        console.info("[school_design_editor] slot_photos_swapped", { slotIdA, slotIdB: slotId });
        await postRevisionAction("swap-slots", { slotIdA, slotIdB: slotId });
        return;
      }
    }
    if (photoData) {
      const selectionPhotoId = parseInt(photoData, 10);
      if (Number.isFinite(selectionPhotoId)) {
        console.info("[school_design_editor] slot_photo_replaced", { slotId, selectionPhotoId });
        await postRevisionAction("replace-photo", { slotId, selectionPhotoId });
      }
    }
  }

  const ctx = data.schoolOrderContext;

  const projectStatus = data.project.status;
  const previewDirty = data.revision.dataJson.previewDirty === true;
  const previewStatus = data.revision.dataJson.previewStatus;
  const canApproveForExport =
    projectStatus === "PENDING_PHOTOGRAPHER_APPROVAL" &&
    !previewDirty &&
    previewStatus !== "RENDERING" &&
    previewStatus !== "FAILED";

  let approveBlockedHint: string | null = null;
  if (!canApproveForExport) {
    if (projectStatus !== "PENDING_PHOTOGRAPHER_APPROVAL") {
      approveBlockedHint = "Este diseño todavía no está listo para aprobar.";
    } else if (previewDirty) {
      approveBlockedHint = "Primero tenés que regenerar la preview.";
    } else if (previewStatus === "RENDERING") {
      approveBlockedHint = "Esperá a que termine de regenerarse la preview.";
    } else if (previewStatus === "FAILED") {
      approveBlockedHint = "La preview falló. Volvé a regenerarla antes de aprobar.";
    }
  }

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <header className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <Link href="/dashboard/design-projects" className="text-[#c27b3d] hover:underline">
              ← Volver a revisiones escolares
            </Link>
            <Link href="/fotografo/escuelas/pedidos" className="text-[#c27b3d] hover:underline">
              ← Volver a pedidos escolares
            </Link>
          </div>
          {designProjectId ? (
            <div className="flex flex-wrap items-start gap-3 pt-1">
              <div className="flex flex-col gap-1 min-w-0">
                <Button
                  type="button"
                  disabled={approving || !canApproveForExport}
                  onClick={() => void handleApproveForExport()}
                >
                  {approving ? "Aprobando..." : "Aprobar para exportar"}
                </Button>
                {!canApproveForExport && approveBlockedHint ? (
                  <p className="text-xs text-gray-600 max-w-2xl leading-relaxed">{approveBlockedHint}</p>
                ) : null}
              </div>
            </div>
          ) : null}
          <h1 className="text-xl font-semibold">Revisión de diseño</h1>
          <p className="text-sm text-gray-600">Proyecto #{data.project.id}</p>
          {ctx ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm border-t border-gray-100 pt-3 mt-1">
              <div className="flex gap-2">
                <dt className="text-gray-500 shrink-0">Alumno</dt>
                <dd className="text-gray-900">{formatContextStudent(ctx.studentFirstName, ctx.studentLastName)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 shrink-0">Escuela</dt>
                <dd className="text-gray-900">{formatContextSchool(ctx.album.school)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 shrink-0">Curso</dt>
                <dd className="text-gray-900">{formatContextCourse(ctx.schoolCourse)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 shrink-0">Álbum</dt>
                <dd className="text-gray-900">{formatContextAlbum(ctx.album)}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">Preview compuesta del diseño.</p>
              <div className="text-xs text-slate-500">
                {data.revision.dataJson.previewDirty ? (
                  <span className="text-amber-600">Cambios sin regenerar</span>
                ) : data.revision.dataJson.previewStatus === "RENDERING" ? (
                  <span className="text-blue-600">Regenerando preview...</span>
                ) : data.revision.dataJson.previewStatus === "FAILED" ? (
                  <span className="text-red-600">Preview fallida</span>
                ) : (
                  <span className="text-emerald-600">Preview actualizada</span>
                )}
                {data.revision.dataJson.previewGeneratedAt ? (
                  <span className="ml-2">
                    Última: {new Date(data.revision.dataJson.previewGeneratedAt).toLocaleString("es-AR")}
                  </span>
                ) : null}
              </div>
            </div>
            <Button
              variant="secondary"
              disabled={regenerating || data.revision.dataJson.previewStatus === "RENDERING"}
              onClick={regeneratePreview}
            >
              {regenerating || data.revision.dataJson.previewStatus === "RENDERING"
                ? "Regenerando..."
                : "Regenerar preview"}
            </Button>
          </div>
          <div className="w-full overflow-auto">
            {data.revision.dataJson.previewUrl ? (
              <img
                src={
                  data.revision.dataJson.previewVersion
                    ? `${data.revision.dataJson.previewUrl}?v=${data.revision.dataJson.previewVersion}`
                    : data.revision.dataJson.previewUrl
                }
                alt=""
                className="w-full max-w-[680px] rounded-lg border shadow-sm"
                onError={() => {
                  console.warn("[school_design_preview] preview_fallback_used", {
                    designProjectId: data.project.id,
                  });
                }}
              />
            ) : (
              <div
                className="relative bg-white border rounded-lg shadow-sm"
                style={{ width: previewWidth, height: previewHeight }}
              >
                {data.template?.imageUrl ? (
                  <img
                    src={data.template.imageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : null}
                {slots.map((slot) => {
                  const assign = slotAssignments.get(slot.id);
                  const photo = assign ? selectionById.get(assign.selectionPhotoId) : null;
                  const selected = slot.id === activeSlotId;
                  return (
                    <div
                      key={slot.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(e) => handleDragStartFromSlot(e, slot.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnSlot(e, slot.id)}
                      onClick={() => setActiveSlotId(slot.id)}
                      className={`absolute border ${selected ? "border-amber-500" : "border-white/60"} rounded-md overflow-hidden`}
                      style={slotStyle(slot)}
                    >
                      {photo?.photo?.previewUrl ? (
                        <img
                          src={photo.photo.previewUrl}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          style={buildImageStyle(slot.id)}
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                          Sin foto
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {slots.map((slot) => {
              const assign = slotAssignments.get(slot.id);
              const photo = assign ? selectionById.get(assign.selectionPhotoId) : null;
              const selected = slot.id === activeSlotId;
              return (
                <button
                  key={slot.id}
                  onClick={() => setActiveSlotId(slot.id)}
                  className={`rounded-lg border p-2 text-left ${selected ? "border-amber-500" : "border-slate-200"}`}
                >
                  <p className="text-xs text-slate-500">Slot #{slot.id}</p>
                  <p className="text-sm font-medium">{slot.role ?? "Sin rol"}</p>
                  {photo?.photo?.previewUrl ? (
                    <img src={photo.photo.previewUrl} alt="" className="mt-2 w-full h-28 object-cover rounded" />
                  ) : (
                    <div className="mt-2 h-28 rounded bg-slate-100 flex items-center justify-center text-xs text-slate-400">
                      Sin foto
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-4 space-y-4">
          <h2 className="text-sm font-semibold">Ajustes rápidos</h2>
          {data.revision.dataJson.previewDirty ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Tenés cambios sin regenerar. La aprobación debería hacerse con la preview actualizada.
            </div>
          ) : data.revision.dataJson.previewStatus === "RENDERING" ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              La preview se está regenerando. Esperá a que finalice para aprobar.
            </div>
          ) : data.revision.dataJson.previewStatus === "FAILED" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
              Falló la generación de la preview. Reintentá la regeneración.
            </div>
          ) : null}
          {activeSlot ? (
            <>
              <div className="text-xs text-slate-600">
                Slot #{activeSlot.id} · {activeSlot.role ?? "Sin rol"}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Zoom (1.0)"
                  onBlur={(e) =>
                    postRevisionAction("slot-transform", { slotId: activeSlot.id, zoom: Number(e.target.value) })
                  }
                />
                <Input
                  placeholder="Rotación"
                  onBlur={(e) =>
                    postRevisionAction("slot-transform", { slotId: activeSlot.id, rotation: Number(e.target.value) })
                  }
                />
                <Input
                  placeholder="Crop X"
                  onBlur={(e) =>
                    postRevisionAction("slot-transform", { slotId: activeSlot.id, cropX: Number(e.target.value) })
                  }
                />
                <Input
                  placeholder="Crop Y"
                  onBlur={(e) =>
                    postRevisionAction("slot-transform", { slotId: activeSlot.id, cropY: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => postRevisionAction("reset-slot-transform", { slotId: activeSlot.id })}
                >
                  Reset
                </Button>
                {activeAssignment ? (
                  <Button
                    variant="secondary"
                    onClick={() => postRevisionAction("replace-photo", { slotId: activeSlot.id, selectionPhotoId: activeAssignment.selectionPhotoId })}
                  >
                    Reaplicar foto
                  </Button>
                ) : null}
              </div>
              <div className="text-xs text-slate-500">
                Foto actual: {activePhoto?.id ?? "—"}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Seleccioná un slot para editar.</p>
          )}

          <div className="border-t pt-3 space-y-2">
            <h3 className="text-sm font-semibold">Export final</h3>
            <div className="text-xs text-slate-500">
              {data.revision.dataJson.exportStatus === "EXPORTING" ? (
                <span className="text-blue-600">Exportando...</span>
              ) : data.revision.dataJson.exportStatus === "FAILED" ? (
                <span className="text-red-600">Falló el export</span>
              ) : data.revision.dataJson.exportStatus === "EXPORTED" ? (
                <span className="text-emerald-600">Export listo</span>
              ) : (
                <span className="text-slate-500">Listo para exportar cuando esté aprobado.</span>
              )}
              {data.revision.dataJson.exportGeneratedAt ? (
                <span className="ml-2">
                  Último export: {new Date(data.revision.dataJson.exportGeneratedAt).toLocaleString("es-AR")}
                </span>
              ) : null}
            </div>
            {data.revision.dataJson.exportError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                {data.revision.dataJson.exportError}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={
                  exporting ||
                  data.project.status !== "APPROVED_FOR_EXPORT" ||
                  data.revision.dataJson.previewDirty ||
                  data.revision.dataJson.previewStatus !== "READY" ||
                  data.revision.dataJson.exportStatus === "EXPORTING"
                }
                onClick={requestExport}
              >
                {exporting || data.revision.dataJson.exportStatus === "EXPORTING"
                  ? "Exportando..."
                  : "Exportar final"}
              </Button>
              {data.revision.dataJson.exportUrlJpg ? (
                <a
                  href={
                    data.revision.dataJson.exportVersion
                      ? `${data.revision.dataJson.exportUrlJpg}?v=${data.revision.dataJson.exportVersion}`
                      : data.revision.dataJson.exportUrlJpg
                  }
                  className="text-xs text-blue-600 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Descargar JPG
                </a>
              ) : null}
              {data.revision.dataJson.exportUrlPdf ? (
                <a
                  href={
                    data.revision.dataJson.exportVersion
                      ? `${data.revision.dataJson.exportUrlPdf}?v=${data.revision.dataJson.exportVersion}`
                      : data.revision.dataJson.exportUrlPdf
                  }
                  className="text-xs text-blue-600 underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Descargar PDF
                </a>
              ) : null}
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <h3 className="text-sm font-semibold">Fotos disponibles</h3>
            <div className="grid grid-cols-2 gap-2">
              {availablePhotos.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => handleDragStartFromPhoto(e, p.id)}
                  className={`rounded-lg border p-2 ${p.inUse ? "border-emerald-400" : "border-slate-200"}`}
                >
                  {p.photo.previewUrl ? (
                    <img src={p.photo.previewUrl} alt="" className="w-full h-24 object-cover rounded" />
                  ) : (
                    <div className="w-full h-24 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-400">
                      Sin preview
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500">
                    <span>#{p.id}</span>
                    <span>{p.inUse ? "En uso" : "Libre"}</span>
                  </div>
                  {activeSlot ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => postRevisionAction("replace-photo", { slotId: activeSlot.id, selectionPhotoId: p.id })}
                    >
                      Reemplazar en slot
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <h3 className="text-sm font-semibold">Textos</h3>
            {(data.template?.textElementsJson ?? []).map((t) => (
              <div key={t.id} className="space-y-1">
                <label className="text-xs text-slate-500">{t.id}</label>
                <Input
                  value={textInputs[t.id] ?? ""}
                  onChange={(e) => setTextInputs((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  onBlur={() => postRevisionAction("text-override", { textFieldId: t.id, overrideValue: textInputs[t.id] ?? "" })}
                />
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
