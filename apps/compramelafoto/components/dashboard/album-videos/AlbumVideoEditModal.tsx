"use client";

import { useEffect, useState } from "react";
import AppModal from "@/components/ui/AppModal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import EventFolderAlbumTreePicker from "@/components/dashboard/EventFolderAlbumTreePicker";
import { formatARS } from "@/lib/lab/helpers";
import type { VideoAssetDto } from "@/lib/videos/video-dto";
import {
  VIDEO_CATEGORIES,
  VIDEO_CATEGORY_LABELS,
  VIDEO_MIN_PRICE_CENTS_BY_CATEGORY,
  type VideoCategoryId,
} from "@/lib/videos/video-validation";
import { VIDEO_DESCRIPTION_MAX_LENGTH } from "@/lib/videos/video-upload-ui";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  albumId: number;
  video: VideoAssetDto | null;
  eventId?: number | null;
  onClose: () => void;
  onSaved: (video: VideoAssetDto) => void;
};

function centsToPesosInput(cents: number): string {
  return String(Math.round(cents / 100));
}

function pesosInputToCents(pesos: string): number {
  const n = Number(pesos.replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export default function AlbumVideoEditModal({
  open,
  albumId,
  video,
  eventId,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<VideoCategoryId>("OTHER");
  const [pricePesos, setPricePesos] = useState("");
  const [sellEnabled, setSellEnabled] = useState(true);
  const [eventFolderId, setEventFolderId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open || !video) return;
    setTitle(video.title ?? "");
    setDescription(video.description ?? "");
    setCategory(video.category as VideoCategoryId);
    setPricePesos(centsToPesosInput(video.priceCents));
    setSellEnabled(video.sellEnabled);
    setEventFolderId(video.eventFolderId != null ? String(video.eventFolderId) : "");
    setError(null);
    setSuccess(false);
  }, [open, video]);

  if (!video) return null;

  const categoryOptions = VIDEO_CATEGORIES.map((c) => ({
    value: c,
    label: VIDEO_CATEGORY_LABELS[c],
  }));

  async function handleSave() {
    const currentVideo = video;
    if (!currentVideo) return;

    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const desc = description.trim();
      if (desc.length > VIDEO_DESCRIPTION_MAX_LENGTH) {
        throw new Error(`La descripción no puede superar ${VIDEO_DESCRIPTION_MAX_LENGTH} caracteres.`);
      }

      const res = await fetch(`/api/dashboard/albums/${albumId}/videos/${currentVideo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || null,
          description: desc || null,
          category,
          priceCents: pesosInputToCents(pricePesos),
          sellEnabled,
          eventFolderId: eventFolderId ? Number(eventFolderId) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar");
      }
      if (data.video) {
        onSaved(data.video as VideoAssetDto);
      }
      setSuccess(true);
      setTimeout(() => onClose(), 600);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="lg"
      title="Editar video"
      description={
        video.originalFileName ? (
          <span className="block w-full text-sm text-[#6b7280] break-words">
            {video.originalFileName}
          </span>
        ) : undefined
      }
      panelClassName="w-full"
    >
      <div className="ds-content-container w-full px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex w-full flex-col gap-4">
        {error ? (
          <p className="ds-readable-text text-sm text-red-600 m-0" role="alert">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="ds-readable-text text-sm text-green-700 m-0">Cambios guardados.</p>
        ) : null}

        <label className="block w-full min-w-0">
          <span className="block text-sm font-medium text-[#374151] mb-1">Título</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={video.originalFileName ?? "Título del video"}
            className="w-full"
            disabled={saving}
          />
        </label>

        <label className="block w-full min-w-0">
          <span className="block text-sm font-medium text-[#374151] mb-1">Descripción</span>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={VIDEO_DESCRIPTION_MAX_LENGTH}
            rows={4}
            disabled={saving}
          />
          <span className="text-xs text-[#9ca3af] mt-1 block">
            {description.length}/{VIDEO_DESCRIPTION_MAX_LENGTH}
          </span>
        </label>

        <label className="block w-full min-w-0">
          <span className="block text-sm font-medium text-[#374151] mb-1">Categoría</span>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value as VideoCategoryId)}
            className="w-full"
            disabled={saving}
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="block w-full min-w-0">
          <span className="block text-sm font-medium text-[#374151] mb-1">
            Precio (ARS). Mínimo {formatARS(VIDEO_MIN_PRICE_CENTS_BY_CATEGORY[category] / 100)}
          </span>
          <Input
            type="number"
            min={VIDEO_MIN_PRICE_CENTS_BY_CATEGORY[category] / 100}
            value={pricePesos}
            onChange={(e) => setPricePesos(e.target.value)}
            className="w-full"
            disabled={saving}
          />
        </label>

        <label className="flex w-full min-w-0 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={sellEnabled}
            onChange={(e) => setSellEnabled(e.target.checked)}
            disabled={saving}
            className="mt-1 shrink-0"
          />
          <span className="min-w-0 flex-1 text-sm text-[#374151]">Vender este video</span>
        </label>

        {eventId != null && eventId > 0 ? (
          <EventFolderAlbumTreePicker
            mode="upload"
            eventId={eventId}
            value={eventFolderId}
            onChange={setEventFolderId}
            disabled={saving}
          />
        ) : null}

        <div className="flex flex-wrap gap-3 pt-2 w-full">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="whitespace-nowrap shrink-0"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2 inline" aria-hidden />
                Guardando…
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="whitespace-nowrap shrink-0"
          >
            Cancelar
          </Button>
        </div>
        </div>
      </div>
    </AppModal>
  );
}
