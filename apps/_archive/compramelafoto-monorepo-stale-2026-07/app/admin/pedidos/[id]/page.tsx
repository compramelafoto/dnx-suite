"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatARS, formatDate, getStatusBadgeColor, getStatusLabel, getOrderTypeLabel } from "@/lib/admin/helpers";

export const dynamic = 'force-dynamic';

interface PrintOrderDetail {
  id: number;
  createdAt: string;
  updatedAt: string;
  statusUpdatedAt: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  paymentStatus: string;
  orderType: string;
  total: number;
  currency: string;
  mpPaymentId: string | null;
  mpPreferenceId: string | null;
  internalNotes: string | null;
  platformCommission: number | null;
  labCommission: number | null;
  photographerCommission: number | null;
  lab: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  photographer: {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
  } | null;
  client: {
    id: number;
    name: string | null;
    email: string;
    phone: string | null;
  } | null;
  items: Array<{
    id: number;
    size: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    fileKey: string;
    originalName: string | null;
    acabado: string;
  }>;
  statusHistory: Array<{
    id: number;
    createdAt: string;
    status: string;
    notes: string | null;
    changedBy: {
      id: number;
      name: string | null;
      email: string;
    } | null;
  }>;
  supportTickets: Array<{
    id: number;
    status: string;
    reason: string;
    createdAt: string;
  }>;
  referral?: {
    isReferred: boolean;
    referrer?: { id: number; name: string | null; email: string } | null;
    referralAmountCents?: number;
  };
}

interface AlbumOrderDetail {
  id: number;
  source: "ALBUM_ORDER";
  createdAt: string;
  status: string;
  paymentStatus: string;
  orderType: string;
  total: number;
  currency: string;
  buyerEmail: string;
  mpPaymentId: string | null;
  mpPreferenceId: string | null;
  album: {
    id: number;
    title: string;
    publicSlug: string;
  } | null;
  photographer: {
    id: number;
    name: string | null;
    email: string;
  } | null;
  items: Array<{
    id: number;
    photoId: number;
    photoName: string | null;
    productType: string;
    size: string | null;
    quantity: number;
    priceCents: number;
    subtotalCents: number;
  }>;
  downloadTokens: Array<{
    token: string;
    photoId: number | null;
    expiresAt: string;
    createdAt: string;
    downloadCount: number;
    maxDownloads: number | null;
  }>;
  zipJobs: Array<{
    id: string;
    status: string;
    zipUrl: string | null;
    expiresAt: string | null;
    createdAt: string;
  }>;
  referral?: {
    isReferred: boolean;
    referrer?: { id: number; name: string | null; email: string } | null;
    referralAmountCents?: number;
  };
}

function AdminPedidoDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params?.id ? parseInt(params.id as string) : null;
  const orderSource = searchParams?.get("source") === "ALBUM_ORDER" ? "ALBUM_ORDER" : "PRINT_ORDER";

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<PrintOrderDetail | AlbumOrderDetail | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (orderId) {
      loadOrder();
    }
  }, [orderId, orderSource]);

  async function loadOrder() {
    if (!orderId) return;

    setLoading(true);
    try {
      const endpoint =
        orderSource === "ALBUM_ORDER"
          ? `/api/admin/orders/${orderId}`
          : `/api/admin/print-orders/${orderId}`;
      const res = await fetch(endpoint, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Error cargando pedido:", errorData);
        return;
      }

      const data = await res.json();
      setOrder(data);
      if (orderSource === "PRINT_ORDER") {
        setInternalNotes((data as PrintOrderDetail).internalNotes || "");
      }
    } catch (err) {
      console.error("Error cargando pedido:", err);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus() {
    if (!orderId || !newStatus) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/print-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status: newStatus,
          notes: statusNotes,
        }),
      });

      if (res.ok) {
        setNewStatus("");
        setStatusNotes("");
        loadOrder();
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert("Error: " + (errorData.error || "Error desconocido"));
      }
    } catch (err: any) {
      alert("Error: " + (err?.message || "Error desconocido"));
    } finally {
      setUpdating(false);
    }
  }

  async function updateInternalNotes() {
    if (!orderId) return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/print-orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          internalNotes,
        }),
      });

      if (res.ok) {
        loadOrder();
        alert("Notas guardadas correctamente");
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert("Error: " + (errorData.error || "Error desconocido"));
      }
    } catch (err: any) {
      alert("Error: " + (err?.message || "Error desconocido"));
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando pedido...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <p className="text-gray-600">Pedido no encontrado</p>
          <Button variant="secondary" onClick={() => router.push("/admin/pedidos")} className="mt-4">
            Volver a Pedidos
          </Button>
        </Card>
      </div>
    );
  }

  if (orderSource === "ALBUM_ORDER") {
    const digitalOrder = order as AlbumOrderDetail;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pedido #{digitalOrder.id}</h1>
            <p className="text-gray-600 mt-1">Digital</p>
          </div>
          <Button variant="secondary" onClick={() => router.push("/admin/pedidos")}>
            Volver
          </Button>
        </div>

        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Estado</p>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(digitalOrder.status)}`}>
                {getStatusLabel(digitalOrder.status)}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pago</p>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(digitalOrder.paymentStatus)}`}>
                {getStatusLabel(digitalOrder.paymentStatus)}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Fecha</p>
              <p className="text-gray-900">{formatDate(digitalOrder.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-gray-900 font-medium">{formatARS(digitalOrder.total)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email comprador</p>
              <p className="text-gray-900">{digitalOrder.buyerEmail}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Álbum</p>
              <p className="text-gray-900">
                {digitalOrder.album?.title || "N/A"} {digitalOrder.album?.publicSlug ? `( /a/${digitalOrder.album.publicSlug} )` : ""}
              </p>
            </div>
          </div>
        </Card>

        {digitalOrder.referral && (
          <Card className="p-6 border-amber-100 bg-amber-50/30">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Referido</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-500">¿Fue referido?</p>
                <p className="text-gray-900 font-medium">{digitalOrder.referral.isReferred ? "Sí" : "No"}</p>
              </div>
              {digitalOrder.referral.isReferred && digitalOrder.referral.referrer && (
                <>
                  <div>
                    <p className="text-gray-500">Referidor</p>
                    <p className="text-gray-900 font-medium">
                      {digitalOrder.referral.referrer.name || digitalOrder.referral.referrer.email}
                    </p>
                    <p className="text-gray-600 text-xs">{digitalOrder.referral.referrer.email}</p>
                  </div>
                  {digitalOrder.referral.referralAmountCents != null && (
                    <div>
                      <p className="text-gray-500">Monto a referidor (comisión)</p>
                      <p className="text-gray-900 font-medium">
                        {formatARS(digitalOrder.referral.referralAmountCents)}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </Card>
        )}

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Items</h2>
          {digitalOrder.items.length === 0 ? (
            <p className="text-gray-500">Sin items</p>
          ) : (
            <div className="space-y-3">
              {digitalOrder.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="text-sm text-gray-700">
                    <p className="text-gray-900 font-medium">
                      {item.photoName || `Foto #${item.photoId}`}
                    </p>
                    {getOrderTypeLabel(item.productType)} {item.size ? `(${item.size})` : ""}
                    <span className="text-xs text-gray-500"> · Cant: {item.quantity}</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {formatARS(Math.round(item.subtotalCents))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Descargas ZIP</h2>
          {digitalOrder.zipJobs?.length ? (
            <div className="space-y-3 text-sm">
              {[...(digitalOrder.zipJobs ?? [])]
                .sort((a, b) => {
                  const order = { COMPLETED: 0, PROCESSING: 1, PENDING: 2, FAILED: 3 };
                  const va = order[a.status as keyof typeof order] ?? 2;
                  const vb = order[b.status as keyof typeof order] ?? 2;
                  return va - vb;
                })
                .map((job) => {
                  const hasOtherCompleted = (digitalOrder.zipJobs ?? []).some(
                    (j) => j.id !== job.id && j.status === "COMPLETED"
                  );
                  return (
                    <div key={job.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-gray-700 font-medium">Job {job.id}</p>
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(job.status)}`}>
                          {getStatusLabel(job.status)}
                        </span>
                      </div>
                      {job.status === "COMPLETED" ? (
                        <a
                          href={`/api/zip-jobs/${job.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700 underline break-all mt-2 inline-block"
                        >
                          Descargar ZIP
                        </a>
                      ) : (
                        <p className="text-gray-500 mt-2">
                          {job.status === "PENDING" || job.status === "PROCESSING"
                            ? hasOtherCompleted
                              ? "En cola (hay una descarga lista abajo)."
                              : "ZIP no disponible aún. Se procesará en breve."
                            : "ZIP no disponible aún."}
                        </p>
                      )}
                      {job.expiresAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Expira: {formatDate(job.expiresAt)}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-gray-500">Sin ZIPs disponibles.</p>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Links de descarga</h2>
          {digitalOrder.downloadTokens?.length ? (
            <div className="space-y-3 text-sm">
              {digitalOrder.downloadTokens.map((token) => {
                const label = token.photoId
                  ? digitalOrder.items.find((item) => item.photoId === token.photoId)?.photoName ||
                    `Foto #${token.photoId}`
                  : "Descarga completa";
                return (
                  <div key={token.token} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-gray-700 font-medium">{label}</p>
                    <a
                      href={`/api/downloads/${token.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline break-all mt-2 inline-block"
                    >
                      Descargar
                    </a>
                    <p className="text-xs text-gray-500 mt-1">
                      Expira: {formatDate(token.expiresAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">Sin links disponibles.</p>
          )}
        </Card>
      </div>
    );
  }

  const printOrder = order as PrintOrderDetail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="secondary" onClick={() => router.push("/admin/pedidos")} size="sm">
            ← Volver
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Pedido #{printOrder.id}
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Información principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos del cliente */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Datos del Cliente</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Nombre</p>
                <p className="text-gray-900">{printOrder.customerName || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="text-gray-900">{printOrder.customerEmail || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Teléfono</p>
                <p className="text-gray-900">{printOrder.customerPhone || "N/A"}</p>
              </div>
              {printOrder.client && (
                <div>
                  <p className="text-sm text-gray-500">Cliente registrado</p>
                  <p className="text-gray-900">
                    {printOrder.client.name || printOrder.client.email} (ID: {printOrder.client.id})
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Items del pedido */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Items del Pedido</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Archivo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tamaño
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Acabado
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Cantidad
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Precio Unit.
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {printOrder.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {item.originalName || item.fileKey}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.size}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{item.acabado}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {formatARS(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                        {formatARS(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      Total:
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">
                      {formatARS(printOrder.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Historial de estados */}
          {printOrder.statusHistory && printOrder.statusHistory.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Historial de Estados</h2>
              <div className="space-y-3">
                {printOrder.statusHistory.map((history) => (
                  <div key={history.id} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(history.status)}`}>
                          {getStatusLabel(history.status)}
                        </span>
                        <p className="text-sm text-gray-500 mt-1">
                          {formatDate(history.createdAt)}
                        </p>
                        {history.notes && (
                          <p className="text-sm text-gray-700 mt-1">{history.notes}</p>
                        )}
                      </div>
                      {history.changedBy && (
                        <p className="text-xs text-gray-500">
                          Por: {history.changedBy.name || history.changedBy.email}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Panel lateral */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Descarga y fotos</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Link de descarga</p>
                <a
                  href={`/api/print-orders/${printOrder.id}/export`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 underline break-all"
                >
                  Descargar carpeta del pedido
                </a>
              </div>
              <div>
                <p className="text-gray-500 mb-1">Fotos compradas</p>
                {printOrder.items.length === 0 ? (
                  <p className="text-gray-600">Sin fotos</p>
                ) : (
                  <ul className="list-disc pl-4 space-y-1 text-gray-700">
                    {printOrder.items.map((item) => (
                      <li key={item.id}>{item.originalName || item.fileKey}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
          {/* Estado y acciones */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Estado y Acciones</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Estado Actual</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(printOrder.status)}`}>
                  {getStatusLabel(printOrder.status)}
                </span>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Estado de Pago</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(printOrder.paymentStatus)}`}>
                  {getStatusLabel(printOrder.paymentStatus)}
                </span>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Tipo</p>
                <p className="text-gray-900">{getOrderTypeLabel(printOrder.orderType)}</p>
              </div>

              {printOrder.mpPaymentId && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">ID Pago MP</p>
                  <p className="text-sm text-gray-900 font-mono">{printOrder.mpPaymentId}</p>
                </div>
              )}

              {/* Cambiar estado */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cambiar Estado
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  <option value="CREATED">Creado</option>
                  <option value="IN_PRODUCTION">En Producción</option>
                  <option value="READY">Listo</option>
                  <option value="READY_TO_PICKUP">Listo para Retirar</option>
                  <option value="SHIPPED">Enviado</option>
                  <option value="DELIVERED">Entregado</option>
                  <option value="CANCELED">Cancelado</option>
                </select>
                <Input
                  type="text"
                  placeholder="Notas del cambio (opcional)"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className="mb-2"
                />
                <Button
                  variant="primary"
                  onClick={updateStatus}
                  disabled={!newStatus || updating}
                  className="w-full"
                  size="sm"
                >
                  {updating ? "Actualizando..." : "Actualizar Estado"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Referido */}
          {printOrder.referral && (
            <Card className="p-6 border-amber-100 bg-amber-50/30">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Referido</h2>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-gray-500">¿Fue referido?</p>
                  <p className="text-gray-900 font-medium">{printOrder.referral.isReferred ? "Sí" : "No"}</p>
                </div>
                {printOrder.referral.isReferred && printOrder.referral.referrer && (
                  <>
                    <div>
                      <p className="text-gray-500">Referidor</p>
                      <p className="text-gray-900 font-medium">
                        {printOrder.referral.referrer.name || printOrder.referral.referrer.email}
                      </p>
                      <p className="text-gray-600 text-xs">{printOrder.referral.referrer.email}</p>
                    </div>
                    {printOrder.referral.referralAmountCents != null && (
                      <div>
                        <p className="text-gray-500">Monto a referidor (comisión)</p>
                        <p className="text-gray-900 font-medium">
                          {formatARS(printOrder.referral.referralAmountCents)}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          )}

          {/* Información adicional */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Información</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-500">Laboratorio</p>
                {printOrder.lab ? (
                  <>
                    <p className="text-gray-900 font-medium">{printOrder.lab.name}</p>
                    {printOrder.lab.email && (
                      <p className="text-gray-600 text-xs">{printOrder.lab.email}</p>
                    )}
                  </>
                ) : (
                  <p className="text-gray-900 font-medium">
                    Fotógrafo (sin laboratorio) — pedido atendido por {printOrder.photographer?.name || printOrder.photographer?.email || "el fotógrafo"}
                  </p>
                )}
              </div>

              {printOrder.photographer && (
                <div>
                  <p className="text-gray-500">Fotógrafo</p>
                  <p className="text-gray-900 font-medium">
                    {printOrder.photographer.name || printOrder.photographer.email}
                  </p>
                </div>
              )}

              <div>
                <p className="text-gray-500">Fecha de Creación</p>
                <p className="text-gray-900">{formatDate(printOrder.createdAt)}</p>
              </div>

              <div>
                <p className="text-gray-500">Última Actualización</p>
                <p className="text-gray-900">{formatDate(printOrder.statusUpdatedAt)}</p>
              </div>

              {(printOrder.platformCommission || printOrder.labCommission || printOrder.photographerCommission) && (
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-gray-500 font-medium mb-2">Comisiones</p>
                  {printOrder.platformCommission !== null && (
                    <p className="text-xs text-gray-600">
                      Plataforma: {formatARS(printOrder.platformCommission)}
                    </p>
                  )}
                  {printOrder.labCommission !== null && (
                    <p className="text-xs text-gray-600">
                      Lab: {formatARS(printOrder.labCommission)}
                    </p>
                  )}
                  {printOrder.photographerCommission !== null && (
                    <p className="text-xs text-gray-600">
                      Fotógrafo: {formatARS(printOrder.photographerCommission)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Notas internas */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Notas Internas</h2>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              rows={4}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Notas internas solo visibles para administradores..."
            />
            <Button
              variant="primary"
              onClick={updateInternalNotes}
              disabled={updating}
              className="w-full mt-2"
              size="sm"
            >
              {updating ? "Guardando..." : "Guardar Notas"}
            </Button>
          </Card>

          {/* Tickets de soporte */}
          {printOrder.supportTickets && printOrder.supportTickets.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Tickets de Soporte</h2>
              <div className="space-y-2">
                {printOrder.supportTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-2 bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                    onClick={() => router.push(`/admin/soporte/${ticket.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">#{ticket.id}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeColor(ticket.status)}`}>
                        {getStatusLabel(ticket.status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{ticket.reason}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminPedidoDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando pedido...</p>
      </div>
    }>
      <AdminPedidoDetailContent />
    </Suspense>
  );
}
