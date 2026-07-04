"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatDate } from "@/lib/admin/helpers";

type AttemptResult =
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "MATCH_FOUND"
  | "NO_MATCH"
  | "EXPIRED_SESSION"
  | "RATE_LIMITED"
  | "ERROR";

const RESULT_LABELS: Record<AttemptResult, string> = {
  NO_FACE: "Sin cara",
  MULTIPLE_FACES: "Varias caras",
  MATCH_FOUND: "Coincidencia",
  NO_MATCH: "Sin coincidencia",
  EXPIRED_SESSION: "Sesión expirada",
  RATE_LIMITED: "Límite intentos",
  ERROR: "Error",
};

const DEVICE_LABELS: Record<string, string> = {
  MOBILE: "Móvil",
  DESKTOP: "Escritorio",
  UNKNOWN: "—",
};

interface AttemptItem {
  id: string;
  albumId: number;
  album: { id: number; title: string; publicSlug: string };
  createdAt: string;
  userId: number | null;
  guestId: string | null;
  user: { id: number; email: string; name: string | null } | null;
  qrSessionId: string | null;
  ipHash: string | null;
  userAgent: string | null;
  deviceType: string;
  result: AttemptResult;
  errorCode: string | null;
  errorMessage: string | null;
  facesInSelfieCount: number;
  bestMatchConfidence: number | null;
  photosNoFaceCount: number;
  photosMatchedCount: number;
  photosVisibleTotal: number;
  grant: { id: string; allowedCount: number; expiresAt: string; isRevoked: boolean } | null;
  selfieStored: boolean;
  selfieExpiresAt: string | null;
  durationMs: number | null;
}

interface DetailAttempt extends AttemptItem {
  user: { id: number; email: string; name: string | null } | null;
  grant: {
    id: string;
    allowedCount: number;
    expiresAt: string;
    isRevoked: boolean;
    allowedPhotoIds: number[];
  } | null;
  photosForThumbnails?: { id: number; previewUrl: string; originalKey: string }[];
}

