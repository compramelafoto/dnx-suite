"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import OrganizerHeader from "@/components/organizer/OrganizerHeader";
import EventInvitePhotographers, { type PhotographerOption } from "@/components/organizer/EventInvitePhotographers";
import EventPhotographersMembersPanel from "@/components/organizer/EventPhotographersMembersPanel";
import PhotographerConvocatoriaSection from "@/components/organizer/PhotographerConvocatoriaSection";
import OrganizerEventSummaryCards from "@/components/organizer/OrganizerEventSummaryCards";
import EventOrganizerCommissionSection from "@/components/organizer/EventOrganizerCommissionSection";
import EventAccreditationNotesField from "@/components/organizer/EventAccreditationNotesField";
import EventPhotoPricingSection from "@/components/organizer/EventPhotoPricingSection";
import EventFoldersSection from "@/components/organizer/EventFoldersSection";
import {
  OrganizerEventEditTabBar,
  ORGANIZER_EVENT_EDIT_FORM_TAB_IDS,
  useOrganizerEventEditTabId,
} from "@/components/organizer/OrganizerEventEditTabs";
import {
  convocatoriaModeFromEvent,
  visibilityAndJoinPolicyForConvocatoria,
  type InviteListVisibility,
  type PhotographerConvocatoriaMode,
} from "@/lib/organizer-event-convocatoria";
import { MAX_EVENT_ORGANIZER_COMMISSION_PERCENT } from "@/lib/event-organizer-commission";
import {
  eventPhotoPricingOrganizerSummary,
  MAX_EVENT_PHOTO_PRICE_ARS,
  MIN_EVENT_PHOTO_PRICE_ARS,
  normalizedPricingFromEventDb,
} from "@/lib/event-photo-pricing";
import { EventPhotoPricingMode } from "@/lib/prisma";
import { ensureOrganizerSession } from "@/lib/organizer-session-client";
import { DsDashboardInner, DsInfoPanel, DsPageShell } from "@/components/ui/DsLayout";

const EventLocationMap = dynamic(
  () => import("@/components/organizer/EventLocationMap"),
  { ssr: false, loading: () => <div className="rounded-lg bg-gray-200 h-[280px] flex items-center justify-center text-gray-500 text-sm">Cargando mapa…</div> }
);
const EventLocationSearch = dynamic(
  () => import("@/components/organizer/EventLocationSearch"),
  { ssr: false }
);

function formatDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

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
  { value: "WEDDING", label: "Boda (legacy)" },
  { value: "BIRTHDAY", label: "Cumpleaños (legacy)" },
  { value: "GRADUATION", label: "Graduación (legacy)" },
];

type InvitedPhotographer = {
  userId: number;
  name: string | null;
  email: string;
  companyName: string | null;
  phone: string | null;
};

type EventData = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  startsAt: string;
  endsAt: string | null;
  latitude: number;
  longitude: number;
  locationName: string | null;
  city: string;
  visibility: string;
  joinPolicy: string;
  uploadsEnabled: boolean;
  photographerTerms: string | null;
  maxPhotographers: number | null;
  expectedAttendees: number | null;
  accreditationNotes: string | null;
  shareSlug: string | null;
  coverImageKey: string | null;
  coverUrl: string | null;
  albumsCount: number;
  membersCount: number;
  invitedPhotographers?: InvitedPhotographer[];
  organizerCommissionEnabled?: boolean;
  organizerCommissionPercentage?: number | null;
  organizerCommissionUpdatedAt?: string | null;
  organizerCommissionUpdatedById?: number | null;
  photoPricingMode?: EventPhotoPricingMode | string;
  fixedPhotoPrice?: number | null;
  minimumPhotoPrice?: number | null;
  photoPricingUpdatedAt?: string | null;
  photoPricingUpdatedById?: number | null;
};

type EventMemberRow = {
  id: number;
  userId: number;
  name: string | null;
  email: string;
  phone?: string | null;
  whatsapp?: string | null;
  status: string;
  role: string;
  createdAt: string;
  termsAcceptedAt?: string | null;
};

type AllowanceSummary = {
  photographersWithPhotos: number;
  maxDownloads: number;
  usedDownloads?: number;
  remainingDownloads?: number;
};

