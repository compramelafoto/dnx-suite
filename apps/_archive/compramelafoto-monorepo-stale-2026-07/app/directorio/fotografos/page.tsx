"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import Card from "@/components/ui/Card";
import HomeBanner from "@/components/HomeBanner";
import { DirectoryCardContent, DirectoryLogoArea } from "@/components/directorio/DirectoryLogoArea";
import { DirectorySocialRow } from "@/components/directorio/DirectorySocialRow";
import { cmlfDirCard } from "@/components/directorio/directoryCardClasses";

type Photographer = {
  id: number;
  name: string | null;
  companyName: string | null;
  logoUrl: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  address: string | null;
  companyAddress: string | null;
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
    <div className={cmlfDirCard.page}>
      <HomeBanner />
      <section className={`section-spacing ${cmlfDirCard.section}`}>
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
            <div className={cmlfDirCard.grid}>
              {sorted.map((p) => {
                const hasMeta =
                  Boolean(p.city || p.province || p.companyAddress || p.address || p.phone || p.whatsapp);
                return (
                <Card key={p.id} className={`${cmlfDirCard.shell} p-0`}>
                  <DirectoryLogoArea>
                    {p.logoUrl ? (
                      <Image
                        src={p.logoUrl}
                        alt={p.companyName || p.name || "Logo"}
                        width={560}
                        height={560}
                        className="h-full w-auto max-h-full max-w-full object-contain"
                        unoptimized={p.logoUrl.startsWith("http")}
                      />
                    ) : (
                      <span className={cmlfDirCard.initials}>{getInitials(p.name, p.companyName)}</span>
                    )}
                  </DirectoryLogoArea>
                  <DirectoryCardContent>
                    <div className={cmlfDirCard.bodyInner}>
                      <h3 className={cmlfDirCard.title}>{p.companyName || p.name || "Sin nombre"}</h3>
                      {hasMeta && (
                        <div className={`${cmlfDirCard.metaStack} mt-4`}>
                          {(p.city || p.province) && (
                            <p className={cmlfDirCard.metaRow}>
                              <span aria-hidden>📍</span>
                              <span>{[p.city, p.province].filter(Boolean).join(", ")}</span>
                            </p>
                          )}
                          {(p.companyAddress || p.address) && (
                            <p className={cmlfDirCard.metaRow}>
                              <span aria-hidden>🏠</span>
                              <span>{(p.companyAddress || p.address || "").trim()}</span>
                            </p>
                          )}
                          {p.phone && (
                            <p className={cmlfDirCard.metaRow}>
                              <span aria-hidden>📞</span> <span>{p.phone}</span>
                            </p>
                          )}
                          {p.whatsapp && (
                            <p className={cmlfDirCard.metaRow}>
                              <span aria-hidden>💬</span>{" "}
                              <span className="tabular-nums">{p.whatsapp.replace(/\s+/g, " ").trim()}</span>
                            </p>
                          )}
                        </div>
                      )}
                      <DirectorySocialRow
                        className={hasMeta ? "mt-6" : "mt-4"}
                        instagram={p.instagram}
                        facebook={p.facebook}
                        whatsapp={p.whatsapp}
                      />
                      {p.publicPageHandler && (
                        <div className={cmlfDirCard.ctaWrap}>
                          <Link href={`/f/${p.publicPageHandler}`} className={cmlfDirCard.ctaLink}>
                            Ver perfil →
                          </Link>
                        </div>
                      )}
                    </div>
                  </DirectoryCardContent>
                </Card>
              );
              })}
            </div>
          )}
          </div>
        </div>
      </section>
    </div>
  );
}
