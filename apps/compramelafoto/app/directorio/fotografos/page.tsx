"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import Card from "@/components/ui/Card";
import HomeBanner from "@/components/HomeBanner";

type Photographer = {
  id: number;
  name: string | null;
  companyName: string | null;
  logoUrl: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  publicPageHandler: string | null;
};

const PROVINCIAS_CANONICAS = [
  "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

function normalizeProvince(s: string | null | undefined): string {
  if (!s || !s.trim()) return "";
  return s
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function canonicalProvinceLabel(norm: string): string {
  if (!norm) return "";
  const found = PROVINCIAS_CANONICAS.find(
    (c) => normalizeProvince(c) === norm
  );
  return found ?? norm;
}

function getInitials(name: string | null, company: string | null): string {
  const text = (company || name || "").trim();
  if (!text) return "?";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  if (text.length >= 2) {
    return text.slice(0, 2).toUpperCase();
  }
  return text[0].toUpperCase();
}

export default function DirectorioFotografosPage() {
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");

  useEffect(() => {
    fetch("/api/public/directory/photographers")
      .then((r) => r.json())
      .then((data) => {
        setPhotographers(Array.isArray(data) ? data : []);
      })
      .catch(() => setPhotographers([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () =>
      photographers.filter(
        (p) => p.companyName?.trim() || p.name?.trim()
      ),
    [photographers]
  );

  const searchLower = search.trim().toLowerCase();
  const filteredBySearch = useMemo(() => {
    if (!searchLower) return visible;
    return visible.filter(
      (p) =>
        (p.companyName ?? "").toLowerCase().includes(searchLower) ||
        (p.name ?? "").toLowerCase().includes(searchLower) ||
        (p.city ?? "").toLowerCase().includes(searchLower) ||
        normalizeProvince(p.province).includes(normalizeProvince(searchLower))
    );
  }, [visible, searchLower]);

  const filtered = useMemo(() => {
    if (!selectedProvince) return filteredBySearch;
    return filteredBySearch.filter(
      (p) => normalizeProvince(p.province ?? p.city) === selectedProvince
    );
  }, [filteredBySearch, selectedProvince]);

  const provincesOptions = useMemo(() => {
    const byNorm = new Map<string, string>();
    for (const p of visible) {
      const raw = (p.province ?? p.city ?? "").trim();
      if (!raw) continue;
      const norm = normalizeProvince(raw);
      if (!byNorm.has(norm)) byNorm.set(norm, canonicalProvinceLabel(norm));
    }
    return [...byNorm.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "es"))
      .map(([value, label]) => ({ value, label }));
  }, [visible]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) =>
      (a.companyName ?? a.name ?? "").localeCompare(b.companyName ?? b.name ?? "", "es")
    );
  }, [filtered]);

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <HomeBanner />
      <section className="section-spacing bg-[#f9fafb]">
        <div className="container-custom">
          <div className="max-w-5xl mx-auto text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-4">
              Nuestros Fotógrafos
            </h1>
            <p className="text-lg text-[#6b7280] mb-6">
              Conocé a los fotógrafos que forman parte de ComprameLaFoto. Explorá sus perfiles, encontrá eventos, comprá tus fotos o imprimí las tuyas. Todo 100% online.
            </p>
            <p className="text-base text-[#1a1a1a] font-medium">
              Buscá abajo por nombre, ciudad o provincia para encontrar tu fotógrafo.
            </p>
          </div>

          <div id="directorio-fotografos">

          <div className="max-w-5xl mx-auto mb-10 mt-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, ciudad o provincia..."
                  className="w-full px-4 py-3 pl-10 rounded-2xl border border-black/10 bg-white text-[#1a1a1a] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/30 focus:border-[#c27b3d]"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b7280]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                className="px-4 py-3 rounded-2xl border border-black/10 bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/30 focus:border-[#c27b3d] min-w-[200px]"
              >
                <option value="">Todas las provincias</option>
                {provincesOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16">
              <p className="text-[#6b7280]">Cargando fotógrafos...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#6b7280]">No se encontraron fotógrafos.</p>
              <Link href="/" className="text-[#c27b3d] hover:underline mt-2 inline-block">
                Volver al inicio
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sorted.map((p) => (
                <Card key={p.id} className="overflow-hidden h-full flex flex-col">
                        <div className="w-full aspect-square max-h-40 bg-[#f9fafb] flex items-center justify-center p-4 -mx-6 -mt-6 mb-4 rounded-t-3xl overflow-hidden">
                          {p.logoUrl ? (
                            <Image
                              src={p.logoUrl}
                              alt={p.companyName || p.name || "Logo"}
                              width={120}
                              height={120}
                              className="object-contain max-h-full max-w-full"
                              unoptimized={p.logoUrl.startsWith("http")}
                            />
                          ) : (
                            <span className="text-3xl md:text-4xl font-semibold text-[#c27b3d]/70 bg-[#c27b3d]/10 w-20 h-20 rounded-full flex items-center justify-center">
                              {getInitials(p.name, p.companyName)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">
                            {p.companyName || p.name || "Sin nombre"}
                          </h3>
                          {(p.city || p.province) && (
                            <p className="text-sm text-[#6b7280] mb-2 flex items-center gap-1">
                              <span>📍</span> {[p.city, p.province].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {p.phone && (
                            <p className="text-sm text-[#6b7280] mb-2 flex items-center gap-1">
                              <span>📞</span> {p.phone}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {p.instagram && (
                              <a
                                href={p.instagram.startsWith("http") ? p.instagram : `https://instagram.com/${p.instagram.replace(/^@/, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#f7f5f2] hover:bg-[#c27b3d]/15 text-[#6b7280] hover:text-[#c27b3d] transition-colors"
                                aria-label="Instagram"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                </svg>
                              </a>
                            )}
                            {p.facebook && (
                              <a
                                href={p.facebook.startsWith("http") ? p.facebook : `https://facebook.com/${p.facebook}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#f7f5f2] hover:bg-[#c27b3d]/15 text-[#6b7280] hover:text-[#c27b3d] transition-colors"
                                aria-label="Facebook"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                              </a>
                            )}
                            {p.whatsapp && (
                              <a
                                href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#f7f5f2] hover:bg-[#c27b3d]/15 text-[#6b7280] hover:text-[#c27b3d] transition-colors"
                                aria-label="WhatsApp"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>
                        {p.publicPageHandler && (
                          <Link
                            href={`/f/${p.publicPageHandler}`}
                            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#c27b3d] hover:underline"
                          >
                            Ver perfil →
                          </Link>
                        )}
                      </Card>
              ))}
            </div>
          )}
          </div>
        </div>
      </section>
    </div>
  );
}
