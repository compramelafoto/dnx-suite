"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface Testimonial {
  id: number;
  name: string;
  message: string;
  instagram: string | null;
  isApproved: boolean;
  createdAt: string;
}

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AdminTestimoniosPage() {
  const [loading, setLoading] = useState(true);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [filter, setFilter] = useState<"all" | "approved" | "pending">("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", message: "", instagram: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTestimonials();
  }, []);

  async function loadTestimonials() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/testimonials", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setTestimonials(data);
    } catch (err) {
      console.error("Error cargando testimonios:", err);
    } finally {
      setLoading(false);
    }
  }

  async function toggleApproved(t: Testimonial) {
    try {
      const res = await fetch(`/api/admin/testimonials/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isApproved: !t.isApproved }),
      });
      if (res.ok) loadTestimonials();
    } catch (err) {
      console.error("Error actualizando:", err);
    }
  }

  function startEdit(t: Testimonial) {
    setEditingId(t.id);
    setEditForm({
      name: t.name,
      message: t.message,
      instagram: t.instagram || "",
    });
  }

  useEffect(() => {
    if (!editingId) return;
    const t = testimonials.find((x) => x.id === editingId);
    if (t) {
      setEditForm({
        name: t.name,
        message: t.message,
        instagram: t.instagram || "",
      });
    }
  }, [editingId, testimonials]);

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/testimonials/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        loadTestimonials();
      }
    } catch (err) {
      console.error("Error guardando:", err);
    } finally {
      setSaving(false);
    }
  }

  const filtered =
    filter === "approved"
      ? testimonials.filter((t) => t.isApproved)
      : filter === "pending"
        ? testimonials.filter((t) => !t.isApproved)
        : testimonials;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando testimonios...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Testimonios</h1>
          <p className="text-gray-600 mt-1">
            Gestión de testimonios. Los aprobados se muestran en la landing y en /testimonios.
          </p>
        </div>
        <Link href="/testimonios" target="_blank" rel="noopener noreferrer">
          <Button variant="secondary">Ver página pública</Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estado
            </label>
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "approved" | "pending")}
            >
              <option value="all">Todos</option>
              <option value="approved">Aprobados (visibles en land)</option>
              <option value="pending">Pendientes</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Lista */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            No hay testimonios{filter !== "all" ? " con ese filtro" : ""}.
          </Card>
        ) : (
          filtered.map((t) => (
            <Card key={t.id} className="p-4">
              {editingId === t.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mensaje
                    </label>
                    <textarea
                      rows={4}
                      value={editForm.message}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, message: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c27b3d] resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Instagram
                    </label>
                    <input
                      type="text"
                      value={editForm.instagram}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, instagram: e.target.value }))
                      }
                      placeholder="@usuario"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c27b3d]"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      onClick={saveEdit}
                      disabled={saving || !editForm.name.trim() || !editForm.message.trim()}
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{t.name}</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatDate(t.createdAt)}
                        {t.instagram && (
                          <span className="ml-2">
                            · @{t.instagram.replace(/^@/, "")}
                          </span>
                        )}
                      </p>
                      <p className="text-gray-700 mt-2 whitespace-pre-wrap">
                        {t.message}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleApproved(t)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          t.isApproved
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                        title={t.isApproved ? "Ver en land" : "Oculto"}
                      >
                        {t.isApproved ? "Visible" : "Oculto"}
                      </button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startEdit(t)}
                      >
                        Editar
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
