"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

const EventLocationSearch = dynamic(
  () => import("@/components/organizer/EventLocationSearch").then((m) => m.default),
  { ssr: false }
);
import { TERMS_VERSION, TERMS_TEXT } from "@/lib/terms/photographerTerms";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import CenteredProse from "@/components/ui/CenteredProse";
import { Settings, Sparkles } from "lucide-react";
import GalleryMediaTypeBadges from "@/components/gallery/GalleryMediaTypeBadges";
import AlbumSalesStatusBadge from "@/components/dashboard/albums/AlbumSalesStatusBadge";
import AlbumEventScheduleFields, {
  EMPTY_ALBUM_EVENT_SCHEDULE,
  albumEventScheduleToApiPayload,
  displayLabelFromAlbumRow,
  hydrateAlbumEventScheduleFromApi,
  type AlbumEventScheduleValue,
} from "@/components/dashboard/albums/AlbumEventScheduleFields";

type Album = {
  id: number;
  title: string;
  location: string | null;
  eventDate: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  publicSlug: string;
  createdAt: string;
  photosCount: number;
  hasPhotos?: boolean;
  hasVideos?: boolean;
  coverPhotoUrl?: string | null;
  showComingSoonMessage?: boolean;
  firstPhotoDate?: string | null;
  termsAcceptedAt?: string | null;
  termsVersion?: string | null;
  hiddenPhotosEnabled?: boolean;
  hiddenSelfieRetentionDays?: number | null;
  /** Si está vinculado a un evento, título/lugar/fecha se gestionan desde el evento */
  eventId?: number | null;
  isTest?: boolean;
};

