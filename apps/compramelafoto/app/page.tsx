"use client";

import Link from "next/link";
import { DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER } from "@/lib/public-flow-config";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import RecommendLabModal from "@/components/RecommendLabModal";
import FaqSection from "@/components/FaqSection";
import HomeBanner from "@/components/HomeBanner";

type Album = {
  id: number;
  title: string;
  location: string | null;
  eventDate: string | null;
  publicSlug: string;
  createdAt: string;
  photosCount: number;
  coverPhotoUrl: string | null;
  coverPhotoUrlFallback?: string | null;
  showComingSoonMessage: boolean;
  photographer: {
    id: number;
    name: string | null;
    companyName: string | null;
    logoUrl: string | null;
    handler: string | null;
  };
};

type DirectoryCounts = {
  photographers: number;
  labs: number;
  photographerServices: number;
  eventVendors: number;
} | null;

export default function HomePage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [recommendLabOpen, setRecommendLabOpen] = useState(false);
  const [directoryCounts, setDirectoryCounts] = useState<DirectoryCounts>(null);
  const albumsSectionRef = useRef<HTMLDivElement>(null);

  // Buscador de eventos (nombre o cerca mío)
  const [eventSearch, setEventSearch] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsNearbyLoading, setEventsNearbyLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [failedCoverIds, setFailedCoverIds] = useState<Set<string>>(new Set());

  // Tras login con Google (callback redirige aquí con ?user=... para ORGANIZER)
  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const userParam = params.get("user");
    if (userParam) {
      try {
        const userData = JSON.parse(userParam);
        if (userData?.role === "ORGANIZER") {
          sessionStorage.setItem("organizer", JSON.stringify(userData));
          sessionStorage.setItem("organizerId", String(userData.id));
          window.location.href = "/organizador/dashboard";
          return;
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    async function loadAlbums() {
      try {
        const res = await fetch("/api/public/albums");
        const data = await res.json();
        if (res.ok) setAlbums(data);
      } catch (err) {
        console.error("Error cargando albums:", err);
      } finally {
        setAlbumsLoading(false);
      }
    }
    loadAlbums();
  }, []);

  async function searchEvents(e?: React.MouseEvent) {
    e?.preventDefault();
    setEventsLoading(true);
    setEvents([]);
    setEventsError(null);
    setFailedCoverIds(new Set());
    try {
      const q = eventSearch.trim();
      const url = q
        ? `/api/public/events?q=${encodeURIComponent(q)}`
        : "/api/public/events";
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEvents(data.events || []);
      } else {
        setEvents([]);
        setEventsError((data as { error?: string })?.error || "Error al buscar. Probá de nuevo.");
      }
    } catch (err) {
      console.error("Error buscando eventos/álbumes:", err);
      setEvents([]);
      setEventsError("Error de conexión. Verificá tu internet y probá de nuevo.");
    } finally {
      setEventsLoading(false);
    }
  }

  async function searchEventsNearby(e?: React.MouseEvent) {
    e?.preventDefault();
    setEventsNearbyLoading(true);
    setEvents([]);
    try {
      if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización. Probá en otro dispositivo.");
        setEventsNearbyLoading(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const q = eventSearch.trim();
          const params = new URLSearchParams({ lat: String(latitude), lng: String(longitude) });
          if (q) params.set("q", q);
          setEventsError(null);
          setFailedCoverIds(new Set());
          try {
            const res = await fetch(`/api/public/events?${params.toString()}`);
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
              setEvents(data.events || []);
            } else {
              setEvents([]);
              setEventsError((data as { error?: string })?.error || "Error al buscar. Probá de nuevo.");
            }
          } catch (err) {
            console.error("Error buscando eventos cercanos:", err);
            setEvents([]);
            setEventsError("Error de conexión. Verificá tu internet y probá de nuevo.");
          } finally {
            setEventsNearbyLoading(false);
          }
        },
        (err) => {
          let msg = "No se pudo obtener tu ubicación.";
          if (err.code === 1) msg = "Permiso denegado. Permití el acceso a la ubicación en tu navegador.";
          else if (err.code === 2) msg = "Ubicación no disponible. Verificá que el GPS esté activado.";
          else if (err.code === 3) msg = "Tiempo de espera agotado. Probá de nuevo.";
          alert(msg);
          setEventsNearbyLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    } catch (err) {
      setEventsNearbyLoading(false);
      alert("Error al obtener la ubicación. Probá de nuevo.");
    }
  }

  useEffect(() => {
    fetch("/api/public/directory/counts")
      .then((r) => r.json())
      .then((data) => {
        if (data?.photographers !== undefined && data?.labs !== undefined) {
          setDirectoryCounts({
            photographers: data.photographers,
            labs: data.labs,
            photographerServices: data.photographerServices ?? 0,
            eventVendors: data.eventVendors ?? 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <HomeBanner />

      {/* Hero Section - como antes: logo y opciones arriba vienen del Header */}
      <section className="relative overflow-hidden bg-[#f7f5f2]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(194,123,61,0.16),transparent_45%)]" />
        <div className="relative container-custom py-20 md:py-28">
          <div className="max-w-4xl space-y-8">
            <h1 className="text-4xl font-semibold leading-tight text-[#111827] md:text-5xl">
              Vendé fotos y cobrá con una experiencia moderna, simple y confiable.
            </h1>
            <p className="text-base text-black/70 md:text-lg">
              Tu lista de precios define todo. A cada álbum se le aplica un sobreprecio
              por autoría y la plataforma suma su fee configurado. Transparente, directo y
              listo para vender.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/${DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER}/imprimir`}>
                <Button variant="primary" className="text-base px-6 py-3">
                  Imprimir mis fotos
                </Button>
              </Link>
              <Link href={`/${DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER}/fotocarnet`}>
                <Button variant="secondary" className="text-base px-6 py-3 border-black/10">
                  Foto carnet
                </Button>
              </Link>
              <Link href={`/${DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER}/polaroids`}>
                <Button variant="secondary" className="text-base px-6 py-3 border-black/10">
                  Polaroids
                </Button>
              </Link>
              <Link href="/fotografo/login">
                <Button variant="secondary" className="text-base px-6 py-3">
                  Soy fotógrafo
                </Button>
              </Link>
              <Button
                type="button"
                variant="secondary"
                className="text-base px-6 py-3"
                onClick={() => setRecommendLabOpen(true)}
              >
                Recomendar un laboratorio
              </Button>
            </div>
            <div className="flex flex-wrap gap-8 text-sm text-black/60">
              <div>
                <p className="text-lg font-semibold text-black">Argentina</p>
                <p>Válido en todo el país</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-black">Pagos</p>
                <p>Con Mercado Pago</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-black">Soporte</p>
                <p>Respuestas claras y rápidas</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Buscador de eventos y álbumes */}
      <section className="section-spacing bg-gradient-to-b from-[#faf8f5] to-white border-b border-[#e5e7eb]">
        <div className="container-custom w-full">
          <div className="search-section-inner w-full max-w-4xl mx-auto min-w-0">
            <h2 className="text-2xl md:text-4xl font-semibold text-[#1a1a1a] mb-2 text-center">
              Buscar eventos y álbumes
            </h2>
            <p className="text-center text-[#6b7280] mb-8 w-full max-w-[42rem] mx-auto">
              Escribí el nombre para buscar o usá tu ubicación para ver eventos cerca tuyo (50 km)
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center w-full min-w-0">
              <div className="flex-1 min-w-0 relative">
                <input
                  type="text"
                  placeholder="Ej: cumpleaños, boda, escuela, nombre del evento..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchEvents()}
                  className="w-full px-5 py-4 pl-12 rounded-2xl border-2 border-[#111827]/10 bg-white text-[#111827] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-[#c27b3d] text-base"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9ca3af]" aria-hidden>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.35-4.35" />
                  </svg>
                </span>
              </div>
              <div className="flex gap-3 sm:flex-shrink-0">
                <button
                  type="button"
                  onClick={(e) => searchEvents(e)}
                  disabled={eventsLoading}
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-[#c27b3d] text-white font-semibold hover:bg-[#a96834] disabled:opacity-60 disabled:cursor-not-allowed transition-colors min-w-[120px]"
                  title="Buscar por nombre"
                >
                  {eventsLoading ? (
                    <span className="animate-pulse">Buscando...</span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                      Buscar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => searchEventsNearby(e)}
                  disabled={eventsNearbyLoading}
                  className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white border-2 border-[#c27b3d] text-[#c27b3d] font-semibold hover:bg-[#c27b3d]/5 disabled:opacity-60 disabled:cursor-not-allowed transition-colors min-w-[140px]"
                  title="Eventos cerca de mi ubicación"
                >
                  {eventsNearbyLoading ? (
                    <span className="animate-pulse">Obteniendo ubicación...</span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      Cerca mío
                    </>
                  )}
                </button>
              </div>
            </div>

            {eventsError && (
              <p className="mt-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
                {eventsError}
              </p>
            )}
            {events.length > 0 && (
              <div className="mt-10">
                <p className="text-sm font-medium text-[#6b7280] mb-4">
                  {events.length} resultado{events.length !== 1 ? "s" : ""} — ordenado{events.length !== 1 ? "s" : ""} por proximidad cuando usás ubicación
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {events.slice(0, 12).map((ev: any) => (
                    <Link
                      key={`${ev.source}-${ev.id}`}
                      href={ev.joinUrl || "#"}
                      className="group flex gap-4 p-4 rounded-2xl border-2 border-[#e5e7eb] hover:border-[#c27b3d]/50 hover:shadow-lg transition-all bg-white"
                    >
                      {(ev.coverUrl && !failedCoverIds.has(`${ev.source}-${ev.id}`)) ? (
                        <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-[#f3f4f6] relative">
                          <img
                            src={ev.coverUrl}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={() =>
                              setFailedCoverIds((prev) => new Set(prev).add(`${ev.source}-${ev.id}`))
                            }
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-xl flex-shrink-0 bg-[#c27b3d]/10 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c27b3d" strokeWidth="2" className="opacity-60">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[#1a1a1a] group-hover:text-[#c27b3d] transition-colors line-clamp-2">
                          {ev.title}
                        </h3>
                        <p className="text-sm text-[#6b7280] mt-1">
                          {ev.typeLabel}
                          {ev.city ? ` • ${ev.city}` : ""}
                          {ev.distanceKm != null ? ` • ${ev.distanceKm} km` : ""}
                        </p>
                        {ev.startsAt && (() => {
                          try {
                            const d = new Date(ev.startsAt);
                            return !isNaN(d.getTime()) ? (
                              <p className="text-xs text-[#9ca3af] mt-1">
                                {d.toLocaleDateString("es-AR", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </p>
                            ) : null;
                          } catch {
                            return null;
                          }
                        })()}
                        <span className="inline-block mt-2 text-[#c27b3d] text-sm font-medium">
                          Ver {ev.source === "ALBUM" ? "álbum" : "evento"} →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                {events.length > 12 && (
                  <p className="text-sm text-[#6b7280] mt-4">
                    Mostrando los primeros 12 de {events.length}
                  </p>
                )}
              </div>
            )}

            {!eventsLoading && !eventsNearbyLoading && events.length === 0 && !eventsError && (
              <p className="text-center text-[#9ca3af] mt-8 text-sm">
                Escribí un nombre y pulsá Buscar, o usá el botón de ubicación para ver eventos y álbumes cerca tuyo (50 km).
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Albums Públicos - como antes */}
      <section id="albums" ref={albumsSectionRef} className="section-spacing bg-[#f9fafb]">
        <div className="container-custom">
          <div className="mb-12 text-center">
            <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-4">
              Albums Disponibles
            </h2>
            <p className="text-lg text-[#6b7280]">
              Explorá todos los albums de nuestros fotógrafos y encontrá tus fotos favoritas
            </p>
          </div>

          {albumsLoading ? (
            <div className="text-center py-12">
              <p className="text-[#6b7280]">Cargando albums...</p>
            </div>
          ) : albums.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#6b7280]">No hay albums disponibles en este momento.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {albums.map((album) => (
                <Link
                  key={album.id}
                  href={`/a/${album.publicSlug}`}
                  className="group block"
                >
                  <Card className="overflow-hidden h-full hover:shadow-xl transition-all duration-300">
                    <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
                      {album.coverPhotoUrl ? (
                        <Image
                          src={album.coverPhotoUrl}
                          alt={album.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const triedFallback = target.getAttribute("data-fallback-tried") === "1";
                            if (album.coverPhotoUrlFallback && !triedFallback) {
                              target.setAttribute("data-fallback-tried", "1");
                              target.src = album.coverPhotoUrlFallback;
                              return;
                            }
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector(".placeholder-fallback")) {
                              const placeholder = document.createElement("div");
                              placeholder.className = "placeholder-fallback w-full h-full flex items-center justify-center";
                              placeholder.innerHTML = `
                                <svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                                </svg>
                              `;
                              parent.appendChild(placeholder);
                            }
                          }}
                          unoptimized={album.coverPhotoUrl.startsWith("/uploads/")}
                        />
                      ) : album.showComingSoonMessage ? (
                        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#f3f4f6]">
                          <Image
                            src="/watermark.png"
                            alt="ComprameLaFoto"
                            width={80}
                            height={80}
                            className="opacity-50"
                          />
                          <p className="text-xs text-[#6b7280] mt-2 text-center">
                            Las fotos serán subidas próximamente
                          </p>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg
                            className="w-16 h-16 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2 line-clamp-2">
                        {album.title}
                      </h3>
                      {album.photographer.companyName || album.photographer.name ? (
                        <p className="text-sm text-[#6b7280] mb-2">
                          Por: {album.photographer.companyName || album.photographer.name}
                        </p>
                      ) : null}
                      <div className="space-y-1 mb-3">
                        {album.location && (
                          <p className="text-sm text-[#6b7280] flex items-center gap-1">
                            <span>📍</span> {album.location}
                          </p>
                        )}
                        {album.eventDate && (
                          <p className="text-sm text-[#6b7280] flex items-center gap-1">
                            <span>📅</span> {new Date(album.eventDate).toLocaleDateString("es-AR")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-[#e5e7eb]">
                        <span className="text-sm font-medium text-[#c27b3d]">
                          {album.photosCount} {album.photosCount === 1 ? "foto" : "fotos"}
                        </span>
                        <span className="text-sm text-[#6b7280] group-hover:text-[#1a1a1a] transition-colors">
                          Ver album →
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Cómo funciona - sección ancha */}
      <section className="section-spacing bg-white">
        <div className="container-custom max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] text-center mb-3">
            ¿Cómo funciona ComprameLaFoto?
          </h2>
          <p className="text-center text-[#6b7280] text-lg mb-12">
            Tres pasos para empezar: subí o elegí fotos, configurá precios y vendé.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#c27b3d]/15 text-[#c27b3d] flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                Creá o entrá a una galería
              </h3>
              <p className="text-[#6b7280]">
                Los fotógrafos suben álbumes; los clientes entran por el link y ven sus fotos.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#c27b3d]/15 text-[#c27b3d] flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                Elegí y comprá
              </h3>
              <p className="text-[#6b7280]">
                Seleccioná las fotos que querés (digital o impresa). Pagás con Mercado Pago.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-[#c27b3d]/15 text-[#c27b3d] flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                Recibí todo listo
              </h3>
              <p className="text-[#6b7280]">
                Descarga digital o impresiones enviadas. Seguimiento claro en cada paso.
              </p>
            </div>
          </div>
          <div className="text-center">
            <Button
              variant="primary"
              className="text-base px-6 py-3"
              onClick={() => albumsSectionRef.current?.scrollIntoView({ behavior: "smooth" })}
            >
              Ver galerías
            </Button>
          </div>
        </div>
      </section>

      {/* Qué es ComprameLaFoto - más ancho */}
      <section className="section-spacing bg-white">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a]">
              ¿Qué es ComprameLaFoto?
            </h2>
            <p className="text-lg text-[#6b7280] leading-relaxed">
              ComprameLaFoto conecta fotógrafos y clientes en un flujo directo: álbumes, selección,
              compra y entrega. Todo se calcula con tu lista de precios y tu margen por álbum.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <Card className="text-center p-6">
                <div className="text-4xl mb-4">📷</div>
                <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">Para Fotógrafos</h3>
                <p className="text-[#6b7280]">
                  Creá álbumes, vendé fotos digitales e impresas, y controlá tus márgenes.
                </p>
              </Card>
              <Card className="text-center p-6">
                <div className="text-4xl mb-4">👤</div>
                <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">Para Clientes</h3>
                <p className="text-[#6b7280]">
                  Elegí fotos, pagá en un clic y recibí todo con seguimiento claro.
                </p>
              </Card>
              <Card className="text-center p-6">
                <div className="text-4xl mb-4">✨</div>
                <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">Para tu marca</h3>
                <p className="text-[#6b7280]">
                  Landing personalizada y experiencia premium para tus clientes.
                </p>
              </Card>
            </div>
            <div className="mt-10 text-center">
              <p className="text-sm text-[#6b7280] mb-2">Fotógrafos, laboratorios, servicios para fotógrafos y proveedores de eventos</p>
              <Link
                href="/fotografo/comunidad"
                className="text-[#c27b3d] font-medium hover:underline"
              >
                Ver Comunidad y directorios →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Imprimir tus fotos */}
      <section className="section-spacing bg-white">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-4">
              Imprimí tus propias fotos
            </h2>
            <p className="text-lg text-[#6b7280] mb-8">
              Subí tus fotos, elegí tamaño y cantidad. Los precios se calculan con la lista
              del fotógrafo y el fee de plataforma.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href={`/${DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER}/imprimir`}>
                <Button variant="primary" className="text-lg px-8 py-4">
                  Imprimir mis fotos
                </Button>
              </Link>
              <Link href={`/${DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER}/fotocarnet`}>
                <Button variant="secondary" className="text-lg px-8 py-4 border-black/10">
                  Foto carnet
                </Button>
              </Link>
              <Link href={`/${DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER}/polaroids`}>
                <Button variant="secondary" className="text-lg px-8 py-4 border-black/10">
                  Polaroids
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Empresas que nos eligen */}
      <section className="section-spacing bg-[#f9fafb]">
        <div className="container-custom">
          <div className="max-w-5xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-4">
              Empresas que nos eligen
            </h2>
            <p className="text-lg text-[#6b7280]">
              Fotógrafos, laboratorios y proveedores que trabajan con nosotros. Conocelos y explorá cada directorio.
            </p>
          </div>
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              href={`/${DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER}/imprimir`}
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white border border-black/8 hover:border-[#c27b3d]/40 hover:shadow-lg transition-all duration-200 text-center"
            >
              <span className="text-3xl mb-3">🖨️</span>
              <span className="font-semibold text-[#1a1a1a] group-hover:text-[#c27b3d] transition-colors">
                Imprimir mis fotos
              </span>
              <span className="text-sm text-[#6b7280] mt-1">Fotos, carnet o polaroids</span>
            </Link>
            <Link
              href="/directorio/fotografos"
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white border border-black/8 hover:border-[#c27b3d]/40 hover:shadow-lg transition-all duration-200 text-center"
            >
              <span className="text-3xl mb-3">📷</span>
              <span className="font-semibold text-[#1a1a1a] group-hover:text-[#c27b3d] transition-colors">
                Fotógrafos
              </span>
              {directoryCounts !== null && (
                <span className="text-sm text-[#6b7280] mt-1">
                  {directoryCounts.photographers} {directoryCounts.photographers === 1 ? "perfil" : "perfiles"}
                </span>
              )}
            </Link>
            <Link
              href="/directorio/laboratorios"
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white border border-black/8 hover:border-[#c27b3d]/40 hover:shadow-lg transition-all duration-200 text-center"
            >
              <span className="text-3xl mb-3">🖨️</span>
              <span className="font-semibold text-[#1a1a1a] group-hover:text-[#c27b3d] transition-colors">
                Laboratorios
              </span>
              {directoryCounts !== null && (
                <span className="text-sm text-[#6b7280] mt-1">
                  {directoryCounts.labs} {directoryCounts.labs === 1 ? "perfil" : "perfiles"}
                </span>
              )}
            </Link>
            <Link
              href="/directorio/servicios-para-fotografos"
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white border border-black/8 hover:border-[#c27b3d]/40 hover:shadow-lg transition-all duration-200 text-center"
            >
              <span className="text-3xl mb-3">✨</span>
              <span className="font-semibold text-[#1a1a1a] group-hover:text-[#c27b3d] transition-colors">
                Servicios para Fotógrafos
              </span>
              {directoryCounts !== null && (
                <span className="text-sm text-[#6b7280] mt-1">
                  {directoryCounts.photographerServices} {directoryCounts.photographerServices === 1 ? "perfil" : "perfiles"}
                </span>
              )}
            </Link>
            <Link
              href="/directorio/servicios-de-eventos"
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-white border border-black/8 hover:border-[#c27b3d]/40 hover:shadow-lg transition-all duration-200 text-center"
            >
              <span className="text-3xl mb-3">🎉</span>
              <span className="font-semibold text-[#1a1a1a] group-hover:text-[#c27b3d] transition-colors">
                Servicios de Eventos
              </span>
              {directoryCounts !== null && (
                <span className="text-sm text-[#6b7280] mt-1">
                  {directoryCounts.eventVendors} {directoryCounts.eventVendors === 1 ? "perfil" : "perfiles"}
                </span>
              )}
            </Link>
          </div>
        </div>
      </section>

      {/* Para Fotógrafos */}
      <section className="section-spacing bg-[#f9fafb]">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto">
            <Card className="p-8 md:p-12">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">📷</div>
                <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-4">
                  ¿Sos Fotógrafo?
                </h2>
                <p className="text-lg text-[#6b7280]">
                  Gana dinero vendiendo tus fotos de forma profesional
                </p>
              </div>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">💰</div>
                  <div>
                    <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                      Comisioná por cada foto vendida
                    </h3>
                    <p className="text-[#6b7280]">
                      Configurá tus propios precios para fotos digitales e impresas. Cada álbum
                      puede sumar un sobreprecio por autoría y se aplica el fee de plataforma.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-2xl">🖨️</div>
                  <div>
                    <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                      Vendé impresiones sin complicaciones
                    </h3>
                    <p className="text-[#6b7280]">
                      Los clientes compran impresiones directamente desde tus álbumes.
                      Los precios salen de tu lista y tu margen por álbum.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-2xl">📸</div>
                  <div>
                    <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                      Creá albums ilimitados
                    </h3>
                    <p className="text-[#6b7280]">
                      Subí todas las fotos que quieras, organizalas en albums por evento, y compartí el 
                      enlace con tus clientes. Ellos pueden ver y comprar sus fotos favoritas de forma fácil 
                      y segura.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-8 text-center flex flex-wrap gap-3 justify-center">
                <Link href="/fotografo/login">
                  <Button variant="primary" className="text-lg px-8 py-4">
                    Empezar como fotógrafo
                  </Button>
                </Link>
                <Button
                  type="button"
                  variant="secondary"
                  className="text-lg px-8 py-4"
                  onClick={() => setRecommendLabOpen(true)}
                >
                  Recomendar un laboratorio
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Para Laboratorios */}
      <section className="section-spacing bg-[#f7f5f2]">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto">
            <Card className="p-8 md:p-12">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">🖨️</div>
                <h2 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-4">
                  ¿Tenés un laboratorio?
                </h2>
                <p className="text-lg text-[#6b7280] mb-2">
                  Unite a la plataforma y recibí pedidos de impresión de fotógrafos y clientes
                </p>
                <p className="text-sm text-[#c27b3d] font-medium">
                  Apto para laboratorios con precios profesionales y minoristas.
                </p>
              </div>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="text-2xl">📋</div>
                  <div>
                    <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                      Definí tu catálogo y precios
                    </h3>
                    <p className="text-[#6b7280]">
                      Cargá tus productos (tamaños, acabados), precios mayoristas y minoristas.
                      Los fotógrafos que elijan tu lab verán tus listas al vender impresiones.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-2xl">📦</div>
                  <div>
                    <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                      Recibí pedidos organizados
                    </h3>
                    <p className="text-[#6b7280]">
                      Los pedidos llegan con las fotos agrupadas por producto, acabado y tamaño,
                      listas para producir. Podés gestionar estados y notificar cuando estén listos.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="text-2xl">🤝</div>
                  <div>
                    <h3 className="text-xl font-medium text-[#1a1a1a] mb-2">
                      Conectá con fotógrafos
                    </h3>
                    <p className="text-[#6b7280]">
                      Los fotógrafos pueden recomendarte a sus clientes. Aparecé en la plataforma
                      como opción de laboratorio y sumá volumen de trabajo de forma ordenada.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-8 text-center">
                <Link href="/lab/registro">
                  <Button variant="primary" className="text-lg px-8 py-4">
                    Registrar mi laboratorio
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <FaqSection />

      <RecommendLabModal
        open={recommendLabOpen}
        onClose={() => setRecommendLabOpen(false)}
      />
    </>
  );
}
