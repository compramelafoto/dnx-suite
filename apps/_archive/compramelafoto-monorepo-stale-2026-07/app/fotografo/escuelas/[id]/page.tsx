"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import AddressGeoSearch from "@/components/school/AddressGeoSearch";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";

type SchoolCourse = {
  id: number;
  name: string;
  division: string | null;
  sortOrder: number | null;
};

type Album = {
  id: number;
  title: string;
  publicSlug: string;
  type: string | null;
  preCompraCloseAt: string | null;
  preCompraProducts: { id: number }[];
};

type School = {
  id: number;
  name: string;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  courses: SchoolCourse[];
  albums: Album[];
};

export default function FotografoEscuelaDetallePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const schoolId = parseInt(id, 10);

  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [photographer, setPhotographer] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editProvince, setEditProvince] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editLatitude, setEditLatitude] = useState<number | null>(null);
  const [editLongitude, setEditLongitude] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Nuevo curso
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  const [newCourseDivision, setNewCourseDivision] = useState("");
  const [savingCourse, setSavingCourse] = useState(false);

  // Vincular álbum
  const [showLinkAlbum, setShowLinkAlbum] = useState(false);
  const [albumsOptions, setAlbumsOptions] = useState<{ id: number; title: string; publicSlug: string }[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      fetch(`/api/fotografo/${session.photographerId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setPhotographer(data))
        .catch(() => {});
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!schoolId || !Number.isFinite(schoolId)) return;
    let active = true;
    async function load() {
      const res = await fetch(`/api/fotografo/schools/${schoolId}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (active) {
          setSchool(data);
          setEditName(data.name);
          setEditContactEmail(data.contactEmail || "");
          setEditContactPhone(data.contactPhone || "");
          setEditNotes(data.notes || "");
          setEditAddress(data.address || "");
          setEditCity(data.city || "");
          setEditProvince(data.province || "");
          setEditCountry(data.country || "");
          setEditLatitude(data.latitude ?? null);
          setEditLongitude(data.longitude ?? null);
        }
      } else if (res.status === 404 && active) {
        router.push("/fotografo/escuelas");
      }
      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
  }, [schoolId, router]);

  useEffect(() => {
    if (showLinkAlbum) {
      fetch("/api/dashboard/albums", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setAlbumsOptions(
            list
              .filter((a: any) => !a.deletedAt)
              .map((a: any) => ({ id: a.id, title: a.title, publicSlug: a.publicSlug }))
          );
        })
        .catch(() => setAlbumsOptions([]));
    }
  }, [showLinkAlbum]);

  async function handleSaveSchool() {
    if (!school) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fotografo/schools/${school.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          contactEmail: editContactEmail.trim() || null,
          contactPhone: editContactPhone.trim() || null,
          notes: editNotes.trim() || null,
          address: editAddress.trim() || null,
          city: editCity.trim() || null,
          province: editProvince.trim() || null,
          country: editCountry.trim() || null,
          latitude: editLatitude,
          longitude: editLongitude,
        }),
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setSchool({ ...school, ...data });
      setEditing(false);
    } catch (err: any) {
      alert(err?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCourse() {
    if (!school || !newCourseName.trim()) return;
    setSavingCourse(true);
    try {
      const res = await fetch(`/api/fotografo/schools/${school.id}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCourseName.trim(),
          division: newCourseDivision.trim() || null,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al crear");
      setSchool({ ...school, courses: [...school.courses, data] });
      setNewCourseName("");
      setNewCourseDivision("");
      setShowNewCourse(false);
    } catch (err: any) {
      alert(err?.message || "Error al crear curso");
    } finally {
      setSavingCourse(false);
    }
  }

  async function handleDeleteCourse(courseId: number) {
    if (!school || !confirm("¿Eliminar este curso?")) return;
    try {
      const res = await fetch(`/api/fotografo/schools/${school.id}/courses/${courseId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Error al eliminar");
      }
      setSchool({
        ...school,
        courses: school.courses.filter((c) => c.id !== courseId),
      });
    } catch (err: any) {
      alert(err?.message || "Error al eliminar");
    }
  }

  async function handleLinkAlbum() {
    if (!school || !selectedAlbumId) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/dashboard/albums/${selectedAlbumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: school.id, type: "SCHOOL" }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Error al vincular");
      }
      const data = await res.json();
      setSchool({
        ...school,
        albums: [
          ...school.albums,
          {
            id: data.id,
            title: data.title,
            publicSlug: data.publicSlug,
            type: "SCHOOL",
            preCompraCloseAt: data.preCompraCloseAt ?? null,
            preCompraProducts: data.preCompraProducts ?? [],
          },
        ],
      });
      setShowLinkAlbum(false);
      setSelectedAlbumId(null);
    } catch (err: any) {
      alert(err?.message || "Error al vincular álbum");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlinkAlbum(albumId: number) {
    if (!school || !confirm("¿Desvincular este álbum de la escuela?")) return;
    try {
      await fetch(`/api/dashboard/albums/${albumId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: null }),
        credentials: "include",
      });
      setSchool({
        ...school,
        albums: school.albums.filter((a) => a.id !== albumId),
      });
    } catch (err: any) {
      alert("Error al desvincular");
    }
  }

  function getPreventaLink(album: Album) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/album/${album.publicSlug}/preventa`;
  }

  function copyPreventaLink(album: Album) {
    const url = getPreventaLink(album);
    navigator.clipboard.writeText(url);
    alert("Link copiado al portapapeles");
  }

  if (loading || !school) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PhotographerDashboardHeader photographer={photographer} />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <div className="container-custom py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="mb-6">
            <Link href="/fotografo/escuelas" className="text-[#c27b3d] hover:underline text-sm">
              ← Volver a escuelas
            </Link>
          </div>

          {/* Datos de la escuela */}
          <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-xl font-bold text-gray-900">{school.name}</h1>
              {!editing ? (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Editar
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="primary" onClick={handleSaveSchool} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(false);
                      setEditName(school.name);
                      setEditContactEmail(school.contactEmail || "");
                      setEditContactPhone(school.contactPhone || "");
                      setEditNotes(school.notes || "");
                      setEditAddress(school.address || "");
                      setEditCity(school.city || "");
                      setEditProvince(school.province || "");
                      setEditCountry(school.country || "");
                      setEditLatitude(school.latitude ?? null);
                      setEditLongitude(school.longitude ?? null);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email contacto</label>
                  <Input type="email" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono contacto</label>
                  <Input value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} />
                </div>
                <AddressGeoSearch
                  address={editAddress}
                  city={editCity}
                  province={editProvince}
                  country={editCountry}
                  latitude={editLatitude}
                  longitude={editLongitude}
                  onAddressChange={setEditAddress}
                  onCityChange={setEditCity}
                  onProvinceChange={setEditProvince}
                  onCountryChange={setEditCountry}
                  onCoordsChange={(lat, lon) => {
                    setEditLatitude(lat);
                    setEditLongitude(lon);
                  }}
                  placeholder="Buscar dirección (ej. Colegio San Martín, Buenos Aires)"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg"
                    rows={2}
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600 space-y-1">
                {(school.contactEmail || school.contactPhone) && (
                  <p>{[school.contactEmail, school.contactPhone].filter(Boolean).join(" · ")}</p>
                )}
                {(school.address || school.city) && (
                  <p className="mt-1">
                    {[school.address, school.city, school.province, school.country].filter(Boolean).join(", ")}
                  </p>
                )}
                {school.notes && <p className="mt-2">{school.notes}</p>}
              </div>
            )}
          </Card>

          {/* Cursos */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cursos / Divisiones</h2>
            {school.courses.length === 0 && !showNewCourse ? (
              <p className="text-gray-600 text-sm mb-4">
                No hay cursos cargados. Agregá al menos uno para que las familias puedan elegir en la preventa.
              </p>
            ) : (
              <ul className="space-y-2 mb-4">
                {school.courses.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <span className="font-medium">
                      {c.name}
                      {c.division ? ` ${c.division}` : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(c.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Eliminar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showNewCourse ? (
              <div className="flex gap-2 flex-wrap items-end">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Nombre (ej. 1ro, Sala 5)</label>
                  <Input
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    placeholder="1ro"
                    className="w-32"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">División (ej. A, B)</label>
                  <Input
                    value={newCourseDivision}
                    onChange={(e) => setNewCourseDivision(e.target.value)}
                    placeholder="A"
                    className="w-24"
                  />
                </div>
                <Button variant="primary" onClick={handleAddCourse} disabled={savingCourse || !newCourseName.trim()}>
                  {savingCourse ? "..." : "Agregar"}
                </Button>
                <Button variant="secondary" onClick={() => setShowNewCourse(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setShowNewCourse(true)}>
                + Agregar curso
              </Button>
            )}
          </Card>

          {/* Álbumes vinculados */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Álbumes escolares</h2>
            {school.albums.length === 0 && !showLinkAlbum ? (
              <p className="text-gray-600 text-sm mb-4">
                No hay álbumes vinculados. Vinculá un álbum existente o creá uno nuevo desde Álbumes.
              </p>
            ) : (
              <ul className="space-y-3 mb-4">
                {school.albums.map((a) => (
                  <li key={a.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg">
                    <div>
                      <Link href={`/dashboard/albums/${a.id}`} className="font-medium text-[#c27b3d] hover:underline">
                        {a.title}
                      </Link>
                      <p className="text-xs text-gray-500 mt-1">
                        {a.preCompraProducts?.length ?? 0} productos ·{" "}
                        {a.preCompraCloseAt ? "Preventa abierta" : "Sin preventa configurada"}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button variant="secondary" onClick={() => copyPreventaLink(a)}>
                        Copiar link preventa
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleUnlinkAlbum(a.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Desvincular
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {showLinkAlbum ? (
              <div className="flex gap-2 flex-wrap items-end">
                <div className="min-w-[200px]">
                  <label className="block text-xs text-gray-600 mb-1">Seleccionar álbum</label>
                  <select
                    value={selectedAlbumId ?? ""}
                    onChange={(e) => setSelectedAlbumId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-4 py-3 border border-[#e5e7eb] rounded-lg"
                  >
                    <option value="">-- Elegir --</option>
                    {albumsOptions
                      .filter((opt) => !school.albums.some((a) => a.id === opt.id))
                      .map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.title}
                        </option>
                      ))}
                  </select>
                </div>
                <Button
                  variant="primary"
                  onClick={handleLinkAlbum}
                  disabled={linking || !selectedAlbumId}
                >
                  {linking ? "..." : "Vincular"}
                </Button>
                <Button variant="secondary" onClick={() => setShowLinkAlbum(false)}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setShowLinkAlbum(true)}>
                + Vincular álbum existente
              </Button>
            )}
            <p className="text-sm text-gray-500 mt-4">
              Para crear un álbum nuevo, andá a{" "}
              <Link href="/dashboard/albums" className="text-[#c27b3d] hover:underline">
                Álbumes
              </Link>
              , crealo y luego vinculalo acá. No olvides configurar productos de pre-venta y preCompraCloseAt.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
