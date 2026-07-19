"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatDate, getRoleLabel } from "@/lib/admin/helpers";
import AdminUserCopyLinkButtons from "@/components/admin/AdminUserCopyLinkButtons";

type TabId =
  | "clientes"
  | "labs"
  | "fotografos"
  | "organizadores"
  | "administradores-escuela";

interface CustomerRow {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  createdAt: string;
  isBlocked: boolean;
  isGuest: boolean;
  clientOrders: Array<{ id: number; total: number }>;
  photographers: Array<{ id: number; name: string | null; email: string; orderCount: number }>;
  lastLoginAt?: string | null;
  referralUrl?: string | null;
}

interface UserRow {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  city: string | null;
  province: string | null;
  createdAt: string;
  isBlocked: boolean;
  lastLoginAt?: string | null;
  cuantoCobroUser?: boolean;
  mpUserId?: string | null;
  mpConnectedAt?: string | null;
  publicPageHandler?: string | null;
  isPublicPageEnabled?: boolean;
  referralUrl?: string | null;
  platformCommissionPercentOverride?: number | null;
}

interface SchoolOrganizerRow extends UserRow {
  schoolOrganizerMemberships: Array<{
    schoolId: number;
    school: { id: number; name: string };
  }>;
}

interface LabRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  approvalStatus: string;
  isActive: boolean;
  isSuspended?: boolean;
  createdAt: string;
  user?: { id: number; email: string; name: string | null; phone?: string | null; lastLoginAt?: string | null };
  mpUserId?: string | null;
  mpConnectedAt?: string | null;
  publicPageHandler?: string | null;
  referralUrl?: string | null;
  commissionOverrideBps?: number | null;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseAdminUsersResponse(data: unknown): {
  users: any[];
  total: number;
  pagination?: { page: number; pageSize: number; total: number; totalPages: number };
} {
  if (Array.isArray(data)) {
    return { users: data, total: data.length };
  }
  if (data && typeof data === "object") {
    const obj = data as {
      users?: unknown;
      total?: unknown;
      pagination?: { page: number; pageSize: number; total: number; totalPages: number };
    };
    const users = Array.isArray(obj.users) ? obj.users : [];
    const total = typeof obj.total === "number" ? obj.total : users.length;
    return { users, total, pagination: obj.pagination };
  }
  return { users: [], total: 0 };
}

function buildWhatsappUrl(phone: string | null | undefined, _name?: string | null): string | null {
  if (!phone || !String(phone).trim()) return null;
  const clean = String(phone).replace(/\D/g, "");
  if (clean.length < 8) return null;
  const withPrefix = clean.startsWith("54") ? clean : "54" + clean.replace(/^0+/, "");
  return `https://wa.me/${withPrefix}`;
}

function daysSinceLastLogin(lastLoginAt: string | Date | null | undefined): string {
  if (!lastLoginAt) return "—";
  const last = new Date(lastLoginAt).getTime();
  const now = Date.now();
  const days = Math.floor((now - last) / 86400000);
  if (days < 0) return "0";
  return String(days);
}

const iconClass = "w-5 h-5";
const btnClass = "inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:pointer-events-none";

const IconWhatsApp = () => (
  <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
);
const IconEye = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
);
const IconCopy = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
);
const IconLock = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
);
const IconUnlock = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>
);
const IconTrash = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
);
const IconCog = () => (
  <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
);

// Logo oficial Mercado Pago (celeste #009EE3) — solo se muestra cuando está conectado
const IconMercadoPago = () => (
  <svg className={iconClass} viewBox="0 0 24 24" aria-hidden fill="#009EE3" role="img">
    <path d="M15.972 2.188h2.769v6.462h.01l4.154-6.462h2.923l-5.385 7.77 5.77 8.308h-3.077l-4.308-6.462-1.385 2.077v4.385h-2.77V2.188zm-5.77 0h2.77v13.846h-2.77V2.188zM2.595 2.188h2.77v13.846h-2.77V2.188z"/>
  </svg>
);

const TABS: { id: TabId; label: string }[] = [
  { id: "clientes", label: "Clientes" },
  { id: "labs", label: "Labs" },
  { id: "fotografos", label: "Fotógrafos" },
  { id: "organizadores", label: "Organizadores de eventos" },
  { id: "administradores-escuela", label: "Administradores de escuela" },
];

function getBaseUrl(): string {
  if (typeof window === "undefined") return "https://www.compramelafoto.com";
  const origin = window.location.origin;
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) return "https://www.compramelafoto.com";
  return origin;
}

