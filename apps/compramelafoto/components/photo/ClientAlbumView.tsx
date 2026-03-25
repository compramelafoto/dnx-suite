"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useGateVisibility } from "@/contexts/GateVisibilityContext";
import PhotoGrid from "./PhotoGrid";
import PhotoSlideViewer from "./PhotoSlideViewer";
import HiddenAlbumVerificationGate from "./HiddenAlbumVerificationGate";
import Button from "@/components/ui/Button";

type Album = {
  id: number;
  title: string;
  location: string | null;
  eventDate: string | null;
  createdAt: string;
  firstPhotoDate?: string | null;
  expirationExtensionDays?: number | null;
  isHidden?: boolean;
  showComingSoonMessage?: boolean;
  hiddenPhotosEnabled?: boolean;
  photos: { id: number; previewUrl: string; originalKey: string; analysisStatus?: string | null }[];
};

/**
 * Normaliza una previewUrl en el cliente para asegurar que sea una URL absoluta válida
 * Esta función es defensiva y solo se ejecuta si el servidor no normalizó correctamente
 */
function normalizePreviewUrlClient(previewUrl: string | null | undefined, originalKey?: string | null): string | null {
  const publicBase =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
    "";

  const buildUrlFromKey = (key: string): string | null => {
    if (!publicBase) return null;
    const cleanKey = key.replace(/^\//, "");
    return `${publicBase.replace(/\/$/, "")}/${cleanKey}`;
  };

  const extractKeyFromUrl = (url: string): string | null => {
    const match = url.match(/\/uploads\/.+/);
    if (match?.[0]) {
      return match[0].replace(/^\//, "");
    }
    return null;
  };

  // Si no hay previewUrl ni originalKey, retornar null
  if (!previewUrl && !originalKey) {
    return null;
  }

  // Si previewUrl es null/undefined pero tenemos originalKey, intentar construir desde originalKey
  if (!previewUrl && originalKey) {
    // Construir previewKey desde originalKey
    // originalKey es "uploads/uuid-original_xxx.jpg"
    // previewKey sería "uploads/uuid-preview_xxx.jpg"
    const previewKey = originalKey.replace(/original_/, "preview_");
    const built = buildUrlFromKey(previewKey);
    if (built) return built;
    console.warn("⚠️ previewUrl es null pero tenemos originalKey, falta NEXT_PUBLIC_R2_PUBLIC_URL");
    return null;
  }

  if (!previewUrl) {
    return null;
  }

  // Si ya es una URL absoluta válida, validarla
  if (previewUrl.startsWith("http://") || previewUrl.startsWith("https://")) {
    // Validación defensiva: nunca permitir localhost
    if (previewUrl.includes("localhost") || previewUrl.includes("127.0.0.1")) {
      console.warn(`⚠️ previewUrl con localhost detectada en cliente: ${previewUrl}`);
      // Si tenemos originalKey, intentar construir desde ahí
      if (originalKey) {
        const previewKey = originalKey.replace(/original_/, "preview_");
        const built = buildUrlFromKey(previewKey);
        if (built) return built;
      }
      const keyFromUrl = extractKeyFromUrl(previewUrl);
      if (keyFromUrl) {
        const built = buildUrlFromKey(keyFromUrl);
        if (built) return built;
      }
      return null;
    }
    return previewUrl;
  }

  // Si es un endpoint interno de previews protegidas, usarlo directo
  if (previewUrl.startsWith("/api/photos/")) {
    return previewUrl;
  }

  // Si es una ruta relativa, construir desde base pública
  if (previewUrl.startsWith("/uploads/") || previewUrl.startsWith("uploads/")) {
    const built = buildUrlFromKey(previewUrl);
    if (built) return built;
    console.warn(`⚠️ previewUrl relativa sin base pública: "${previewUrl}"`);
    return null;
  }

  // Si no reconocemos el formato, intentar construir desde originalKey si está disponible
  if (originalKey) {
    console.warn(`⚠️ previewUrl con formato desconocido en cliente: "${previewUrl}", debería haberse normalizado en servidor`);
    return null;
  }

  return previewUrl;
}

export default function ClientAlbumView({
  album,
  tertiaryColor,
  isAccessBlocked,
  initialHasGrant,
}: {
  album: Album;
  tertiaryColor?: string | null;
  isAccessBlocked?: boolean;
  /** Si es true (ej. dueño o admin), no se muestra el gate ni loading; se muestran las fotos de entrada */
  initialHasGrant?: boolean;
}) {
  const accentColor = tertiaryColor || "#c27b3d";
  const router = useRouter();
  const searchParams = useSearchParams();
  
  function handleRequestRemoval(photoId: string) {
    router.push(`/a/${album.id}/remover/${photoId}`);
  }
  
  // Inicializar con un Set vacío para evitar problemas de hidratación
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [notificationName, setNotificationName] = useState("");
  const [notificationWhatsapp, setNotificationWhatsapp] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [notificationSubmitted, setNotificationSubmitted] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationSelfie, setNotificationSelfie] = useState<File | null>(null);
  const [notificationSelfiePreview, setNotificationSelfiePreview] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [biometricConsent, setBiometricConsent] = useState(false);
  const notificationSelfieInputRef = useRef<HTMLInputElement | null>(null);
  const [showSlideViewer, setShowSlideViewer] = useState(false);
  const [slideViewerIndex, setSlideViewerIndex] = useState(0);
  const [slideViewerPhotoList, setSlideViewerPhotoList] = useState<Array<{ id: string; src: string; alt: string; selected: boolean }>>([]);
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [extensionSuccess, setExtensionSuccess] = useState(false);
  const [searchTab, setSearchTab] = useState<"text" | "face">("text");
  const [searchText, setSearchText] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ id: number; previewUrl: string; originalKey: string; analysisStatus?: string | null }>>([]);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreviewUrl, setFacePreviewUrl] = useState<string | null>(null);
  const [faceInputMode, setFaceInputMode] = useState<"camera" | "file">("camera");
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [showFaceConsentModal, setShowFaceConsentModal] = useState(false);
  const [faceConsentLoading, setFaceConsentLoading] = useState(false);
  const [authUser, setAuthUser] = useState<{ id: number; faceConsent?: boolean } | null | undefined>(undefined);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Verificación de grant para álbum con fotos ocultas (dueño/admin ya tienen grant desde el servidor → sin parpadeo del gate)
  const [grantLoading, setGrantLoading] = useState(
    !!album.hiddenPhotosEnabled && !initialHasGrant
  );
  const [hasGrant, setHasGrant] = useState(
    !album.hiddenPhotosEnabled || !!initialHasGrant
  );
  /** IDs de fotos que el usuario puede ver tras selfie; null = ver todas (dueño/admin o álbum sin ocultas) */
  const [allowedPhotoIds, setAllowedPhotoIds] = useState<number[] | null>(null);

  useEffect(() => {
    if (!album.hiddenPhotosEnabled) {
      setHasGrant(true);
      setGrantLoading(false);
      setAllowedPhotoIds(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/albums/${album.id}/hidden/check-grant`, { credentials: "include" })
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (!cancelled) {
          setHasGrant(Boolean(data?.hasGrant));
          setAllowedPhotoIds(
            Array.isArray(data?.allowedPhotoIds) ? data.allowedPhotoIds : null
          );
        }
      })
      .finally(() => {
        if (!cancelled) setGrantLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [album.id, album.hiddenPhotosEnabled]);

  const gateVisibility = useGateVisibility();
  const gateVisible = Boolean(album.hiddenPhotosEnabled && (grantLoading || !hasGrant));
  useEffect(() => {
    gateVisibility?.setGateVisible(gateVisible);
    return () => {
      gateVisibility?.setGateVisible(false);
    };
  }, [gateVisible, gateVisibility]);

  const hasSelection = selected.size > 0;
  

  // Si llega con ?fotos=1&t=TOKEN (link del email), cargar fotos filtradas por rostro
  const fotosParam = searchParams.get("fotos");
  const tokenParam = searchParams.get("t");
  useEffect(() => {
    if (fotosParam !== "1" || !tokenParam || album.photos.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/a/my-face-photos?t=${encodeURIComponent(tokenParam)}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data.photoIds) && data.photoIds.length > 0) {
          const idSet = new Set(data.photoIds);
          const filtered = album.photos.filter((p) => idSet.has(p.id));
          if (filtered.length > 0) {
            setSearchResults(filtered);
            setSearchTab("face");
            // Limpiar la URL de los params
            const url = new URL(window.location.href);
            url.searchParams.delete("fotos");
            url.searchParams.delete("t");
            window.history.replaceState({}, "", url.pathname + url.search);
          }
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [fotosParam, tokenParam, album.id, album.photos]);

  // Cargar selección guardada desde sessionStorage solo en el cliente después del mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = sessionStorage.getItem(`album_${album.id}_selection`);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        setSelected(new Set(parsed));
      }
    } catch {}
  }, [album.id]);

  // Guardar selección en sessionStorage cada vez que cambia (solo si está montado)
  useEffect(() => {
    if (!mounted) return;
    const arr = Array.from(selected);
    if (arr.length > 0) {
      sessionStorage.setItem(`album_${album.id}_selection`, JSON.stringify(arr));
    } else {
      sessionStorage.removeItem(`album_${album.id}_selection`);
    }
  }, [selected, album.id, mounted]);

  useEffect(() => {
    if (!faceFile) {
      if (facePreviewUrl) URL.revokeObjectURL(facePreviewUrl);
      setFacePreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(faceFile);
    setFacePreviewUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [faceFile, facePreviewUrl]);

  // Preview de selfie para registro de interés
  useEffect(() => {
    if (!notificationSelfie) {
      if (notificationSelfiePreview) URL.revokeObjectURL(notificationSelfiePreview);
      setNotificationSelfiePreview(null);
      return;
    }
    const nextUrl = URL.createObjectURL(notificationSelfie);
    setNotificationSelfiePreview(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [notificationSelfie, notificationSelfiePreview]);

  // Cerrar modales con ESC
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (showFaceModal) {
          setShowFaceModal(false);
        }
        if (showOcrModal) {
          setShowOcrModal(false);
        }
      }
    }
    if (showFaceModal || showOcrModal) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [showFaceModal, showOcrModal]);

  // Mantener la lista del slide en sync con la selección para que el botón "Seleccionar" se actualice
  useEffect(() => {
    if (!showSlideViewer || slideViewerPhotoList.length === 0) return;
    setSlideViewerPhotoList((prev) =>
      prev.map((p) => ({ ...p, selected: selected.has(p.id) }))
    );
  }, [selected, showSlideViewer]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleComprar() {
    if (selected.size === 0) return;
    // Guardar selección antes de redirigir
    const arr = Array.from(selected);
    sessionStorage.setItem(`album_${album.id}_selection`, JSON.stringify(arr));
    router.push(`/a/${album.id}/comprar?photoIds=${arr.join(",")}`);
  }


  async function handleNotifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notificationName.trim() || !notificationWhatsapp.trim()) return;
    
    // Validar términos y condiciones
    if (!termsAccepted) {
      alert("Debés aceptar los Términos y Condiciones para continuar.");
      return;
    }
    
    // Validar consentimiento biométrico si hay selfie
    if (notificationSelfie && !biometricConsent) {
      alert("Si subís una selfie, debés aceptar el consentimiento biométrico para que podamos avisarte cuando aparezcan tus fotos.");
      return;
    }

    setNotificationLoading(true);
    try {
      // Dividir el nombre completo en nombre y apellido (si hay espacio)
      const nameParts = notificationName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Si hay selfie, usar el nuevo endpoint con FormData
      if (notificationSelfie) {
        const formData = new FormData();
        formData.append("name", firstName);
        formData.append("lastName", lastName);
        formData.append("whatsapp", notificationWhatsapp.trim());
        formData.append("email", notificationEmail.trim() || "");
        formData.append("selfie", notificationSelfie);
        formData.append("termsAccepted", "true");
        formData.append("biometricConsent", "true");

        const res = await fetch(`/api/a/${album.id}/register-interest`, {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Error registrando interés");
        }
      } else {
        // Sin selfie, usar el endpoint tradicional
        const res = await fetch(`/api/a/${album.id}/notifications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            name: firstName,
            lastName: lastName,
            whatsapp: notificationWhatsapp.trim(),
            email: notificationEmail.trim() || undefined
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Error suscribiendo notificación");
        }
      }

      setNotificationSubmitted(true);
      setNotificationName("");
      setNotificationWhatsapp("");
      setNotificationEmail("");
      setNotificationSelfie(null);
      setNotificationSelfiePreview(null);
      setTermsAccepted(false);
      setBiometricConsent(false);
    } catch (err: any) {
      alert(err?.message || "Error. Por favor intentá nuevamente.");
    } finally {
      setNotificationLoading(false);
    }
  }

  const baseDate = album.firstPhotoDate
    ? new Date(album.firstPhotoDate)
    : album.photos.length > 0
      ? new Date(album.createdAt)
      : null;
  const extensionDays = album.expirationExtensionDays ?? 0;
  const visibleUntil = baseDate
    ? new Date(baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000)
    : null;
  const now = new Date();
  const isExpired = visibleUntil ? now >= visibleUntil : false;

  // Álbum con fotos ocultas: mostrar gate de verificación hasta tener grant
  if (album.hiddenPhotosEnabled && (grantLoading || !hasGrant)) {
    return (
      <main className="select-none w-full max-w-none box-border" style={{ padding: 24 }}>
        <h1 className="text-2xl font-medium text-[#1a1a1a] mb-6">{album.title}</h1>
        <div className="w-full flex justify-center">
          <HiddenAlbumVerificationGate
          albumId={album.id}
          albumTitle={album.title}
          tertiaryColor={tertiaryColor}
        />
        </div>
      </main>
    );
  }

  if (isAccessBlocked) {
    return (
      <main className="select-none" style={{ padding: 24 }}>
        <h1 className="text-2xl font-medium text-[#1a1a1a] mb-6">{album.title}</h1>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-5xl border border-amber-200 bg-amber-50 rounded-xl p-8 text-center space-y-4">
            <div className="flex justify-center">
              <img
                src="/watermark.png"
                alt="ComprameLaFoto"
                className="w-[21rem] h-auto opacity-90"
              />
            </div>
            <p className="text-amber-800 font-medium">
              Este album esta pronto a eliminarse y ya no esta disponible. Si realmente queres adquirir alguna fotografia podes reactivarlo y solicitar las fotos que desees por tiempo limitado.
            </p>
            {visibleUntil && (
              <p className="text-sm text-amber-700">
                Eliminacion programada: {visibleUntil.toLocaleDateString("es-AR")}
              </p>
            )}
            <p className="text-xs text-amber-700">
              Podes solicitar una reactivacion por 30 dias. Durante el periodo
              extendido se aplican los recargos configurados.
            </p>
            <Button
              variant="primary"
              onClick={handleRequestExtension}
              disabled={extensionLoading || extensionSuccess}
              className="text-sm"
            >
              {extensionSuccess ? "Solicitado ✅" : extensionLoading ? "Solicitando..." : "Reactivar 30 dias"}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // Con fotos ocultas y grant por selfie: solo mostrar las autorizadas para ese rostro (no las demás ni como "dañadas")
  const photosToShow =
    album.hiddenPhotosEnabled && hasGrant && allowedPhotoIds !== null
      ? album.photos.filter((p) => allowedPhotoIds.includes(p.id))
      : album.photos;

  const photos = photosToShow.map((p) => {
    // Normalización defensiva en el cliente
    const normalizedUrl = normalizePreviewUrlClient(p.previewUrl, p.originalKey);
    if (!normalizedUrl) {
      console.warn(`⚠️ No se pudo normalizar previewUrl para foto ${p.id}, previewUrl: "${p.previewUrl}", originalKey: "${p.originalKey}"`);
    }
    const analysis = (p.analysisStatus || "").toUpperCase();
    const statusBadge =
      analysis && analysis !== "DONE"
        ? analysis === "ERROR"
          ? "Error análisis"
          : "Analizando..."
        : null;
    return {
      id: String(p.id),
      src: normalizedUrl || "", // Usar solo URL normalizada
      alt: `Foto ${p.id}`,
      selected: selected.has(String(p.id)),
      statusBadge,
    };
  }).filter((p) => p.src); // Filtrar fotos sin URL válida

  const searchPhotos = searchResults
    .map((p) => {
      // Asegurar que siempre usamos el endpoint con marca de agua
      // Los endpoints de búsqueda ya devuelven /api/photos/[id]/view, pero por seguridad lo forzamos
      // Siempre usar mode=preview para asegurar marca de agua
      const watermarkedUrl = `/api/photos/${p.id}/view?mode=preview&albumId=${album.id}`;
      return {
        id: String(p.id),
        src: watermarkedUrl,
        alt: `Foto ${p.id}`,
        selected: selected.has(String(p.id)),
      };
    })
    .filter((p): p is { id: string; src: string; alt: string; selected: boolean } => Boolean(p));

  async function handleSearchText() {
    if (searchText.trim().length < 3) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/albums/${album.id}/search/text?q=${encodeURIComponent(searchText.trim())}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error buscando texto");
      setSearchResults(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      setSearchError(err?.message || "Error buscando texto");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleSearchFace(fileOverride?: File) {
    const fileToUse = fileOverride || faceFile;
    if (!fileToUse) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const formData = new FormData();
      formData.append("file", fileToUse);
      const res = await fetch(`/api/albums/${album.id}/search/face`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Error buscando rostro");
      setSearchResults(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      setSearchError(err?.message || "Error buscando rostro");
    } finally {
      setSearchLoading(false);
    }
  }


  async function handleRequestExtension() {
    if (extensionLoading) return;
    setExtensionLoading(true);
    try {
      const res = await fetch("/api/album-extensions/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId: album.id, daysToAdd: 30 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error solicitando reactivación");
      }
      setExtensionSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err: any) {
      alert(err?.message || "No se pudo solicitar la reactivación");
    } finally {
      setExtensionLoading(false);
    }
  }

  return (
    <main className="select-none" style={{ padding: 24 }} data-protected="true">
      <h1 className="text-2xl font-medium text-[#1a1a1a] mb-1">{album.title}</h1>
      <div className="text-[#6b7280] text-sm space-y-1 mb-6">
        {(album.isHidden || isExpired) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <div className="flex flex-col items-center gap-3">
              <img
                src="/watermark.png"
                alt="ComprameLaFoto"
                className="w-56 h-auto opacity-90"
              />
              <p className="text-amber-800 font-medium text-center">
                Este álbum está pronto a eliminarse.
              </p>
              <p className="text-xs text-amber-700 text-center max-w-lg">
                Podés reactivarlo por 30 días. Durante el período extendido se aplican los recargos configurados.
              </p>
              <Button
                variant="primary"
                onClick={handleRequestExtension}
                disabled={extensionLoading || extensionSuccess}
                className="text-sm"
              >
                {extensionSuccess ? "Solicitado ✅" : extensionLoading ? "Solicitando..." : "Reactivar 30 días"}
              </Button>
            </div>
          </div>
        )}
        {album.location && <p>📍 {album.location}</p>}
        {album.eventDate && (
          <p>📅 {new Date(album.eventDate).toLocaleDateString("es-AR")}</p>
        )}
        {visibleUntil && (
          <p className="text-amber-700 font-medium mt-2">
            ⏱ Este álbum se eliminará automáticamente el {visibleUntil.toLocaleDateString("es-AR")}
          </p>
        )}
      </div>

      <hr className="border-[#e5e7eb] my-6" />

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-[#1a1a1a]">
          Fotos ({album.photos.length})
        </h2>
      </div>

      {album.photos.length === 0 ? (
        <div className="space-y-4">
          {album.showComingSoonMessage ? (
            <>
              <div className="flex flex-col items-center gap-4 py-6">
                <img 
                  src="/watermark.png" 
                  alt="ComprameLaFoto" 
                  className="w-48 h-auto opacity-90"
                />
                <p className="text-[#6b7280] text-lg text-center">
                  Las fotos serán subidas próximamente.
                </p>
              </div>
              {!notificationSubmitted ? (
                <div className="container-custom">
                  <div className="max-w-4xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
                    <div
                      style={{
                        textAlign: "center",
                        padding: "0 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                        alignItems: "center",
                      }}
                    >
                      <p
                        className="max-w-full md:max-w-[50%] mx-auto"
                        style={{
                          fontSize: "clamp(16px, 2vw, 18px)",
                          fontWeight: "normal",
                          color: "#1a1a1a",
                          lineHeight: "1.5",
                          margin: 0,
                          width: "100%",
                          wordBreak: "normal",
                          overflowWrap: "normal",
                          whiteSpace: "normal",
                        }}
                      >
                        Dejá tus datos y te avisaremos apenas estén disponibles:
                      </p>
                    </div>
                    <form onSubmit={handleNotifySubmit} className="space-y-4 max-w-full md:max-w-[50%] mx-auto">
                      <div>
                        <input
                          id="album-notification-name"
                          name="notificationName"
                          type="text"
                          value={notificationName}
                          onChange={(e) => setNotificationName(e.target.value)}
                          placeholder="Nombre completo"
                          required
                          disabled={notificationLoading}
                          className="w-full px-4 py-3 text-base border rounded-md focus:outline-none"
                          style={{ 
                            borderColor: "#d1d5db",
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = accentColor;
                            e.target.style.boxShadow = `0 0 0 2px ${accentColor}40`;
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "#d1d5db";
                            e.target.style.boxShadow = "none";
                          }}
                        />
                      </div>
                      <div>
                        <input
                          id="album-notification-whatsapp"
                          name="notificationWhatsapp"
                          type="tel"
                          value={notificationWhatsapp}
                          onChange={(e) => setNotificationWhatsapp(e.target.value)}
                          placeholder="WhatsApp (ej: +5491123456789)"
                          required
                          disabled={notificationLoading}
                          className="w-full px-4 py-3 text-base border rounded-md focus:outline-none"
                          style={{ 
                            borderColor: "#d1d5db",
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = accentColor;
                            e.target.style.boxShadow = `0 0 0 2px ${accentColor}40`;
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "#d1d5db";
                            e.target.style.boxShadow = "none";
                          }}
                        />
                      </div>
                      <div>
                        <input
                          id="album-notification-email"
                          name="notificationEmail"
                          type="email"
                          value={notificationEmail}
                          onChange={(e) => setNotificationEmail(e.target.value)}
                          placeholder="Email"
                          required
                          disabled={notificationLoading}
                          className="w-full px-4 py-3 text-base border rounded-md focus:outline-none"
                          style={{ 
                            borderColor: "#d1d5db",
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = accentColor;
                            e.target.style.boxShadow = `0 0 0 2px ${accentColor}40`;
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "#d1d5db";
                            e.target.style.boxShadow = "none";
                          }}
                        />
                      </div>
                      
                      {/* Opción de subir selfie - mismo estilo que búsqueda por rostro */}
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-[#1a1a1a]">
                          Selfie (opcional) - Te avisaremos automáticamente cuando aparezcan tus fotos
                        </label>
                        <input
                          ref={notificationSelfieInputRef}
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setNotificationSelfie(file);
                            if (!file) {
                              setBiometricConsent(false);
                            }
                          }}
                          disabled={notificationLoading}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => notificationSelfieInputRef.current?.click()}
                          disabled={notificationLoading}
                          className={`flex w-full max-w-[280px] mx-auto flex-col items-center justify-center gap-3 rounded-[28px] border px-6 py-6 text-center shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed sm:h-[260px] sm:max-w-none sm:py-0 ${
                            notificationSelfie
                              ? "border-[#10b981] hover:border-[#10b981]"
                              : "border-[#e5e7eb] hover:border-[#cbd5f5]"
                          }`}
                          style={notificationSelfie ? { backgroundColor: `${accentColor}14` } : undefined}
                        >
                          {notificationSelfie && notificationSelfiePreview ? (
                            <>
                              <img
                                src={notificationSelfiePreview}
                                alt="Tu selfie"
                                className="h-[140px] w-[140px] rounded-3xl border border-[#e5e7eb] bg-white object-cover sm:h-[180px] sm:w-[180px]"
                              />
                              <div>
                                <p className="text-base font-semibold text-[#1a1a1a]">Selfie cargada</p>
                                <p className="text-xs text-[#6b7280]">Tocá para cambiar</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <img
                                src="/faceid.png"
                                alt="Tomar selfie"
                                className="h-[140px] w-[140px] rounded-3xl border border-[#e5e7eb] bg-white p-5 object-contain sm:h-[195px] sm:w-[195px]"
                              />
                              <div>
                                <p className="text-base font-semibold text-[#1a1a1a]">Tomar/Subir selfie</p>
                                <p className="text-xs text-[#6b7280]">Reconocimiento facial con IA</p>
                              </div>
                            </>
                          )}
                        </button>
                        {notificationSelfie && (
                          <div className="text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setNotificationSelfie(null);
                                setBiometricConsent(false);
                                if (notificationSelfieInputRef.current) {
                                  notificationSelfieInputRef.current.value = "";
                                }
                              }}
                              disabled={notificationLoading}
                              className="text-sm text-red-600 hover:text-red-700 hover:underline transition-colors disabled:opacity-50"
                            >
                              Eliminar selfie
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Checkboxes de consentimiento */}
                      <div className="space-y-3 pt-2">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            disabled={notificationLoading}
                            className="mt-1 w-4 h-4 rounded border-[#d1d5db] text-[#c27b3d] focus:ring-2 focus:ring-[#c27b3d]"
                            style={{ accentColor }}
                            required
                          />
                          <span className="text-sm text-[#1a1a1a]">
                            Acepto los <a href="/terminos" target="_blank" className="underline text-[#c27b3d] hover:text-[#a0662f]">Términos y Condiciones</a> *
                          </span>
                        </label>
                        {notificationSelfie && (
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={biometricConsent}
                              onChange={(e) => setBiometricConsent(e.target.checked)}
                              disabled={notificationLoading}
                              className="mt-1 w-4 h-4 rounded border-[#d1d5db] text-[#c27b3d] focus:ring-2 focus:ring-[#c27b3d]"
                              style={{ accentColor }}
                              required
                            />
                            <span className="text-sm text-[#1a1a1a]">
                              Acepto el <a href="/consentimiento-biometrico" target="_blank" className="underline text-[#c27b3d] hover:text-[#a0662f]">Consentimiento Biométrico</a> para el reconocimiento facial. Entiendo que mis datos biométricos se eliminarán automáticamente después de 90 días. *
                            </span>
                          </label>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={notificationLoading || !notificationName.trim() || !notificationWhatsapp.trim() || !termsAccepted || (notificationSelfie ? !biometricConsent : false)}
                        className="w-full px-6 py-3 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap font-medium transition-colors"
                        style={{ 
                          backgroundColor: accentColor,
                        }}
                        onMouseEnter={(e) => {
                          if (!e.currentTarget.disabled) {
                            // Oscurecer el color en 10%
                            const rgb = accentColor.match(/\w\w/g)?.map(x => parseInt(x, 16)) || [194, 123, 61];
                            const darker = `rgb(${Math.max(0, rgb[0] - 20)}, ${Math.max(0, rgb[1] - 20)}, ${Math.max(0, rgb[2] - 20)})`;
                            e.currentTarget.style.backgroundColor = darker;
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = accentColor;
                        }}
                      >
                        {notificationLoading ? "..." : "Avisame"}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="container-custom">
                  <div className="max-w-4xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
                    <div
                      style={{
                        textAlign: "center",
                        padding: "0 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                        alignItems: "center",
                      }}
                    >
                      <div className="p-4 bg-[#10b981]/10 border border-[#10b981]/20 rounded-md max-w-full md:max-w-[50%] mx-auto">
                        <p
                          style={{
                            fontSize: "clamp(14px, 1.5vw, 16px)",
                            fontWeight: "normal",
                            color: "#10b981",
                            lineHeight: "1.5",
                            margin: 0,
                            wordBreak: "normal",
                            overflowWrap: "normal",
                            whiteSpace: "normal",
                            textAlign: "center",
                          }}
                        >
                          ✅ Perfecto! Te avisaremos cuando las fotos estén disponibles.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-[#6b7280]">No hay fotos en este álbum.</p>
          )}
        </div>
      ) : (
        <>
          {album.photos.length > 0 && (
            <div className="mb-6 border border-[#e5e7eb] rounded-2xl p-5 bg-white shadow-sm">
              <div className="mb-5">
                <h3 className="text-xl font-semibold text-[#1a1a1a]">Buscá tus fotos con IA</h3>
                <p className="text-sm text-[#6b7280] mt-2">
                  Elegí una opción: reconocimiento facial con selfie o búsqueda por palabras clave
                  (patente, dorsal, DNI, nombre).
                </p>
              </div>
            <div className="mb-6 flex flex-col items-center">
              <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={async () => {
                    setSearchTab("face");
                    if (authUser === undefined) {
                      const res = await fetch("/api/auth/me", { credentials: "include" });
                      const data = await res.json().catch(() => ({}));
                      const u = data?.user ?? null;
                      setAuthUser(u ? { id: u.id, faceConsent: u.faceConsent } : null);
                      if (u?.faceConsent || (typeof window !== "undefined" && sessionStorage.getItem("faceConsentSession"))) {
                        setShowFaceModal(true);
                      } else {
                        setShowFaceConsentModal(true);
                      }
                    } else if (authUser?.faceConsent || (typeof window !== "undefined" && sessionStorage.getItem("faceConsentSession"))) {
                      setShowFaceModal(true);
                    } else {
                      setShowFaceConsentModal(true);
                    }
                  }}
                  className={`flex w-full flex-col items-center justify-center gap-4 rounded-[28px] border px-6 py-6 text-center shadow-lg transition sm:h-[260px] sm:w-full sm:py-0 ${
                    searchTab === "face"
                      ? "border-transparent"
                      : "border-[#e5e7eb] hover:border-[#cbd5f5]"
                  }`}
                  style={searchTab === "face" ? { backgroundColor: `${accentColor}14` } : undefined}
                >
                  <img
                    src="/faceid.png"
                    alt="Encontrá tus fotos"
                    className="h-[195px] w-[195px] rounded-3xl border border-[#e5e7eb] bg-white p-5 object-contain sm:h-[235px] sm:w-[235px]"
                  />
                  <div>
                    <p className="text-base font-semibold text-[#1a1a1a]">Encontrá tu foto</p>
                    <p className="text-xs text-[#6b7280]">Reconocimiento facial con IA</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTab("text");
                    setShowOcrModal(true);
                  }}
                  className={`flex w-full flex-col items-center justify-center gap-4 rounded-[28px] border px-6 py-6 text-center shadow-lg transition sm:h-[260px] sm:w-full sm:py-0 ${
                    searchTab === "text"
                      ? "border-transparent"
                      : "border-[#e5e7eb] hover:border-[#cbd5f5]"
                  }`}
                  style={searchTab === "text" ? { backgroundColor: `${accentColor}14` } : undefined}
                >
                  <img
                    src="/OCR.png"
                    alt="OCR"
                    className="h-[195px] w-[195px] rounded-3xl border border-[#e5e7eb] bg-white p-5 object-contain sm:h-[235px] sm:w-[235px]"
                  />
                  <div>
                    <p className="text-base font-semibold text-[#1a1a1a]">Buscá por número</p>
                    <p className="text-xs text-[#6b7280]">
                      Camiseta, patente, pechera, dorsal
                    </p>
                  </div>
                </button>
              </div>
            </div>
            {searchError && (
              <p className="mt-3 text-sm text-[#ef4444]">{searchError}</p>
            )}
            {showFaceConsentModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                  <h3 className="text-lg font-semibold text-[#1a1a1a] mb-3">Reconocimiento facial</h3>
                  <p className="text-sm text-[#6b7280] mb-6">
                    Esta función usa reconocimiento facial para ayudarte a encontrar tus fotos en el álbum.
                  </p>
                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => setShowFaceConsentModal(false)}
                      disabled={faceConsentLoading}
                    >
                      No, gracias
                    </Button>
                    <Button
                      variant="primary"
                      onClick={async () => {
                        setFaceConsentLoading(true);
                        try {
                          if (authUser) {
                            await fetch("/api/users/me/face-consent", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ faceConsent: true }),
                              credentials: "include",
                            });
                            setAuthUser({ ...authUser, faceConsent: true });
                          } else if (typeof window !== "undefined") {
                            sessionStorage.setItem("faceConsentSession", "1");
                          }
                          setShowFaceConsentModal(false);
                          setShowFaceModal(true);
                        } finally {
                          setFaceConsentLoading(false);
                        }
                      }}
                      disabled={faceConsentLoading}
                    >
                      {faceConsentLoading ? "..." : "Acepto"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {showFaceModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#1a1a1a]">Encontrá tus fotos</h3>
                    <button
                      type="button"
                      className="text-sm text-[#6b7280] hover:text-[#1a1a1a]"
                      onClick={() => setShowFaceModal(false)}
                    >
                      Cerrar
                    </button>
                  </div>
                  <p className="text-sm text-[#6b7280] mb-4">
                    Elegí cómo querés cargar tu selfie.
                  </p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-[#e5e7eb] bg-white px-6 py-8 text-center shadow-lg transition hover:border-[#cbd5f5]">
                      <input
                        type="file"
                        accept="image/*"
                        capture="user"
                        className="hidden"
                        ref={cameraInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setFaceFile(file);
                          if (file) {
                            setFaceInputMode("camera");
                            setShowFaceModal(false);
                            handleSearchFace(file);
                          }
                        }}
                      />
                      <div className="flex h-[120px] w-[120px] items-center justify-center rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-sm sm:h-[140px] sm:w-[140px]">
                        <svg
                          viewBox="0 0 64 64"
                          className="h-full w-full"
                          aria-hidden="true"
                        >
                          <rect x="10" y="18" width="44" height="30" rx="6" fill="#E5E7EB" />
                          <rect x="18" y="14" width="12" height="6" rx="2" fill="#9CA3AF" />
                          <circle cx="32" cy="33" r="10" fill="#FFFFFF" stroke="#6B7280" strokeWidth="3" />
                          <circle cx="46" cy="24" r="2.5" fill="#6B7280" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-[#1a1a1a]">Tomar selfie</p>
                        <p className="text-xs text-[#6b7280]">Abrí la cámara frontal</p>
                      </div>
                    </label>
                    <label className="group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-[#e5e7eb] bg-white px-6 py-8 text-center shadow-lg transition hover:border-[#cbd5f5]">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setFaceFile(file);
                          if (file) {
                            setFaceInputMode("file");
                            setShowFaceModal(false);
                            handleSearchFace(file);
                          }
                        }}
                      />
                      <div className="flex h-[120px] w-[120px] items-center justify-center rounded-3xl border border-[#e5e7eb] bg-white p-6 shadow-sm sm:h-[140px] sm:w-[140px]">
                        <svg
                          viewBox="0 0 64 64"
                          className="h-full w-full"
                          aria-hidden="true"
                        >
                          <path
                            d="M32 14v26"
                            stroke="#6B7280"
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                          <path
                            d="M24 26l8-8 8 8"
                            stroke="#6B7280"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <rect x="12" y="40" width="40" height="12" rx="6" fill="#E5E7EB" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-base font-semibold text-[#1a1a1a]">Subir archivo</p>
                        <p className="text-xs text-[#6b7280]">Elegí una selfie guardada</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}
            {showOcrModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="ocr-modal-title">
                <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <img src="/OCR.png" alt="" className="h-10 w-10 object-contain" aria-hidden />
                      <h3 id="ocr-modal-title" className="text-lg font-semibold text-[#1a1a1a]">OCR</h3>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-[#6b7280] hover:text-[#1a1a1a] p-1"
                      onClick={() => setShowOcrModal(false)}
                      aria-label="Cerrar"
                    >
                      Cerrar
                    </button>
                  </div>
                  <p className="text-sm text-[#6b7280] mb-4">
                    Escribí acá lo que querés buscar y hacé clic en <strong>Buscar</strong>. Patente, dorsal, camiseta, DNI o nombre.
                  </p>
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <input
                          id="album-search-ocr"
                          name="searchText"
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && searchText.trim().length >= 3 && !searchLoading) {
                              handleSearchText();
                              setShowOcrModal(false);
                            }
                          }}
                          placeholder="Ej: apellido, patente, dorsal..."
                          className="w-full border border-[#e5e7eb] rounded-md pl-9 pr-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-offset-0"
                          onFocus={(e) => {
                            e.target.style.borderColor = accentColor;
                            e.target.style.boxShadow = `0 0 0 2px ${accentColor}40`;
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = "#e5e7eb";
                            e.target.style.boxShadow = "none";
                          }}
                          autoFocus
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af] text-lg">
                          🔎
                        </span>
                      </div>
                      <Button 
                        variant="primary" 
                        onClick={() => {
                          handleSearchText();
                          setShowOcrModal(false);
                        }} 
                        disabled={searchLoading || searchText.trim().length < 3}
                        className="px-6 py-3"
                      >
                        {searchLoading ? "Buscando..." : "Buscar"}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-[#6b7280]">
                      {["PATENTE", "CAMISETA", "DORSAL", "DNI", "NOMBRE", "PALABRA"].map((hint) => (
                        <button
                          key={hint}
                          type="button"
                          onClick={() => setSearchText(hint)}
                          className="rounded-full border border-[#e5e7eb] px-3 py-1 hover:border-[#cbd5f5] transition"
                        >
                          {hint}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {searchLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-[#6b7280]">
                <span className="animate-pulse">⏳</span>
                Procesando búsqueda...
              </div>
            )}
            {!searchLoading && searchResults.length === 0 && (searchText.trim() || faceFile) && (
              <div className="mt-4 rounded-md border border-dashed border-[#e5e7eb] p-4 text-sm text-[#6b7280]">
                No encontramos resultados todavía. Probá con otro texto o una selfie más clara.
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-[#6b7280]">
                    Resultados: {searchResults.length}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchResults([])}
                    className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline"
                  >
                    Limpiar resultados
                  </button>
                </div>
                <PhotoGrid
                  photos={searchPhotos}
                  onPhotoSelect={toggle}
                  onPhotoOpenSlide={(id) => {
                    const index = searchPhotos.findIndex((p) => p.id === id);
                    if (index !== -1) {
                      setSlideViewerPhotoList(searchPhotos);
                      setSlideViewerIndex(index);
                      setShowSlideViewer(true);
                    }
                  }}
                  noDrag
                />
              </div>
            )}
          </div>
          )}
          {album.photos.length > 0 && (
            <div className="mb-6 flex justify-center">
              <button
                onClick={() => {
                  setSlideViewerPhotoList(photos.map((p) => ({ id: p.id, src: p.src, alt: p.alt, selected: p.selected })));
                  setSlideViewerIndex(0);
                  setShowSlideViewer(true);
                }}
                className="flex w-full max-w-4xl items-center justify-center gap-4 rounded-2xl border-2 border-[#2563eb] bg-[#2563eb] px-6 py-5 text-lg font-semibold text-white shadow-lg transition hover:bg-[#1d4ed8] hover:border-[#1d4ed8] hover:shadow-xl"
                title="Ver fotos en slide en pantalla completa"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-8 w-8 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                Ver fotos en slide en pantalla completa
              </button>
            </div>
          )}
          <p className="text-sm text-[#6b7280] mb-4">
            <strong className="text-[#1a1a1a]">Hacé clic en cada foto</strong> para seleccionarla o deseleccionarla. Cuando termines, hacé clic en <strong>Comprar seleccionadas</strong>. En la siguiente página podrás elegir el formato de cada foto: archivo digital o cualquier tipo de impresión disponible.
          </p>
          <PhotoGrid
            photos={photos}
            onPhotoSelect={toggle}
            onPhotoRequestRemoval={handleRequestRemoval}
            noDrag
            onPhotoOpenSlide={(id) => {
              const index = photos.findIndex((p) => p.id === id);
              if (index !== -1) {
                setSlideViewerPhotoList(photos.map((p) => ({ id: p.id, src: p.src, alt: p.alt, selected: p.selected })));
                setSlideViewerIndex(index);
                setShowSlideViewer(true);
              }
            }}
          />
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button
              variant="primary"
              onClick={handleComprar}
              disabled={selected.size === 0}
            >
              Comprar seleccionadas {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-sm text-[#6b7280] hover:text-[#1a1a1a] underline"
              >
                Deseleccionar todas
              </button>
            )}
          </div>
        </>
      )}

      {/* CTA flotante */}
      <button
        type="button"
        onClick={handleComprar}
        disabled={!hasSelection}
        className={`fixed z-40 right-5 bottom-5 md:right-8 md:bottom-8 px-4 py-3 rounded-full shadow-lg text-white text-sm font-semibold transition-all ${
          hasSelection
            ? "bg-[#c27b3d] hover:bg-[#a0652d]"
            : "bg-[#9ca3af] cursor-not-allowed"
        }`}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        {hasSelection ? "Comprar fotos" : "Seleccioná fotos"}
      </button>

      {/* Slide Viewer */}
      {showSlideViewer && slideViewerPhotoList.length > 0 && (
        <PhotoSlideViewer
          photos={slideViewerPhotoList}
          initialIndex={slideViewerIndex}
          onClose={() => setShowSlideViewer(false)}
          onPhotoSelect={toggle}
        />
      )}
    </main>
  );
}
