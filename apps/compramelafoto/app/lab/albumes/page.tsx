"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LabHeader from "@/components/lab/LabDashboardHeader";
import { ensureLabSession } from "@/lib/lab-session-client";

function LabAlbumesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") || "albums";
  const [activeTab, setActiveTab] = useState<"albums" | "interesados">(
    tabParam === "interesados" ? "interesados" : "albums"
  );

  const [labId, setLabId] = useState<number | null>(null);
  const [lab, setLab] = useState<{
    id: number;
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  } | null>(null);
  const [albumsEnabled, setAlbumsEnabled] = useState(false);
  const [albums, setAlbums] = useState<any[]>([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [interesados, setInteresados] = useState<any[]>([]);
  const [interesadosLoading, setInteresadosLoading] = useState(false);

  useEffect(() => {
    const t = searchParams?.get("tab");
    if (t === "interesados") setActiveTab("interesados");
    else setActiveTab("albums");
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensureLabSession();
      if (!active) return;
      if (!session) {
        router.push("/lab/login");
        return;
      }
      setLabId(session.labId);
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!labId) return;
    fetch(`/api/lab/${labId}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setAlbumsEnabled(data.soyFotografo || false);
          setLab({
            id: data.id,
            name: data.name,
            logoUrl: data.logoUrl ?? null,
            primaryColor: data.primaryColor ?? null,
            secondaryColor: data.secondaryColor ?? null,
          });
        }
      })
      .catch(() => {});
  }, [labId]);

  async function loadAlbums() {
    if (!albumsEnabled) return;
    setAlbumsLoading(true);
    try {
      const res = await fetch("/api/dashboard/albums");
      if (res.ok) {
        const data = await res.json();
        setAlbums(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error cargando álbumes:", err);
    } finally {
      setAlbumsLoading(false);
    }
  }

  async function loadInteresados() {
    if (!labId) return;
    setInteresadosLoading(true);
    try {
      const res = await fetch(`/api/lab/interesados`);
      if (res.ok) {
        const data = await res.json();
        setInteresados(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error cargando interesados:", err);
      setInteresados([]);
    } finally {
      setInteresadosLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "albums" && albumsEnabled) loadAlbums();
    if (activeTab === "interesados") loadInteresados();
  }, [activeTab, labId, albumsEnabled]);

  function handleTabChange(t: "albums" | "interesados") {
    setActiveTab(t);
    router.replace(`/lab/albumes?tab=${t === "interesados" ? "interesados" : "albums"}`, { scroll: false });
  }

  if (!labId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-[#6b7280]">Verificando sesión...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LabHeader lab={lab} />
      <section className="py-12 md:py-16 bg-white min-h-screen">
        <div className="container-custom">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] mb-2">Álbumes</h1>
                <p className="text-[#6b7280] text-lg">
                  Gestioná tus álbumes e interesados en los álbumes que tienen este laboratorio seleccionado
                </p>
              </div>
              <Link
                href="/lab/dashboard"
                className="flex items-center gap-2 px-4 py-2 text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Volver al Panel
              </Link>
            </div>

            {/* Tabs internos: Álbumes | Interesados */}
            <div className="border-b border-[#e5e7eb]">
              <div className="flex gap-0">
                <button
                  onClick={() => handleTabChange("albums")}
                  className={`px-6 py-3 text-sm font-medium transition-colors border border-[#e5e7eb] border-b-0 rounded-t-lg ${
                    activeTab === "albums"
                      ? "bg-white text-[#1a1a1a] border-[#c27b3d] border-b-2 border-b-[#c27b3d]"
                      : "bg-[#f8f9fa] text-[#6b7280] hover:bg-[#f3f4f6]"
                  }`}
                  style={{ marginBottom: activeTab === "albums" ? "-1px" : "0" }}
                >
                  📸 Ver álbumes
                </button>
                <button
                  onClick={() => handleTabChange("interesados")}
                  className={`px-6 py-3 text-sm font-medium transition-colors border border-[#e5e7eb] border-b-0 rounded-t-lg -ml-px ${
                    activeTab === "interesados"
                      ? "bg-white text-[#1a1a1a] border-[#c27b3d] border-b-2 border-b-[#c27b3d]"
                      : "bg-[#f8f9fa] text-[#6b7280] hover:bg-[#f3f4f6]"
                  }`}
                  style={{ marginBottom: activeTab === "interesados" ? "-1px" : "0" }}
                >
                  👀 Interesados
                </button>
              </div>
            </div>

            <div className="mt-6">
              {activeTab === "albums" && (
                <div className="space-y-6">
                  {!albumsEnabled ? (
                    <Card className="p-8 text-center">
                      <div className="w-1/2 mx-auto">
                        <svg className="w-16 h-16 mx-auto text-[#6b7280] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h3 className="text-lg font-medium text-[#1a1a1a] mb-2">Álbumes no habilitados</h3>
                        <p className="text-sm text-[#6b7280] mb-4">
                          Para gestionar álbumes, primero debés habilitar esta funcionalidad en la sección de Configuración.
                        </p>
                        <Link href="/lab/configuracion?tab=datos">
                          <Button variant="primary">Ir a Configuración</Button>
                        </Link>
                      </div>
                    </Card>
                  ) : albumsLoading ? (
                    <div className="text-center py-8">
                      <p className="text-[#6b7280]">Cargando álbumes...</p>
                    </div>
                  ) : albums.length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-[#6b7280] mb-4">No tenés álbumes creados aún.</p>
                      <Link href="/dashboard/albums">
                        <Button variant="primary" className="mt-4">
                          Crear primer álbum
                        </Button>
                      </Link>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <Link href="/dashboard/albums">
                          <Button variant="primary">+ Crear nuevo álbum</Button>
                        </Link>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {albums.map((album: any) => (
                          <Card key={album.id} className="p-4">
                            <h3 className="font-medium text-[#1a1a1a] mb-2">{album.title}</h3>
                            <p className="text-sm text-[#6b7280] mb-2">{album.location || "Sin ubicación"}</p>
                            <p className="text-xs text-[#6b7280]">
                              {album.photosCount || 0} foto{album.photosCount !== 1 ? "s" : ""}
                            </p>
                            <Link href={`/dashboard/albums/${album.id}`}>
                              <Button variant="secondary" className="mt-3 w-full">
                                Ver álbum
                              </Button>
                            </Link>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "interesados" && (
                <div className="space-y-6">
                  {interesadosLoading ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600">Cargando interesados...</p>
                    </div>
                  ) : interesados.length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-gray-600">
                        No hay interesados en los álbumes que tienen este laboratorio seleccionado.
                      </p>
                    </Card>
                  ) : (
                    <div className="space-y-6">
                      {interesados.map((item: any) => (
                        <Card key={item.albumId} className="p-6">
                          <div className="mb-4">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.albumTitle}</h3>
                                <p className="text-sm text-gray-600">Fotógrafo: {item.photographerName}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {item.totalInteresados} {item.totalInteresados === 1 ? "interesado" : "interesados"}
                                </p>
                              </div>
                              <a
                                href={`/a/${item.albumSlug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                              >
                                Ver álbum →
                              </a>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {item.interesados.map((interesado: any) => (
                              <div
                                key={interesado.id}
                                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                              >
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">
                                    {interesado.name || ""} {interesado.lastName || ""}
                                  </p>
                                  <div className="space-y-1 text-xs text-gray-600">
                                    {interesado.whatsapp && (
                                      <p className="flex items-center gap-1">
                                        <span>📱</span> {interesado.whatsapp}
                                      </p>
                                    )}
                                    {interesado.email && (
                                      <p className="flex items-center gap-1">
                                        <span>✉️</span> {interesado.email}
                                      </p>
                                    )}
                                    <p className="text-gray-500 mt-1">
                                      Interesado el:{" "}
                                      {new Date(interesado.createdAt).toLocaleDateString("es-AR", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  {interesado.whatsapp && (
                                    <button
                                      onClick={() => {
                                        const cleanWhatsapp = interesado.whatsapp.replace(/\D/g, "");
                                        const finalWhatsapp = cleanWhatsapp.startsWith("54") ? cleanWhatsapp : `54${cleanWhatsapp}`;
                                        const name = `${interesado.name || ""} ${interesado.lastName || ""}`.trim();
                                        const greeting = name ? `Hola ${name.split(" ")[0]}` : "Hola";
                                        const message = encodeURIComponent(`${greeting}, ¿tu álbum "${item.albumTitle}" está listo?`);
                                        window.open(`https://wa.me/${finalWhatsapp}?text=${message}`, "_blank");
                                      }}
                                      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium shadow-sm hover:shadow-md"
                                    >
                                      WhatsApp
                                    </button>
                                  )}
                                  {interesado.email && (
                                    <a
                                      href={`mailto:${interesado.email}`}
                                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                      Email
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function LabAlbumesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[#6b7280]">Cargando...</div>}>
      <LabAlbumesContent />
    </Suspense>
  );
}