export default function AdminAuditoriaSelfiesPage() {
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState<AttemptItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({
    albumId: "",
    result: "",
    from: "",
    to: "",
    email: "",
    guestId: "",
  });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailAttempt | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  const loadAttempts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      params.set("pageSize", String(pagination.pageSize));
      if (filters.albumId) params.set("albumId", filters.albumId);
      if (filters.result) params.set("result", filters.result);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.email) params.set("email", filters.email);
      if (filters.guestId) params.set("guestId", filters.guestId);
      const res = await fetch(`/api/admin/hidden-album-attempts?${params}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error(err);
        return;
      }
      const data = await res.json();
      setAttempts(data.attempts || []);
      setPagination(data.pagination || pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters.albumId, filters.result, filters.from, filters.to, filters.email, filters.guestId]);

  useEffect(() => {
    loadAttempts();
  }, [loadAttempts]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      setSelfieUrl(null);
      return;
    }
    setDetailLoading(true);
    setSelfieUrl(null);
    fetch(`/api/admin/hidden-album-attempts/${detailId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setDetail(d);
        setDetailLoading(false);
      })
      .catch(() => setDetailLoading(false));
  }, [detailId]);

  async function openSelfie(attemptId: string) {
    try {
      const res = await fetch(`/api/admin/hidden-album-attempts/${attemptId}/selfie`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "No se pudo obtener la selfie");
        return;
      }
      const { url } = await res.json();
      setSelfieUrl(url);
      if (url) window.open(url, "_blank");
    } catch (e) {
      console.error(e);
      alert("Error al obtener URL de selfie");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Auditoría Selfies (álbum oculto)</h1>
        <p className="text-gray-600 mt-1">
          Intentos de verificación por selfie en álbumes con fotos ocultas
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Álbum ID</label>
            <Input
              type="text"
              placeholder="ID álbum"
              value={filters.albumId}
              onChange={(e) => setFilters((f) => ({ ...f, albumId: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Resultado</label>
            <select
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              value={filters.result}
              onChange={(e) => setFilters((f) => ({ ...f, result: e.target.value }))}
            >
              <option value="">Todos</option>
              {(Object.keys(RESULT_LABELS) as AttemptResult[]).map((r) => (
                <option key={r} value={r}>{RESULT_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              type="text"
              placeholder="email@..."
              value={filters.email}
              onChange={(e) => setFilters((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Guest ID</label>
            <Input
              type="text"
              placeholder="UUID"
              value={filters.guestId}
              onChange={(e) => setFilters((f) => ({ ...f, guestId: e.target.value }))}
            />
          </div>
        </div>
        <Button variant="primary" onClick={() => loadAttempts()}>Filtrar</Button>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando...</div>
          ) : attempts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No hay intentos con los filtros aplicados.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Álbum</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Usuario / Guest</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Resultado</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fotos visibles</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">IP hash</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attempts.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">{formatDate(a.createdAt)}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className="font-medium">{a.album?.title ?? a.albumId}</span>
                      <span className="text-gray-500 ml-1">#{a.albumId}</span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {a.user ? (
                        <span title={a.user.email}>{a.user.email}</span>
                      ) : a.guestId ? (
                        <span className="text-gray-500 font-mono text-xs">{a.guestId.slice(0, 8)}…</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">{RESULT_LABELS[a.result as AttemptResult] ?? a.result}</td>
                    <td className="px-4 py-2 text-sm">{a.photosVisibleTotal}</td>
                    <td className="px-4 py-2 text-sm font-mono text-xs text-gray-500">{a.ipHash ? `${a.ipHash.slice(0, 12)}…` : "—"}</td>
                    <td className="px-4 py-2 text-sm">{DEVICE_LABELS[a.deviceType] ?? a.deviceType}</td>
                    <td className="px-4 py-2 text-sm">
                      <Button variant="secondary" size="sm" onClick={() => setDetailId(a.id)}>Ver detalle</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {pagination.totalPages > 1 && (
          <div className="px-4 py-2 border-t flex justify-between items-center text-sm text-gray-600">
            <span>Página {pagination.page} de {pagination.totalPages} ({pagination.total} total)</span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal detalle */}
      {detailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setDetailId(null)}>
          <div
            className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto m-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Detalle del intento</h2>
              <button type="button" className="text-gray-500 hover:text-gray-700" onClick={() => setDetailId(null)}>✕</button>
            </div>
            <div className="p-4 space-y-4">
              {detailLoading ? (
                <p className="text-gray-500">Cargando...</p>
              ) : detail ? (
                <>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-gray-500">ID</dt>
                    <dd className="font-mono">{detail.id}</dd>
                    <dt className="text-gray-500">Álbum</dt>
                    <dd>{detail.album?.title} (#{detail.albumId})</dd>
                    <dt className="text-gray-500">Fecha</dt>
                    <dd>{formatDate(detail.createdAt)}</dd>
                    <dt className="text-gray-500">Usuario</dt>
                    <dd>{detail.user?.email ?? detail.guestId ?? "—"}</dd>
                    <dt className="text-gray-500">Resultado</dt>
                    <dd>{RESULT_LABELS[detail.result as AttemptResult] ?? detail.result}</dd>
                    <dt className="text-gray-500">Device</dt>
                    <dd>{DEVICE_LABELS[detail.deviceType] ?? detail.deviceType}</dd>
                    <dt className="text-gray-500">IP hash</dt>
                    <dd className="font-mono text-xs break-all">{detail.ipHash ?? "—"}</dd>
                    <dt className="text-gray-500">User-Agent</dt>
                    <dd className="text-xs break-all">{detail.userAgent ?? "—"}</dd>
                    <dt className="text-gray-500">Caras en selfie</dt>
                    <dd>{detail.facesInSelfieCount}</dd>
                    <dt className="text-gray-500">Confianza mejor match</dt>
                    <dd>{detail.bestMatchConfidence != null ? `${(detail.bestMatchConfidence * 100).toFixed(1)}%` : "—"}</dd>
                    <dt className="text-gray-500">Fotos sin cara / matched / total visible</dt>
                    <dd>{detail.photosNoFaceCount} / {detail.photosMatchedCount} / {detail.photosVisibleTotal}</dd>
                    <dt className="text-gray-500">Duración (ms)</dt>
                    <dd>{detail.durationMs ?? "—"}</dd>
                    {detail.grant && (
                      <>
                        <dt className="text-gray-500">Grant</dt>
                        <dd>ID: {detail.grant.id} · Expira: {formatDate(detail.grant.expiresAt)} · Revocado: {detail.grant.isRevoked ? "Sí" : "No"}</dd>
                        <dt className="text-gray-500">Fotos habilitadas (IDs)</dt>
                        <dd className="font-mono text-xs">{Array.isArray(detail.grant.allowedPhotoIds) ? detail.grant.allowedPhotoIds.join(", ") : "—"}</dd>
                      </>
                    )}
                  </dl>
                  {detail.selfieStored && (
                    <div>
                      <Button variant="primary" size="sm" onClick={() => openSelfie(detail.id)}>
                        Ver selfie (URL firmada)
                      </Button>
                      {detail.selfieExpiresAt && (
                        <span className="ml-2 text-sm text-gray-500">Expira selfie: {formatDate(detail.selfieExpiresAt)}</span>
                      )}
                    </div>
                  )}
                  {detail.photosForThumbnails && detail.photosForThumbnails.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Fotos habilitadas (miniaturas)</h3>
                      <div className="flex flex-wrap gap-2">
                        {detail.photosForThumbnails.map((p) => (
                          <a
                            key={p.id}
                            href={`/api/photos/${p.id}/view?mode=preview`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-16 h-16 rounded overflow-hidden border border-gray-200"
                          >
                            <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500">No se pudo cargar el detalle.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
