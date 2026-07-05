"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import EventInvitePhotographers, {
  type PhotographerOption,
} from "@/components/organizer/EventInvitePhotographers";
import PhotographerConvocatoriaSection from "@/components/organizer/PhotographerConvocatoriaSection";
import EventOrganizerCommissionSection from "@/components/organizer/EventOrganizerCommissionSection";
import EventAccreditationNotesField from "@/components/organizer/EventAccreditationNotesField";
import EventPhotoPricingSection from "@/components/organizer/EventPhotoPricingSection";
import {
  visibilityAndJoinPolicyForConvocatoria,
  type InviteListVisibility,
  type PhotographerConvocatoriaMode,
} from "@/lib/organizer-event-convocatoria";
import { MAX_EVENT_ORGANIZER_COMMISSION_PERCENT } from "@/lib/event-organizer-commission";
import { EventPhotoPricingMode } from "@/lib/prisma";

const EventLocationMap = dynamic(
  () => import("@/components/organizer/EventLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg bg-gray-200 h-[280px] flex items-center justify-center text-gray-500 text-sm">
        Cargando mapa…
      </div>
    ),
  }
);
const EventLocationSearch = dynamic(() => import("@/components/organizer/EventLocationSearch"), {
  ssr: false,
});

const EVENT_TYPES = [
  { value: "PUBLIC_SESSION", label: "Sesión pública" },
  { value: "PRIVATE_SESSION", label: "Sesión privada" },
  { value: "SPORTS", label: "Evento deportivo" },
  { value: "PUBLIC_PHOTOGRAPHY", label: "Fotografías públicas" },
  { value: "THEMATIC_SESSIONS", label: "Sesiones temáticas" },
  { value: "COMMERCIAL_SESSIONS", label: "Sesiones comerciales" },
  { value: "SCHOOL", label: "Eventos escolares" },
  { value: "RELIGIOUS", label: "Eventos religiosos" },
  { value: "FESTIVAL", label: "Festival / Fiesta popular" },
  { value: "CONFERENCE", label: "Conferencia / Charla" },
  { value: "CONCERT", label: "Recital / Concierto" },
  { value: "CORPORATE", label: "Corporativo" },
  { value: "OTHER", label: "Otro" },
];

const STEP_LABELS = [
  "Datos básicos",
  "Ubicación",
  "Convocatoria",
  "Acreditación",
  "Venta digital",
  "Comisión",
  "Carpetas sugeridas",
  "Revisión",
];

const PRESET_FOLDER_NAMES = ["Cancha 1", "Cancha 2", "Premiación", "Final"];

const TOTAL_STEPS = STEP_LABELS.length;