function buildInvitationMessage(data: { email: string; temporaryPassword?: string; referralUrl?: string }, baseUrl: string): string {
  const lines: string[] = [
    "¡Hola! Te invito a sumarte a ComprameLaFoto.",
    "",
    "¿Qué es ComprameLaFoto?",
    "Es una plataforma que conecta fotógrafos con clientes y laboratorios. Los fotógrafos suben álbumes, los clientes eligen fotos para imprimir o descargar, y todo el proceso de pago y entrega se gestiona de forma automática.",
    "",
    "¿Qué ganás recomendando la plataforma?",
    "• Ganás comisiones por cada fotógrafo que se registre con tu link y realice ventas.",
    "• Es una forma de generar ingresos extra recomendando una herramienta que conocés.",
    "",
    "Pasos para retirar tus comisiones:",
    "1. Registrate con el link de referidos que te comparto abajo.",
    "2. Conectá Mercado Pago en tu panel (Configuración → Mercado Pago).",
    "3. Cuando tus referidos vendan, acumulás comisiones.",
    "4. Solicitá el retiro desde Configuración → Referidos cuando llegues al mínimo.",
    "",
    "--- TUS DATOS DE ACCESO ---",
    `Email: ${data.email}`,
  ];
  if (data.temporaryPassword) {
    lines.push(`Contraseña temporal (cambiala al iniciar sesión): ${data.temporaryPassword}`);
  }
  lines.push("");
  lines.push("--- LINKS ÚTILES ---");
  if (data.referralUrl) {
    lines.push(`Link de referidos (compartilo para ganar comisiones): ${data.referralUrl}`);
  }
  lines.push(`Plataforma: ${baseUrl}`);
  lines.push(`Tutoriales: ${baseUrl}/tutoriales`);
  lines.push(`Preguntas frecuentes: ${baseUrl}/#faq`);
  return lines.join("\n");
}

