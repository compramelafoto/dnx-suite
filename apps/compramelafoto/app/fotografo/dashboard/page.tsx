"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import RecommendLabModal from "@/components/RecommendLabModal";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import type { InteresadoRow } from "@/app/api/admin/interesados/route";
import { compositionSpacing } from "@repo/design-system/tokens";

/** Formato devuelto por GET /api/fotografo/interesados (agrupado por álbum). */
type PhotographerInteresadoContact = {
  id: number;
  type: "notification" | "interest";
  name: string;
  lastName: string;
  whatsapp: string;
  email: string;
  createdAt: string;
};

type PhotographerInteresadosAlbumGroup = {
  albumId: number;
  albumTitle: string;
  albumSlug: string;
  albumCreatedAt: string;
  interesados: PhotographerInteresadoContact[];
  totalInteresados: number;
};

/**
 * Si el usuario es ADMIN, GET /api/fotografo/interesados devuelve 401.
 * GET /api/admin/interesados devuelve filas planas; las agrupamos como el endpoint de fotógrafo.
 */
function groupAdminInteresadosRowsToPhotographerShape(
  rows: InteresadoRow[],
): PhotographerInteresadosAlbumGroup[] {
  const byAlbum = new Map<number, PhotographerInteresadosAlbumGroup>();

  for (const r of rows) {
    let g = byAlbum.get(r.albumId);
    if (!g) {
      g = {
        albumId: r.albumId,
        albumTitle: r.albumTitle,
        albumSlug: r.albumPublicSlug,
        albumCreatedAt: r.createdAt,
        interesados: [],
        totalInteresados: 0,
      };
      byAlbum.set(r.albumId, g);
    }
    g.interesados.push({
      id: r.id,
      type: r.tipo === "aviso" ? "notification" : "interest",
      name: r.name ?? "",
      lastName: r.lastName ?? "",
      whatsapp: r.whatsapp ?? "",
      email: r.email,
      createdAt: r.createdAt,
    });
  }

  return Array.from(byAlbum.values())
    .map((item) => ({
      ...item,
      totalInteresados: item.interesados.length,
    }))
    .sort((a, b) => {
      const maxA = Math.max(0, ...a.interesados.map((x) => new Date(x.createdAt).getTime()));
      const maxB = Math.max(0, ...b.interesados.map((x) => new Date(x.createdAt).getTime()));
      return maxB - maxA;
    });
}

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function PhotographerDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("ventas");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [printOrders, setPrintOrders] = useState<any[]>([]);
  const [albumOrdersWithPrint, setAlbumOrdersWithPrint] = useState<any[]>([]);
  const [photographer, setPhotographer] = useState<any>(null);
  const [interesados, setInteresados] = useState<PhotographerInteresadosAlbumGroup[]>([]);
  const [recommendLabOpen, setRecommendLabOpen] = useState(false);
  const [eventsNearby, setEventsNearby] = useState<any[]>([]);
  const [eventsNearbyNoLocation, setEventsNearbyNoLocation] = useState(false);
  const [eventsNearbyLoading, setEventsNearbyLoading] = useState(false);
  const [settingLocation, setSettingLocation] = useState(false);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [myEventsLoading, setMyEventsLoading] = useState(false);
  const [leavingEventId, setLeavingEventId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      const urlParams = new URLSearchParams(window.location.search);
      const userParam = urlParams.get("user");
      if (userParam) {
        try {
          const userData = JSON.parse(userParam);
          if (userData.role === "PHOTOGRAPHER" || userData.role === "LAB_PHOTOGRAPHER") {
            sessionStorage.setItem("photographer", JSON.stringify(userData));
            sessionStorage.setItem("photographerId", userData.id.toString());
            window.history.replaceState({}, "", "/fotografo/dashboard");
          }
        } catch (e) {
          console.error("Error procesando datos de Google OAuth:", e);
        }
      }
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      loadPhotographer(session.photographerId);
      loadDashboard();
      loadInteresados();
      loadEventsNearby();
      loadMyEvents();
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  async function loadPhotographer(photographerId: number) {
    try {
      const res = await fetch(`/api/fotografo/${photographerId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const photographerData = await res.json();
        setPhotographer(photographerData);
      }
    } catch (error) {
      console.error("Error cargando datos del fotógrafo:", error);
    }
  }

  async function loadDashboard() {
    try {
      const res = await fetch("/api/fotografo/dashboard", {
        credentials: "include",
      });
      if (!res.ok) {
        router.push("/fotografo/login");
        return;
      }
      const data = await res.json();
      setStats(data.stats);
      setSalesHistory(data.salesHistory || []);
      setAlbums(data.albums || []);
      setPrintOrders(data.printOrders || []);
      setAlbumOrdersWithPrint(data.albumOrdersWithPrint || []);
    } catch (error) {
      console.error("Error cargando dashboard:", error);
      router.push("/fotografo/login");
    } finally {
      setLoading(false);
    }
  }

  async function loadInteresados() {
    try {
      const res = await fetch("/api/fotografo/interesados", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Interesados cargados:", data);
        setInteresados(Array.isArray(data) ? data : []);
        return;
      }

      if (res.status === 401) {
        const adminRes = await fetch("/api/admin/interesados", { credentials: "include" });
        if (adminRes.ok) {
          const data = await adminRes.json();
          const rows = (data?.rows ?? []) as InteresadoRow[];
          setInteresados(groupAdminInteresadosRowsToPhotographerShape(rows));
          return;
        }
      }

      const errorData = await res.json().catch(() => ({}));
      console.error("Error cargando interesados:", res.status, errorData);
      setInteresados([]);
    } catch (error) {
      console.error("Error cargando interesados:", error);
      setInteresados([]);
    }
  }

  async function loadEventsNearby() {
    setEventsNearbyLoading(true);
    try {
      const res = await fetch("/api/fotografo/events-nearby", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEventsNearby(Array.isArray(data.events) ? data.events : []);
        setEventsNearbyNoLocation(!!data.noLocation);
      } else {
        setEventsNearby([]);
        setEventsNearbyNoLocation(false);
      }
    } catch {
      setEventsNearby([]);
      setEventsNearbyNoLocation(false);
    } finally {
      setEventsNearbyLoading(false);
    }
  }

  async function loadMyEvents() {
    setMyEventsLoading(true);
    try {
      const res = await fetch("/api/fotografo/events-mine", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data)) {
        setMyEvents(data);
      } else {
        setMyEvents([]);
      }
    } catch {
      setMyEvents([]);
    } finally {
      setMyEventsLoading(false);
    }
  }

  async function handleLeaveEvent(ev: { id: number; shareSlug: string }) {
    if (!confirm("¿Desinscribirte de este evento? Si cambias de opinión podés volver a inscribirte desde el link del evento.")) return;
    setLeavingEventId(ev.id);
    try {
      const res = await fetch(`/api/public/events/${ev.shareSlug}/leave`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        await loadMyEvents();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo desinscribir");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setLeavingEventId(null);
    }
  }

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    setSettingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, maximumAge: 60000 });
      });
      const res = await fetch("/api/fotografo/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      });
      if (res.ok) {
        await loadEventsNearby();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "No se pudo guardar la ubicación.");
      }
    } catch (e: any) {
      alert(e?.message || "No se pudo obtener tu ubicación. Revisá los permisos del navegador.");
    } finally {
      setSettingLocation(false);
    }
  }

  function handleWhatsAppMessage(whatsapp: string, name: string, albumTitle: string) {
    if (!whatsapp) {
      alert("No hay número de WhatsApp disponible");
      return;
    }
    // Limpiar el número de WhatsApp (remover espacios, guiones, etc.)
    const cleanWhatsapp = whatsapp.replace(/\D/g, "");
    // Agregar código de país si no lo tiene (asumimos Argentina +54)
    const finalWhatsapp = cleanWhatsapp.startsWith("54") ? cleanWhatsapp : `54${cleanWhatsapp}`;
    const greeting = name ? `Hola ${name.split(" ")[0]}` : "Hola";
    const message = encodeURIComponent(`${greeting}, ¿tu álbum "${albumTitle}" está listo?`);
    const whatsappUrl = `https://wa.me/${finalWhatsapp}?text=${message}`;
    window.open(whatsappUrl, "_blank");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PhotographerDashboardHeader photographer={photographer} />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "ventas", label: "💰 Ventas" },
    { id: "albumes", label: "📸 Álbumes" },
    { id: "interesados", label: "👥 Interesados" },
    { id: "pedidos", label: "📦 Pedidos" },
  ];

  const getAlbumStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      ACTIVE: { label: "Activo", className: "bg-[#10b981]/10 text-[#10b981]" },
      EXPIRED_CLIENT: {
        label: "Expirado (Cliente)",
        className: "bg-[#f59e0b]/10 text-[#f59e0b]",
      },
      EXPIRED_LAB: {
        label: "Expirado (Lab)",
        className: "bg-[#ef4444]/10 text-[#ef4444]",
      },
    };
    return badges[status] || { label: status, className: "bg-gray-100 text-gray-600" };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <div className="container-custom py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
              Panel de Fotógrafo
            </h1>
            <p className="text-gray-600 mb-6">
              Gestioná tus pedidos y estadísticas desde este panel
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
              <Link href="/fotografo/negocio">
                <Button variant="primary">
                  Ir a Negocio
                </Button>
              </Link>
              <Link href="/dashboard/albums">
                <Button variant="secondary">
                  Álbums
                </Button>
              </Link>
              <Link href="/fotografo/soporte">
                <Button variant="secondary">
                  Soporte técnico
                </Button>
              </Link>
              <Link href="/fotografo/configuracion?tab=referidos">
                <Button variant="secondary">
                  Recomendá ComprameLaFoto
                </Button>
              </Link>
              <Button variant="secondary" onClick={() => setRecommendLabOpen(true)}>
                Recomendar un laboratorio
              </Button>
              {photographer?.email === "dnxfotografia@gmail.com" && (
                <>
                  <Link href="/fotocarnet-test" target="_blank" rel="noopener noreferrer">
                    <Button variant="secondary">
                      Prueba Foto Carnet
                    </Button>
                  </Link>
                  <Link href="/polaroids-test" target="_blank" rel="noopener noreferrer">
                    <Button variant="secondary">
                      Prueba Polaroids
                    </Button>
                  </Link>
                </>
              )}
            </div>
            <RecommendLabModal
              open={recommendLabOpen}
              onClose={() => setRecommendLabOpen(false)}
              defaultPhotographerName={photographer?.name ?? ""}
            />
            <Card className="p-6 mb-6">
              <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">Mis eventos</h3>
              <p className="text-sm text-[#6b7280] mb-4">
                Eventos en los que estás inscrito. Si no podés asistir, desinscribite con al menos 24 hs de anticipación.
              </p>
              {myEventsLoading ? (
                <p className="text-sm text-[#6b7280]">Cargando…</p>
              ) : myEvents.length === 0 ? (
                <p className="text-sm text-[#6b7280]">No estás inscrito en ningún evento.</p>
              ) : (
                <ul className="space-y-3">
                  {myEvents.map((ev: any) => (
                    <li key={ev.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {ev.coverUrl && (
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-200">
                          <img src={ev.coverUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#1a1a1a] flex items-center gap-2 flex-wrap">
                          {ev.title}
                          {ev.isPast && (
                            <span className="text-xs font-normal px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Vencido
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#6b7280]">
                          {ev.typeLabel} · {ev.city}
                          {ev.membersCount != null && ` · ${ev.membersCount} inscrito(s)`}
                        </p>
                        <p className="text-xs text-[#6b7280]">
                          {new Date(ev.startsAt).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 flex-shrink-0">
                        <a href={`/e/${ev.shareSlug}`} target="_blank" rel="noopener noreferrer">
                          <Button variant="secondary" size="sm">Ver evento</Button>
                        </a>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleLeaveEvent(ev)}
                          disabled={leavingEventId === ev.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {leavingEventId === ev.id ? "..." : "Desinscribirme"}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">Eventos cerca (50 km)</h3>
              <p className="text-sm text-[#6b7280] mb-4">
                Eventos publicados por organizadores a menos de 50 km de tu ubicación. Inscribite para participar.
              </p>
              {eventsNearbyLoading ? (
                <p className="text-sm text-[#6b7280]">Cargando…</p>
              ) : eventsNearbyNoLocation ? (
                <div>
                  <p className="text-sm text-[#6b7280] mb-3">
                    Configurá tu ubicación para ver eventos cerca de vos.
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleUseMyLocation}
                    disabled={settingLocation}
                  >
                    {settingLocation ? "Guardando…" : "Usar mi ubicación actual"}
                  </Button>
                </div>
              ) : eventsNearby.length === 0 ? (
                <p className="text-sm text-[#6b7280]">No hay eventos a menos de 50 km por ahora.</p>
              ) : (
                <ul className="space-y-3">
                  {eventsNearby.map((ev: any) => (
                    <li key={ev.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {ev.coverUrl && (
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-200">
                          <img src={ev.coverUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[#1a1a1a] flex items-center gap-2 flex-wrap">
                          {ev.title}
                          {ev.isPast && (
                            <span className="text-xs font-normal px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                              Vencido
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-[#6b7280]">
                          {ev.typeLabel} · {ev.city}
                          {ev.distanceKm != null && ` · ${ev.distanceKm} km`}
                        </p>
                        <p className="text-xs text-[#6b7280]">
                          {new Date(ev.startsAt).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}
                          {ev.membersCount != null && ` · ${ev.membersCount} inscrito(s)`}
                        </p>
                      </div>
                      {ev.joinUrl && (
                        <a
                          href={ev.joinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0"
                        >
                          <Button variant="primary" size="sm">Ver e inscribirme</Button>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {stats && (
              <div
                className="grid grid-cols-1 md:grid-cols-4"
                style={{
                  marginTop: compositionSpacing.comprameLaFotoDashboard.cardsBlockToKpi,
                  gap: compositionSpacing.comprameLaFotoDashboard.kpiGridGap,
                }}
              >
                <Card className="p-4">
                  <p className="text-sm text-[#6b7280]">Total Ventas</p>
                  <p className="text-2xl font-bold text-[#1a1a1a]">
                    {formatARS(stats.totalSalesARS)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-[#6b7280]">Ventas Digitales</p>
                  <p className="text-2xl font-bold text-[#3b82f6]">
                    {formatARS(stats.digitalSalesARS)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-[#6b7280]">Ventas Impresión</p>
                  <p className="text-2xl font-bold text-[#10b981]">
                    {formatARS(stats.printSalesARS)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-[#6b7280]">Álbumes Activos</p>
                  <p className="text-2xl font-bold text-[#f59e0b]">
                    {stats.activeAlbumsCount} / {stats.albumsCount}
                  </p>
                </Card>
              </div>
            )}
          </div>

          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
            {activeTab === "ventas" && (
            <div className="space-y-4">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Historial de Ventas</h3>
                {salesHistory.length === 0 ? (
                  <p className="text-[#6b7280]">No hay ventas registradas aún.</p>
                ) : (
                  <div className="space-y-2">
                    {salesHistory.map((sale, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-2 border-b border-gray-100"
                      >
                        <span className="text-sm text-[#6b7280]">
                          {new Date(sale.date).toLocaleDateString("es-AR")}
                        </span>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                          {sale.digital > 0 && (
                            <span className="text-sm text-[#3b82f6]">
                              Digital: {formatARS(sale.digital)}
                            </span>
                          )}
                          {sale.print > 0 && (
                            <span className="text-sm text-[#10b981]">
                              Impresión: {formatARS(sale.print)}
                            </span>
                          )}
                          <span className="text-sm font-medium">
                            Total: {formatARS(sale.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === "albumes" && (
            <div className="space-y-4">
              {albums.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-[#6b7280] mb-4">
                    Aún no tenés álbumes.{" "}
                    <Link href="/dashboard/albums" className="text-[#c27b3d] hover:underline">
                      Crear tu primer álbum
                    </Link>
                  </p>
                </Card>
              ) : (
                albums.map((album) => {
                  const badge = getAlbumStatusBadge(album.status);
                  return (
                    <Card key={album.id} className="p-6">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-3">
                            <h3 className="text-lg font-medium text-[#1a1a1a]">
                              {album.title}
                            </h3>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm text-[#6b7280]">
                            <p>
                              <span className="font-medium">Fotos:</span> {album.photosCount}
                            </p>
                            <p>
                              <span className="font-medium">Pedidos:</span> {album.ordersCount}
                            </p>
                            <p>
                              <span className="font-medium">Visible hasta:</span>{" "}
                              {new Date(album.visibleUntil).toLocaleDateString("es-AR")}
                            </p>
                            <p>
                              <span className="font-medium">Disponible para lab hasta:</span>{" "}
                              {new Date(album.availableUntil).toLocaleDateString("es-AR")}
                            </p>
                          </div>
                        </div>
                        <Link href={`/dashboard/albums/${album.id}`}>
                          <Button variant="secondary" size="sm">
                            Ver Álbum
                          </Button>
                        </Link>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "interesados" && (
            <div className="space-y-4">
              {interesados.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-[#6b7280]">No tenés álbumes con interesados.</p>
                </Card>
              ) : (
                interesados.map((item) => (
                  <Card key={item.albumId} className="p-6">
                    <div className="mb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-[#1a1a1a] mb-1">
                            {item.albumTitle}
                          </h3>
                          <p className="text-xs text-[#6b7280] mt-1">
                            {item.totalInteresados} {item.totalInteresados === 1 ? "interesado" : "interesados"}
                          </p>
                        </div>
                        <Link href={`/dashboard/albums/${item.albumId}`}>
                          <Button variant="secondary" size="sm">
                            Ver Álbum
                          </Button>
                        </Link>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {item.interesados.map((interesado) => (
                        <div
                          key={interesado.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium text-[#1a1a1a]">
                                {interesado.name || ""} {interesado.lastName || ""}
                              </p>
                            </div>
                            <div className="space-y-1 text-xs text-[#6b7280]">
                              {interesado.whatsapp ? (
                                <p className="flex items-center gap-1">
                                  <span>📱</span> {interesado.whatsapp}
                                </p>
                              ) : null}
                              {interesado.email ? (
                                <p className="flex items-center gap-1">
                                  <span>✉️</span> {interesado.email}
                                </p>
                              ) : null}
                              <p className="text-[#9ca3af]">
                                Interesado el: {new Date(interesado.createdAt).toLocaleDateString("es-AR", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                          {interesado.whatsapp ? (
                            <button
                              onClick={() => handleWhatsAppMessage(interesado.whatsapp, `${interesado.name || ""} ${interesado.lastName || ""}`.trim(), item.albumTitle)}
                              className="ml-4 flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium shadow-sm hover:shadow-md"
                              title="Abrir WhatsApp para comunicarte"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                              </svg>
                              <span className="text-sm">WhatsApp</span>
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "pedidos" && (
            <div className="space-y-4">
              {printOrders.length === 0 && albumOrdersWithPrint.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-[#6b7280]">No tenés pedidos de impresión asociados.</p>
                </Card>
              ) : (
                <>
                  {albumOrdersWithPrint.map((order) => (
                    <Card key={`album-${order.id}`} className="p-6">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-[#1a1a1a] mb-2">
                            Pedido de álbum #{order.id}
                          </h3>
                          <div className="space-y-1 text-sm text-[#6b7280]">
                            {order.albumTitle && (
                              <p>
                                <span className="font-medium">Álbum:</span> {order.albumTitle}
                              </p>
                            )}
                            <p>
                              <span className="font-medium">Cliente:</span> {order.buyerEmail}
                            </p>
                            <p>
                              <span className="font-medium">Estado:</span> {order.status === "PAID" ? "Pagado" : order.status}
                            </p>
                            <p>
                              <span className="font-medium">Items:</span> {order.itemsCount} (incl. impresión)
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <p className="text-2xl font-medium text-[#1a1a1a]">
                            {formatARS(order.total)}
                          </p>
                          <Link href="/fotografo/pedidos">
                            <Button variant="primary" size="sm">
                              Ver y descargar carpeta impresión
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ))}
                  {printOrders.map((order) => (
                    <Card key={`print-${order.id}`} className="p-6">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-[#1a1a1a] mb-2">
                            Pedido impresión #{order.id}
                          </h3>
                          <div className="space-y-1 text-sm text-[#6b7280]">
                            <p>
                              <span className="font-medium">Laboratorio:</span> {order.labName}
                            </p>
                            <p>
                              <span className="font-medium">Estado:</span> {order.status}
                            </p>
                            <p>
                              <span className="font-medium">Items:</span> {order.itemsCount}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <p className="text-2xl font-medium text-[#1a1a1a]">
                            {formatARS(order.total)}
                          </p>
                          <Link href="/fotografo/pedidos">
                            <Button variant="primary" size="sm">
                              Ver y descargar carpeta
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </Card>
                  ))}
                </>
              )}
            </div>
          )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