type OrganizerPhoto = {
  id: number;
  previewUrl: string | null;
  albumId: number;
  albumSlug: string | null;
  photographerName: string | null;
};

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const eventId = parseInt(id, 10);

  const [session, setSession] = useState<{ organizerId: number; name?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingShare, setGeneratingShare] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [event, setEvent] = useState<EventData | null>(null);
  const [eventPhotos, setEventPhotos] = useState<OrganizerPhoto[]>([]);
  const [allowance, setAllowance] = useState<AllowanceSummary | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accreditationNotes, setAccreditationNotes] = useState("");
  const [photographerTerms, setPhotographerTerms] = useState("");
  const [uploadsEnabled, setUploadsEnabled] = useState(false);
  const [eventStatus, setEventStatus] = useState("ACTIVE");
  const [type, setType] = useState("OTHER");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [city, setCity] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [maxPhotographers, setMaxPhotographers] = useState("");
  const [expectedAttendees, setExpectedAttendees] = useState("");
  const [convocatoriaMode, setConvocatoriaMode] = useState<PhotographerConvocatoriaMode>("open");
  const [inviteListVisibility, setInviteListVisibility] = useState<InviteListVisibility>("UNLISTED");
  const [invitedPhotographers, setInvitedPhotographers] = useState<PhotographerOption[]>([]);
  const [organizerCommissionEnabled, setOrganizerCommissionEnabled] = useState(false);
  const [organizerCommissionPercentage, setOrganizerCommissionPercentage] = useState("");
  const [photoPricingMode, setPhotoPricingMode] = useState<EventPhotoPricingMode>(
    EventPhotoPricingMode.PHOTOGRAPHER_DECIDES
  );
  const [minimumPhotoPriceInput, setMinimumPhotoPriceInput] = useState("");
  const [eventMembers, setEventMembers] = useState<EventMemberRow[]>([]);
  const [actingMemberId, setActingMemberId] = useState<number | null>(null);
  const [enrollingUserId, setEnrollingUserId] = useState<number | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const editTab = useOrganizerEventEditTabId();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function refreshEventMembers() {
    if (!Number.isFinite(eventId)) return;
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/members`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => []);
      setEventMembers(Array.isArray(data) ? data : []);
    } catch {
      /* ignore */
    }
  }

  async function handleApproveMember(memberRowId: number) {
    setError(null);
    setMessage(null);
    setActingMemberId(memberRowId);
    try {
      const res = await fetch(
        `/api/organizer/events/${eventId}/members/${memberRowId}/approve`,
        { method: "POST", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo aprobar");
        setActingMemberId(null);
        return;
      }
      setMessage(data.message || "Fotógrafo aprobado.");
      setTimeout(() => setMessage(null), 4000);
      await refreshEventMembers();
      const resAlbums = await fetch(`/api/organizer/events/${eventId}/albums`, {
        credentials: "include",
      });
      if (resAlbums.ok) {
        const albumsPayload = await resAlbums.json().catch(() => null);
        if (albumsPayload?.allowance != null) {
          setAllowance(albumsPayload.allowance);
        }
      }
    } catch {
      setError("Error de conexión");
    }
    setActingMemberId(null);
  }

  async function handleRejectMember(memberRowId: number) {
    setError(null);
    setMessage(null);
    setActingMemberId(memberRowId);
    try {
      const res = await fetch(
        `/api/organizer/events/${eventId}/members/${memberRowId}/reject`,
        { method: "POST", credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo rechazar");
        setActingMemberId(null);
        return;
      }
      setMessage(data.message || "Solicitud rechazada.");
      setTimeout(() => setMessage(null), 4000);
      await refreshEventMembers();
    } catch {
      setError("Error de conexión");
    }
    setActingMemberId(null);
  }

  async function handleEnrollPhotographer(photographer: PhotographerOption) {
    setError(null);
    setMessage(null);
    setEnrollingUserId(photographer.id);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: photographer.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo inscribir al fotógrafo");
        return;
      }
      setMessage(data.message || "Fotógrafo inscripto.");
      setTimeout(() => setMessage(null), 4000);
      await refreshEventMembers();
      const resAlbums = await fetch(`/api/organizer/events/${eventId}/albums`, {
        credentials: "include",
      });
      if (resAlbums.ok) {
        const albumsPayload = await resAlbums.json().catch(() => null);
        if (albumsPayload?.allowance != null) {
          setAllowance(albumsPayload.allowance);
        }
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setEnrollingUserId(null);
    }
  }

  const enrolledOrPendingUserIds = useMemo(
    () =>
      eventMembers
        .filter((m) => m.status === "ACTIVE" || m.status === "PENDING")
        .map((m) => m.userId),
    [eventMembers]
  );

  useEffect(() => {
    let active = true;
    async function init() {
      const s = await ensureOrganizerSession();
      if (!active) return;
      if (!s) {
        router.push("/login");
        return;
      }
      setSession(s);
      if (!Number.isFinite(eventId)) {
        setError("Evento no encontrado");
        setLoading(false);
        return;
      }
      try {
        const [resEvent, resAlbums, resPhotos, resMembers] = await Promise.all([
          fetch(`/api/organizer/events/${eventId}`, { credentials: "include" }),
          fetch(`/api/organizer/events/${eventId}/albums`, { credentials: "include" }),
          fetch(`/api/organizer/events/${eventId}/photos`, { credentials: "include" }),
          fetch(`/api/organizer/events/${eventId}/members`, { credentials: "include" }),
        ]);
        if (!resEvent.ok) {
          if (resEvent.status === 401) {
            router.push("/login");
            return;
          }
          setError("Evento no encontrado");
          setLoading(false);
          return;
        }
        const eventData = await resEvent.json();
        setEvent(eventData);
        setTitle(eventData.title);
        setDescription(eventData.description || "");
        setAccreditationNotes(eventData.accreditationNotes || "");
        setPhotographerTerms(eventData.photographerTerms || "");
        setUploadsEnabled(Boolean(eventData.uploadsEnabled));
        setEventStatus(eventData.status || "ACTIVE");
        setType(eventData.type);
        setStartsAt(eventData.startsAt ? formatDateTimeLocal(eventData.startsAt) : "");
        setEndsAt(eventData.endsAt ? formatDateTimeLocal(eventData.endsAt) : "");
        setCity(eventData.city || "");
        setLocationName(eventData.locationName || "");
        setLatitude(String(eventData.latitude ?? ""));
        setLongitude(String(eventData.longitude ?? ""));
        setMaxPhotographers(eventData.maxPhotographers != null ? String(eventData.maxPhotographers) : "");
        setExpectedAttendees(eventData.expectedAttendees != null ? String(eventData.expectedAttendees) : "");
        const conv = convocatoriaModeFromEvent(eventData.visibility, eventData.joinPolicy);
        setConvocatoriaMode(conv.mode);
        setInviteListVisibility(conv.inviteVisibility);
        setOrganizerCommissionEnabled(Boolean(eventData.organizerCommissionEnabled));
        setOrganizerCommissionPercentage(
          eventData.organizerCommissionPercentage != null &&
            Number.isFinite(Number(eventData.organizerCommissionPercentage))
            ? String(eventData.organizerCommissionPercentage)
            : ""
        );
        const loadedMode =
          eventData.photoPricingMode === EventPhotoPricingMode.ORGANIZER_FIXED
            ? EventPhotoPricingMode.ORGANIZER_FIXED
            : eventData.photoPricingMode === EventPhotoPricingMode.ORGANIZER_MINIMUM
              ? EventPhotoPricingMode.ORGANIZER_MINIMUM
              : EventPhotoPricingMode.PHOTOGRAPHER_DECIDES;
        setPhotoPricingMode(loadedMode);
        setMinimumPhotoPriceInput(
          eventData.minimumPhotoPrice != null && Number.isFinite(Number(eventData.minimumPhotoPrice))
            ? String(eventData.minimumPhotoPrice)
            : ""
        );
        const inv = eventData.invitedPhotographers ?? [];
        setInvitedPhotographers(
          inv.map((p: InvitedPhotographer) => ({
            id: p.userId,
            name: p.name ?? undefined,
            email: p.email,
            companyName: p.companyName ?? undefined,
            phone: p.phone ?? undefined,
          }))
        );
        if (resMembers.ok) {
          const membersData = await resMembers.json();
          setEventMembers(Array.isArray(membersData) ? membersData : []);
        } else {
          setEventMembers([]);
        }

        const albumsPayload = resAlbums.ok ? await resAlbums.json() : null;
        setAllowance(albumsPayload?.allowance ?? null);

        if (resPhotos.ok) {
          const photosPayload = await resPhotos.json().catch(() => ({}));
          setEventPhotos(Array.isArray(photosPayload?.photos) ? photosPayload.photos : []);
          if (photosPayload?.allowance) {
            setAllowance(photosPayload.allowance);
          }
        }
      } catch {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [router, eventId]);

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
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
          setSaving(false);
          return;
        }
      }
      if (photoPricingMode === EventPhotoPricingMode.ORGANIZER_MINIMUM) {
        const p = parseFloat(minimumPhotoPriceInput.replace(",", "."));
        if (
          !Number.isFinite(p) ||
          p < MIN_EVENT_PHOTO_PRICE_ARS ||
          p > MAX_EVENT_PHOTO_PRICE_ARS
        ) {
          setError(
            `Indicá un precio mínimo por foto entre $${MIN_EVENT_PHOTO_PRICE_ARS.toLocaleString("es-AR")} y $${MAX_EVENT_PHOTO_PRICE_ARS.toLocaleString("es-AR")}.`
          );
          setSaving(false);
          return;
        }
      }
      const { visibility, joinPolicy } = visibilityAndJoinPolicyForConvocatoria(
        convocatoriaMode,
        inviteListVisibility
      );
      const res = await fetch(`/api/organizer/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            accreditationNotes: accreditationNotes.trim() || null,
            photographerTerms: photographerTerms.trim() || null,
            uploadsEnabled,
            status: eventStatus,
            type,
            startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
            endsAt: endsAt ? new Date(endsAt).toISOString() : null,
            city: city.trim(),
            locationName: locationName.trim() || null,
            latitude: latitude ? parseFloat(latitude) : undefined,
            longitude: longitude ? parseFloat(longitude) : undefined,
            visibility,
            joinPolicy,
            maxPhotographers: maxPhotographers ? parseInt(maxPhotographers, 10) : null,
            expectedAttendees: expectedAttendees ? parseInt(expectedAttendees, 10) : null,
            organizerCommissionEnabled,
            organizerCommissionPercentage: organizerCommissionEnabled
              ? parseFloat(organizerCommissionPercentage.replace(",", "."))
              : null,
            photoPricingMode,
            minimumPhotoPrice:
              photoPricingMode === EventPhotoPricingMode.ORGANIZER_MINIMUM
                ? minimumPhotoPriceInput
                : null,
          }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al guardar");
        setSaving(false);
        return;
      }
      const userIds = convocatoriaMode === "invite_only" ? invitedPhotographers.map((p) => p.id) : [];
      const resInv = await fetch(`/api/organizer/events/${eventId}/invitations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userIds }),
      });
      if (!resInv.ok) {
        const invData = await resInv.json().catch(() => ({}));
        setError(invData.error || "Evento guardado pero falló actualizar invitados");
      }
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              ...data,
              uploadsEnabled,
              photographerTerms: photographerTerms.trim() || null,
              status: eventStatus,
              invitedPhotographers: invitedPhotographers.map((p) => ({
                userId: p.id,
                name: p.name ?? null,
                email: p.email,
                companyName: p.companyName ?? null,
                phone: p.phone ?? null,
              })),
            }
          : null
      );
      if (data.visibility != null && data.joinPolicy != null) {
        const synced = convocatoriaModeFromEvent(String(data.visibility), String(data.joinPolicy));
        setConvocatoriaMode(synced.mode);
        setInviteListVisibility(synced.inviteVisibility);
      }
      setOrganizerCommissionEnabled(Boolean(data.organizerCommissionEnabled));
      setOrganizerCommissionPercentage(
        data.organizerCommissionPercentage != null &&
          Number.isFinite(Number(data.organizerCommissionPercentage))
          ? String(data.organizerCommissionPercentage)
          : ""
      );
      const savedMode =
        data.photoPricingMode === EventPhotoPricingMode.ORGANIZER_FIXED
          ? EventPhotoPricingMode.ORGANIZER_FIXED
          : data.photoPricingMode === EventPhotoPricingMode.ORGANIZER_MINIMUM
            ? EventPhotoPricingMode.ORGANIZER_MINIMUM
            : EventPhotoPricingMode.PHOTOGRAPHER_DECIDES;
      setPhotoPricingMode(savedMode);
      setMinimumPhotoPriceInput(
        data.minimumPhotoPrice != null && Number.isFinite(Number(data.minimumPhotoPrice))
          ? String(data.minimumPhotoPrice)
          : ""
      );
      await refreshEventMembers();
      setMessage("Evento actualizado.");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setError("Error de conexión");
    }
    setSaving(false);
  }

  async function handleOrganizerDownload(photoId: number) {
    setDownloadError(null);
    setDownloadMessage(null);
    setDownloadingPhotoId(photoId);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/downloads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photoId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDownloadError(data.error || "No se pudo descargar la foto.");
        setDownloadingPhotoId(null);
        return;
      }
      if (data?.allowance) {
        setAllowance(data.allowance);
      }
      if (data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        setDownloadMessage("Descarga iniciada en nueva pestaña.");
      } else {
        setDownloadMessage("Descarga registrada.");
      }
    } catch {
      setDownloadError("Error de conexión");
    } finally {
      setDownloadingPhotoId(null);
      setTimeout(() => setDownloadMessage(null), 3000);
    }
  }

  async function handleInvite() {
    setError(null);
    setMessage(null);
    setInviting(true);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/invite`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error || "No pudimos enviar la invitación a los fotógrafos cercanos. Intentá nuevamente."
        );
        setInviting(false);
        return;
      }
      setMessage(
        data.message || "Se envió un email notificando a los fotógrafos cercanos."
      );
      setTimeout(() => setMessage(null), 5000);
    } catch {
      setError("No pudimos enviar la invitación a los fotógrafos cercanos. Intentá nuevamente.");
    }
    setInviting(false);
  }

  async function handleGenerateShareLink() {
    setGeneratingShare(true);
    setError(null);
    try {
      const res = await fetch(`/api/organizer/events/${eventId}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No se pudo generar el link.");
        return;
      }
      setEvent((prev) => (prev ? { ...prev, shareSlug: data.shareSlug ?? prev.shareSlug } : prev));
      setMessage("Link generado.");
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setError("Error de conexión");
    } finally {
      setGeneratingShare(false);
    }
  }

  if (!session && !loading) return null;
  if (loading || !event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <OrganizerHeader organizer={session ? { organizerId: session.organizerId, name: session.name } : null} />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-600">
          {loading ? "Cargando..." : "Evento no encontrado"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <OrganizerHeader organizer={session ? { organizerId: session.organizerId, name: session.name } : null} />
      <DsPageShell className="py-6 md:py-8 flex-1">
        <DsDashboardInner className="flex flex-col gap-6 min-w-0">
        <Link href="/organizador/dashboard" className="text-sm text-gray-600 hover:text-gray-900">
          ← Volver al panel
        </Link>

        {event.coverUrl && (
          <div className="w-full -mx-4 sm:-mx-6 mt-0 mb-6 aspect-[2/1] max-h-[320px] bg-gray-200 overflow-hidden rounded-xl">
            <img src={event.coverUrl} alt="Portada del evento" className="w-full h-full object-cover object-center" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm mb-6">
            {error}
          </div>
        )}
        {downloadError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800 text-sm mb-6">
            {downloadError}
          </div>
        )}
        {downloadMessage && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm mb-6">
            {downloadMessage}
          </div>
        )}
        {message && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm mb-6">
            {message}
          </div>
        )}

        <OrganizerEventEditTabBar active={editTab} />

        {editTab === "resumen" && (
          <>
        <DsInfoPanel title="Comisión del organizador">
          {event.organizerCommissionEnabled === true &&
          event.organizerCommissionPercentage != null &&
          Number(event.organizerCommissionPercentage) > 0 ? (
            <div className="ds-content-container space-y-3">
              <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-800 m-0">
                Tenés activa una comisión del <strong>{Number(event.organizerCommissionPercentage)}%</strong> sobre el{" "}
                <strong>precio base</strong> que define cada fotógrafo por foto (no sobre descuentos ni el total que paga
                el cliente).
              </p>
              <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-700 m-0">
                Después de cada venta con pago aprobado, el importe aparece en{" "}
                <strong className="font-semibold">Comisiones</strong>: primero en espera y, pasados{" "}
                <strong>15 días</strong>, disponible para que solicites el retiro manual (lo procesa el equipo de
                ComprameLaFoto).
              </p>
              {event.organizerCommissionUpdatedAt ? (
                <p className="text-xs text-gray-500 m-0">
                  Última actualización de la configuración:{" "}
                  {new Date(event.organizerCommissionUpdatedAt).toLocaleString("es-AR", {
                    timeZone: "America/Argentina/Buenos_Aires",
                  })}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-600 m-0">
              No hay comisión configurada para las ventas de fotos de este evento.               Podés activarla en la solapa{" "}
              <strong className="font-semibold">Comisión</strong>.
            </p>
          )}
        </DsInfoPanel>

        <DsInfoPanel title="Precio de las fotos">
          <div className="ds-content-container space-y-2">
            <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-800 m-0">
              {eventPhotoPricingOrganizerSummary(normalizedPricingFromEventDb(event))}
            </p>
            {event.photoPricingUpdatedAt ? (
              <p className="text-xs text-gray-500 m-0">
                Última actualización de la regla:{" "}
                {new Date(event.photoPricingUpdatedAt).toLocaleString("es-AR", {
                  timeZone: "America/Argentina/Buenos_Aires",
                })}
              </p>
            ) : null}
          </div>
        </DsInfoPanel>
          </>
        )}

        {editTab === "resumen" && (
          <>
        <h1 className="text-2xl font-bold text-gray-900 w-full min-w-0 break-words">{event.title}</h1>
        <OrganizerEventSummaryCards
          origin={origin}
          shareSlug={event.shareSlug}
          albumsCount={event.albumsCount}
          membersCount={event.membersCount}
          inviting={inviting}
          generatingShare={generatingShare}
          confirmedPhotographers={eventMembers.filter((m) => m.status === "ACTIVE")}
          onInvite={() => void handleInvite()}
          onGenerateShareLink={() => void handleGenerateShareLink()}
        />
          </>
        )}

        {editTab === "carpetas" && (
        <div className="mt-2 pt-2 border-gray-200 min-w-0 ds-fill-width">
          <EventFoldersSection eventId={eventId} />
        </div>
        )}

        {editTab === "avanzado" && (
          <>
        <Card className="p-6 w-full min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Foto de portada</h2>
          <p className="text-sm text-gray-500 mb-4">
            La portada se muestra arriba de todo en la página pública del evento como encabezado cuando alguien abre el link del cliente.
          </p>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              aria-hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError(null);
                setUploadingCover(true);
                try {
                  const form = new FormData();
                  form.append("file", file);
                  const res = await fetch(`/api/organizer/events/${eventId}/cover`, {
                    method: "POST",
                    credentials: "include",
                    body: form,
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    setError(data.error || "Error subiendo portada");
                    return;
                  }
                  setEvent((prev) =>
                    prev
                      ? {
                          ...prev,
                          coverImageKey: data.coverImageKey ?? prev.coverImageKey,
                          coverUrl: data.coverUrl ?? prev.coverUrl,
                        }
                      : null
                  );
                  setMessage("Portada actualizada.");
                  setTimeout(() => setMessage(null), 3000);
                } catch {
                  setError("Error de conexión");
                } finally {
                  setUploadingCover(false);
                  e.target.value = "";
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={uploadingCover}
              onClick={() => coverInputRef.current?.click()}
            >
              {uploadingCover ? "Subiendo..." : "Elegir imagen"}
            </Button>
          </form>
        </Card>

        <Card className="p-6 w-full min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Descargas del organizador</h2>
          <p className="text-sm text-gray-600 mb-3">
            El organizador recibe 5 fotos en alta por cada fotógrafo que efectivamente suba fotos al evento.
          </p>
          {allowance ? (
            <div className="text-sm text-gray-700">
              <p>Fotógrafos con fotos: <strong>{allowance.photographersWithPhotos}</strong></p>
              <p>Cupo máximo disponible: <strong>{allowance.maxDownloads}</strong> fotos</p>
              <p>Descargas usadas: <strong>{allowance.usedDownloads ?? 0}</strong></p>
              <p>Descargas restantes: <strong>{allowance.remainingDownloads ?? allowance.maxDownloads}</strong></p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Cargando cupo de descargas…</p>
          )}
        </Card>

        <Card className="p-6 w-full min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Fotos disponibles para descargar</h2>
          <p className="text-sm text-gray-500 mb-4">
            Descargas en alta sin marca para el organizador. Se descuenta del cupo solo al iniciar la descarga.
          </p>
          {eventPhotos.length === 0 ? (
            <p className="text-sm text-gray-500">Todavía no hay fotos disponibles para descargar.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {eventPhotos.map((photo) => (
                <div key={photo.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <div className="aspect-square bg-gray-100 flex items-center justify-center">
                    {photo.previewUrl ? (
                      <img
                        src={photo.previewUrl}
                        alt={`Foto ${photo.id}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-gray-500">Sin preview</span>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs text-gray-500 truncate">
                      {photo.photographerName ? `Fotógrafo: ${photo.photographerName}` : "Fotógrafo participante"}
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full"
                      disabled={
                        downloadingPhotoId === photo.id ||
                        (allowance?.remainingDownloads ?? allowance?.maxDownloads ?? 0) <= 0
                      }
                      onClick={() => handleOrganizerDownload(photo.id)}
                    >
                      {downloadingPhotoId === photo.id ? "Descargando..." : "Descargar en alta"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
          </>
        )}

        {(editTab === "datos" ||
          editTab === "convocatoria" ||
          editTab === "venta-digital" ||
          editTab === "comision") && (
        <Card className="p-6 w-full min-w-0">
          <div className="mb-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 m-0">Editar evento</h2>
              <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 m-0 mt-1">
                Un solo guardado para todas las pestañas. Las secciones no visibles siguen cargadas para no perder cambios al cambiar de solapa.
              </p>
            </div>
          </div>
          <form id="event-organizer-detail-form" onSubmit={handleSaveEvent} className="space-y-4 w-full min-w-0">
            <div className={`space-y-4 w-full min-w-0 ${editTab !== "datos" ? "hidden" : ""}`} aria-hidden={editTab !== "datos"}>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full max-w-full box-border" />
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del evento</label>
              <Textarea
                className="text-sm focus:ring-blue-500"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                className="w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 box-border"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            </div>

            <div className={`space-y-6 w-full min-w-0 ${editTab !== "convocatoria" ? "hidden" : ""}`} aria-hidden={editTab !== "convocatoria"}>
            <div className="w-full min-w-0">
              <PhotographerConvocatoriaSection
                fieldIdPrefix="edit-event-convocatoria"
                mode={convocatoriaMode}
                onModeChange={setConvocatoriaMode}
                inviteVisibility={inviteListVisibility}
                onInviteVisibilityChange={setInviteListVisibility}
                disabled={saving}
              />
            </div>
            <EventAccreditationNotesField
              fieldIdPrefix="edit-event-accreditation"
              value={accreditationNotes}
              onChange={setAccreditationNotes}
              disabled={saving}
            />
            <EventPhotographersMembersPanel
              members={eventMembers}
              actingMemberId={actingMemberId}
              onApprove={(memberId) => void handleApproveMember(memberId)}
              onReject={(memberId) => void handleRejectMember(memberId)}
              description={
                convocatoriaMode === "open"
                  ? "Fotógrafos inscriptos en el evento. También podés sumar fotógrafos manualmente abajo."
                  : convocatoriaMode === "approval"
                    ? "Solicitudes pendientes, fotógrafos inscriptos y rechazados. Podés inscribir fotógrafos directamente sin esperar su solicitud."
                    : undefined
              }
            />
            {(convocatoriaMode === "open" || convocatoriaMode === "approval") && (
              <div className="w-full min-w-0 p-4 md:p-5 rounded-3xl border border-[#111827]/10 bg-gray-50/90">
                <p className="text-sm font-medium text-gray-700 mb-2">Inscribir fotógrafo manualmente</p>
                <EventInvitePhotographers
                  mode="enroll"
                  value={[]}
                  onChange={() => {}}
                  disabled={saving}
                  onEnroll={handleEnrollPhotographer}
                  enrollingUserId={enrollingUserId}
                  excludeUserIds={enrolledOrPendingUserIds}
                />
              </div>
            )}
            {convocatoriaMode === "invite_only" && (
              <div className="w-full min-w-0 p-4 md:p-5 rounded-3xl border border-[#111827]/10 bg-gray-50/90">
                <p className="text-sm font-medium text-gray-700 mb-2">Invitación manual de fotógrafos</p>
                <EventInvitePhotographers
                  value={invitedPhotographers}
                  onChange={setInvitedPhotographers}
                  disabled={saving}
                />
              </div>
            )}
            </div>

            <div className={`space-y-4 w-full min-w-0 ${editTab !== "comision" ? "hidden" : ""}`} aria-hidden={editTab !== "comision"}>
            <DsInfoPanel title="Liquidación · comisión del organizador" className="!text-sm">
              <ul className="ds-readable-text ds-readable-text--fluid text-sm text-gray-700 space-y-2 list-disc pl-5 m-0">
                <li>
                  Porcentaje sobre el <strong>precio base</strong> definido por cada fotógrafo por foto (no sobre descuentos ni el total abonado).
                </li>
                <li>El importe se acredita con <strong>15 días</strong> de espera tras el pago aprobado.</li>
                <li>Podés solicitar retiro desde <strong>Comisiones</strong> cuando figure como disponible (retiro manual, procesado por el equipo).</li>
              </ul>
            </DsInfoPanel>
            <EventOrganizerCommissionSection
              fieldIdPrefix="edit-event-org-commission"
              enabled={organizerCommissionEnabled}
              onEnabledChange={setOrganizerCommissionEnabled}
              percentageInput={organizerCommissionPercentage}
              onPercentageInputChange={setOrganizerCommissionPercentage}
              disabled={saving}
            />
            </div>

            <div className={`space-y-4 w-full min-w-0 ${editTab !== "venta-digital" ? "hidden" : ""}`} aria-hidden={editTab !== "venta-digital"}>
            <EventPhotoPricingSection
              fieldIdPrefix="edit-event-photo-pricing"
              mode={photoPricingMode}
              onModeChange={setPhotoPricingMode}
              disabled={saving}
              pricingFormPhase="edit"
              legacyMinimumPesos={
                photoPricingMode === EventPhotoPricingMode.ORGANIZER_MINIMUM
                  ? (() => {
                      const n = parseFloat(minimumPhotoPriceInput.replace(",", "."));
                      return Number.isFinite(n) && n >= MIN_EVENT_PHOTO_PRICE_ARS ? n : null;
                    })()
                  : null
              }
            />
            </div>

            <div className={`space-y-4 w-full min-w-0 pt-4 border-t border-gray-100 ${editTab !== "datos" ? "hidden" : ""}`} aria-hidden={editTab !== "datos"}>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cupo máximo de fotógrafos</label>
              <Input
                type="number"
                min="1"
                value={maxPhotographers}
                onChange={(e) => setMaxPhotographers(e.target.value)}
                className="w-full max-w-full box-border"
              />
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Asistentes aproximados (opcional)</label>
              <Input
                type="number"
                min="1"
                value={expectedAttendees}
                onChange={(e) => setExpectedAttendees(e.target.value)}
                placeholder="Ej: 500, 5000"
                className="w-full max-w-full box-border"
              />
              <p className="text-xs text-gray-500 mt-1">Para que el fotógrafo sepa si es un evento multitudinario o más íntimo.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full min-w-0">
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">Inicio</label>
                <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full max-w-full box-border" />
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin (opcional)</label>
                <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="w-full max-w-full box-border" />
              </div>
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado del evento</label>
              <select
                className="w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 box-border"
                value={eventStatus}
                onChange={(e) => setEventStatus(e.target.value)}
              >
                <option value="ACTIVE">Activo</option>
                <option value="CLOSED">Cerrado</option>
              </select>
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">¿Habilitar subidas de fotos?</label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={uploadsEnabled}
                  onChange={(e) => setUploadsEnabled(e.target.checked)}
                />
                <span>Permitir a fotógrafos subir fotos al evento</span>
              </label>
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Condiciones para fotógrafos</label>
              <Textarea
                className="text-sm focus:ring-blue-500"
                rows={3}
                value={photographerTerms}
                onChange={(e) => setPhotographerTerms(e.target.value)}
                placeholder="Texto breve que debe aceptar el fotógrafo al inscribirse."
              />
              <p className="text-xs text-gray-500 mt-1">
                Si no se completa, se usa un texto por defecto.
              </p>
            </div>
            <div className="w-full min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación en el mapa</label>
              <p className="text-xs text-gray-500 mb-2">Escribí el nombre del lugar y elegí de la lista, o hacé clic en el mapa / arrastrá el marcador; las coordenadas y el lugar se completan solos.</p>
              {(latitude && longitude && (parseFloat(latitude) !== 0 || parseFloat(longitude) !== 0)) && locationName && (
                <div className="mb-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Lugar</label>
                  <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">{locationName}</p>
                </div>
              )}
              <div className="mb-3">
                <EventLocationSearch
                  placeholder="Ej: Teatro Colón, Estadio Monumental"
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
                    // ignorar error de reverse geocode
                  }
                }}
                height="280px"
              />
            </div>
            </div>
            {ORGANIZER_EVENT_EDIT_FORM_TAB_IDS.has(editTab) ? (
              <div className="pt-6 border-t border-gray-100 flex justify-end">
                <Button type="submit" variant="primary" disabled={saving} className="shrink-0 whitespace-nowrap">
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            ) : null}
          </form>
        </Card>
        )}

        </DsDashboardInner>
      </DsPageShell>
    </div>
  );
}