export default function DashboardAlbumsPage() {
  const router = useRouter();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCopiedToast, setShowCopiedToast] = useState(false);

  // Estado para crear/editar álbum
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [eventSchedule, setEventSchedule] = useState<AlbumEventScheduleValue>(EMPTY_ALBUM_EVENT_SCHEDULE);
  const [foundAlbums, setFoundAlbums] = useState<any[]>([]);
  const [searchingAlbums, setSearchingAlbums] = useState(false);
  const [showJoinOptions, setShowJoinOptions] = useState(false);
  const [albumMatchChoice, setAlbumMatchChoice] = useState("");
  
  const [photographer, setPhotographer] = useState<{ mpConnected?: boolean } | null>(null);
  const [showComingSoonMessage, setShowComingSoonMessage] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [hiddenPhotosEnabled, setHiddenPhotosEnabled] = useState(false);
  const [hiddenSelfieRetentionDays, setHiddenSelfieRetentionDays] = useState("");
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Invitaciones a álbum (integrado en el mismo modal de edición)
  const [inviteEmailsInput, setInviteEmailsInput] = useState("");
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [inviteResults, setInviteResults] = useState<Record<string, string>>({});
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteListLoading, setInviteListLoading] = useState(false);
  const [inviteAccesses, setInviteAccesses] = useState<Array<{ email: string; status: string }>>([]);
  const [invitePending, setInvitePending] = useState<Array<{ email: string; status: string; expiresAt?: string | null }>>([]);
  const [albumDataLoading, setAlbumDataLoading] = useState(false);
  const loadedFormSnapshot = useRef<{ hiddenPhotosEnabled: boolean; isPublic: boolean; showComingSoonMessage: boolean } | null>(null);
  /** Creación desde "Subir fotos al evento" (Mis eventos): se envía al API para vincular el álbum al evento. */
  const [createFromEventId, setCreateFromEventId] = useState<number | null>(null);
  const fromEventBootstrapRef = useRef(false);
  /** Editar álbum de evento: bloquear título, lugar y fecha en el paso 1 */
  const [lockEventAlbumFields, setLockEventAlbumFields] = useState(false);
  /** Tras guardar el wizard, ir al detalle del álbum (p. ej. para subir fotos) */
  const [afterAlbumSetupNavigateTo, setAfterAlbumSetupNavigateTo] = useState<string | null>(null);

  // Buscar álbumes existentes cuando cambia el título
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (title.trim().length >= 3 && !editingAlbumId) {
        setSearchingAlbums(true);
        try {
          const res = await fetch(`/api/dashboard/albums/search?title=${encodeURIComponent(title.trim())}`);
          if (res.ok) {
            const data = await res.json();
            setFoundAlbums(data.albums || []);
            setShowJoinOptions(data.albums && data.albums.length > 0);
          }
        } catch (err) {
          console.error("Error buscando álbumes:", err);
        } finally {
          setSearchingAlbums(false);
        }
      } else {
        setFoundAlbums([]);
        setShowJoinOptions(false);
      }
    }, 500); // Debounce de 500ms

    return () => clearTimeout(searchTimeout);
  }, [title, editingAlbumId]);

  useEffect(() => {
    loadAlbums();
    void fetch("/api/dashboard/photographer")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPhotographer({ mpConnected: Boolean(data.mpConnected) });
      })
      .catch(() => {});

    // Verificar si hay un parámetro de edición en la URL (wizard de 3 pasos)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const editId = params.get("edit");
      const lockEv = params.get("lockEventFields") === "1";
      const afterSetup = params.get("afterSetup");
      if (lockEv) setLockEventAlbumFields(true);
      if (afterSetup && afterSetup.startsWith("/")) {
        setAfterAlbumSetupNavigateTo(afterSetup);
      }
      if (editId && !isNaN(Number(editId))) {
        const albumId = Number(editId);
        // Buscar el álbum en la lista y abrir el modal de edición
        setTimeout(() => {
          const albumToEdit = albums.find((a: any) => a.id === albumId);
          if (albumToEdit) {
            handleEditAlbum(albumToEdit);
            // Limpiar el parámetro de la URL
            window.history.replaceState({}, "", "/dashboard/albums");
          }
        }, 100);
      }
    }
  }, [albums.length]);

  // ?fromEvent=<id> — abrir modal de nuevo álbum con datos del evento (flujo desde panel Mis eventos)
  useEffect(() => {
    if (typeof window === "undefined" || fromEventBootstrapRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("fromEvent");
    if (!raw) return;
    const eventId = Number(raw);
    if (!Number.isFinite(eventId) || eventId <= 0) return;
    fromEventBootstrapRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/fotografo/events/${eventId}/album-context`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        window.history.replaceState({}, "", "/dashboard/albums");
        if (!res.ok) {
          setError(data.error || "No se pudo cargar el evento.");
          return;
        }
        if (data.existingAlbumId) {
          const id = data.existingAlbumId as number;
          const dest = `/dashboard/albums/${id}`;
          router.push(
            `/dashboard/albums?edit=${id}&lockEventFields=1&afterSetup=${encodeURIComponent(dest)}`
          );
          return;
        }
        if (!data.uploadsAllowed) {
          setError("La subida de fotos todavía no está habilitada para este evento.");
          return;
        }
        const p = data.prefill;
        if (p) {
          setTitle(p.title || "");
          setLocation(p.location || "");
          setEventSchedule(
            hydrateAlbumEventScheduleFromApi({
              eventDate: p.eventDate || null,
            }).value
          );
        }
        setCreateFromEventId(eventId);
        setShowCreateModal(true);
      } catch {
        if (!cancelled) {
          window.history.replaceState({}, "", "/dashboard/albums");
          setError("Error cargando datos del evento.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleRequestCloseModalRef = useRef(handleRequestCloseModal);
  handleRequestCloseModalRef.current = handleRequestCloseModal;

  // Cerrar modales con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showTermsModal) {
          setShowTermsModal(false);
        }
        if (showCreateModal) {
          handleRequestCloseModalRef.current();
        }
      }
    }
    if (showCreateModal || showTermsModal) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [showCreateModal, showTermsModal]);

  // Cargar datos del fotógrafo y configuración del sistema cuando se abre el modal
  useEffect(() => {
    if (showCreateModal && editingAlbumId) {
      // Cargar datos del álbum para edición
      setAlbumDataLoading(true);
      async function loadAlbumData() {
        try {
          const res = await fetch(`/api/dashboard/albums/${editingAlbumId}`, { cache: "no-store" });
          if (res.ok) {
            const album = await res.json();
            if (album.eventId) {
              setLockEventAlbumFields(true);
            }
            setTitle(album.title || "");
            setLocation(album.location || "");
            setEventSchedule(
              hydrateAlbumEventScheduleFromApi({
                eventSchedule: album.eventSchedule,
                eventDate: album.eventDate,
                startsAt: album.startsAt,
                endsAt: album.endsAt,
              }).value
            );
            setIsPublic(album.isPublic !== undefined ? album.isPublic : true);
            setHiddenPhotosEnabled(Boolean(album.hiddenPhotosEnabled));
            setHiddenSelfieRetentionDays(album.hiddenSelfieRetentionDays != null ? String(album.hiddenSelfieRetentionDays) : "");
            setShowComingSoonMessage(Boolean(album.showComingSoonMessage));
            loadedFormSnapshot.current = {
              hiddenPhotosEnabled: Boolean(album.hiddenPhotosEnabled),
              isPublic: album.isPublic !== false,
              showComingSoonMessage: Boolean(album.showComingSoonMessage),
            };

            await loadInviteData();
          }
        } catch (err) {
          console.error("Error cargando datos del álbum:", err);
        } finally {
          setAlbumDataLoading(false);
        }
      }
      loadAlbumData();
    } else {
      setAlbumDataLoading(false);
    }
  }, [showCreateModal, editingAlbumId]);

  useEffect(() => {
    if (showCreateModal && editingAlbumId) {
      loadInviteData();
    }
  }, [showCreateModal, editingAlbumId]);

  async function loadAlbums() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/albums");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error(data?.error || data?.detail || "Error cargando álbumes");
      }
      setAlbums(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Error cargando álbumes:", err);
      setError(err.message || "Error cargando álbumes");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAlbum(album: { id: number; title?: string; hasOtherContributors?: boolean; myPhotosCount?: number; photosCount?: number }) {
    const msg = album.hasOtherContributors
      ? `Este álbum es colaborativo. Solo se eliminarán tus ${album.myPhotosCount ?? 0} fotos. El álbum permanecerá con las de otros fotógrafos. Si sos el creador, la propiedad pasará a otro colaborador. ¿Continuar?`
      : `¿Eliminar el álbum "${album.title ?? ""}" y sus ${album.photosCount ?? 0} fotos? Esta acción no se puede deshacer.`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/dashboard/albums/${album.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error eliminando álbum");
      await loadAlbums();
    } catch (e: any) {
      setError(e?.message || "Error eliminando álbum");
    }
  }

  function doCloseModal() {
    setShowCreateModal(false);
    setEditingAlbumId(null);
    setError(null);
    setTitle("");
    setLocation("");
    setEventSchedule(EMPTY_ALBUM_EVENT_SCHEDULE);
    setFoundAlbums([]);
    setShowJoinOptions(false);
    setShowComingSoonMessage(false);
    setIsPublic(true);
    setHiddenPhotosEnabled(false);
    setHiddenSelfieRetentionDays("");
    setShowTermsModal(false);
    loadedFormSnapshot.current = null;
    setCreateFromEventId(null);
    setLockEventAlbumFields(false);
    setAfterAlbumSetupNavigateTo(null);
  }

  function handleRequestCloseModal() {
    if (!editingAlbumId || creating) {
      doCloseModal();
      return;
    }
    const loaded = loadedFormSnapshot.current;
    if (!loaded) {
      doCloseModal();
      return;
    }
    const hasChanges =
      hiddenPhotosEnabled !== loaded.hiddenPhotosEnabled ||
      isPublic !== loaded.isPublic ||
      showComingSoonMessage !== loaded.showComingSoonMessage;
    if (!hasChanges) {
      doCloseModal();
      return;
    }
    if (confirm("Tenés cambios sin guardar. ¿Guardar antes de cerrar?\n\n• Sí = guardar y cerrar\n• No = descartar cambios")) {
      handleCreateAlbum();
    } else {
      doCloseModal();
    }
  }

  async function handleCreateAlbum() {
    // Título obligatorio para poder guardar
    if (!title.trim()) {
      setError("El título es requerido");
      return;
    }
    // Lugar del evento obligatorio al crear
    if (!editingAlbumId && !location.trim()) {
      setError("El lugar del evento es requerido.");
      return;
    }

    if (!editingAlbumId && foundAlbums.length > 0) {
      if (!albumMatchChoice) {
        setError("Seleccioná si querés unirte a un álbum existente o crear uno nuevo.");
        return;
      }
      if (albumMatchChoice !== "create_new") {
        setCreating(true);
        setError(null);
        try {
          const res = await fetch("/api/dashboard/albums", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              joinAlbumId: Number(albumMatchChoice),
              title: title.trim(),
            }),
          });
          const data = await res.json();
          if (res.ok) {
            setShowCreateModal(false);
            setTitle("");
            setFoundAlbums([]);
            setShowJoinOptions(false);
            setAlbumMatchChoice("");
            await loadAlbums();
            router.push(`/dashboard/albums/${data.id}`);
            return;
          }
          setError(data.error || "Error uniéndose al álbum");
        } catch (err: any) {
          setError(err.message || "Error uniéndose al álbum");
        } finally {
          setCreating(false);
        }
        return;
      }
    }

    setCreating(true);
    setError(null);

    const isEditing = editingAlbumId !== null;

    try {
      const datosPayload = {
        title: title.trim(),
        location: location.trim() || null,
        ...albumEventScheduleToApiPayload(eventSchedule),
        showComingSoonMessage,
        isPublic,
        hiddenPhotosEnabled,
        hiddenSelfieRetentionDays:
          hiddenSelfieRetentionDays === ""
            ? null
            : parseInt(hiddenSelfieRetentionDays, 10) || null,
      };

      const res = await fetch(
        isEditing ? `/api/dashboard/albums/${editingAlbumId}` : "/api/dashboard/albums",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEditing
              ? datosPayload
              : {
                  ...datosPayload,
                  ...(createFromEventId ? { eventId: createFromEventId } : {}),
                }
          ),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data?.existingAlbumId) {
        doCloseModal();
        router.push(`/dashboard/albums/${data.existingAlbumId}`);
        return;
      }

      if (!res.ok) {
        const errorMessage = data.error || data.detail || (isEditing ? "Error actualizando álbum" : "Error creando álbum");
        const fullError = data.detail ? `${errorMessage}. Detalle: ${data.detail}` : errorMessage;
        console.error("Error del servidor:", fullError, "Response status:", res.status, "Data:", data);
        throw new Error(fullError);
      }

      const warningMessage = isEditing && data._warning ? String(data._warning) : null;
      const navigateAfterEdit = isEditing ? afterAlbumSetupNavigateTo : null;

      // Cerrar modal y limpiar formulario (mantener aviso de migración si aplica)
      doCloseModal();
      if (warningMessage) setError(warningMessage);

      // Si es creación nueva, guardar el link para mostrarlo después
      if (!isEditing && data.publicSlug) {
        const albumUrl = `${window.location.origin}/a/${data.publicSlug}`;
        // Guardar en sessionStorage para mostrarlo en la página de detalle
        sessionStorage.setItem("newAlbumUrl", albumUrl);
        sessionStorage.setItem("newAlbumTitle", data.title || "");
      }

      // Recargar lista
      await loadAlbums();

      if (isEditing && navigateAfterEdit) {
        router.push(navigateAfterEdit);
        return;
      }
      if (!isEditing) {
        router.push(`/dashboard/albums/${data.id}?tab=ventas`);
      }
    } catch (err: any) {
      console.error(isEditing ? "Error actualizando álbum:" : "Error creando álbum:", err);
      setError(err.message || (isEditing ? "Error actualizando álbum" : "Error creando álbum"));
    } finally {
      setCreating(false);
    }
  }

  function normalizeEmails(raw: string): string[] {
    return raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  function addInviteEmailsFromInput() {
    const parsed = normalizeEmails(inviteEmailsInput);
    if (!parsed.length) return;
    setInviteEmails((prev) => Array.from(new Set([...prev, ...parsed])));
    setInviteEmailsInput("");
  }

  async function loadInviteData() {
    if (!editingAlbumId) return;
    setInviteListLoading(true);
    try {
      const res = await fetch(`/api/albums/${editingAlbumId}/invite`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteAccesses([]);
        setInvitePending([]);
        return;
      }
      const accessRows = Array.isArray(data.accesses) ? data.accesses : [];
      const pendingRows = Array.isArray(data.invitations) ? data.invitations : [];
      setInviteAccesses(accessRows);
      setInvitePending(pendingRows);
    } catch {
      setInviteAccesses([]);
      setInvitePending([]);
    } finally {
      setInviteListLoading(false);
    }
  }

  async function handleSendInvites() {
    if (!editingAlbumId) return;
    const emails = Array.from(new Set(inviteEmails.map((e) => e.toLowerCase())));
    if (!emails.length) {
      setError("Agregá al menos un email para invitar.");
      return;
    }
    setInviteLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/albums/${editingAlbumId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error enviando invitaciones");
      }
      const results = Array.isArray(data.results) ? data.results : [];
      const nextResults: Record<string, string> = {};
      results.forEach((r: any) => {
        if (r?.email) {
          nextResults[String(r.email).toLowerCase()] = r?.status || "invited";
        }
      });
      setInviteResults(nextResults);
      setInviteEmails([]);
      await loadInviteData();
    } catch (err: any) {
      setError(err?.message || "Error enviando invitaciones");
    } finally {
      setInviteLoading(false);
    }
  }

  function handleEditAlbum(album: Album) {
    setEditingAlbumId(album.id);
    if (album.eventId) {
      setLockEventAlbumFields(true);
    }
    setShowCreateModal(true);
  }

  if (loading) {
    return (
      <>
        <PhotographerDashboardHeader photographer={null} />
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-6xl mx-auto text-center">
              <p className="text-[#6b7280]">Cargando álbumes...</p>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PhotographerDashboardHeader photographer={null} />
      <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-[95%] mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
          {/* Header */}
          <div
            style={{
              textAlign: "center",
              padding: "0 16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "center",
              width: "100%",
            }}
          >
            <h1
              style={{
                fontSize: "clamp(24px, 5vw, 36px)",
                fontWeight: "normal",
                color: "#1a1a1a",
                lineHeight: "1.3",
                margin: 0,
                width: "100%",
                maxWidth: "800px",
                alignSelf: "stretch",
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
              }}
            >
              Mis Albums
            </h1>
            <p
              style={{
                fontSize: "16px",
                color: "#6b7280",
                lineHeight: "1.6",
                margin: 0,
                width: "100%",
                alignSelf: "stretch",
                maxWidth: "600px",
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
              }}
            >
              Creá álbumes y subí tus fotos. Se aplicará marca de agua automáticamente para proteger tus imágenes.
            </p>
          </div>

          <div className="mb-4 w-full min-w-0 space-y-3 border-b border-[#e5e7eb] pb-4">
            <CenteredProse maxWidthClassName="max-w-2xl" size="sm">
              Para empezar rápido, te recomendamos{" "}
              <strong className="font-semibold text-[#4b5563]">crear el álbum con el asistente paso a paso</strong>. La{" "}
              <strong className="font-semibold text-[#4b5563]">configuración avanzada</strong> permite definir datos del
              álbum; los precios y productos se configuran después en la pestaña Venta.
            </CenteredProse>
            <div className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3">
              <Link
                href="/dashboard/albums/new"
                title="Asistente: elegís tipo de álbum, datos básicos y venta simplificada en pasos cortos."
                className="inline-flex min-h-[44px] max-w-[min(100%,20rem)] shrink-0 flex-col items-center justify-center gap-1 rounded-full border border-[#b86d30] bg-[#c27b3d] px-4 py-2.5 text-sm font-semibold leading-snug text-white shadow-[0_4px_14px_0_rgba(194,123,61,0.28)] transition-all duration-200 hover:bg-[#b06d34] hover:shadow-[0_8px_22px_-6px_rgba(194,123,61,0.4)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d] sm:max-w-none sm:flex-row sm:gap-2 sm:px-5 sm:leading-tight"
              >
                <Sparkles className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" aria-hidden strokeWidth={2} />
                <span className="text-balance text-center sm:text-left">Crear álbum con asistente paso a paso</span>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingAlbumId(null);
                  setShowCreateModal(true);
                }}
                className="inline-flex min-h-[44px] max-w-[min(100%,20rem)] flex-col items-center justify-center gap-1 rounded-full border border-[#c27b3d]/35 bg-[#fdfcfb] px-4 py-2.5 text-sm font-semibold leading-snug text-[#6b4423] shadow-sm hover:border-[#c27b3d]/55 hover:bg-[#fdf8f3] sm:max-w-none sm:flex-row sm:gap-2 sm:px-5 sm:leading-tight"
                disabled={photographer?.mpConnected === false}
                title={
                  photographer?.mpConnected === false
                    ? "Vinculá Mercado Pago para crear álbumes"
                    : "Datos básicos del álbum; precios y ventas se configuran después en la pestaña Venta."
                }
              >
                <Settings className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" aria-hidden strokeWidth={2} />
                <span className="text-balance text-center sm:text-left">Configuración avanzada</span>
              </Button>
            </div>
          </div>

          {error && (
            <Card className="bg-[#ef4444]/10 border-[#ef4444]">
              <p className="text-[#ef4444] text-sm">{error}</p>
            </Card>
          )}

          {/* Lista de álbumes */}
          {albums.length === 0 ? (
            <Card className="border-2 border-dashed border-[#e5e7eb] w-full">
              <div className="text-center py-16 px-4">
                <div className="mb-6">
                  <svg className="w-16 h-16 mx-auto text-[#9ca3af]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-[#1a1a1a] mb-2">No tenés álbumes creados todavía</h3>
                <p className="text-[#6b7280] mb-6 max-w-4xl mx-auto text-base">
                  Creá tu primer álbum para comenzar a compartir tus fotos. Después configurá precios y ventas en la pestaña Venta del álbum.
                </p>
                <Button 
                  variant="primary" 
                  onClick={() => {
                    setEditingAlbumId(null);
                    setShowCreateModal(true);
                  }}
                  className="flex items-center gap-2 mx-auto"
                  disabled={photographer?.mpConnected === false}
                  title={
                    photographer?.mpConnected === false
                      ? "Vinculá Mercado Pago para crear álbumes"
                      : undefined
                  }
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Crear mi primer álbum</span>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {albums.map((album: any) => {
                const scheduleLabel = displayLabelFromAlbumRow(album);
                const baseDate = album.firstPhotoDate ? new Date(album.firstPhotoDate) : new Date(album.createdAt);
                const extensionDays = album.expirationExtensionDays ?? 0;
                const expiresAt = new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000);
                return (
                  <Card key={album.id} className="h-full overflow-hidden relative hover:shadow-lg transition-shadow duration-200">
                    <div className="absolute top-2 right-2 z-10 flex gap-2">
                      <a
                        href={`/a/${album.publicSlug || album.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/95 hover:bg-green-50 text-[#6b7280] hover:text-green-600 border border-[#e5e7eb] shadow-sm hover:shadow transition-all"
                        aria-label="Ver álbum como cliente"
                        title="Ver álbum como cliente"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </a>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const albumUrl = `${window.location.origin}/a/${album.publicSlug || album.id}`;
                          try {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                              await navigator.clipboard.writeText(albumUrl);
                            } else {
                              // Fallback para navegadores sin clipboard API
                              const textArea = document.createElement("textarea");
                              textArea.className = "ds-textarea-opt-out";
                              textArea.value = albumUrl;
                              textArea.style.position = "fixed";
                              textArea.style.opacity = "0";
                              document.body.appendChild(textArea);
                              textArea.select();
                              document.execCommand("copy");
                              document.body.removeChild(textArea);
                            }
                            // Mostrar toast de confirmación
                            setShowCopiedToast(true);
                            setTimeout(() => {
                              setShowCopiedToast(false);
                            }, 3000);
                          } catch (err) {
                            console.error("Error copiando link:", err);
                            alert(`Link del álbum:\n${albumUrl}`);
                          }
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/95 hover:bg-purple-50 text-[#6b7280] hover:text-purple-600 border border-[#e5e7eb] shadow-sm hover:shadow transition-all"
                        aria-label="Compartir álbum"
                        title="Compartir álbum (copiar link)"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditAlbum(album); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/95 hover:bg-blue-50 text-[#6b7280] hover:text-blue-600 border border-[#e5e7eb] shadow-sm hover:shadow transition-all"
                        aria-label="Editar álbum (configuración completa)"
                        title="Editar álbum"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteAlbum(album); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/90 hover:bg-red-100 text-[#6b7280] hover:text-red-600 border border-[#e5e7eb] shadow"
                        aria-label="Eliminar álbum"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                    <Link href={`/dashboard/albums/${album.id}`} className="block">
                      <div className="relative w-full aspect-square bg-[#f3f4f6] overflow-hidden">
                        {album.coverPhotoUrl && album.photosCount > 0 ? (
                          <img
                            src={album.coverPhotoUrl}
                            alt={album.title}
                            className="w-full h-full object-cover"
                          />
                        ) : album.photosCount === 0 ? (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-4">
                            <img
                              src="/watermark.png"
                              alt="ComprameLaFoto"
                              className="w-20 h-auto opacity-90"
                            />
                            <p className="text-[#6b7280] text-xs text-center leading-tight">
                              Las fotos serán subidas próximamente
                            </p>
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <p className="text-[#9ca3af] text-sm">Sin foto de portada</p>
                          </div>
                        )}
                        <GalleryMediaTypeBadges
                          hasPhotos={album.hasPhotos ?? album.photosCount > 0}
                          hasVideos={Boolean(album.hasVideos)}
                        />
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-[#1a1a1a] line-clamp-2 flex-1 flex flex-wrap items-center gap-2">
                            {album.title}
                            {album.isTest ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                                TEST
                              </span>
                            ) : null}
                          </h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${album.isPublic !== false ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>
                              {album.isPublic !== false ? "Público" : "Privado"}
                            </span>
                            {(album as any).isCollaborative && (
                            <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full whitespace-nowrap">
                              🤝 Colaborativo
                            </span>
                          )}
                            {(album as any).hasOtherContributors && !(album as any).isCollaborative && (
                              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full whitespace-nowrap">
                                👥 Con colaboradores
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mb-2">
                          <AlbumSalesStatusBadge
                            album={{
                              enableDigitalPhotos: (album as { enableDigitalPhotos?: boolean }).enableDigitalPhotos,
                              enablePrintedPhotos: (album as { enablePrintedPhotos?: boolean }).enablePrintedPhotos,
                              digitalPhotoPriceCents: (album as { digitalPhotoPriceCents?: number | null }).digitalPhotoPriceCents ?? null,
                              albumProfitMarginPercent: (album as { albumProfitMarginPercent?: number | null }).albumProfitMarginPercent ?? null,
                              termsAcceptedAt: (album as { termsAcceptedAt?: string | null }).termsAcceptedAt ?? null,
                              termsVersion: (album as { termsVersion?: string | null }).termsVersion ?? null,
                            }}
                          />
                        </div>
                        <div className="space-y-1 mb-3">
                          {album.location && (
                            <p className="text-sm text-[#6b7280] flex items-center gap-1">
                              <span>📍</span>
                              <span className="truncate">{album.location}</span>
                            </p>
                          )}
                          {scheduleLabel && (
                            <p className="text-sm text-[#6b7280] flex items-center gap-1">
                              <span>📅</span>
                              <span>{scheduleLabel}</span>
                            </p>
                          )}
                        </div>
                        <div className="pt-3 border-t border-[#e5e7eb] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-[#1a1a1a]">
                              {album.photosCount} {album.photosCount === 1 ? "foto" : "fotos"}
                              {(album as any).myPhotosCount !== undefined && (album as any).myPhotosCount !== album.photosCount && (
                                <span className="text-xs text-[#6b7280] ml-2">
                                  ({((album as any).myPhotosCount || 0)} tuyas)
                                </span>
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-[#6b7280]">
                            Creado: {new Date(album.createdAt).toLocaleDateString("es-AR")}
                          </p>
                          {expiresAt && (
                            <p className="text-xs text-amber-700 font-medium bg-amber-50 px-2 py-1 rounded">
                              ⏱ Eliminación: {expiresAt.toLocaleDateString("es-AR")}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Toast de confirmación de copia */}
          {showCopiedToast && (
            <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-[#10b981] text-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 min-w-[200px]">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-medium whitespace-nowrap">Link copiado al portapapeles</p>
              </div>
            </div>
          )}

          {/* Modal para crear álbum */}
          {showCreateModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={handleRequestCloseModal}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto overscroll-y-contain">
                <Card
                  className="max-w-4xl shrink-0 w-full max-h-[min(90vh,920px)] flex flex-col min-h-0 overflow-hidden gap-4 my-auto"
                  style={{ wordBreak: "normal", overflowWrap: "normal" }}
                >
                  <div className="flex shrink-0 justify-between items-center gap-3">
                    <h2 className="text-xl font-medium text-[#1a1a1a]">
                      {editingAlbumId ? "Editar Álbum" : "Crear Nuevo Álbum"}
                    </h2>
                    <button
                      onClick={handleRequestCloseModal}
                      className="text-[#6b7280] hover:text-[#1a1a1a]"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {photographer?.mpConnected === false && (
                    <Card className="shrink-0 bg-amber-50 border border-amber-200">
                      <p className="text-sm text-amber-800">
                        ⚠️ Debés vincular tu cuenta de Mercado Pago para crear álbumes y recibir cobros.
                      </p>
                      <Link
                        href="/fotografo/configuracion?tab=laboratorio"
                        className="inline-flex mt-2 text-sm text-amber-900 underline"
                      >
                        Ir a vincular Mercado Pago
                      </Link>
                    </Card>
                  )}

                  {editingAlbumId ? (
                    <Card className="shrink-0 border border-[#e5e7eb] bg-[#f9fafb] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-[#374151] m-0 min-w-0">
                          La configuración de ventas se gestiona desde la pestaña <strong>Venta</strong> del
                          álbum.
                        </p>
                        <Link
                          href={`/dashboard/albums/${editingAlbumId}?tab=ventas`}
                          prefetch={false}
                          className="w-full shrink-0 sm:w-auto"
                        >
                          <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            className="w-full whitespace-nowrap sm:w-auto"
                          >
                            Abrir ventas del álbum
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  ) : null}

                  <div
                    ref={modalContentRef}
                    className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 overscroll-y-contain"
                  >
                    <div className="space-y-6">
                        {(() => {
                          const datosDelEventoBloqueados =
                            lockEventAlbumFields || (!!createFromEventId && !editingAlbumId);
                          return datosDelEventoBloqueados ? (
                            <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2.5 text-sm text-[#374151]">
                              <strong className="text-[#1a1a1a]">Datos del evento</strong>
                              <p className="mt-1 text-[#6b7280]">
                                Título, lugar y fecha están definidos por el evento y no se pueden modificar acá.
                                Configurá precios y ventas en la pestaña Venta del álbum.
                              </p>
                            </div>
                          ) : null;
                        })()}
                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                            Título <span className="text-[#ef4444]">*</span>
                          </label>
                          <Input
                            type="text"
                            placeholder="Ej: Boda de Juan y María"
                            value={title}
                            onChange={(e) => {
                              setTitle(e.target.value);
                              setShowJoinOptions(false);
                              setAlbumMatchChoice("");
                            }}
                            disabled={
                              creating ||
                              lockEventAlbumFields ||
                              (!!createFromEventId && !editingAlbumId)
                            }
                          />
                          {searchingAlbums && (
                            <p className="text-xs text-[#6b7280] mt-1">
                              Buscando álbumes existentes...
                            </p>
                          )}
                          {showJoinOptions &&
                            foundAlbums.length > 0 &&
                            !lockEventAlbumFields &&
                            !(createFromEventId && !editingAlbumId) && (
                            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-sm font-medium text-blue-900 mb-2">
                                📸 Se encontraron {foundAlbums.length} álbum{foundAlbums.length !== 1 ? "es" : ""} con el mismo nombre.
                              </p>
                              <Select
                                value={albumMatchChoice}
                                onChange={(e) => setAlbumMatchChoice(e.target.value)}
                                disabled={creating}
                              >
                                <option value="">Seleccioná una opción...</option>
                                {foundAlbums.map((album) => (
                                  <option
                                    key={album.id}
                                    value={String(album.id)}
                                    disabled={album.hasMyPhotos}
                                  >
                                    Unirme a "{album.title}" #{album.id}
                                  </option>
                                ))}
                                <option value="create_new">Crear un álbum nuevo</option>
                              </Select>
                              {albumMatchChoice && albumMatchChoice !== "create_new" && (
                                <p className="text-xs text-blue-700 mt-2">
                                  Se unirá como colaborador al álbum seleccionado.
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                            Lugar del evento *
                          </label>
                          {lockEventAlbumFields || (!!createFromEventId && !editingAlbumId) ? (
                            <div className="rounded-lg border border-[#e5e7eb] bg-gray-50 px-3 py-2 text-sm text-[#1a1a1a]">
                              {location || "—"}
                            </div>
                          ) : (
                            <EventLocationSearch
                              value={location}
                              onClear={() => setLocation("")}
                              onSelect={(_, __, displayName) => setLocation(displayName)}
                              placeholder="Ej: Teatro Colón, Estadio Monumental"
                              className={creating ? "opacity-60 pointer-events-none" : ""}
                            />
                          )}
                        </div>

                        <AlbumEventScheduleFields
                          value={eventSchedule}
                          onChange={setEventSchedule}
                          disabled={
                            creating ||
                            lockEventAlbumFields ||
                            (!!createFromEventId && !editingAlbumId)
                          }
                          readOnly={
                            lockEventAlbumFields ||
                            (!!createFromEventId && !editingAlbumId)
                          }
                        />

                        <div className="p-4 bg-[#f8f9fa] rounded-lg border border-[#e5e7eb]">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={showComingSoonMessage}
                              onChange={(e) => setShowComingSoonMessage(e.target.checked)}
                              disabled={creating}
                              className="mt-1 w-4 h-4 text-[#c27b3d] border-[#d1d5db] rounded focus:ring-[#c27b3d] focus:ring-2"
                            />
                            <div className="flex-1">
                              <span className="block text-sm font-medium text-[#1a1a1a] mb-1">
                                Mostrar mensaje "Las fotos serán subidas próximamente"
                              </span>
                              <span className="block text-xs text-[#6b7280]">
                                Si el álbum no tiene fotos, se mostrará un mensaje para que los clientes dejen su email y sean notificados cuando las fotos estén disponibles.
                              </span>
                            </div>
                          </label>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isPublic}
                              onChange={(e) => setIsPublic(e.target.checked)}
                              disabled={creating}
                              className="mt-1 w-5 h-5 text-blue-600 border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                            />
                            <div className="flex-1">
                              <span className="block text-sm font-semibold text-blue-900 mb-1">
                                🌐 Álbum Público
                              </span>
                              <span className="block text-xs text-blue-800 leading-relaxed">
                                {isPublic ? (
                                  <>
                                    Este álbum aparecerá en las páginas públicas (home de ComprameLaFoto y página del fotógrafo). Cualquiera podrá encontrarlo y acceder a él.
                                  </>
                                ) : (
                                  <>
                                    Este álbum será <strong>privado</strong>. Solo las personas con el link directo podrán acceder a él. No aparecerá en páginas públicas.
                                  </>
                                )}
                              </span>
                            </div>
                          </label>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg border-2 border-slate-200">
                          <label className={`flex items-start gap-3 ${albumDataLoading ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
                            <input
                              type="checkbox"
                              checked={hiddenPhotosEnabled}
                              onChange={(e) => setHiddenPhotosEnabled(e.target.checked)}
                              disabled={creating || albumDataLoading}
                              className="mt-1 w-5 h-5 text-slate-600 border-slate-300 rounded focus:ring-slate-500 focus:ring-2"
                            />
                            <div className="flex-1">
                              <span className="block text-sm font-semibold text-slate-800 mb-1">
                                🔒 Fotos ocultas hasta selfie
                              </span>
                              <span className="block text-xs text-slate-700 leading-relaxed">
                                Si está activado, los visitantes solo verán sus fotos después de subir una selfie (reconocimiento facial). Nadie verá todo el álbum sin verificar.
                              </span>
                            </div>
                          </label>
                          {hiddenPhotosEnabled && (
                            <div className="mt-3 pl-8">
                              <label className="block text-xs font-medium text-slate-700 mb-1">Retener selfie (días, opcional)</label>
                              <input
                                type="number"
                                min={0}
                                max={365}
                                placeholder="0 = no guardar"
                                value={hiddenSelfieRetentionDays}
                                onChange={(e) => setHiddenSelfieRetentionDays(e.target.value)}
                                disabled={creating || albumDataLoading}
                                className="w-full max-w-[120px] border border-slate-300 rounded px-2 py-1.5 text-sm"
                              />
                              <span className="block text-xs text-slate-500 mt-1">Ej: 7 o 30 para auditoría; la selfie se borra al cumplir los días.</span>
                            </div>
                          )}
                        </div>

                        {editingAlbumId && (
                          <div className="p-5 bg-gradient-to-br from-[#f8fafc] to-white rounded-xl border border-[#e2e8f0] shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-1 h-5 bg-[#6366f1] rounded-full" />
                              <h3 className="text-sm font-semibold text-[#1a1a1a]">Invitar clientes</h3>
                            </div>
                            <p className="text-xs text-[#64748b] mb-4">
                              Agregá emails y enviá invitaciones para que accedan al álbum. Podés escribir varios separados por coma o Enter.
                            </p>
                            <div className="space-y-3">
                              <div className="flex gap-2">
                                <Input
                                  type="text"
                                  placeholder="ej: cliente@mail.com, otro@mail.com"
                                  value={inviteEmailsInput}
                                  onChange={(e) => setInviteEmailsInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === ",") {
                                      e.preventDefault();
                                      addInviteEmailsFromInput();
                                    }
                                  }}
                                  disabled={inviteLoading}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={addInviteEmailsFromInput}
                                  disabled={inviteLoading || !inviteEmailsInput.trim()}
                                >
                                  Agregar
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-2 min-h-[32px]">
                                {inviteEmails.map((email) => (
                                  <span
                                    key={email}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#e0e7ff] text-[#4338ca] rounded-lg text-xs font-medium"
                                  >
                                    {email}
                                    <button
                                      type="button"
                                      onClick={() => setInviteEmails((prev) => prev.filter((e) => e !== email))}
                                      className="text-[#6366f1] hover:text-[#3730a3] disabled:opacity-50"
                                      disabled={inviteLoading}
                                      aria-label="Quitar"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                                {inviteEmails.length === 0 && (
                                  <span className="text-xs text-[#94a3b8] self-center">Ningún email agregado aún.</span>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="primary"
                                onClick={handleSendInvites}
                                disabled={inviteLoading || inviteEmails.length === 0}
                                className="w-full sm:w-auto"
                              >
                                {inviteLoading ? "Enviando…" : "Enviar invitaciones"}
                              </Button>
                            </div>
                          </div>
                        )}

                        {!isPublic && editingAlbumId && (
                          <div className="p-5 bg-gradient-to-br from-[#f8fafc] to-white rounded-xl border border-[#e2e8f0] shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-1 h-5 bg-[#10b981] rounded-full" />
                              <h3 className="text-sm font-semibold text-[#1a1a1a]">Usuarios con acceso</h3>
                            </div>
                            {inviteListLoading ? (
                              <p className="text-xs text-[#64748b]">Cargando…</p>
                            ) : (
                              <div className="space-y-2 text-xs">
                                {inviteAccesses.map((entry) => (
                                  <div key={`access-${entry.email}`} className="flex items-center justify-between py-1">
                                    <span className="text-[#475569]">{entry.email}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${entry.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                      {entry.status === "ACTIVE" ? "Activo" : "Pendiente"}
                                    </span>
                                  </div>
                                ))}
                                {invitePending.map((entry) => (
                                  <div key={`invite-${entry.email}`} className="flex items-center justify-between py-1">
                                    <span className="text-[#475569]">{entry.email}</span>
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700">
                                      Pendiente
                                    </span>
                                  </div>
                                ))}
                                {inviteAccesses.length === 0 && invitePending.length === 0 && (
                                  <p className="text-[#94a3b8] py-1">Aún no hay invitados. Usá el bloque de arriba para invitar.</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
                          ⏱ Este álbum se eliminará automáticamente en 30 días a partir de que se suban las fotografías.
                        </p>

                        {!editingAlbumId ? (
                          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                            Después de guardar, configurá precios y productos en la pestaña <strong>Venta</strong> del álbum.
                          </div>
                        ) : null}

                        <div className="pt-4 border-t border-[#e5e7eb] space-y-3">
                          <Button
                            type="button"
                            variant="primary"
                            onClick={handleCreateAlbum}
                            className="w-full"
                            disabled={creating || !title.trim()}
                          >
                            {creating ? (editingAlbumId ? "Guardando..." : "Creando...") : (editingAlbumId ? "Guardar Cambios" : "Guardar Álbum")}
                          </Button>
                          {!title.trim() && (
                            <p className="text-xs text-[#ef4444] mt-2 text-center">
                              Completa el título del álbum para continuar
                            </p>
                          )}
                        </div>
                    </div>
                  </div>

                  {error && (
                    <div
                      className="shrink-0 bg-[#fef2f2] border border-[#ef4444]/80 rounded-xl px-4 py-3 shadow-sm"
                      role="alert"
                    >
                      <p className="text-[#b91c1c] text-sm font-medium leading-snug">{error}</p>
                    </div>
                  )}

                  <div className="flex shrink-0 flex-wrap gap-3 justify-end pt-2 border-t border-[#e5e7eb] pb-[max(0px,env(safe-area-inset-bottom))]">
                    <Button
                      variant="secondary"
                      onClick={handleRequestCloseModal}
                      disabled={creating}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant="primary" 
                      onClick={handleCreateAlbum} 
                      disabled={creating || !title.trim() || (!editingAlbumId && !location.trim())}
                    >
                      {creating ? (editingAlbumId ? "Guardando..." : "Creando...") : (editingAlbumId ? "Guardar Cambios" : "Crear Álbum")}
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* Modal de términos y condiciones */}
          {showTermsModal && (
            <>
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setShowTermsModal(false)}
              />
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                <Card className="max-w-4xl shrink-0 w-full max-h-[90vh] flex flex-col">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-[#e5e7eb]">
                    <h2 className="text-xl font-medium text-[#1a1a1a]">
                      Términos y Condiciones – Fotógrafos
                    </h2>
                    <button
                      onClick={() => setShowTermsModal(false)}
                      className="text-[#6b7280] hover:text-[#1a1a1a]"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto pr-4 mb-4">
                    <div className="text-sm text-[#6b7280] mb-4 pb-4 border-b border-[#e5e7eb]">
                      Versión: {TERMS_VERSION}
                    </div>
                    <div className="prose prose-base max-w-none text-[#1a1a1a] whitespace-pre-line leading-relaxed" style={{ lineHeight: '1.7' }}>
                      {TERMS_TEXT}
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-[#e5e7eb]">
                    <Button variant="primary" onClick={() => setShowTermsModal(false)}>
                      Cerrar
                    </Button>
                  </div>
                </Card>
              </div>
            </>
          )}

        </div>
      </div>
    </section>
    </>
  );
}
