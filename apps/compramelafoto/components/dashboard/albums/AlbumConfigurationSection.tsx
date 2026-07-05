"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EventLocationSearch from "@/components/organizer/EventLocationSearch";
import AlbumEventScheduleFields, {
  type AlbumEventScheduleValue,
} from "@/components/dashboard/albums/AlbumEventScheduleFields";
import { albumModeOptions } from "@/lib/albums/album-mode-options";
import type { AlbumNextStepsMode } from "@/components/dashboard/albums/AlbumNextSteps";

export type AlbumConfigurationSectionProps = {
  albumId: number;
  eventId?: number | null;
  lockEventFields: boolean;
  title: string;
  location: string;
  eventSchedule: AlbumEventScheduleValue;
  isPublic: boolean;
  hiddenPhotosEnabled: boolean;
  hiddenSelfieRetentionDays: string;
  showComingSoonMessage: boolean;
  albumMode: AlbumNextStepsMode;
  albumModeSaving: boolean;
  saving: boolean;
  photographerHandler?: string | null;
  onTitleChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onEventScheduleChange: (value: AlbumEventScheduleValue) => void;
  onIsPublicChange: (value: boolean) => void;
  onHiddenPhotosChange: (value: boolean) => void;
  onHiddenSelfieRetentionChange: (value: string) => void;
  onShowComingSoonChange: (value: boolean) => void;
  onAlbumModeChange: (value: AlbumNextStepsMode) => void;
  onSave: () => void;
  onSaveAlbumMode: () => void;
};

function ConfigBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6">
      <div className="ds-stack-section w-full gap-4">
        <div className="ds-content-container w-full max-w-3xl space-y-1">
          <h3 className="text-base font-semibold text-[#1a1a1a] m-0">{title}</h3>
          {description ? (
            <p className="ds-readable-text ds-readable-text--sm text-[#6b7280] m-0">{description}</p>
          ) : null}
        </div>
        <div className="w-full max-w-2xl">{children}</div>
      </div>
    </Card>
  );
}