export default function AdminUsuariosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = (searchParams?.get("tab") || "clientes") as TabId;
  const tab = TABS.some((t) => t.id === tabParam) ? tabParam : "clientes";

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cuantoCobroFilter, setCuantoCobroFilter] = useState(false);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customersPagination, setCustomersPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [labs, setLabs] = useState<LabRow[]>([]);
  const [photographers, setPhotographers] = useState<UserRow[]>([]);
  const [photographersPagination, setPhotographersPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [organizers, setOrganizers] = useState<UserRow[]>([]);
  const [organizersPagination, setOrganizersPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [schoolOrganizers, setSchoolOrganizers] = useState<SchoolOrganizerRow[]>([]);
  const [schoolOrganizersPagination, setSchoolOrganizersPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<"CUSTOMER" | "PHOTOGRAPHER" | "LAB_PHOTOGRAPHER" | "LAB" | "ORGANIZER">("PHOTOGRAPHER");
  const [creatingUser, setCreatingUser] = useState(false);
  const [showCreatedUserModal, setShowCreatedUserModal] = useState(false);
  const [createdUserData, setCreatedUserData] = useState<{
    email: string;
    temporaryPassword?: string;
    referralUrl?: string;
  } | null>(null);

  const setTab = useCallback(
    (newTab: TabId) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("tab", newTab);
      router.replace(`/admin/usuarios?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (tab === "clientes") {
      loadCustomers();
    } else if (tab === "labs") {
      loadLabs();
    } else if (tab === "fotografos") {
      loadPhotographers();
    } else if (tab === "organizadores") {
      loadOrganizers();
    } else if (tab === "administradores-escuela") {
      loadSchoolOrganizers();
    }
  }, [
    tab,
    searchQuery,
    customersPagination.page,
    photographersPagination.page,
    organizersPagination.page,
    schoolOrganizersPagination.page,
    cuantoCobroFilter,
  ]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      params.set("page", customersPagination.page.toString());
      params.set("pageSize", customersPagination.pageSize.toString());
      const res = await fetch(`/api/admin/customers?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        setCustomers([]);
        return;
      }
      const data = await res.json();
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setCustomersPagination((prev) => ({ ...prev, ...(data.pagination || {}) }));
    } catch (err) {
      console.error("Error cargando clientes:", err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadLabs() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/labs", { credentials: "include" });
      if (!res.ok) {
        setLabs([]);
        return;
      }
      const data = await res.json();
      setLabs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error cargando labs:", err);
      setLabs([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPhotographers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (cuantoCobroFilter) params.set("cuantoCobro", "true");
      params.set("roles", "PHOTOGRAPHER,LAB_PHOTOGRAPHER");
      params.set("page", photographersPagination.page.toString());
      params.set("pageSize", photographersPagination.pageSize.toString());
      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        setPhotographers([]);
        setPhotographersPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
        return;
      }
      const data = await res.json();
      const parsed = parseAdminUsersResponse(data);
      setPhotographers(parsed.users as UserRow[]);
      setPhotographersPagination((prev) => ({
        ...prev,
        total: parsed.total,
        totalPages: parsed.pagination?.totalPages ?? Math.max(1, Math.ceil(parsed.total / prev.pageSize)),
        page: parsed.pagination?.page ?? prev.page,
        pageSize: parsed.pagination?.pageSize ?? prev.pageSize,
      }));
    } catch (err) {
      console.error("Error cargando fotógrafos:", err);
      setPhotographers([]);
      setPhotographersPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
    } finally {
      setLoading(false);
    }
  }

  async function loadOrganizers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      params.set("role", "ORGANIZER");
      params.set("page", organizersPagination.page.toString());
      params.set("pageSize", organizersPagination.pageSize.toString());
      const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        setOrganizers([]);
        setOrganizersPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
        return;
      }
      const data = await res.json();
      const parsed = parseAdminUsersResponse(data);
      setOrganizers(parsed.users as UserRow[]);
      setOrganizersPagination((prev) => ({
        ...prev,
        total: parsed.total,
        totalPages: parsed.pagination?.totalPages ?? Math.max(1, Math.ceil(parsed.total / prev.pageSize)),
        page: parsed.pagination?.page ?? prev.page,
        pageSize: parsed.pagination?.pageSize ?? prev.pageSize,
      }));
    } catch (err) {
      console.error("Error cargando organizadores:", err);
      setOrganizers([]);
      setOrganizersPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
    } finally {
      setLoading(false);
    }
  }

  async function loadSchoolOrganizers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      params.set("role", "SCHOOL_ORGANIZER");
      params.set("includeSchoolOrganizerMeta", "true");
      params.set("page", schoolOrganizersPagination.page.toString());
      params.set("pageSize", schoolOrganizersPagination.pageSize.toString());
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setSchoolOrganizers([]);
        setSchoolOrganizersPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
        return;
      }
      const data = await res.json();
      const parsed = parseAdminUsersResponse(data);
      setSchoolOrganizers(parsed.users as SchoolOrganizerRow[]);
      setSchoolOrganizersPagination((prev) => ({
        ...prev,
        total: parsed.total,
        totalPages: parsed.pagination?.totalPages ?? Math.max(1, Math.ceil(parsed.total / prev.pageSize)),
        page: parsed.pagination?.page ?? prev.page,
        pageSize: parsed.pagination?.pageSize ?? prev.pageSize,
      }));
    } catch (err) {
      console.error("Error cargando administradores de escuela:", err);
      setSchoolOrganizers([]);
      setSchoolOrganizersPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser() {
    if (!newUserEmail.trim()) return;
    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: newUserEmail.trim(), role: newUserRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "Error al crear usuario");
        return;
      }
      setCreatedUserData({
        email: data.user?.email || newUserEmail,
        temporaryPassword: data.temporaryPassword,
        referralUrl: data.referralUrl,
      });
      setShowNewUserModal(false);
      setNewUserEmail("");
      setShowCreatedUserModal(true);
      if (newUserRole === "CUSTOMER") loadCustomers();
      else if (newUserRole === "LAB") loadLabs();
      else if (newUserRole === "PHOTOGRAPHER" || newUserRole === "LAB_PHOTOGRAPHER") loadPhotographers();
      else if (newUserRole === "ORGANIZER") loadOrganizers();
    } catch (err) {
      alert("Error de conexión al crear usuario");
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleToggleBlockUser(userId: number, currentBlocked: boolean) {
    const key = `user-${userId}`;
    setActionLoadingId(key);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isBlocked: !currentBlocked }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Error al actualizar");
        return;
      }
      if (tab === "clientes") loadCustomers();
      else if (tab === "fotografos") loadPhotographers();
      else if (tab === "organizadores") loadOrganizers();
      else if (tab === "administradores-escuela") loadSchoolOrganizers();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleUpdateCommissionUser(userId: number, value: number | null) {
    const key = `commission-user-${userId}`;
    setActionLoadingId(key);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ platformCommissionPercentOverride: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Error al guardar porcentaje");
        return;
      }
      if (tab === "fotografos") loadPhotographers();
      else if (tab === "organizadores") loadOrganizers();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleUpdateCommissionLab(labId: number, percentValue: number | null) {
    const key = `commission-lab-${labId}`;
    setActionLoadingId(key);
    try {
      const commissionOverrideBps = percentValue != null ? Math.round(percentValue * 100) : null;
      const res = await fetch(`/api/admin/labs/${labId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ commissionOverrideBps }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Error al guardar porcentaje");
        return;
      }
      loadLabs();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDeleteUser(userId: number) {
    if (!confirm("¿Eliminar este usuario? Esta acción no se puede deshacer.")) return;
    const key = `user-${userId}`;
    setActionLoadingId(key);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Error al eliminar");
        return;
      }
      if (tab === "clientes") loadCustomers();
      else if (tab === "fotografos") loadPhotographers();
      else if (tab === "organizadores") loadOrganizers();
      else if (tab === "administradores-escuela") loadSchoolOrganizers();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleToggleLabSuspend(labId: number, currentSuspended: boolean) {
    const key = `lab-${labId}`;
    setActionLoadingId(key);
    try {
      const res = await fetch(`/api/admin/labs/${labId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isSuspended: !currentSuspended }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Error al actualizar");
        return;
      }
      loadLabs();
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDeleteLab(labId: number) {
    if (!confirm("¿Eliminar este laboratorio? Esta acción no se puede deshacer.")) return;
    const key = `lab-${labId}`;
    setActionLoadingId(key);
    try {
      const res = await fetch("/api/admin/labs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids: [labId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Error al eliminar");
        return;
      }
      if (data.blocked?.length) {
        alert("No se pudo eliminar: tiene pedidos asociados.");
      }
      loadLabs();
    } finally {
      setActionLoadingId(null);
    }
  }

  function exportCsvClientes() {
    const headers = ["ID", "Email", "Nombre", "Teléfono", "Ciudad", "Provincia", "País", "Pedidos", "Estado", "Días sin conectar", "Fecha registro"];
    const rows = customers.map((c) => {
      const orderCount = c.photographers?.reduce((s, p) => s + p.orderCount, 0) ?? c.clientOrders?.length ?? 0;
      return [
        c.id,
        escapeCsvCell(c.email),
        escapeCsvCell(c.name),
        escapeCsvCell(c.phone),
        escapeCsvCell(c.city),
        escapeCsvCell(c.province),
        escapeCsvCell(c.country),
        orderCount,
        c.isBlocked ? "Bloqueado" : "Activo",
        c.isGuest ? "—" : daysSinceLastLogin(c.lastLoginAt),
        escapeCsvCell(c.createdAt),
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\r\n");
    downloadCsv(csv, `usuarios-clientes-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportCsvLabs() {
    const headers = ["ID", "Nombre", "Email", "Teléfono", "Ciudad", "Provincia", "País", "Estado", "Aprobación", "Días sin conectar", "Fecha"];
    const rows = labs.map((l) => [
      l.id,
      escapeCsvCell(l.name),
      escapeCsvCell(l.email),
      escapeCsvCell(l.phone),
      escapeCsvCell(l.city),
      escapeCsvCell(l.province),
      escapeCsvCell(l.country),
      l.isActive ? "Activo" : "Inactivo",
      l.approvalStatus,
      daysSinceLastLogin(l.user?.lastLoginAt),
      escapeCsvCell(l.createdAt),
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\r\n");
    downloadCsv(csv, `usuarios-labs-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function exportCsvFotografos() {
    try {
      const all: UserRow[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        if (cuantoCobroFilter) params.set("cuantoCobro", "true");
        params.set("roles", "PHOTOGRAPHER,LAB_PHOTOGRAPHER");
        params.set("page", String(page));
        params.set("pageSize", "500");
        const res = await fetch(`/api/admin/users?${params.toString()}`, { credentials: "include" });
        if (!res.ok) break;
        const parsed = parseAdminUsersResponse(await res.json());
        all.push(...(parsed.users as UserRow[]));
        totalPages = parsed.pagination?.totalPages ?? 1;
        page += 1;
      } while (page <= totalPages);

      const headers = ["ID", "Email", "Nombre", "Teléfono", "Ubicación", "Rol", "Estado", "Días sin conectar", "Fecha alta"];
      const rows = all.map((u) => [
        u.id,
        escapeCsvCell(u.email),
        escapeCsvCell(u.name),
        escapeCsvCell(u.phone),
        escapeCsvCell([u.city, u.province].filter(Boolean).join(", ")),
        getRoleLabel(u.role),
        u.isBlocked ? "Bloqueado" : "Activo",
        daysSinceLastLogin(u.lastLoginAt),
        escapeCsvCell(u.createdAt),
      ].join(","));
      const csv = [headers.join(","), ...rows].join("\r\n");
      downloadCsv(csv, `usuarios-fotografos-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      console.error("Error exportando fotógrafos:", err);
      alert("No se pudo exportar el CSV de fotógrafos.");
    }
  }

  function exportCsvOrganizadores() {
    const headers = ["ID", "Email", "Nombre", "Teléfono", "Ubicación", "Estado", "Días sin conectar", "Fecha alta"];
    const rows = organizers.map((u) => [
      u.id,
      escapeCsvCell(u.email),
      escapeCsvCell(u.name),
      escapeCsvCell(u.phone),
      escapeCsvCell([u.city, u.province].filter(Boolean).join(", ")),
      u.isBlocked ? "Bloqueado" : "Activo",
      daysSinceLastLogin(u.lastLoginAt),
      escapeCsvCell(u.createdAt),
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\r\n");
    downloadCsv(csv, `usuarios-organizadores-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function exportCsvSchoolOrganizers() {
    const headers = [
      "ID",
      "Email",
      "Nombre",
      "Estado",
      "Fecha alta",
      "Escuelas asociadas (cantidad)",
      "Escuelas asociadas (nombres)",
    ];
    const rows = schoolOrganizers.map((u) => [
      u.id,
      escapeCsvCell(u.email),
      escapeCsvCell(u.name),
      u.isBlocked ? "Bloqueado" : "Activo",
      escapeCsvCell(u.createdAt),
      u.schoolOrganizerMemberships.length,
      escapeCsvCell(
        u.schoolOrganizerMemberships.map((membership) => membership.school.name).join(" | ")
      ),
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\r\n");
    downloadCsv(csv, `usuarios-admin-escuela-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const currentCount =
    tab === "clientes"
      ? customersPagination.total
      : tab === "labs"
        ? labs.length
        : tab === "fotografos"
          ? photographersPagination.total
          : tab === "organizadores"
            ? organizersPagination.total
            : schoolOrganizersPagination.total;

  const handleExportCsv = () => {
    if (tab === "clientes") exportCsvClientes();
    else if (tab === "labs") exportCsvLabs();
    else if (tab === "fotografos") void exportCsvFotografos();
    else if (tab === "organizadores") exportCsvOrganizadores();
    else exportCsvSchoolOrganizers();
  };

  const canExport =
    (tab === "clientes" && customers.length > 0) ||
    (tab === "labs" && labs.length > 0) ||
    (tab === "fotografos" && photographers.length > 0) ||
    (tab === "organizadores" && organizers.length > 0) ||
    (tab === "administradores-escuela" && schoolOrganizers.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => setShowNewUserModal(true)} aria-label="Nuevo usuario">
            Nuevo usuario
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportCsv} disabled={!canExport} aria-label="Exportar listado actual a CSV">
            Exportar CSV
          </Button>
          {tab === "labs" && (
            <Link href="/admin/laboratorios">
              <Button variant="secondary" size="sm">Gestión completa de laboratorios</Button>
            </Link>
          )}
          {tab === "fotografos" && (
            <Link href="/admin/fotografos">
              <Button variant="secondary" size="sm">Gestión completa de fotógrafos</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Selector por rol y recordatorio de exportar */}
      <Card className="p-2">
        <div className="flex flex-wrap gap-2 items-center">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
          <span className="text-gray-500 text-sm ml-2 hidden sm:inline">
            Exportá el listado actual con el botón «Exportar CSV» arriba.
          </span>
        </div>
      </Card>

      {/* Búsqueda (solo donde aplica) */}
      {(tab === "clientes" ||
        tab === "fotografos" ||
        tab === "organizadores" ||
        tab === "administradores-escuela") && (
        <Card className="p-4 ds-form-stack">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Búsqueda</label>
            <Input
              type="text"
              placeholder="Email, nombre, teléfono..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (tab === "clientes") setCustomersPagination((p) => ({ ...p, page: 1 }));
                else if (tab === "fotografos") setPhotographersPagination((p) => ({ ...p, page: 1 }));
                else if (tab === "organizadores") setOrganizersPagination((p) => ({ ...p, page: 1 }));
                else if (tab === "administradores-escuela") {
                  setSchoolOrganizersPagination((p) => ({ ...p, page: 1 }));
                }
              }}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                (tab === "clientes"
                  ? loadCustomers()
                  : tab === "fotografos"
                  ? loadPhotographers()
                  : tab === "organizadores"
                  ? loadOrganizers()
                  : loadSchoolOrganizers())
              }
            />
          </div>
          {tab === "fotografos" ? (
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={cuantoCobroFilter}
                onChange={(e) => {
                  setCuantoCobroFilter(e.target.checked);
                  setPhotographersPagination((p) => ({ ...p, page: 1 }));
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              Solo usuarios de ¿Cuánto Cobro?
            </label>
          ) : null}
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">Cargando...</p>
        </div>
      ) : (
        <>
          <p className="text-gray-600 text-sm">
            Total: {currentCount}{" "}
            {tab === "clientes"
              ? "clientes"
              : tab === "labs"
                ? "laboratorios"
                : tab === "fotografos"
                  ? "fotógrafos"
                  : tab === "organizadores"
                    ? "organizadores de eventos"
                    : "administradores de escuela"}
          </p>

          {/* Tabla Clientes */}
          {tab === "clientes" && (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Teléfono</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ubicación</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Días sin conectar</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enlaces</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-gray-500">No hay clientes</td>
                      </tr>
                    ) : (
                      customers.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">#{c.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{c.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{c.name || "—"}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{c.phone || "—"}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {[c.city, c.province, c.country].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.isBlocked ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                              {c.isBlocked ? "Bloqueado" : "Activo"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600" title={c.lastLoginAt ? `Último login: ${formatDate(c.lastLoginAt)}` : undefined}>
                            {c.isGuest ? "—" : daysSinceLastLogin(c.lastLoginAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(c.createdAt)}</td>
                          <td className="px-4 py-3 text-sm">
                            <AdminUserCopyLinkButtons referralUrl={c.referralUrl} />
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <div className="flex flex-wrap gap-1 justify-end items-center">
                              {buildWhatsappUrl(c.phone) && (
                                <button type="button" className={btnClass} onClick={() => window.open(buildWhatsappUrl(c.phone)!, "_blank")} title="WhatsApp" aria-label="WhatsApp"><IconWhatsApp /></button>
                              )}
                              <button type="button" className={btnClass} onClick={() => router.push(`/admin/usuarios/${c.id}`)} disabled={c.isGuest} title="Ver configuración completa (solo lectura)" aria-label="Ver configuración"><IconEye /></button>
                              <button type="button" className={btnClass} onClick={() => handleToggleBlockUser(c.id, c.isBlocked)} disabled={actionLoadingId === `user-${c.id}`} title={c.isBlocked ? "Activar" : "Desactivar"} aria-label={c.isBlocked ? "Activar" : "Desactivar"}>{actionLoadingId === `user-${c.id}` ? <span className="text-xs">...</span> : c.isBlocked ? <IconUnlock /> : <IconLock />}</button>
                              <button type="button" className={`${btnClass} text-red-600 hover:bg-red-50 hover:border-red-300`} onClick={() => handleDeleteUser(c.id)} disabled={actionLoadingId === `user-${c.id}` || c.isGuest} title="Eliminar" aria-label="Eliminar"><IconTrash /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {customersPagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    Página {customersPagination.page} de {customersPagination.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCustomersPagination((p) => ({ ...p, page: p.page - 1 }))}
                      disabled={customersPagination.page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCustomersPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={customersPagination.page >= customersPagination.totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Tabla Labs */}
          {tab === "labs" && (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ubicación</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Días sin conectar</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comisión %</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enlaces</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {labs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No hay laboratorios</td>
                      </tr>
                    ) : (
                      labs.map((l) => (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">#{l.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{l.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{l.email || "—"}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {[l.city, l.province, l.country].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${l.approvalStatus === "APPROVED" ? "bg-green-100 text-green-800" : l.approvalStatus === "REJECTED" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                              {l.approvalStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600" title={l.user?.lastLoginAt ? `Último login: ${formatDate(l.user.lastLoginAt)}` : undefined}>
                            {daysSinceLastLogin(l.user?.lastLoginAt)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <input
                              key={`lab-${l.id}-${l.commissionOverrideBps ?? "null"}`}
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              placeholder="Default"
                              className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                              defaultValue={l.commissionOverrideBps != null ? (l.commissionOverrideBps / 100).toString() : ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                const num = v === "" ? null : parseFloat(v);
                                if (num !== null && (Number.isNaN(num) || num < 0 || num > 100)) return;
                                if (num !== null && l.commissionOverrideBps != null && Math.abs(num - l.commissionOverrideBps / 100) < 0.01) return;
                                if (num === null && l.commissionOverrideBps == null) return;
                                handleUpdateCommissionLab(l.id, num);
                              }}
                              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                              disabled={actionLoadingId === `commission-lab-${l.id}`}
                            />
                            {actionLoadingId === `commission-lab-${l.id}` && <span className="ml-1 text-xs text-gray-500">...</span>}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <AdminUserCopyLinkButtons
                              landingKind="lab"
                              publicPageHandler={l.publicPageHandler}
                              referralUrl={l.referralUrl}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <div className="flex flex-wrap gap-1 justify-end items-center">
                              {(l.mpUserId ?? l.mpConnectedAt) && (
                                <span className="inline-flex items-center" title="Mercado Pago conectado" aria-label="Mercado Pago conectado"><IconMercadoPago /></span>
                              )}
                              {buildWhatsappUrl(l.phone || l.user?.phone) && (
                                <button type="button" className={btnClass} onClick={() => window.open(buildWhatsappUrl(l.phone || l.user?.phone)!, "_blank")} title="WhatsApp" aria-label="WhatsApp"><IconWhatsApp /></button>
                              )}
                              {l.user?.id && (
                                <button type="button" className={btnClass} onClick={() => router.push(`/admin/usuarios/${l.user!.id}`)} title="Ver configuración completa (solo lectura)" aria-label="Ver configuración"><IconEye /></button>
                              )}
                              <button type="button" className={btnClass} onClick={() => handleToggleLabSuspend(l.id, !!l.isSuspended)} disabled={actionLoadingId === `lab-${l.id}`} title={l.isSuspended ? "Activar" : "Desactivar"} aria-label={l.isSuspended ? "Activar" : "Desactivar"}>{actionLoadingId === `lab-${l.id}` ? <span className="text-xs">...</span> : l.isSuspended ? <IconUnlock /> : <IconLock />}</button>
                              <button type="button" className={`${btnClass} text-red-600 hover:bg-red-50 hover:border-red-300`} onClick={() => handleDeleteLab(l.id)} disabled={actionLoadingId === `lab-${l.id}`} title="Eliminar" aria-label="Eliminar"><IconTrash /></button>
                              <Link href="/admin/laboratorios" className={btnClass} title="Gestionar" aria-label="Gestionar"><IconCog /></Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Tabla Fotógrafos */}
          {tab === "fotografos" && (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Productos</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Días sin conectar</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comisión %</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enlaces</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {photographers.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-gray-500">No hay fotógrafos</td>
                      </tr>
                    ) : (
                      photographers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">#{u.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.name || "—"}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{getRoleLabel(u.role)}</td>
                          <td className="px-4 py-3 text-sm">
                            {u.cuantoCobroUser ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                Cuánto Cobro
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.isBlocked ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                              {u.isBlocked ? "Bloqueado" : "Activo"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600" title={u.lastLoginAt ? `Último login: ${formatDate(u.lastLoginAt)}` : undefined}>
                            {daysSinceLastLogin(u.lastLoginAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(u.createdAt)}</td>
                          <td className="px-4 py-3 text-sm">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              placeholder="Default"
                              className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                              key={`user-${u.id}-${u.platformCommissionPercentOverride ?? "null"}`}
                              defaultValue={u.platformCommissionPercentOverride != null ? String(u.platformCommissionPercentOverride) : ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                const num = v === "" ? null : parseFloat(v);
                                if (num !== null && (Number.isNaN(num) || num < 0 || num > 100)) return;
                                if (num !== null && u.platformCommissionPercentOverride != null && Math.abs(num - u.platformCommissionPercentOverride) < 0.01) return;
                                if (num === null && u.platformCommissionPercentOverride == null) return;
                                handleUpdateCommissionUser(u.id, num);
                              }}
                              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                              disabled={actionLoadingId === `commission-user-${u.id}`}
                            />
                            {actionLoadingId === `commission-user-${u.id}` && <span className="ml-1 text-xs text-gray-500">...</span>}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <AdminUserCopyLinkButtons
                              landingKind="photographer"
                              publicPageHandler={u.publicPageHandler}
                              referralUrl={u.referralUrl}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <div className="flex flex-wrap gap-1 justify-end items-center">
                              {(u.mpUserId ?? u.mpConnectedAt) && (
                                <span className="inline-flex items-center" title="Mercado Pago conectado" aria-label="Mercado Pago conectado"><IconMercadoPago /></span>
                              )}
                              {buildWhatsappUrl(u.phone) && (
                                <button type="button" className={btnClass} onClick={() => window.open(buildWhatsappUrl(u.phone)!, "_blank")} title="WhatsApp" aria-label="WhatsApp"><IconWhatsApp /></button>
                              )}
                              <button type="button" className={btnClass} onClick={() => router.push(`/admin/usuarios/${u.id}`)} title="Ver configuración completa (solo lectura)" aria-label="Ver configuración"><IconEye /></button>
                              <button type="button" className={btnClass} onClick={() => handleToggleBlockUser(u.id, u.isBlocked)} disabled={actionLoadingId === `user-${u.id}`} title={u.isBlocked ? "Activar" : "Desactivar"} aria-label={u.isBlocked ? "Activar" : "Desactivar"}>{actionLoadingId === `user-${u.id}` ? <span className="text-xs">...</span> : u.isBlocked ? <IconUnlock /> : <IconLock />}</button>
                              <button type="button" className={`${btnClass} text-red-600 hover:bg-red-50 hover:border-red-300`} onClick={() => handleDeleteUser(u.id)} disabled={actionLoadingId === `user-${u.id}`} title="Eliminar" aria-label="Eliminar"><IconTrash /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {photographersPagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    Página {photographersPagination.page} de {photographersPagination.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPhotographersPagination((p) => ({ ...p, page: p.page - 1 }))}
                      disabled={photographersPagination.page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPhotographersPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={photographersPagination.page >= photographersPagination.totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Tabla Organizadores */}
          {tab === "organizadores" && (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Días sin conectar</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comisión %</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Enlaces</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {organizers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No hay organizadores</td>
                      </tr>
                    ) : (
                      organizers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">#{u.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.email}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.name || "—"}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.isBlocked ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                              {u.isBlocked ? "Bloqueado" : "Activo"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600" title={u.lastLoginAt ? `Último login: ${formatDate(u.lastLoginAt)}` : undefined}>
                            {daysSinceLastLogin(u.lastLoginAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(u.createdAt)}</td>
                          <td className="px-4 py-3 text-sm">
                            <input
                              key={`org-${u.id}-${u.platformCommissionPercentOverride ?? "null"}`}
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              placeholder="Default"
                              className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
                              defaultValue={u.platformCommissionPercentOverride != null ? String(u.platformCommissionPercentOverride) : ""}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                const num = v === "" ? null : parseFloat(v);
                                if (num !== null && (Number.isNaN(num) || num < 0 || num > 100)) return;
                                if (num !== null && u.platformCommissionPercentOverride != null && Math.abs(num - u.platformCommissionPercentOverride) < 0.01) return;
                                if (num === null && u.platformCommissionPercentOverride == null) return;
                                handleUpdateCommissionUser(u.id, num);
                              }}
                              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                              disabled={actionLoadingId === `commission-user-${u.id}`}
                            />
                            {actionLoadingId === `commission-user-${u.id}` && <span className="ml-1 text-xs text-gray-500">...</span>}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <AdminUserCopyLinkButtons
                              landingKind="organizer"
                              publicPageHandler={u.publicPageHandler}
                              referralUrl={u.referralUrl}
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <div className="flex flex-wrap gap-1 justify-end items-center">
                              {(u.mpUserId ?? u.mpConnectedAt) && (
                                <span className="inline-flex items-center" title="Mercado Pago conectado" aria-label="Mercado Pago conectado"><IconMercadoPago /></span>
                              )}
                              {buildWhatsappUrl(u.phone) && (
                                <button type="button" className={btnClass} onClick={() => window.open(buildWhatsappUrl(u.phone)!, "_blank")} title="WhatsApp" aria-label="WhatsApp"><IconWhatsApp /></button>
                              )}
                              <button type="button" className={btnClass} onClick={() => router.push(`/admin/usuarios/${u.id}`)} title="Ver configuración completa (solo lectura)" aria-label="Ver configuración"><IconEye /></button>
                              <button type="button" className={btnClass} onClick={() => handleToggleBlockUser(u.id, u.isBlocked)} disabled={actionLoadingId === `user-${u.id}`} title={u.isBlocked ? "Activar" : "Desactivar"} aria-label={u.isBlocked ? "Activar" : "Desactivar"}>{actionLoadingId === `user-${u.id}` ? <span className="text-xs">...</span> : u.isBlocked ? <IconUnlock /> : <IconLock />}</button>
                              <button type="button" className={`${btnClass} text-red-600 hover:bg-red-50 hover:border-red-300`} onClick={() => handleDeleteUser(u.id)} disabled={actionLoadingId === `user-${u.id}`} title="Eliminar" aria-label="Eliminar"><IconTrash /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {organizersPagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    Página {organizersPagination.page} de {organizersPagination.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setOrganizersPagination((p) => ({ ...p, page: p.page - 1 }))}
                      disabled={organizersPagination.page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setOrganizersPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={organizersPagination.page >= organizersPagination.totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Tabla Administradores de escuela */}
          {tab === "administradores-escuela" && (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Nombre
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Fecha de creación
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Escuelas asociadas
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {schoolOrganizers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                          No hay administradores de escuela
                        </td>
                      </tr>
                    ) : (
                      schoolOrganizers.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">#{u.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.name || "—"}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{u.email}</td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                u.isBlocked ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                              }`}
                            >
                              {u.isBlocked ? "Bloqueado" : "Activo"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {formatDate(u.createdAt)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            <div className="space-y-1">
                              <p className="font-medium">
                                {u.schoolOrganizerMemberships.length} escuela
                                {u.schoolOrganizerMemberships.length === 1 ? "" : "s"}
                              </p>
                              {u.schoolOrganizerMemberships.length > 0 ? (
                                <p className="text-xs text-gray-500">
                                  {u.schoolOrganizerMemberships
                                    .slice(0, 2)
                                    .map((membership) => membership.school.name)
                                    .join(" · ")}
                                  {u.schoolOrganizerMemberships.length > 2
                                    ? ` +${u.schoolOrganizerMemberships.length - 2} más`
                                    : ""}
                                </p>
                              ) : (
                                <p className="text-xs text-gray-500">Sin escuelas asociadas</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            <div className="flex flex-wrap gap-1 justify-end items-center">
                              <button
                                type="button"
                                className={btnClass}
                                onClick={() => router.push(`/admin/usuarios/${u.id}`)}
                                title="Ver detalle"
                                aria-label="Ver detalle"
                              >
                                <IconEye />
                              </button>
                              <button
                                type="button"
                                className={btnClass}
                                onClick={() => handleToggleBlockUser(u.id, u.isBlocked)}
                                disabled={actionLoadingId === `user-${u.id}`}
                                title={u.isBlocked ? "Activar" : "Desactivar"}
                                aria-label={u.isBlocked ? "Activar" : "Desactivar"}
                              >
                                {actionLoadingId === `user-${u.id}` ? (
                                  <span className="text-xs">...</span>
                                ) : u.isBlocked ? (
                                  <IconUnlock />
                                ) : (
                                  <IconLock />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {schoolOrganizersPagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    Página {schoolOrganizersPagination.page} de {schoolOrganizersPagination.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSchoolOrganizersPagination((p) => ({ ...p, page: p.page - 1 }))}
                      disabled={schoolOrganizersPagination.page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSchoolOrganizersPagination((p) => ({ ...p, page: p.page + 1 }))}
                      disabled={schoolOrganizersPagination.page >= schoolOrganizersPagination.totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Modal Nuevo usuario */}
          {showNewUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNewUserModal(false)}>
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl min-w-[20rem] p-6" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Nuevo usuario</h2>
                <p className="text-sm text-gray-600 mb-4">Creá un usuario solo con email. Aparecerá en el listado y, si es fotógrafo, se generará su link de referidos para que pueda recomendar antes de usar la plataforma.</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de usuario</label>
                    <select
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as typeof newUserRole)}
                    >
                      <option value="CUSTOMER">Cliente</option>
                      <option value="PHOTOGRAPHER">Fotógrafo</option>
                      <option value="LAB_PHOTOGRAPHER">Fotógrafo + Lab</option>
                      <option value="LAB">Laboratorio</option>
                      <option value="ORGANIZER">Organizador</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <Input
                      type="email"
                      placeholder="ejemplo@email.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="mt-6 flex gap-3 justify-end">
                  <Button variant="secondary" onClick={() => setShowNewUserModal(false)}>Cancelar</Button>
                  <Button variant="primary" onClick={handleCreateUser} disabled={creatingUser || !newUserEmail.trim()}>
                    {creatingUser ? "Creando..." : "Crear usuario"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Usuario creado - Mensaje de invitación con opción de copiar */}
          {showCreatedUserModal && createdUserData && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowCreatedUserModal(false); setCreatedUserData(null); }}>
              <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 overflow-y-auto flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Usuario creado correctamente</h2>
                  <p className="text-sm text-gray-600 mb-4">Copiá el mensaje de invitación para compartirlo con {createdUserData.email}</p>

                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Datos de acceso</p>
                      <p className="text-sm text-gray-900">Email: {createdUserData.email}</p>
                      {createdUserData.temporaryPassword && (
                        <p className="text-sm text-gray-900 mt-1">Contraseña temporal: {createdUserData.temporaryPassword}</p>
                      )}
                      {createdUserData.referralUrl && (
                        <p className="text-sm text-gray-900 mt-1 break-all">Link de referidos: {createdUserData.referralUrl}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Links útiles</p>
                      <div className="flex flex-wrap gap-2">
                        {createdUserData.referralUrl && (
                          <a href={createdUserData.referralUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Link de referidos</a>
                        )}
                        <a href={getBaseUrl()} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Plataforma</a>
                        <a href={`${getBaseUrl()}/tutoriales`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Tutoriales</a>
                        <a href={`${getBaseUrl()}/#faq`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Preguntas frecuentes</a>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-6 pt-0 flex gap-3 justify-end border-t border-gray-200">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const msg = buildInvitationMessage(createdUserData, getBaseUrl());
                      await navigator.clipboard.writeText(msg);
                      alert("Mensaje de invitación copiado al portapapeles.");
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <IconCopy />
                      Copiar mensaje de invitación
                    </span>
                  </Button>
                  <Button variant="primary" onClick={() => { setShowCreatedUserModal(false); setCreatedUserData(null); }}>
                    Aceptar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
