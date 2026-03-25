"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface AppConfig {
  id: number;
  minDigitalPhotoPrice?: number;
  platformCommissionPercent?: number;
  stuckOrderDays: number;
  downloadLinkDays: number;
  photoDeletionDays: number;
  maintenanceMode: boolean;
  whatsappEnabled?: boolean;
  whatsappMaxPhotosToSend?: number;
  whatsappSendInitialMessage?: boolean;
  whatsappSendFinalMessage?: boolean;
  whatsappSendDownloadLinkForLargeOrders?: boolean;
  whatsappDeliveryEnabledForPaidOrders?: boolean;
}

export default function AdminConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulario
  const [platformCommissionPercent, setPlatformCommissionPercent] = useState("");
  const [minDigitalPhotoPrice, setMinDigitalPhotoPrice] = useState("");
  const [stuckOrderDays, setStuckOrderDays] = useState("");
  const [downloadLinkDays, setDownloadLinkDays] = useState("");
  const [photoDeletionDays, setPhotoDeletionDays] = useState("");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappMaxPhotosToSend, setWhatsappMaxPhotosToSend] = useState("10");
  const [whatsappSendInitialMessage, setWhatsappSendInitialMessage] = useState(true);
  const [whatsappSendFinalMessage, setWhatsappSendFinalMessage] = useState(true);
  const [whatsappSendDownloadLinkForLargeOrders, setWhatsappSendDownloadLinkForLargeOrders] = useState(true);
  const [whatsappDeliveryEnabledForPaidOrders, setWhatsappDeliveryEnabledForPaidOrders] = useState(true);
  const [albumIdToExtend, setAlbumIdToExtend] = useState("");
  const [extensionDays, setExtensionDays] = useState("");
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [extensionError, setExtensionError] = useState<string | null>(null);
  const [extensionSuccess, setExtensionSuccess] = useState<string | null>(null);
  const [albumSearch, setAlbumSearch] = useState("");
  const [albumSearchLoading, setAlbumSearchLoading] = useState(false);
  const [albumSearchResults, setAlbumSearchResults] = useState<Array<{ id: number; title: string; publicSlug?: string | null }>>([]);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setPlatformCommissionPercent(
          data.platformCommissionPercent != null ? String(data.platformCommissionPercent) : "10"
        );
        setMinDigitalPhotoPrice(
          data.minDigitalPhotoPrice ? String(Math.round(data.minDigitalPhotoPrice)) : "5000"
        );
        setStuckOrderDays(data.stuckOrderDays?.toString() || "7");
        setDownloadLinkDays(data.downloadLinkDays?.toString() || "30");
        setPhotoDeletionDays(data.photoDeletionDays?.toString() || "45");
        setMaintenanceMode(data.maintenanceMode || false);
        setWhatsappEnabled(data.whatsappEnabled ?? false);
        setWhatsappMaxPhotosToSend(data.whatsappMaxPhotosToSend?.toString() ?? "10");
        setWhatsappSendInitialMessage(data.whatsappSendInitialMessage ?? true);
        setWhatsappSendFinalMessage(data.whatsappSendFinalMessage ?? true);
        setWhatsappSendDownloadLinkForLargeOrders(data.whatsappSendDownloadLinkForLargeOrders ?? true);
        setWhatsappDeliveryEnabledForPaidOrders(data.whatsappDeliveryEnabledForPaidOrders ?? true);
      }
    } catch (err) {
      console.error("Error cargando configuración:", err);
      setError("Error cargando configuración");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const minDigitalPricePesos = parseFloat(minDigitalPhotoPrice.replace(",", "."));
      const minDigitalPriceCents = Number.isFinite(minDigitalPricePesos)
        ? Math.round(minDigitalPricePesos)
        : 5000;
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minDigitalPhotoPrice: minDigitalPriceCents,
          platformCommissionPercent: Number(platformCommissionPercent) || 10,
          stuckOrderDays: parseInt(stuckOrderDays) || 7,
          downloadLinkDays: parseInt(downloadLinkDays) || 30,
          photoDeletionDays: parseInt(photoDeletionDays) || 45,
          maintenanceMode,
          whatsappEnabled,
          whatsappMaxPhotosToSend: parseInt(whatsappMaxPhotosToSend) || 10,
          whatsappSendInitialMessage,
          whatsappSendFinalMessage,
          whatsappSendDownloadLinkForLargeOrders,
          whatsappDeliveryEnabledForPaidOrders,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error guardando configuración");
      }

      const data = await res.json();
      setConfig(data);
      setSuccess("Configuración guardada correctamente");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleExtendAlbum() {
    setExtensionLoading(true);
    setExtensionError(null);
    setExtensionSuccess(null);

    const albumId = parseInt(albumIdToExtend);
    const daysToAdd = parseInt(extensionDays);

    if (!Number.isFinite(albumId)) {
      setExtensionLoading(false);
      setExtensionError("ID de álbum inválido");
      return;
    }
    if (!Number.isFinite(daysToAdd)) {
      setExtensionLoading(false);
      setExtensionError("Días a ajustar inválido");
      return;
    }

    try {
      const res = await fetch(`/api/admin/albums/${albumId}/extend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daysToAdd }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.detail || "Error actualizando extensión");
      }

      setExtensionSuccess(
        `Extensión aplicada. Total días extra: ${data.expirationExtensionDays}. ` +
          `Visible hasta: ${new Date(data.visibleUntil).toLocaleDateString("es-AR")} ` +
          `| Eliminación: ${new Date(data.availableUntil).toLocaleDateString("es-AR")}`
      );
      setAlbumIdToExtend("");
      setExtensionDays("");
    } catch (err: any) {
      setExtensionError(err?.message || "Error actualizando extensión");
    } finally {
      setExtensionLoading(false);
    }
  }

  async function handleAlbumSearch(query: string) {
    const q = query.trim();
    setAlbumSearch(q);
    if (q.length < 2) {
      setAlbumSearchResults([]);
      return;
    }
    setAlbumSearchLoading(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Error buscando álbumes");
      }
      const albums = Array.isArray(data?.albums) ? data.albums : [];
      setAlbumSearchResults(albums.map((a: any) => ({ id: a.id, title: a.title, publicSlug: a.publicSlug })));
    } catch (err: any) {
      console.error("Error buscando álbumes:", err);
      setAlbumSearchResults([]);
    } finally {
      setAlbumSearchLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-600 mt-1">Configuración general de la plataforma</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
          {success}
        </div>
      )}

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Extender expiración de álbum</h2>
        <p className="text-sm text-gray-600">
          Agregá días extra a un álbum específico para extender su fecha de ocultamiento y eliminación.
        </p>

        {extensionError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
            {extensionError}
          </div>
        )}
        {extensionSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700">
            {extensionSuccess}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Buscar álbum por título</label>
            <Input
              type="text"
              placeholder="Ej: Casamiento de Ana y Luis"
              value={albumSearch}
              onChange={(e) => handleAlbumSearch(e.target.value)}
            />
            {albumSearchLoading && (
              <p className="text-xs text-gray-500 mt-2">Buscando...</p>
            )}
            {!albumSearchLoading && albumSearchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-md divide-y">
                {albumSearchResults.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => {
                      setAlbumIdToExtend(String(album.id));
                      setAlbumSearch(`${album.title} (#${album.id})`);
                      setAlbumSearchResults([]);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">{album.title}</span>
                    <span className="text-xs text-gray-500 ml-2">#{album.id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">ID del álbum</label>
            <Input
              type="number"
              placeholder="Ej: 123"
              value={albumIdToExtend}
              onChange={(e) => setAlbumIdToExtend(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Días a agregar (negativo para reducir)
            </label>
            <Input
              type="number"
              placeholder="Ej: 7 o -7"
              value={extensionDays}
              onChange={(e) => setExtensionDays(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button variant="primary" onClick={handleExtendAlbum} disabled={extensionLoading}>
              {extensionLoading
                ? "Aplicando..."
                : Number.parseInt(extensionDays || "0") < 0
                ? "Reducir días"
                : "Agregar días"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Comisiones */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Comisiones</h2>
        <p className="text-sm text-gray-600 mb-6">
          Este porcentaje se aplica sobre el total pagado (se descuenta luego del pago).
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comisión de la plataforma (%)
            </label>
            <div className="flex gap-4 items-center">
              <Input
                type="number"
                value={platformCommissionPercent}
                onChange={(e) => setPlatformCommissionPercent(e.target.value)}
                placeholder="10"
                min="0"
                max="100"
                step="0.1"
                className="w-32"
              />
              <span className="text-sm text-gray-600">
                %
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Se calcula sobre el total pagado en los pedidos de álbum (digital e impresa).
            </p>
          </div>
        </div>
      </Card>

      {/* Configuraciones generales */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuraciones Generales</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Precio mínimo foto digital (ARS)
            </label>
            <Input
              type="number"
              value={minDigitalPhotoPrice}
              onChange={(e) => setMinDigitalPhotoPrice(e.target.value)}
              placeholder="5000"
              min="0"
              step="1"
              className="w-40"
            />
            <p className="text-xs text-gray-500 mt-1">
              Mínimo permitido para venta de fotos digitales (en pesos).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Días sin cambio de estado para considerar pedido "trabado"
            </label>
            <Input
              type="number"
              value={stuckOrderDays}
              onChange={(e) => setStuckOrderDays(e.target.value)}
              placeholder="7"
              min="1"
              className="w-32"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Días de expiración de links de descarga
            </label>
            <Input
              type="number"
              value={downloadLinkDays}
              onChange={(e) => setDownloadLinkDays(e.target.value)}
              placeholder="30"
              min="1"
              className="w-32"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Días antes de borrar fotos (política de borrado)
            </label>
            <Input
              type="number"
              value={photoDeletionDays}
              onChange={(e) => setPhotoDeletionDays(e.target.value)}
              placeholder="45"
              min="1"
              className="w-32"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Modo mantenimiento (bloquea el frontend público)
              </span>
            </label>
          </div>
        </div>
      </Card>

      {/* Entrega por WhatsApp post-compra */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Entrega por WhatsApp</h2>
        <p className="text-sm text-gray-600 mb-4">
          Complementa el email con envío por WhatsApp. Si el pedido tiene hasta N fotos, se envían una por una. Si tiene más, solo se envía el link de descarga.
        </p>
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={whatsappEnabled}
                onChange={(e) => setWhatsappEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Activar entrega por WhatsApp
              </span>
            </label>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={whatsappDeliveryEnabledForPaidOrders}
                onChange={(e) => setWhatsappDeliveryEnabledForPaidOrders(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Habilitar para pedidos pagados
              </span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Máximo de fotos a enviar una por una
            </label>
            <Input
              type="number"
              value={whatsappMaxPhotosToSend}
              onChange={(e) => setWhatsappMaxPhotosToSend(e.target.value)}
              placeholder="10"
              min="1"
              max="50"
              className="w-24"
            />
            <p className="text-xs text-gray-500 mt-1">
              Si el pedido tiene más fotos, solo se envía el link de descarga.
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={whatsappSendInitialMessage}
                onChange={(e) => setWhatsappSendInitialMessage(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Enviar mensaje inicial (pedidos ≤ N fotos)
              </span>
            </label>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={whatsappSendFinalMessage}
                onChange={(e) => setWhatsappSendFinalMessage(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Enviar mensaje final con link (pedidos ≤ N fotos)
              </span>
            </label>
          </div>
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={whatsappSendDownloadLinkForLargeOrders}
                onChange={(e) => setWhatsappSendDownloadLinkForLargeOrders(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">
                Enviar link de descarga para pedidos grandes (&gt; N fotos)
              </span>
            </label>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar Configuración"}
        </Button>
      </div>
    </div>
  );
}
