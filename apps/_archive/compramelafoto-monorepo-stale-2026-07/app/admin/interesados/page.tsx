"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import type { InteresadoRow } from "@/app/api/admin/interesados/route";

function buildWhatsAppLink(phone: string | null, message: string): string {
  if (!phone || !phone.trim()) return "#";
  const cleaned = phone.replace(/\D/g, "");
  const num = cleaned.startsWith("0") ? "54" + cleaned : cleaned.startsWith("549") ? cleaned : "54" + cleaned.replace(/^0/, "");
  const base = `https://wa.me/${num}`;
  return `${base}?text=${encodeURIComponent(message)}`;
}

function escapeCsvCell(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(rows: InteresadoRow[]): string {
  const headers = [
    "Tipo",
    "Email",
    "Nombre",
    "Apellido",
    "Nombre (firstName)",
    "WhatsApp",
    "Fecha registro",
    "Compró",
    "Álbum ID",
    "Álbum título",
    "Fotógrafo ID",
    "Fotógrafo email",
    "Fotógrafo nombre",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.tipo,
        escapeCsvCell(r.email),
        escapeCsvCell(r.name),
        escapeCsvCell(r.lastName),
        escapeCsvCell(r.firstName),
        escapeCsvCell(r.whatsapp),
        escapeCsvCell(r.createdAt),
        r.tipo === "interesado" ? (r.hasPurchased ? "Sí" : "No") : "",
        r.albumId,
        escapeCsvCell(r.albumTitle),
        r.photographerId,
        escapeCsvCell(r.photographerEmail),
        escapeCsvCell(r.photographerName),
      ].join(",")
    ),
  ];
  return lines.join("\r\n");
}

function downloadCsv(rows: InteresadoRow[], filename: string) {
  const csv = buildCsv(rows);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminInteresadosPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InteresadoRow[]>([]);
  const [search, setSearch] = useState("");
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieRow, setSelfieRow] = useState<InteresadoRow | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/interesados", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Error cargando interesados");
      }
      const data = await res.json();
      setRows(data.rows || []);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = search.trim().length >= 3
    ? rows.filter(
        (r) =>
          r.email.toLowerCase().includes(search.toLowerCase()) ||
          (r.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (r.lastName ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (r.albumTitle ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (r.photographerEmail ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (r.whatsapp ?? "").replace(/\D/g, "").includes(search.replace(/\D/g, ""))
      )
    : rows;

  const exportCsv = () => {
    const filename = `clientes-interesados-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filtered, filename);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando clientes interesados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes interesados</h1>
          <p className="text-gray-600 mt-1">
            Listado de contactos que mostraron interés en álbumes o pidieron aviso cuando estén listos.
          </p>
        </div>
        <Button variant="primary" onClick={exportCsv} disabled={filtered.length === 0}>
          Exportar CSV
        </Button>
      </div>

      <Card className="p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
        <Input
          type="text"
          placeholder="Email, nombre, álbum, fotógrafo, WhatsApp..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Álbum</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fotógrafo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Compró</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    {rows.length === 0
                      ? "No hay clientes interesados registrados."
                      : "No hay resultados para la búsqueda."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={`${r.tipo}-${r.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          r.tipo === "interesado" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.tipo === "interesado" ? "Interés" : "Aviso"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{r.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {[r.name, r.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{r.whatsapp || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className="font-medium">#{r.albumId}</span> {r.albumTitle}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {r.photographerName || r.photographerEmail || `#${r.photographerId}`}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.tipo === "interesado" ? (
                        r.hasPurchased ? (
                          <span className="text-green-600 font-medium">Sí</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        {r.hasSelfie && r.interestId && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelfieRow(r);
                              setShowSelfieModal(true);
                            }}
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                            title="Ver selfie"
                          >
                            <img src="/faceid.png" alt="Ver selfie" className="w-5 h-5 object-contain" />
                          </button>
                        )}
                        <a
                          href={buildWhatsAppLink(
                            r.whatsapp,
                            `Hola! Las fotos de tu álbum "${r.albumTitle}" ya están listas. Podés verlas acá: ${typeof window !== "undefined" ? window.location.origin : ""}/a/${r.albumPublicSlug}`
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                            r.whatsapp
                              ? "border-green-200 bg-green-50 hover:bg-green-100 text-green-700"
                              : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed pointer-events-none"
                          }`}
                          title={r.whatsapp ? "Enviar link por WhatsApp" : "Sin WhatsApp"}
                          aria-disabled={!r.whatsapp}
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {filtered.length > 0 && (
        <p className="text-sm text-gray-500">
          Mostrando {filtered.length} de {rows.length} registro(s).
          {search.trim() && " (filtrado por búsqueda)"}
        </p>
      )}

      {/* Modal de selfie */}
      {showSelfieModal && selfieRow && selfieRow.interestId && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => {
              setShowSelfieModal(false);
              setSelfieRow(null);
            }}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl min-w-[min(100%,320px)] space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Selfie - {[selfieRow.name, selfieRow.lastName].filter(Boolean).join(" ") || selfieRow.email}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowSelfieModal(false);
                    setSelfieRow(null);
                  }}
                  className="p-1 text-gray-500 hover:text-gray-900"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={`/api/admin/albums/${selfieRow.albumId}/interested/${selfieRow.interestId}/selfie`}
                  alt="Selfie del interesado"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector(".selfie-error")) {
                      const err = document.createElement("div");
                      err.className = "selfie-error absolute inset-0 flex items-center justify-center text-gray-500";
                      err.textContent = "No se pudo cargar la selfie";
                      parent.appendChild(err);
                    }
                  }}
                />
              </div>
              <Button onClick={() => { setShowSelfieModal(false); setSelfieRow(null); }} variant="secondary" className="w-full">
                Cerrar
              </Button>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
