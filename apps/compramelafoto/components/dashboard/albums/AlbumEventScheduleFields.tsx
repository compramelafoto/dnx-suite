"use client";

import Input from "@/components/ui/Input";
import {
  buildAlbumEventScheduleFromDb,
  formatAlbumEventScheduleDisplay,
} from "@/lib/albums/album-event-datetime";

export type AlbumEventScheduleValue = {
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
};

export const EMPTY_ALBUM_EVENT_SCHEDULE: AlbumEventScheduleValue = {
  eventDate: "",
  eventStartTime: "",
  eventEndTime: "",
};

export type AlbumEventScheduleApiShape = {
  eventDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  displayLabel?: string;
};

export function hydrateAlbumEventScheduleFromApi(data: {
  eventSchedule?: AlbumEventScheduleApiShape | null;
  eventDate?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}): { value: AlbumEventScheduleValue; displayLabel: string } {
  if (data.eventSchedule) {
    const s = data.eventSchedule;
    const value: AlbumEventScheduleValue = {
      eventDate: s.eventDate || "",
      eventStartTime: s.eventStartTime || "",
      eventEndTime: s.eventEndTime || "",
    };
    return {
      value,
      displayLabel:
        s.displayLabel ||
        formatAlbumEventScheduleDisplay({
          eventDate: value.eventDate,
          eventStartTime: value.eventStartTime,
          eventEndTime: value.eventEndTime,
        }),
    };
  }

  const built = buildAlbumEventScheduleFromDb({
    eventDate: data.eventDate ? new Date(data.eventDate) : null,
    startsAt: data.startsAt ? new Date(data.startsAt) : null,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
  });

  return {
    value: {
      eventDate: built.eventDate,
      eventStartTime: built.eventStartTime,
      eventEndTime: built.eventEndTime,
    },
    displayLabel: built.displayLabel,
  };
}

export function albumEventScheduleToApiPayload(value: AlbumEventScheduleValue) {
  return {
    eventDate: value.eventDate.trim() || null,
    eventStartTime: value.eventStartTime.trim() || null,
    eventEndTime: value.eventEndTime.trim() || null,
  };
}

export function displayLabelForAlbumEventSchedule(value: AlbumEventScheduleValue): string {
  return formatAlbumEventScheduleDisplay({
    eventDate: value.eventDate,
    eventStartTime: value.eventStartTime,
    eventEndTime: value.eventEndTime,
  });
}

export function displayLabelFromAlbumRow(album: {
  eventDate?: string | null;
  startsAt?: string | Date | null;
  endsAt?: string | Date | null;
}): string {
  if (!album.eventDate && !album.startsAt) return "";
  return buildAlbumEventScheduleFromDb({
    eventDate: album.eventDate ? new Date(album.eventDate) : null,
    startsAt: album.startsAt ? new Date(album.startsAt) : null,
    endsAt: album.endsAt ? new Date(album.endsAt) : null,
  }).displayLabel;
}

type Props = {
  value: AlbumEventScheduleValue;
  onChange: (value: AlbumEventScheduleValue) => void;
  disabled?: boolean;
  readOnly?: boolean;
};

export default function AlbumEventScheduleFields({
  value,
  onChange,
  disabled = false,
  readOnly = false,
}: Props) {
  const fieldsDisabled = disabled || readOnly;

  function patch(partial: Partial<AlbumEventScheduleValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="ds-form-stack w-full gap-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-[#1a1a1a]">Fecha del evento</span>
        {readOnly ? (
          <div className="rounded-lg border border-[#e5e7eb] bg-gray-50 px-3 py-2 text-sm">
            {value.eventDate || "—"}
          </div>
        ) : (
          <Input
            type="date"
            value={value.eventDate}
            onChange={(e) => patch({ eventDate: e.target.value })}
            disabled={fieldsDisabled}
            className="w-full"
          />
        )}
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[#1a1a1a]">Hora de inicio</span>
          {readOnly ? (
            <div className="rounded-lg border border-[#e5e7eb] bg-gray-50 px-3 py-2 text-sm">
              {value.eventStartTime || "—"}
            </div>
          ) : (
            <Input
              type="time"
              value={value.eventStartTime}
              onChange={(e) => patch({ eventStartTime: e.target.value })}
              disabled={fieldsDisabled}
              className="w-full"
            />
          )}
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[#1a1a1a]">Hora de finalización</span>
          {readOnly ? (
            <div className="rounded-lg border border-[#e5e7eb] bg-gray-50 px-3 py-2 text-sm">
              {value.eventEndTime || "—"}
            </div>
          ) : (
            <Input
              type="time"
              value={value.eventEndTime}
              onChange={(e) => patch({ eventEndTime: e.target.value })}
              disabled={fieldsDisabled}
              className="w-full"
            />
          )}
        </label>
      </div>

      <p className="text-xs text-[#6b7280] m-0 leading-relaxed">
        {readOnly
          ? "Este horario proviene del evento asociado y no puede modificarse desde el álbum."
          : "Estos horarios podrán utilizarse para asignar automáticamente fotografías recibidas mediante FTP Directo."}
      </p>
    </div>
  );
}
