"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { SchoolLeadStatus } from "@/lib/prisma";

type Owner = {
  id: number;
  name: string | null;
  email: string;
};

type SchoolRow = {
  id: number;
  name: string;
  logoUrl: string | null;
  city: string | null;
  province: string | null;
  createdAt: string;
  updatedAt: string;
  albumsCount: number;
  activeAlbumsCount: number;
  studentsCount: number;
  preCompraOrdersCount: number;
  preventaActiveCount: number;
  photographers: Owner[];
  owner: Owner;
};

type PhotographerOption = {
  id: number;
  name: string | null;
  email: string;
};

type SchoolLeadRow = {
  id: number;
  schoolName: string;
  city: string;
  contactName: string;
  contactRole: string | null;
  email: string | null;
  whatsapp: string;
  approxStudents: number | null;
  message: string | null;
  status: SchoolLeadStatus;
  referralCode: string | null;
  referredByUserId: number | null;
  referrerRole: string | null;
  createdAt: string;
  updatedAt: string;
  convertedAt: string | null;
  convertedSchoolId: number | null;
  notes: string | null;
  referredByUser: {
    id: number;
    name: string | null;
    email: string;
    role: string;
  } | null;
  convertedSchool: {
    id: number;
    name: string;
  } | null;
};

const LEAD_STATUS_OPTIONS: Array<{ value: SchoolLeadStatus; label: string }> = [
  { value: "NEW", label: "Nuevo" },
  { value: "CONTACTED", label: "Contactado" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "CONVERTED", label: "Convertido" },
  { value: "DISCARDED", label: "Descartado" },
];

function formatLeadStatus(status: SchoolLeadStatus): string {
  return LEAD_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}