export default function AlbumConfigurationSection({
  albumId,
  eventId,
  lockEventFields,
  title,
  location,
  eventSchedule,
  isPublic,
  hiddenPhotosEnabled,
  hiddenSelfieRetentionDays,
  showComingSoonMessage,
  albumMode,
  albumModeSaving,
  saving,
  photographerHandler,
  onTitleChange,
  onLocationChange,
  onEventScheduleChange,
  onIsPublicChange,
  onHiddenPhotosChange,
  onHiddenSelfieRetentionChange,
  onShowComingSoonChange,
  onAlbumModeChange,
  onSave,
  onSaveAlbumMode,
}: AlbumConfigurationSectionProps) {
  return (
    <div className="ds-tab-panel ds-stack-section w-full min-w-0 gap-5">
      <div className="ds-content-container w-full space-y-1">
        <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">Configuración</h2>
        <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-[#6b7280] m-0">
          Datos del álbum, privacidad, tipo operativo y enlaces a ajustes globales de tu cuenta.
        </p>
      </div>

      {lockEventFields ? (
        <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3 text-sm text-[#374151] max-w-2xl">
          <strong className="text-[#1a1a1a]">Vinculado a evento</strong>
          <p className="mt-1 text-[#6b7280] m-0">
            Título, lugar y fecha están definidos por el evento. Configurá ventas y publicación en sus
            áreas correspondientes.
          </p>
        </div>
      ) : null}

      <ConfigBlock title="Datos del álbum" description="Información visible para vos y tus clientes.">
        <div className="ds-form-stack w-full gap-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#1a1a1a]">
              Título <span className="text-[#ef4444]">*</span>
            </span>
            <Input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              disabled={saving || lockEventFields}
              className="w-full"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-[#1a1a1a]">Lugar</span>
            {lockEventFields ? (
              <div className="rounded-lg border border-[#e5e7eb] bg-gray-50 px-3 py-2 text-sm">
                {location || "—"}
              </div>
            ) : (
              <EventLocationSearch
                value={location}
                onClear={() => onLocationChange("")}
                onSelect={(_, __, displayName) => onLocationChange(displayName)}
                placeholder="Ej: Teatro Colón, Estadio Monumental"
                className={saving ? "opacity-60 pointer-events-none" : ""}
              />
            )}
          </label>

          <AlbumEventScheduleFields
            value={eventSchedule}
            onChange={onEventScheduleChange}
            disabled={saving}
            readOnly={lockEventFields}
          />
        </div>
      </ConfigBlock>

      <ConfigBlock
        title="Privacidad y acceso"
        description="Controlá quién puede encontrar y acceder al álbum."
      >
        <div className="ds-form-stack w-full gap-4">
          <label className="flex items-start gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 shrink-0"
              checked={isPublic}
              onChange={(e) => onIsPublicChange(e.target.checked)}
              disabled={saving}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[#1a1a1a]">Álbum público</span>
              <span className="mt-0.5 block text-xs text-[#6b7280] leading-relaxed">
                {isPublic
                  ? "Aparece en páginas públicas y puede ser encontrado por cualquier visitante."
                  : "Solo accesible con link directo. No aparece en listados públicos."}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 shrink-0"
              checked={hiddenPhotosEnabled}
              onChange={(e) => onHiddenPhotosChange(e.target.checked)}
              disabled={saving}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[#1a1a1a]">Fotos ocultas hasta selfie</span>
              <span className="mt-0.5 block text-xs text-[#6b7280] leading-relaxed">
                Los visitantes solo ven sus fotos tras verificar identidad con selfie.
                Guardá los cambios y probá el álbum en una ventana privada o con{" "}
                <span className="font-medium">?vista=cliente</span> en el link.
              </span>
            </span>
          </label>

          {hiddenPhotosEnabled ? (
            <label className="block space-y-1.5 pl-1">
              <span className="text-xs font-medium text-[#6b7280]">Retener selfie (días, opcional)</span>
              <Input
                type="number"
                min={0}
                max={365}
                placeholder="0 = no guardar"
                value={hiddenSelfieRetentionDays}
                onChange={(e) => onHiddenSelfieRetentionChange(e.target.value)}
                disabled={saving}
                className="w-full max-w-[140px]"
              />
            </label>
          ) : null}

          <label className="flex items-start gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 shrink-0"
              checked={showComingSoonMessage}
              onChange={(e) => onShowComingSoonChange(e.target.checked)}
              disabled={saving}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[#1a1a1a]">
                Mensaje &quot;fotos próximamente&quot;
              </span>
              <span className="mt-0.5 block text-xs text-[#6b7280] leading-relaxed">
                Si no hay fotos, los clientes pueden dejar email para recibir aviso.
              </span>
            </span>
          </label>
        </div>
      </ConfigBlock>

      <ConfigBlock title="Tipo de álbum" description="Define el flujo operativo del workspace.">
        <div className="ds-form-stack w-full gap-3">
          <select
            value={albumMode}
            onChange={(e) => onAlbumModeChange(e.target.value as AlbumNextStepsMode)}
            disabled={albumModeSaving}
            className="w-full max-w-md rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-sm"
          >
            {albumModeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-[#6b7280] m-0">
            {albumModeOptions.find((o) => o.value === albumMode)?.description}
          </p>
          <Button
            variant="secondary"
            size="md"
            className="w-fit whitespace-nowrap"
            onClick={onSaveAlbumMode}
            disabled={albumModeSaving}
          >
            {albumModeSaving ? "Guardando…" : "Guardar tipo de álbum"}
          </Button>
        </div>
      </ConfigBlock>

      <ConfigBlock
        title="Cuenta y branding"
        description="Ajustes globales que aplican a todos tus álbumes."
      >
        <ul className="m-0 p-0 list-none space-y-2">
          <li>
            <Link
              href="/fotografo/configuracion?tab=mercadopago"
              className="text-sm font-medium text-[#c27b3d] hover:underline"
            >
              Mercado Pago y cobros →
            </Link>
          </li>
          <li>
            <Link
              href="/fotografo/configuracion?tab=diseno"
              className="text-sm font-medium text-[#c27b3d] hover:underline"
            >
              Diseño y página pública →
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/sales-settings"
              className="text-sm font-medium text-[#c27b3d] hover:underline"
            >
              Productos y adicionales globales →
            </Link>
          </li>
          {photographerHandler ? (
            <li>
              <Link
                href={`/${photographerHandler}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[#c27b3d] hover:underline"
              >
                Ver landing pública (@{photographerHandler}) →
              </Link>
            </li>
          ) : null}
        </ul>
      </ConfigBlock>

      <div className="flex flex-wrap gap-3 pt-1">
        <Button
          variant="primary"
          size="md"
          className="whitespace-nowrap"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Guardando…" : "Guardar configuración"}
        </Button>
        <Link href={`/dashboard/albums/${albumId}?tab=publicacion`} prefetch={false}>
          <Button type="button" variant="secondary" size="md" className="whitespace-nowrap">
            Ir a publicación
          </Button>
        </Link>
      </div>
    </div>
  );
}
