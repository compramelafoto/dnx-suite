"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tabs from "@/components/ui/Tabs";

function formatARS(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

const STATUS_LABEL: Record<string, string> = {
  CREATED: "Creado",
  IN_PRODUCTION: "En producción",
  READY_TO_PICKUP: "Listo para retirar",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELED: "Cancelado",
};

export default function ClientDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("pedidos");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [digitalDownloads, setDigitalDownloads] = useState<any[]>([]);
  const [visitedAlbums, setVisitedAlbums] = useState<any[]>([]);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [downloadingOrderId, setDownloadingOrderId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    // Verificar si viene de Google OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get("user");
    if (userParam) {
      try {
        const userData = JSON.parse(userParam);
        if (userData.role === "CUSTOMER") {
          sessionStorage.setItem("client", JSON.stringify(userData));
          sessionStorage.setItem("clientId", userData.id.toString());
          window.history.replaceState({}, "", "/cliente/dashboard");
        }
      } catch (e) {
        console.error("Error procesando datos de Google OAuth:", e);
      }
    }
    loadDashboard();
  }, []);

  // Mantener marketing siempre activo (sin opción de desactivar)
  useEffect(() => {
    if (loading || marketingOptIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/me/marketing-opt-in", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketingOptIn: true, source: "profile" }),
        });
        if (res.ok && !cancelled) setMarketingOptIn(true);
      } catch (_err) {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [loading, marketingOptIn]);

  async function loadDashboard() {
    try {
      const res = await fetch("/api/cliente/dashboard");
      if (!res.ok) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setStats(data.stats);
      setOrders(data.orders || []);
      setDigitalDownloads(data.digitalDownloads || []);
      setVisitedAlbums(data.visitedAlbums || []);
      setMarketingOptIn(data.marketingOptIn ?? false);
    } catch (error) {
      console.error("Error cargando dashboard:", error);
      router.push("/cliente/login");
    } finally {
      setLoading(false);
    }
  }

  async function getDownloadUrl(orderId: number): Promise<string | null> {
    setDownloadError(null);
    setDownloadingOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/refresh-download-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDownloadError(data?.error || "No se pudo obtener el link de descarga");
        return null;
      }
      return data?.downloadUrl ?? null;
    } catch (err) {
      setDownloadError("Error al generar el link de descarga");
      return null;
    } finally {
      setDownloadingOrderId(null);
    }
  }

  async function handleDownloadZip(download: { orderId: number; photoId?: number; albumId?: number }) {
    const url = await getDownloadUrl(download.orderId);
    if (url) {
      window.location.href = url;
    }
  }

  function sendWhatsAppDownload(phone: string, downloadUrl: string) {
    const message = encodeURIComponent(
      `Hola! Te comparto el link para descargar tus fotos digitales:\n\n${downloadUrl}\n\nEste link estará disponible hasta la fecha indicada.`
    );
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${message}`, "_blank");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#6b7280]">Cargando...</p>
      </div>
    );
  }

  const tabs = [
    { id: "pedidos", label: "📦 Mis Pedidos" },
    { id: "descargas", label: "⬇️ Descargas Digitales" },
    { id: "albumes", label: "📸 Álbumes Visitados" },
    { id: "cuenta", label: "⚙️ Cuenta" },
  ];

  return (
    <section className="py-12 md:py-16 bg-white min-h-screen">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-[#1a1a1a] mb-2">
                  Mi Dashboard
                </h1>
              </div>
              <div className="flex gap-3 items-center">
                <Link
                  href="/cliente/soporte"
                  className="p-2.5 rounded-lg border border-[#e5e7eb] hover:bg-[#f9fafb] transition-colors"
                  title="Soporte"
                  aria-label="Soporte técnico"
                >
                  <svg
                    className="w-5 h-5 text-[#1a1a1a]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </Link>
                <Link href="/directorio/fotografos" aria-label="Comunidad">
                  <Button variant="secondary" className="px-3 py-2 text-sm">
                    Comunidad
                  </Button>
                </Link>
                <Link href="/terminos#cliente" aria-label="Términos y condiciones">
                  <Button variant="secondary" className="px-3 py-2 text-sm">
                    Términos
                  </Button>
                </Link>
              </div>
            </div>
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <Card className="p-4">
                  <p className="text-sm text-[#6b7280]">Total Pedidos</p>
                  <p className="text-2xl font-bold text-[#1a1a1a]">
                    {stats.totalOrders}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-[#6b7280]">Total Gastado</p>
                  <p className="text-2xl font-bold text-[#1a1a1a]">
                    {formatARS(stats.totalSpent)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-[#6b7280]">En Producción</p>
                  <p className="text-2xl font-bold text-[#f59e0b]">
                    {stats.ordersByStatus.IN_PRODUCTION}
                  </p>
                </Card>
              </div>
            )}
          </div>

          <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab}>
            {activeTab === "pedidos" && (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-[#6b7280] mb-4">
                    Aún no tenés pedidos.{" "}
                    <Link href="/imprimir" className="text-[#c27b3d] hover:underline">
                      Hacé tu primer pedido
                    </Link>
                  </p>
                </Card>
              ) : (
                orders.map((order) => (
                  <Card key={order.id} className="p-6">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          <h3 className="text-lg font-medium text-[#1a1a1a]">
                            Pedido #{order.id}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${
                              order.status === "DELIVERED"
                                ? "bg-[#10b981]/10 text-[#10b981]"
                                : order.status === "CANCELED"
                                ? "bg-[#ef4444]/10 text-[#ef4444]"
                                : order.status === "READY_TO_PICKUP" || order.status === "SHIPPED"
                                ? "bg-[#3b82f6]/10 text-[#3b82f6]"
                                : "bg-[#f59e0b]/10 text-[#f59e0b]"
                            }`}
                          >
                            {STATUS_LABEL[order.status] || order.status}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm text-[#6b7280]">
                          <p>
                            <span className="font-medium">Laboratorio:</span> {order.labName}
                          </p>
                          <p>
                            <span className="font-medium">Items:</span> {order.itemsCount} {order.itemsCount === 1 ? "foto" : "fotos"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-medium text-[#1a1a1a]">
                          {formatARS(order.total)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "descargas" && (
            <div className="space-y-4">
              {digitalDownloads.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-[#6b7280]">
                    No tenés descargas digitales disponibles.
                  </p>
                </Card>
              ) : (
                digitalDownloads.map((download, idx) => {
                  const isExpired = download.expiresAt
                    ? new Date(download.expiresAt) < new Date()
                    : false;
                  const daysLeft = download.expiresAt
                    ? Math.ceil(
                        (new Date(download.expiresAt).getTime() - Date.now()) /
                          (24 * 60 * 60 * 1000)
                      )
                    : null;

                  return (
                    <Card key={idx} className="p-6">
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-[#1a1a1a] mb-2">
                            {download.albumTitle}
                          </h3>
                          <p className="text-sm text-[#6b7280] mb-4">
                            Pedido #{download.orderId}
                          </p>
                          {isExpired ? (
                            <p className="text-sm text-[#ef4444] font-medium">
                              ⚠️ Descarga expirada
                            </p>
                          ) : daysLeft !== null ? (
                            <p className="text-sm text-[#6b7280]">
                              Disponible hasta:{" "}
                              {new Date(download.expiresAt).toLocaleDateString("es-AR")} (
                              {daysLeft > 0 ? `${daysLeft} días restantes` : "Último día"}
                              )
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-col gap-2">
                          {downloadError && (
                            <p className="text-sm text-[#ef4444]">{downloadError}</p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={isExpired || downloadingOrderId === download.orderId}
                              onClick={() => handleDownloadZip(download)}
                            >
                              {downloadingOrderId === download.orderId
                                ? "Generando link..."
                                : "Descargar ZIP"}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={isExpired}
                              onClick={async () => {
                                const url = await getDownloadUrl(download.orderId);
                                if (url) {
                                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                                  const fullUrl = url.startsWith("http") ? url : `${origin}${url}`;
                                  sendWhatsAppDownload("", fullUrl);
                                }
                              }}
                            >
                              📱 WhatsApp
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "albumes" && (
            <div className="space-y-4">
              {visitedAlbums.length === 0 ? (
                <Card className="text-center py-12">
                  <p className="text-[#6b7280]">
                    Aún no visitaste ningún álbum.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visitedAlbums.map((album) => (
                    <Link key={album.id} href={`/a/${album.slug || album.id}`}>
                      <Card className="p-4 hover:shadow-lg transition-shadow cursor-pointer">
                        <h3 className="font-semibold text-lg mb-2">{album.title}</h3>
                        <p className="text-sm text-[#6b7280]">
                          {album.purchasesCount} {album.purchasesCount === 1 ? "compra" : "compras"}
                        </p>
                        <p className="text-xs text-[#9ca3af] mt-2">
                          Última visita:{" "}
                          {new Date(album.lastVisit).toLocaleDateString("es-AR")}
                        </p>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "cuenta" && (
            <Card className="p-6 space-y-6">
              <h2 className="text-xl font-medium text-[#1a1a1a]">Configuración de cuenta</h2>
              <p className="text-sm text-[#6b7280]">
                <Link href="/privacidad" className="text-[#c27b3d] hover:underline">
                  Ver Política de Privacidad
                </Link>
              </p>
            </Card>
          )}
          </Tabs>
        </div>
      </div>
    </section>
  );
}