export default function AdminEscuelasPage() {
  const [activeSection, setActiveSection] = useState<"escuelas" | "solicitudes">("escuelas");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [hasActiveAlbums, setHasActiveAlbums] = useState("all");
  const [withoutAlbums, setWithoutAlbums] = useState("all");
  const [hasPreventaActive, setHasPreventaActive] = useState("all");
  const [hasStudents, setHasStudents] = useState("all");

  const [leads, setLeads] = useState<SchoolLeadRow[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [debouncedLeadSearch, setDebouncedLeadSearch] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all");
  const [leadReferredByFilter, setLeadReferredByFilter] = useState<string>("");
  const [photographers, setPhotographers] = useState<PhotographerOption[]>([]);
  const [leadStatusDraft, setLeadStatusDraft] = useState<Record<number, SchoolLeadStatus>>({});
  const [leadOwnerDraft, setLeadOwnerDraft] = useState<Record<number, string>>({});
  const [leadActionLoading, setLeadActionLoading] = useState<Record<number, boolean>>({});
  const [leadActionMessage, setLeadActionMessage] = useState<Record<number, string>>({});
  const [selectedLead, setSelectedLead] = useState<SchoolLeadRow | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLeadSearch(leadSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [leadSearch]);

  const loadSchools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (ownerId) params.set("ownerId", ownerId);
      if (hasActiveAlbums !== "all") params.set("hasActiveAlbums", hasActiveAlbums);
      if (withoutAlbums !== "all") params.set("withoutAlbums", withoutAlbums);
      if (hasPreventaActive !== "all") params.set("hasPreventaActive", hasPreventaActive);
      if (hasStudents !== "all") params.set("hasStudents", hasStudents);

      const res = await fetch(`/api/admin/schools?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Error ${res.status}`);
      }
      setSchools(Array.isArray(data.schools) ? data.schools : []);
      setOwners(Array.isArray(data.owners) ? data.owners : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar escuelas";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, ownerId, hasActiveAlbums, withoutAlbums, hasPreventaActive, hasStudents]);

  useEffect(() => {
    if (activeSection === "escuelas") {
      void loadSchools();
    }
  }, [activeSection, loadSchools]);

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true);
    setLeadsError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedLeadSearch) params.set("q", debouncedLeadSearch);
      if (leadStatusFilter !== "all") params.set("status", leadStatusFilter);
      if (leadReferredByFilter) params.set("referredByUserId", leadReferredByFilter);

      const res = await fetch(`/api/admin/school-leads?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Error ${res.status}`);
      }
      const rows = Array.isArray(data.leads) ? (data.leads as SchoolLeadRow[]) : [];
      setLeads(rows);
      setLeadStatusDraft(
        rows.reduce<Record<number, SchoolLeadStatus>>((acc, lead) => {
          acc[lead.id] = lead.status;
          return acc;
        }, {})
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar solicitudes";
      setLeadsError(msg);
    } finally {
      setLeadsLoading(false);
    }
  }, [debouncedLeadSearch, leadStatusFilter, leadReferredByFilter]);

  const loadPhotographers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/photographers", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const rows = Array.isArray(data.photographers) ? data.photographers : [];
      setPhotographers(rows);
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    if (activeSection === "solicitudes") {
      void loadLeads();
      void loadPhotographers();
    }
  }, [activeSection, loadLeads, loadPhotographers]);

  const totalPrecompras = useMemo(
    () => schools.reduce((acc, school) => acc + school.preCompraOrdersCount, 0),
    [schools]
  );

  const leadsSummary = useMemo(() => {
    return leads.reduce(
      (acc, lead) => {
        acc.total += 1;
        if (lead.status === "NEW") acc.new += 1;
        if (lead.status === "CONTACTED" || lead.status === "IN_PROGRESS") acc.open += 1;
        if (lead.status === "CONVERTED") acc.converted += 1;
        return acc;
      },
      { total: 0, new: 0, open: 0, converted: 0 }
    );
  }, [leads]);

  async function updateLead(leadId: number, payload: { status?: SchoolLeadStatus; notes?: string }) {
    setLeadActionLoading((prev) => ({ ...prev, [leadId]: true }));
    setLeadActionMessage((prev) => ({ ...prev, [leadId]: "" }));
    try {
      const res = await fetch(`/api/admin/school-leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo actualizar la solicitud.");
      }
      setLeadActionMessage((prev) => ({ ...prev, [leadId]: "Actualizado." }));
      await loadLeads();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar.";
      setLeadActionMessage((prev) => ({ ...prev, [leadId]: message }));
    } finally {
      setLeadActionLoading((prev) => ({ ...prev, [leadId]: false }));
    }
  }

  async function convertLead(lead: SchoolLeadRow) {
    setLeadActionLoading((prev) => ({ ...prev, [lead.id]: true }));
    setLeadActionMessage((prev) => ({ ...prev, [lead.id]: "" }));
    try {
      const ownerUserId = lead.referredByUserId
        ? undefined
        : leadOwnerDraft[lead.id]
          ? Number(leadOwnerDraft[lead.id])
          : undefined;

      const res = await fetch(`/api/admin/school-leads/${lead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ownerUserId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo convertir la solicitud.");
      }
      setLeadActionMessage((prev) => ({
        ...prev,
        [lead.id]: `Escuela creada (ID ${data?.school?.id ?? "N/D"}).`,
      }));
      await Promise.all([loadLeads(), loadSchools()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo convertir la solicitud.";
      setLeadActionMessage((prev) => ({ ...prev, [lead.id]: message }));
    } finally {
      setLeadActionLoading((prev) => ({ ...prev, [lead.id]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Escuelas</h1>
        <p className="text-gray-600 mt-1">
          Gestión administrativa de colegios y solicitudes públicas de implementación.
        </p>
      </div>

      <Card className="p-4 md:p-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSection("escuelas")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeSection === "escuelas"
                ? "bg-[#c27b3d] text-white"
                : "border border-[#111827]/15 bg-white text-[#374151] hover:bg-[#f3f4f6]"
            }`}
          >
            Escuelas
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("solicitudes")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              activeSection === "solicitudes"
                ? "bg-[#c27b3d] text-white"
                : "border border-[#111827]/15 bg-white text-[#374151] hover:bg-[#f3f4f6]"
            }`}
          >
            Solicitudes
          </button>
        </div>
      </Card>

      {activeSection === "escuelas" ? (
        <>
          <Card className="p-4 md:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <Input
                placeholder="Buscar por colegio, fotógrafo, álbum, localidad o email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
              >
                <option value="">Todos los fotógrafos owner</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {(owner.name || owner.email).trim()}
                  </option>
                ))}
              </select>
              <select
                value={hasActiveAlbums}
                onChange={(event) => setHasActiveAlbums(event.target.value)}
                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
              >
                <option value="all">Con y sin álbumes activos</option>
                <option value="true">Con álbumes activos</option>
                <option value="false">Sin álbumes activos</option>
              </select>
              <select
                value={withoutAlbums}
                onChange={(event) => setWithoutAlbums(event.target.value)}
                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
              >
                <option value="all">Con y sin álbumes vinculados</option>
                <option value="true">Sin álbumes</option>
                <option value="false">Con álbumes</option>
              </select>
              <select
                value={hasPreventaActive}
                onChange={(event) => setHasPreventaActive(event.target.value)}
                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
              >
                <option value="all">Con y sin preventa activa</option>
                <option value="true">Con preventa activa</option>
                <option value="false">Sin preventa activa</option>
              </select>
              <select
                value={hasStudents}
                onChange={(event) => setHasStudents(event.target.value)}
                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
              >
                <option value="all">Con y sin alumnos</option>
                <option value="true">Con alumnos cargados</option>
                <option value="false">Sin alumnos cargados</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Escuelas listadas</p>
                <p className="text-xl font-semibold text-gray-900">{schools.length}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Preventas asociadas</p>
                <p className="text-xl font-semibold text-gray-900">{totalPrecompras}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Álbumes asociados</p>
                <p className="text-xl font-semibold text-gray-900">
                  {schools.reduce((acc, school) => acc + school.albumsCount, 0)}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-0 overflow-hidden">
            {loading ? (
              <div className="p-6">
                <p className="text-gray-600">Cargando escuelas...</p>
              </div>
            ) : error ? (
              <div className="p-6 space-y-3">
                <p className="text-red-700">{error}</p>
                <Button variant="secondary" onClick={() => void loadSchools()}>
                  Reintentar
                </Button>
              </div>
            ) : schools.length === 0 ? (
              <div className="p-6">
                <p className="text-gray-600">No hay escuelas para los filtros actuales.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                        Escuela
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                        Localidad
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                        Álbumes
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                        Alumnos
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                        Preventas
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                        Owner / Fotógrafos
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">
                        Fechas
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {schools.map((school) => (
                      <tr key={school.id}>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-start gap-3">
                            {school.logoUrl ? (
                              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-white">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={school.logoUrl}
                                  alt={`Logo ${school.name}`}
                                  className="h-full w-full object-contain"
                                />
                              </div>
                            ) : (
                              <div className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 bg-gray-100" />
                            )}
                            <div>
                              <p className="font-medium text-gray-900">{school.name}</p>
                              <p className="text-xs text-gray-500">
                                Owner: {school.owner.name || school.owner.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">
                          {[school.city, school.province].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">
                          <p>{school.albumsCount} total</p>
                          <p className="text-xs text-gray-500">{school.activeAlbumsCount} activos</p>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">
                          {school.studentsCount}
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">
                          <p>{school.preCompraOrdersCount}</p>
                          <p className="text-xs text-gray-500">
                            {school.preventaActiveCount} con preventa abierta
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">
                          {school.photographers.length === 0 ? (
                            "—"
                          ) : (
                            <div className="space-y-1">
                              {school.photographers.map((photographer) => (
                                <p key={photographer.id} className="text-xs">
                                  {photographer.name || photographer.email}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-gray-600">
                          <p>
                            Creada:{" "}
                            {new Date(school.createdAt).toLocaleDateString("es-AR", {
                              dateStyle: "short",
                            })}
                          </p>
                          <p>
                            Actualizada:{" "}
                            {new Date(school.updatedAt).toLocaleDateString("es-AR", {
                              dateStyle: "short",
                            })}
                          </p>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex justify-end gap-2">
                            <Link href={`/admin/escuelas/${school.id}`}>
                              <Button variant="secondary" size="sm">
                                Ver detalle
                              </Button>
                            </Link>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled
                              title="Disponible en Fase 3"
                            >
                              Editar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          <Card className="p-4 md:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <Input
                placeholder="Buscar por escuela, contacto, ciudad, email o WhatsApp"
                value={leadSearch}
                onChange={(event) => setLeadSearch(event.target.value)}
              />
              <select
                value={leadStatusFilter}
                onChange={(event) => setLeadStatusFilter(event.target.value)}
                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
              >
                <option value="all">Todos los estados</option>
                {LEAD_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <select
                value={leadReferredByFilter}
                onChange={(event) => setLeadReferredByFilter(event.target.value)}
                className="w-full rounded-2xl border border-[#111827]/10 bg-white px-4 py-3 text-base text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
              >
                <option value="">Todos los fotógrafos referidos</option>
                {photographers.map((photographer) => (
                  <option key={photographer.id} value={photographer.id}>
                    {photographer.name || photographer.email}
                  </option>
                ))}
              </select>
              <Button variant="secondary" onClick={() => void loadLeads()}>
                Actualizar solicitudes
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
                <p className="text-xl font-semibold text-gray-900">{leadsSummary.total}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Nuevas</p>
                <p className="text-xl font-semibold text-gray-900">{leadsSummary.new}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Abiertas</p>
                <p className="text-xl font-semibold text-gray-900">{leadsSummary.open}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Convertidas</p>
                <p className="text-xl font-semibold text-gray-900">{leadsSummary.converted}</p>
              </div>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            {leadsLoading ? (
              <div className="p-6">
                <p className="text-gray-600">Cargando solicitudes...</p>
              </div>
            ) : leadsError ? (
              <div className="p-6 space-y-3">
                <p className="text-red-700">{leadsError}</p>
                <Button variant="secondary" onClick={() => void loadLeads()}>
                  Reintentar
                </Button>
              </div>
            ) : leads.length === 0 ? (
              <div className="p-6">
                <p className="text-gray-600">No hay solicitudes para los filtros actuales.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Escuela</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Ciudad</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Contacto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Cargo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">WhatsApp</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Alumnos</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Fotógrafo referido</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Estado</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td className="px-4 py-3 align-top text-xs text-gray-600">
                          {new Date(lead.createdAt).toLocaleDateString("es-AR", {
                            dateStyle: "short",
                          })}
                        </td>
                        <td className="px-4 py-3 align-top text-sm font-medium text-gray-900">{lead.schoolName}</td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">{lead.city}</td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">{lead.contactName}</td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">{lead.contactRole || "—"}</td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">{lead.whatsapp}</td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">{lead.email || "—"}</td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">
                          {lead.approxStudents ?? "—"}
                        </td>
                        <td className="px-4 py-3 align-top text-xs text-gray-700">
                          {lead.referredByUser ? (
                            <div className="space-y-1">
                              <p className="font-medium text-gray-900">
                                {lead.referredByUser.name || lead.referredByUser.email}
                              </p>
                              <p className="text-gray-500">{lead.referredByUser.email}</p>
                              <p className="text-gray-500">Código: {lead.referralCode || "—"}</p>
                              <p className="text-emerald-700">
                                Recomendado por: {lead.referredByUser.name || lead.referredByUser.email}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p>Sin referido</p>
                              <p className="text-gray-500">Código: {lead.referralCode || "—"}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-700">
                          {formatLeadStatus(lead.status)}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-col items-end gap-2 min-w-[220px]">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedLead(lead)}
                            >
                              Ver detalle
                            </Button>

                            <div className="flex w-full gap-2">
                              <select
                                value={leadStatusDraft[lead.id] || lead.status}
                                onChange={(event) =>
                                  setLeadStatusDraft((prev) => ({
                                    ...prev,
                                    [lead.id]: event.target.value as SchoolLeadStatus,
                                  }))
                                }
                                className="w-full rounded-lg border border-[#111827]/10 bg-white px-3 py-2 text-xs text-[#111827]"
                              >
                                {LEAD_STATUS_OPTIONS.map((status) => (
                                  <option key={status.value} value={status.value}>
                                    {status.label}
                                  </option>
                                ))}
                              </select>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={leadActionLoading[lead.id]}
                                onClick={() =>
                                  void updateLead(lead.id, {
                                    status: leadStatusDraft[lead.id] || lead.status,
                                  })
                                }
                              >
                                Guardar
                              </Button>
                            </div>

                            {!lead.referredByUserId ? (
                              <select
                                value={leadOwnerDraft[lead.id] || ""}
                                onChange={(event) =>
                                  setLeadOwnerDraft((prev) => ({ ...prev, [lead.id]: event.target.value }))
                                }
                                className="w-full rounded-lg border border-[#111827]/10 bg-white px-3 py-2 text-xs text-[#111827]"
                              >
                                <option value="">Seleccionar fotógrafo para convertir</option>
                                {photographers.map((photographer) => (
                                  <option key={photographer.id} value={photographer.id}>
                                    {photographer.name || photographer.email}
                                  </option>
                                ))}
                              </select>
                            ) : null}

                            <div className="flex w-full gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={leadActionLoading[lead.id]}
                                onClick={() => void convertLead(lead)}
                              >
                                Crear escuela
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={leadActionLoading[lead.id]}
                                onClick={() =>
                                  void updateLead(lead.id, {
                                    status: "DISCARDED",
                                  })
                                }
                              >
                                Descartar
                              </Button>
                            </div>
                            {leadActionMessage[lead.id] ? (
                              <p className="w-full text-right text-xs text-gray-600">
                                {leadActionMessage[lead.id]}
                              </p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {selectedLead ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setSelectedLead(null)}
            >
              <div
                className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <h2 className="text-xl font-semibold text-[#111827]">
                  Solicitud #{selectedLead.id} - {selectedLead.schoolName}
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-[#374151]">
                  <p><span className="font-semibold">Ciudad:</span> {selectedLead.city}</p>
                  <p><span className="font-semibold">Contacto:</span> {selectedLead.contactName}</p>
                  <p><span className="font-semibold">Cargo:</span> {selectedLead.contactRole || "—"}</p>
                  <p><span className="font-semibold">WhatsApp:</span> {selectedLead.whatsapp}</p>
                  <p><span className="font-semibold">Email:</span> {selectedLead.email || "—"}</p>
                  <p><span className="font-semibold">Alumnos:</span> {selectedLead.approxStudents ?? "—"}</p>
                  <p className="sm:col-span-2">
                    <span className="font-semibold">Fotógrafo referido:</span>{" "}
                    {selectedLead.referredByUser
                      ? `${selectedLead.referredByUser.name || selectedLead.referredByUser.email} (${selectedLead.referredByUser.email})`
                      : "Sin referido"}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-semibold">Consulta:</span> {selectedLead.message || "—"}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="font-semibold">Notas admin:</span> {selectedLead.notes || "—"}
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button variant="secondary" onClick={() => setSelectedLead(null)}>
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