export default function OrganizerNewEventWizard() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("PUBLIC_SESSION");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [city, setCity] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");

  const [convocatoriaMode, setConvocatoriaMode] = useState<PhotographerConvocatoriaMode>("open");
  const [inviteListVisibility, setInviteListVisibility] = useState<InviteListVisibility>("UNLISTED");
  const [invitedPhotographers, setInvitedPhotographers] = useState<PhotographerOption[]>([]);
  const [preEnrolledPhotographers, setPreEnrolledPhotographers] = useState<PhotographerOption[]>([]);
  const [maxPhotographers, setMaxPhotographers] = useState("");
  const [expectedAttendees, setExpectedAttendees] = useState("");

  const [accreditationNotes, setAccreditationNotes] = useState("");
  const [inviteOnlyProceed, setInviteOnlyProceed] = useState(false);

  const [photoPricingMode, setPhotoPricingMode] = useState<EventPhotoPricingMode>(
    EventPhotoPricingMode.PHOTOGRAPHER_DECIDES
  );

  const [organizerCommissionEnabled, setOrganizerCommissionEnabled] = useState(false);
  const [organizerCommissionPercentage, setOrganizerCommissionPercentage] = useState("");

  const [presetFolders, setPresetFolders] = useState<Record<string, boolean>>(() =>
    PRESET_FOLDER_NAMES.reduce<Record<string, boolean>>((acc, n) => {
      acc[n] = false;
      return acc;
    }, {})
  );

  const progressPct = useMemo(() => ((step + 1) / TOTAL_STEPS) * 100, [step]);

  function validateStepsUpTo(lastStepIdx: number): string | null {
    if (lastStepIdx >= 0) {
      if (!title.trim()) return "El nombre del evento es obligatorio.";
      const dStart = startsAt ? new Date(startsAt) : null;
      if (!startsAt || !dStart || isNaN(dStart.getTime())) return "La fecha de inicio no es válida.";
    }
    if (lastStepIdx >= 1) {
      if (!city.trim()) {
        return "Seleccioná un lugar en el mapa o en la búsqueda para detectar la ciudad del evento.";
      }
    }
    if (lastStepIdx >= 2) {
      if (maxPhotographers.trim() !== "") {
        const cupo = parseInt(maxPhotographers, 10);
        if (!Number.isFinite(cupo) || cupo < 1) return "Si indicás cupo, debe ser un número mayor a cero.";
      }
      if (expectedAttendees.trim() !== "") {
        const a = parseInt(expectedAttendees, 10);
        if (!Number.isFinite(a) || a < 1) return "Asistentes aproximados: número inválido.";
      }
    }
    if (lastStepIdx >= 5) {
      if (organizerCommissionEnabled) {
        const p = parseFloat(organizerCommissionPercentage.replace(",", "."));
        if (!Number.isFinite(p) || p <= 0 || p > MAX_EVENT_ORGANIZER_COMMISSION_PERCENT) {
          return `Comisión activa: indicá un porcentaje mayor a 0 y hasta ${MAX_EVENT_ORGANIZER_COMMISSION_PERCENT}.`;
        }
      }
    }
    return null;
  }

  function goNext() {
    setStepError(null);
    setError(null);
    const blocked = validateStepsUpTo(step);
    if (blocked) {
      setStepError(blocked);
      return;
    }
    if (step === 2 && convocatoriaMode === "invite_only" && invitedPhotographers.length === 0 && !inviteOnlyProceed) {
      setStepError(
        "Convocatoria sólo por invitación sin invitados. Marcá la confirmación para continuar, o cargá fotógrafos."
      );
      return;
    }
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
  }

  function goBack() {
    setStepError(null);
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function submitWizard() {
    setError(null);
    const finalErr = validateStepsUpTo(TOTAL_STEPS - 1);
    if (finalErr) {
      setError(finalErr);
      return;
    }
    if (organizerCommissionEnabled) {
      const p = parseFloat(organizerCommissionPercentage.replace(",", "."));
      if (
        !Number.isFinite(p) ||
        p <= 0 ||
        p > MAX_EVENT_ORGANIZER_COMMISSION_PERCENT
      ) {
        setError(
          `Indicá un porcentaje de comisión mayor que 0 y hasta ${MAX_EVENT_ORGANIZER_COMMISSION_PERCENT}%.`
        );
        return;
      }
    }
    setSaving(true);
    try {
      const lat = latitude ? parseFloat(latitude) : 0;
      const lng = longitude ? parseFloat(longitude) : 0;
      const { visibility, joinPolicy } = visibilityAndJoinPolicyForConvocatoria(
        convocatoriaMode,
        inviteListVisibility
      );
      const res = await fetch("/api/organizer/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          accreditationNotes: accreditationNotes.trim() || null,
          type,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          city: city.trim(),
          locationName: locationName.trim() || null,
          latitude: Number.isFinite(lat) ? lat : 0,
          longitude: Number.isFinite(lng) ? lng : 0,
          maxPhotographers: maxPhotographers ? parseInt(maxPhotographers, 10) : null,
          expectedAttendees: expectedAttendees ? parseInt(expectedAttendees, 10) : null,
          visibility,
          joinPolicy,
          invitedUserIds: convocatoriaMode === "invite_only" ? invitedPhotographers.map((p) => p.id) : [],
          organizerCommissionEnabled,
          organizerCommissionPercentage: organizerCommissionEnabled
            ? parseFloat(organizerCommissionPercentage.replace(",", "."))
            : null,
          photoPricingMode,
          minimumPhotoPrice: null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al crear el evento");
        setSaving(false);
        return;
      }
      if (typeof data.id === "number" && preEnrolledPhotographers.length > 0) {
        await Promise.all(
          preEnrolledPhotographers.map((photographer) =>
            fetch(`/api/organizer/events/${data.id}/members`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: photographer.id }),
            }).catch(() => null)
          )
        );
      }
      const ids = PRESET_FOLDER_NAMES.filter((n) => presetFolders[n]);
      if (typeof data.id === "number" && ids.length > 0) {
        await Promise.all(
          ids.map((name) =>
            fetch(`/api/organizer/events/${data.id}/folders`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            }).catch(() => null)
          )
        );
      }
      router.push(`/organizador/events/${data.id}?tab=carpetas`);
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  function renderStep(): React.ReactNode {
    switch (step) {
      case 0:
        return (
          <div className="clf-form-section min-w-0">
            <p className="clf-form-description m-0">
              Nombre, tipo y fecha/hora inicial. Podés cambiar más detalle luego desde la página del evento.
            </p>
            <div className="clf-form-field-stack">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del evento *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Maratón Ciudad 2025"
                disabled={saving}
                className="w-full max-w-full box-border"
              />
            </div>
            <div className="clf-form-field-stack">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción corta</label>
              <Textarea
                className="text-sm"
                rows={3}
                value={description}
                disabled={saving}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="clf-form-field-stack">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de evento</label>
              <select
                className="w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/35 box-border"
                value={type}
                disabled={saving}
                onChange={(e) => setType(e.target.value)}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="clf-form-grid clf-form-grid--2">
              <div className="clf-form-field-stack min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">Inicio *</label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  disabled={saving}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full max-w-full box-border"
                />
              </div>
              <div className="clf-form-field-stack min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin (opcional)</label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  disabled={saving}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full max-w-full box-border"
                />
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4 min-w-0">
            <p className="ds-readable-text ds-readable-text--fluid text-xs text-gray-500 m-0">
              Buscá el lugar para autocompletar coordenadas y ciudad, o ubicá el pin en el mapa.
            </p>
            {(latitude && longitude && (parseFloat(latitude) !== 0 || parseFloat(longitude) !== 0)) &&
            locationName ? (
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Lugar seleccionado</p>
                  <p className="text-sm text-gray-800 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 m-0">
                    {locationName}
                  </p>
                </div>
                {city.trim() ? (
                  <p className="text-sm text-gray-700 m-0">
                    <span className="font-medium text-gray-800">Ciudad:</span> {city.trim()}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="w-full min-w-0 mb-2">
              <EventLocationSearch
                placeholder="Ej. Teatro Colón, Estadio Monumental"
                onSelect={(lat, lon, displayName, selectedCity) => {
                  setLatitude(String(lat));
                  setLongitude(String(lon));
                  if (displayName) setLocationName(displayName);
                  if (selectedCity) setCity(selectedCity);
                }}
              />
            </div>
            <EventLocationMap
              latitude={latitude ? parseFloat(latitude) : 0}
              longitude={longitude ? parseFloat(longitude) : 0}
              editable
              onPositionChange={async (lat, lng) => {
                setLatitude(String(lat));
                setLongitude(String(lng));
                try {
                  const res = await fetch(`/api/geocode/reverse?lat=${lat}&lon=${lng}`);
                  if (res.ok) {
                    const data = await res.json();
                    if (data.display_name) setLocationName(data.display_name);
                    if (data.city) setCity(data.city);
                  }
                } catch {
                  /* ignorar reverse */
                }
              }}
              height="280px"
            />
          </div>
        );
      case 2:
        return (
          <div className="space-y-4 min-w-0">
            <PhotographerConvocatoriaSection
              fieldIdPrefix="wizard-convocatoria"
              mode={convocatoriaMode}
              onModeChange={setConvocatoriaMode}
              inviteVisibility={inviteListVisibility}
              onInviteVisibilityChange={setInviteListVisibility}
              disabled={saving}
            />
            {convocatoriaMode === "invite_only" ? (
              <div className="rounded-3xl border border-amber-200/80 bg-amber-50/50 p-4 space-y-3">
                <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950 m-0">
                  Modo sólo por invitación sin invitados aún: el evento se puede crear igual; conviene cargar invitaciones
                  luego desde el evento.
                </p>
                <label className="flex items-start gap-2 text-sm text-amber-950 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-gray-300"
                    checked={inviteOnlyProceed}
                    onChange={(e) => setInviteOnlyProceed(e.target.checked)}
                  />
                  <span>Sigo igual sin lista de invitados por ahora.</span>
                </label>
                <EventInvitePhotographers
                  value={invitedPhotographers}
                  onChange={setInvitedPhotographers}
                  disabled={saving}
                />
              </div>
            ) : (
              <div className="rounded-3xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3">
                <p className="ds-readable-text ds-readable-text--fluid text-sm text-emerald-950 m-0">
                  Podés inscribir fotógrafos ahora. Al crear el evento quedarán activos y podrán subir fotos.
                </p>
                <EventInvitePhotographers
                  mode="enroll"
                  value={[]}
                  onChange={() => {}}
                  disabled={saving}
                  onEnroll={async (photographer) => {
                    setPreEnrolledPhotographers((prev) =>
                      prev.some((p) => p.id === photographer.id) ? prev : [...prev, photographer]
                    );
                  }}
                  excludeUserIds={preEnrolledPhotographers.map((p) => p.id)}
                  helpText="Los fotógrafos que agregues acá se inscribirán automáticamente al crear el evento."
                />
                {preEnrolledPhotographers.length > 0 ? (
                  <ul className="space-y-1 rounded-lg border border-emerald-200 bg-white p-2 text-sm">
                    {preEnrolledPhotographers.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 px-2 py-1">
                        <span className="truncate">{p.name || p.email}</span>
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:text-red-700 shrink-0"
                          onClick={() =>
                            setPreEnrolledPhotographers((prev) => prev.filter((x) => x.id !== p.id))
                          }
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cupo máximo de fotógrafos (opcional)
              </label>
              <Input
                type="number"
                min={1}
                value={maxPhotographers}
                disabled={saving}
                onChange={(e) => setMaxPhotographers(e.target.value)}
                className="w-full box-border"
              />
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Asistentes aproximados (opcional)
              </label>
              <Input
                type="number"
                min={1}
                value={expectedAttendees}
                disabled={saving}
                onChange={(e) => setExpectedAttendees(e.target.value)}
                className="w-full box-border"
              />
              <p className="ds-readable-text ds-readable-text--fluid text-xs text-gray-500 mt-1 m-0">
                Ayuda al fotógrafo a contextualizar el tamaño del evento.
              </p>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-3 min-w-0">
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-amber-950/95 m-0 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3">
              Recomendado: aclarar acreditación, permisos, horarios de ingreso y seguros en eventos con acceso limitado.
            </p>
            <EventAccreditationNotesField
              fieldIdPrefix="wizard-accreditation"
              value={accreditationNotes}
              onChange={setAccreditationNotes}
              disabled={saving}
            />
          </div>
        );
      case 4:
        return (
          <div className="space-y-3 min-w-0">
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 m-0">
              Elegí la política de precios por evento. Los detalle se pueden revisar después.
            </p>
            <EventPhotoPricingSection
              fieldIdPrefix="wizard-photo-pricing"
              mode={photoPricingMode}
              onModeChange={setPhotoPricingMode}
              disabled={saving}
              pricingFormPhase="create"
            />
          </div>
        );
      case 5:
        return (
          <div className="space-y-3 min-w-0">
            <EventOrganizerCommissionSection
              fieldIdPrefix="wizard-org-commission"
              enabled={organizerCommissionEnabled}
              onEnabledChange={setOrganizerCommissionEnabled}
              percentageInput={organizerCommissionPercentage}
              onPercentageInputChange={setOrganizerCommissionPercentage}
              disabled={saving}
            />
          </div>
        );
      case 6:
        return (
          <div className="space-y-3 min-w-0">
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 m-0">
              Carpetas opcionales vacías (sin jerarquía). Si no marcás ninguna, después creás la estructura con el mismo
              explorador de siempre.
            </p>
            <ul className="m-0 p-0 list-none space-y-2">
              {PRESET_FOLDER_NAMES.map((n) => (
                <li key={n}>
                  <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={presetFolders[n] ?? false}
                      disabled={saving}
                      onChange={(e) =>
                        setPresetFolders((prev) => ({
                          ...prev,
                          [n]: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300"
                    />
                    <span>{n}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        );
      case 7:
        return (
          <div className="space-y-4 min-w-0 text-sm text-gray-800">
            <ul className="ds-readable-text ds-readable-text--fluid space-y-2 m-0 pl-5">
              <li>
                <strong>Título:</strong> {title.trim() || "—"}
              </li>
              <li>
                <strong>Inicio:</strong> {startsAt || "—"} {endsAt ? <>· Fin: {endsAt}</> : null}
              </li>
              <li>
                <strong>Ciudad:</strong> {city.trim() || "—"}
                {locationName ? <> · Lugar: {locationName}</> : null}
              </li>
              <li>
                <strong>Convocatoria:</strong>{" "}
                {convocatoriaMode === "open"
                  ? "Abierta"
                  : convocatoriaMode === "approval"
                    ? "Con aprobación"
                    : "Sólo por invitación"}
                {convocatoriaMode === "invite_only"
                  ? ` · ${invitedPhotographers.length} invitaciones`
                  : ""}
              </li>
              <li>
                <strong>Venta digital:</strong>{" "}
                {photoPricingMode === EventPhotoPricingMode.PHOTOGRAPHER_DECIDES
                  ? "Cada fotógrafo define precios"
                  : "Políticas oficiales del evento"}
              </li>
              <li>
                <strong>Comisión organizador:</strong>{" "}
                {organizerCommissionEnabled ? `Sí · ${organizerCommissionPercentage}%` : "No"}
              </li>
              <li>
                <strong>Carpetas opcionales:</strong>{" "}
                {PRESET_FOLDER_NAMES.filter((n) => presetFolders[n]).join(", ") || "Ninguna"}
              </li>
            </ul>
            {accreditationNotes.trim() === "" ? (
              <p className="ds-readable-text ds-readable-text--fluid text-amber-900 m-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                Pendiente sugerido: texto de acreditación vacío — podés agregarlo luego desde el evento (solapa
                Convocatoria).
              </p>
            ) : null}
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <Card className="clf-wizard-root clf-wizard-card p-5 sm:p-6 w-full min-w-0 ds-card">
      <nav className="clf-wizard-stepper mb-4" aria-label="Progreso del asistente">
        <ol className="clf-wizard-stepper__list m-0 p-0 list-none">
          {STEP_LABELS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li
                key={label}
                className={`clf-wizard-stepper__item text-center ${current ? "opacity-100" : done ? "opacity-70" : "opacity-40"}`}
              >
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    current
                      ? "bg-[#c27b3d] text-white shadow-sm"
                      : done
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-gray-200 text-gray-600"
                  }`}
                  aria-hidden
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className="hidden sm:block text-[10px] font-semibold text-gray-600 leading-tight mt-1 px-0.5">
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="min-w-0 space-y-1 mb-4">
        <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide m-0">
          Paso {step + 1} de {TOTAL_STEPS}
        </p>
        <h2 className="text-xl font-bold text-[#111827] m-0">{STEP_LABELS[step]}</h2>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden mt-2" aria-hidden>
          <div
            className="h-full bg-[#c27b3d] transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 text-sm mb-4" role="alert">
          {error}
        </div>
      ) : null}
      {stepError ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 text-sm mb-4" role="alert">
          {stepError}
        </div>
      ) : null}

      <div className="py-2 min-w-0">{renderStep()}</div>

      <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-between gap-3 pt-6 border-t border-gray-100">
        <Link href="/organizador/dashboard">
          <Button type="button" variant="secondary" className="w-full sm:w-auto shrink-0" disabled={saving}>
            Cancelar
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button type="button" variant="outline" className="shrink-0" disabled={step === 0 || saving} onClick={goBack}>
            Atrás
          </Button>
          {step < TOTAL_STEPS - 1 ? (
            <Button type="button" variant="primary" className="shrink-0" disabled={saving} onClick={goNext}>
              Siguiente
            </Button>
          ) : (
            <Button type="button" variant="primary" className="shrink-0" disabled={saving} onClick={() => void submitWizard()}>
              {saving ? "Creando…" : "Crear evento"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
