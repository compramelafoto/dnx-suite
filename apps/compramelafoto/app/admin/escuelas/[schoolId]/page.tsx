"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Tabs from "@/components/ui/Tabs";
import type {
  AlbumConfigFormState,
  AlbumRow,
  CreateSchoolOrganizerFormState,
  DetailResponse,
  DiagnosticAlert,
  OrderDetailResponse,
  PackFormState,
  PackRow,
  PhotographerOption,
  SchoolData,
  SchoolFormState,
  SchoolOption,
  SchoolOrganizerInvitationRow,
  SchoolOrganizerMember,
  StudentFormState,
  StudentImportSummary,
  StudentRow,
} from "@/components/admin/school-detail/types";
import { formatCurrencyArs, formatDate, formatDateTime } from "@/lib/admin/school-detail-format";
import type { SchoolAlbumListFilter } from "@/lib/admin/school-albums-filter";
import {
  getAlbumIdFromIdentModeDiagnostic,
  getDiagnosticCategory,
} from "@/lib/admin/school-detail-diagnostics";
import { SchoolAlbumsTab } from "@/components/admin/school-detail/SchoolAlbumsTab";
import { SchoolCommissionsTab } from "@/components/admin/school-detail/SchoolCommissionsTab";
import { SchoolInstitutionTab } from "@/components/admin/school-detail/SchoolInstitutionTab";
import { SchoolStudentsTab } from "@/components/admin/school-detail/SchoolStudentsTab";
import { SchoolUsersTab } from "@/components/admin/school-detail/SchoolUsersTab";
import { Building2, GraduationCap, Images, Users, Wallet } from "lucide-react";

function buildSchoolFormState(school: SchoolData): SchoolFormState {
  return {
    name: school.name || "",
    contactEmail: school.contactEmail || "",
    contactPhone: school.contactPhone || "",
    address: school.address || "",
    city: school.city || "",
    province: school.province || "",
    country: school.country || "",
    notes: school.notes || "",
    logoUrl: school.logoUrl || "",
  };
}

function buildAlbumConfigFormState(album: AlbumRow): AlbumConfigFormState {
  const eventDateIso = album.eventDate
    ? new Date(album.eventDate).toISOString().slice(0, 10)
    : "";
  return {
    title: album.title || "",
    publicSlug: album.publicSlug || "",
    eventDate: eventDateIso,
    schoolId: album.schoolId != null ? String(album.schoolId) : "",
    isTest: Boolean(album.isTest),
    studentIdentificationMode: album.studentIdentificationMode || "",
    allowManualStudentFallback: Boolean(album.allowManualStudentFallback),
    organizerCommissionEnabled: Boolean(album.organizerCommissionEnabled),
    organizerCommissionPercentage:
      album.organizerCommissionPercentage != null
        ? String(album.organizerCommissionPercentage)
        : "",
    organizerCommissionAppliesTo: Array.isArray(album.organizerCommissionAppliesTo)
      ? album.organizerCommissionAppliesTo
      : ["PREVENTA"],
  };
}

function buildStudentFormState(student?: StudentRow): StudentFormState {
  if (!student) {
    return {
      firstName: "",
      lastName: "",
      level: "",
      course: "",
      division: "",
      shift: "",
      notes: "",
      albumId: "",
    };
  }
  return {
    studentId: student.studentId,
    rosterEntryId: student.id,
    firstName: student.firstName || "",
    lastName: student.lastName || "",
    level: student.level || "",
    course: student.course || "",
    division: student.division || "",
    shift: student.shift || "",
    notes: student.notes || "",
    albumId: String(student.albumId),
  };
}

function toDateInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function buildPackFormState(pack: PackRow): PackFormState {
  return {
    name: pack.name || "",
    description: pack.description || "",
    priceClientArs: String(pack.priceClientArs ?? 0),
    availabilityPhase: pack.availabilityPhase || "",
    isActive: Boolean(pack.isActive),
    validFrom: toDateInputValue(pack.validFrom),
    validUntil: toDateInputValue(pack.validUntil),
  };
}

export default function AdminEscuelaDetallePage() {
  const router = useRouter();
  const params = useParams<{ schoolId: string }>();
  const schoolId = params?.schoolId;

  const [activeTab, setActiveTab] = useState("institucion");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);

  const [isEditingSchool, setIsEditingSchool] = useState(false);
  const [schoolForm, setSchoolForm] = useState<SchoolFormState | null>(null);
  const [schoolSaveLoading, setSchoolSaveLoading] = useState(false);
  const [schoolSaveError, setSchoolSaveError] = useState<string | null>(null);
  const [isEditingSchoolOwner, setIsEditingSchoolOwner] = useState(false);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState("");
  const [ownerSearchResults, setOwnerSearchResults] = useState<PhotographerOption[]>([]);
  const [ownerSearchLoading, setOwnerSearchLoading] = useState(false);
  const [ownerSearchError, setOwnerSearchError] = useState<string | null>(null);
  const [selectedOwnerUser, setSelectedOwnerUser] = useState<PhotographerOption | null>(null);
  const [ownerSaveLoading, setOwnerSaveLoading] = useState(false);
  const [ownerSaveError, setOwnerSaveError] = useState<string | null>(null);
  const [schoolOrganizers, setSchoolOrganizers] = useState<SchoolOrganizerMember[]>([]);
  const [organizersLoading, setOrganizersLoading] = useState(false);
  const [organizersError, setOrganizersError] = useState<string | null>(null);
  const [organizerSearch, setOrganizerSearch] = useState("");
  const [organizerCandidates, setOrganizerCandidates] = useState<
    Array<{ id: number; name: string | null; email: string; role: string }>
  >([]);
  const [organizerSearchLoading, setOrganizerSearchLoading] = useState(false);
  const [selectedOrganizerUserId, setSelectedOrganizerUserId] = useState<string>("");
  const [organizerSaveLoading, setOrganizerSaveLoading] = useState(false);
  const [removingOrganizerId, setRemovingOrganizerId] = useState<string | null>(null);
  const [isCreatingOrganizerUser, setIsCreatingOrganizerUser] = useState(false);
  const [createOrganizerForm, setCreateOrganizerForm] =
    useState<CreateSchoolOrganizerFormState>({
      name: "",
      email: "",
    });
  const [createOrganizerLoading, setCreateOrganizerLoading] = useState(false);
  const [createOrganizerError, setCreateOrganizerError] = useState<string | null>(null);
  const [lastInvitationSent, setLastInvitationSent] = useState<{
    email: string;
    expiresAt: string;
  } | null>(null);
  const [organizerInvitations, setOrganizerInvitations] = useState<SchoolOrganizerInvitationRow[]>([]);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<string | null>(null);

  const [editingAlbumId, setEditingAlbumId] = useState<number | null>(null);
  const [albumConfigForm, setAlbumConfigForm] = useState<AlbumConfigFormState | null>(null);
  const [albumSaveLoading, setAlbumSaveLoading] = useState(false);
  const [albumSaveError, setAlbumSaveError] = useState<string | null>(null);

  const [editingPackId, setEditingPackId] = useState<number | null>(null);
  const [packForm, setPackForm] = useState<PackFormState | null>(null);
  const [packSaveLoading, setPackSaveLoading] = useState(false);
  const [packSaveError, setPackSaveError] = useState<string | null>(null);

  const [studentFormMode, setStudentFormMode] = useState<"create" | "edit" | null>(null);
  const [studentForm, setStudentForm] = useState<StudentFormState | null>(null);
  const [studentSaveLoading, setStudentSaveLoading] = useState(false);
  const [studentSaveError, setStudentSaveError] = useState<string | null>(null);
  const [deletingStudentId, setDeletingStudentId] = useState<number | null>(null);
  const [editingStudentHasSensitiveRelations, setEditingStudentHasSensitiveRelations] =
    useState(false);
  const [importAlbumId, setImportAlbumId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importCsvText, setImportCsvText] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<StudentImportSummary | null>(null);
  const [studentFilterCourse, setStudentFilterCourse] = useState("");
  const [studentFilterDivision, setStudentFilterDivision] = useState("");
  const [studentFilterShift, setStudentFilterShift] = useState("");
  const [studentPage, setStudentPage] = useState(1);
  const studentPageSize = 20;
  const [albumListFilter, setAlbumListFilter] = useState<SchoolAlbumListFilter>("all");
  const [pendingFocusStudentIdentificationAlbumId, setPendingFocusStudentIdentificationAlbumId] =
    useState<number | null>(null);
  const [pendingFocusAlbumConfigAlbumId, setPendingFocusAlbumConfigAlbumId] =
    useState<number | null>(null);
  const [pendingFocusPackId, setPendingFocusPackId] = useState<number | null>(null);
  const [pendingFocusPackField, setPendingFocusPackField] = useState<
    "name" | "availabilityPhase" | "validUntil"
  >("name");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDetailResponse | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState<string | null>(null);
  const [diagnosticsSeverityFilter, setDiagnosticsSeverityFilter] = useState<
    "all" | "warning" | "error"
  >("all");

  const loadDetail = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Error ${res.status}`);
      }
      setDetail(data as DetailResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error cargando detalle";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!detail) return;
    setSchoolForm(buildSchoolFormState(detail.school));
  }, [detail]);

  useEffect(() => {
    if (!detail) return;
    setSelectedOwnerUser({
      id: detail.school.owner.id,
      name: detail.school.owner.name,
      email: detail.school.owner.email,
      role: detail.school.owner.role,
      studioName: detail.school.owner.companyName,
    });
  }, [detail]);

  useEffect(() => {
    if (!isEditingSchoolOwner) return;
    const controller = new AbortController();
    const query = ownerSearchQuery.trim();
    const timeoutId = window.setTimeout(async () => {
      setOwnerSearchLoading(true);
      setOwnerSearchError(null);
      try {
        const url = query
          ? `/api/admin/photographers?q=${encodeURIComponent(query)}`
          : "/api/admin/photographers";
        const res = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar fotógrafos");
        }
        const rows = Array.isArray(data.photographers)
          ? (data.photographers as PhotographerOption[])
          : [];
        setOwnerSearchResults(rows);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setOwnerSearchResults([]);
        setOwnerSearchError(err instanceof Error ? err.message : "No se pudieron cargar fotógrafos");
      } finally {
        setOwnerSearchLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isEditingSchoolOwner, ownerSearchQuery]);

  useEffect(() => {
    if (!detail) return;
    const hasSelectedAlbum = detail.albums.some((album) => String(album.id) === importAlbumId);
    if (hasSelectedAlbum) return;
    setImportAlbumId(detail.albums[0] ? String(detail.albums[0].id) : "");
  }, [detail, importAlbumId]);

  useEffect(() => {
    setStudentPage(1);
  }, [studentSearch, studentFilterCourse, studentFilterDivision, studentFilterShift]);

  useEffect(() => {
    if (
      activeTab !== "albumes" ||
      pendingFocusStudentIdentificationAlbumId == null ||
      editingAlbumId !== pendingFocusStudentIdentificationAlbumId
    ) {
      return;
    }
    const target = document.getElementById(
      `album-config-student-identification-mode-${pendingFocusStudentIdentificationAlbumId}`
    );
    if (!(target instanceof HTMLSelectElement)) return;
    target.focus();
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setPendingFocusStudentIdentificationAlbumId(null);
  }, [activeTab, editingAlbumId, pendingFocusStudentIdentificationAlbumId]);

  useEffect(() => {
    if (
      activeTab !== "albumes" ||
      pendingFocusAlbumConfigAlbumId == null ||
      editingAlbumId !== pendingFocusAlbumConfigAlbumId
    ) {
      return;
    }
    const formContainer = document.getElementById(
      `album-config-form-${pendingFocusAlbumConfigAlbumId}`
    );
    formContainer?.scrollIntoView({ behavior: "smooth", block: "center" });
    const target = document.getElementById(
      `album-config-title-input-${pendingFocusAlbumConfigAlbumId}`
    );
    if (target instanceof HTMLElement) {
      target.focus();
    }
    setPendingFocusAlbumConfigAlbumId(null);
  }, [activeTab, editingAlbumId, pendingFocusAlbumConfigAlbumId]);

  useEffect(() => {
    if (activeTab !== "albumes" || pendingFocusPackId == null || editingPackId !== pendingFocusPackId) {
      return;
    }
    const formContainer = document.getElementById(`pack-config-form-${pendingFocusPackId}`);
    formContainer?.scrollIntoView({ behavior: "smooth", block: "center" });
    const targetId =
      pendingFocusPackField === "availabilityPhase"
        ? `pack-config-phase-input-${pendingFocusPackId}`
        : pendingFocusPackField === "validUntil"
        ? `pack-config-valid-until-input-${pendingFocusPackId}`
        : `pack-config-name-input-${pendingFocusPackId}`;
    const target = document.getElementById(targetId);
    if (target instanceof HTMLElement) {
      target.focus();
    }
    setPendingFocusPackId(null);
  }, [activeTab, editingPackId, pendingFocusPackField, pendingFocusPackId]);

  const loadSchoolOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/schools", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const rows = Array.isArray(data.schools) ? data.schools : [];
      setSchoolOptions(
        rows.map((row: { id: number; name: string }) => ({
          id: row.id,
          name: row.name,
        }))
      );
    } catch {
      // Silencioso: en caso de error dejamos solo la escuela actual
    }
  }, []);

  useEffect(() => {
    void loadSchoolOptions();
  }, [loadSchoolOptions]);

  const loadSchoolOrganizers = useCallback(async () => {
    if (!schoolId) return;
    setOrganizersLoading(true);
    setOrganizersError(null);
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}/organizers`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar los usuarios de escuela");
      }
      setSchoolOrganizers(Array.isArray(data?.organizers) ? data.organizers : []);
    } catch (err) {
      setOrganizersError(
        err instanceof Error ? err.message : "No se pudieron cargar los usuarios de escuela"
      );
      setSchoolOrganizers([]);
    } finally {
      setOrganizersLoading(false);
    }
  }, [schoolId]);

  const loadSchoolOrganizerInvitations = useCallback(async () => {
    if (!schoolId) return;
    try {
      const res = await fetch(`/api/admin/schools/${schoolId}/organizers/invite`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar invitaciones");
      }
      setOrganizerInvitations(Array.isArray(data?.invitations) ? data.invitations : []);
    } catch {
      setOrganizerInvitations([]);
    }
  }, [schoolId]);

  useEffect(() => {
    void Promise.all([loadSchoolOrganizers(), loadSchoolOrganizerInvitations()]);
  }, [loadSchoolOrganizers, loadSchoolOrganizerInvitations]);

  useEffect(() => {
    if (!schoolId) {
      setOrganizerCandidates([]);
      return;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setOrganizerSearchLoading(true);
      try {
        const q = organizerSearch.trim();
        const url = q
          ? `/api/admin/schools/${schoolId}/organizers/candidates?q=${encodeURIComponent(q)}`
          : `/api/admin/schools/${schoolId}/organizers/candidates`;
        const res = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "No se pudieron cargar cuentas disponibles para asignar");
        }
        const rows = Array.isArray(data?.users) ? data.users : [];
        setOrganizerCandidates(
          rows.map(
            (row: {
              id: number;
              name: string | null;
              email: string;
              role: string;
            }) => ({
              id: row.id,
              name: row.name,
              email: row.email,
              role: row.role,
            })
          )
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setOrganizerCandidates([]);
      } finally {
        setOrganizerSearchLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [organizerSearch, schoolId]);

  async function handleSaveSchool() {
    if (!detail || !schoolForm) return;
    setSchoolSaveLoading(true);
    setSchoolSaveError(null);
    try {
      const res = await fetch(`/api/admin/schools/${detail.school.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: schoolForm.name,
          contactEmail: schoolForm.contactEmail || null,
          contactPhone: schoolForm.contactPhone || null,
          address: schoolForm.address || null,
          city: schoolForm.city || null,
          province: schoolForm.province || null,
          country: schoolForm.country || null,
          notes: schoolForm.notes || null,
          logoUrl: schoolForm.logoUrl || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar la escuela");
      }
      await loadDetail();
      setIsEditingSchool(false);
    } catch (err) {
      setSchoolSaveError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSchoolSaveLoading(false);
    }
  }

  function startEditingSchoolOwner() {
    if (!detail) return;
    setOwnerSaveError(null);
    setOwnerSearchError(null);
    setOwnerSearchQuery("");
    setSelectedOwnerUser({
      id: detail.school.owner.id,
      name: detail.school.owner.name,
      email: detail.school.owner.email,
      role: detail.school.owner.role,
      studioName: detail.school.owner.companyName,
    });
    setIsEditingSchoolOwner(true);
  }

  function cancelEditingSchoolOwner() {
    setIsEditingSchoolOwner(false);
    setOwnerSaveError(null);
    setOwnerSearchError(null);
    setOwnerSearchQuery("");
    setOwnerSearchResults([]);
    setSelectedOwnerUser(
      detail
        ? {
            id: detail.school.owner.id,
            name: detail.school.owner.name,
            email: detail.school.owner.email,
            role: detail.school.owner.role,
            studioName: detail.school.owner.companyName,
          }
        : null
    );
  }

  async function handleSaveSchoolOwner() {
    if (!detail || !selectedOwnerUser) return;
    setOwnerSaveLoading(true);
    setOwnerSaveError(null);
    try {
      const res = await fetch(`/api/admin/schools/${detail.school.id}/owner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ownerId: String(selectedOwnerUser.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo actualizar el fotógrafo responsable");
      }
      await loadDetail();
      setIsEditingSchoolOwner(false);
      setOwnerSearchResults([]);
      setOwnerSearchQuery("");
    } catch (err) {
      setOwnerSaveError(
        err instanceof Error ? err.message : "No se pudo actualizar el fotógrafo responsable"
      );
    } finally {
      setOwnerSaveLoading(false);
    }
  }

  async function handleAddSchoolOrganizer() {
    if (!detail || !selectedOrganizerUserId) return;
    setOrganizerSaveLoading(true);
    setOrganizersError(null);
    try {
      const res = await fetch(`/api/admin/schools/${detail.school.id}/organizers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: Number(selectedOrganizerUserId) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo asignar el usuario a la escuela");
      }
      setSelectedOrganizerUserId("");
      await loadSchoolOrganizers();
    } catch (err) {
      setOrganizersError(
        err instanceof Error ? err.message : "No se pudo asignar el usuario a la escuela"
      );
    } finally {
      setOrganizerSaveLoading(false);
    }
  }

  async function handleRemoveSchoolOrganizer(membershipId: string) {
    if (!detail) return;
    const confirmed = window.confirm(
      "¿Querés remover el acceso de este usuario a la escuela? Esta acción se puede volver a asignar luego."
    );
    if (!confirmed) return;

    setRemovingOrganizerId(membershipId);
    setOrganizersError(null);
    try {
      const res = await fetch(
        `/api/admin/schools/${detail.school.id}/organizers/${membershipId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo remover el acceso");
      }
      await loadSchoolOrganizers();
    } catch (err) {
      setOrganizersError(err instanceof Error ? err.message : "No se pudo remover el acceso");
    } finally {
      setRemovingOrganizerId(null);
    }
  }

  async function handleInviteSchoolOrganizerUser() {
    if (!detail) return;
    setCreateOrganizerLoading(true);
    setCreateOrganizerError(null);
    setOrganizersError(null);
    try {
      const payload = {
        name: createOrganizerForm.name.trim(),
        email: createOrganizerForm.email.trim(),
      };
      const res = await fetch(`/api/admin/schools/${detail.school.id}/organizers/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo enviar la invitación");
      }

      setLastInvitationSent({
        email: String(data?.invitation?.email ?? payload.email),
        expiresAt: String(data?.invitation?.expiresAt ?? ""),
      });
      setCreateOrganizerForm({ name: "", email: "" });
      setIsCreatingOrganizerUser(false);
      await Promise.all([loadSchoolOrganizers(), loadSchoolOrganizerInvitations()]);
    } catch (err) {
      setCreateOrganizerError(
        err instanceof Error ? err.message : "No se pudo enviar la invitación"
      );
    } finally {
      setCreateOrganizerLoading(false);
    }
  }

  async function handleResendInvitation(invitationId: string) {
    if (!detail) return;
    setResendingInvitationId(invitationId);
    setCreateOrganizerError(null);
    try {
      const res = await fetch(
        `/api/admin/schools/${detail.school.id}/organizers/invite/${invitationId}/resend`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo reenviar la invitación");
      }
      setLastInvitationSent({
        email: String(data?.invitation?.email ?? ""),
        expiresAt: String(data?.invitation?.expiresAt ?? ""),
      });
      await loadSchoolOrganizerInvitations();
    } catch (err) {
      setCreateOrganizerError(
        err instanceof Error ? err.message : "No se pudo reenviar la invitación"
      );
    } finally {
      setResendingInvitationId(null);
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    if (!detail) return;
    const confirmed = window.confirm("¿Querés cancelar esta invitación?");
    if (!confirmed) return;
    setCancellingInvitationId(invitationId);
    setCreateOrganizerError(null);
    try {
      const res = await fetch(
        `/api/admin/schools/${detail.school.id}/organizers/invite/${invitationId}/cancel`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo cancelar la invitación");
      }
      await loadSchoolOrganizerInvitations();
    } catch (err) {
      setCreateOrganizerError(
        err instanceof Error ? err.message : "No se pudo cancelar la invitación"
      );
    } finally {
      setCancellingInvitationId(null);
    }
  }

  function startEditingAlbum(album: AlbumRow) {
    setAlbumSaveError(null);
    setEditingAlbumId(album.id);
    setAlbumConfigForm(buildAlbumConfigFormState(album));
  }

  function cancelEditingAlbum() {
    setEditingAlbumId(null);
    setAlbumConfigForm(null);
    setAlbumSaveError(null);
  }

  async function handleSaveAlbumConfig() {
    if (!editingAlbumId || !albumConfigForm || !detail) return;
    const currentAlbum = detail.albums.find((album) => album.id === editingAlbumId);
    if (!currentAlbum) return;
    setAlbumSaveLoading(true);
    setAlbumSaveError(null);
    try {
      const nextSchoolId =
        albumConfigForm.schoolId.trim() === "" ? null : Number(albumConfigForm.schoolId);
      const payload = {
        title: albumConfigForm.title,
        publicSlug: albumConfigForm.publicSlug,
        eventDate: albumConfigForm.eventDate || null,
        schoolId: nextSchoolId,
        isTest: albumConfigForm.isTest,
        studentIdentificationMode:
          albumConfigForm.studentIdentificationMode.trim() === ""
            ? null
            : albumConfigForm.studentIdentificationMode,
        allowManualStudentFallback: albumConfigForm.allowManualStudentFallback,
        organizerCommissionEnabled: albumConfigForm.organizerCommissionEnabled,
        organizerCommissionPercentage:
          albumConfigForm.organizerCommissionPercentage.trim() === ""
            ? null
            : Number(albumConfigForm.organizerCommissionPercentage),
        organizerCommissionAppliesTo: albumConfigForm.organizerCommissionAppliesTo,
      };

      const res = await fetch(`/api/admin/albums/${editingAlbumId}/school-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo actualizar la configuración del álbum");
      }

      await loadDetail();
      cancelEditingAlbum();
    } catch (err) {
      setAlbumSaveError(
        err instanceof Error ? err.message : "No se pudo actualizar la configuración"
      );
    } finally {
      setAlbumSaveLoading(false);
    }
  }

  function startEditingPack(pack: PackRow) {
    if (pack.source !== "PACK_DEFINITION") return;
    setPackSaveError(null);
    setEditingPackId(pack.id);
    setPackForm(buildPackFormState(pack));
  }

  function cancelEditingPack() {
    setEditingPackId(null);
    setPackForm(null);
    setPackSaveError(null);
  }

  async function handleSavePack(pack: PackRow) {
    if (!packForm || pack.source !== "PACK_DEFINITION") return;
    setPackSaveLoading(true);
    setPackSaveError(null);
    try {
      const payload: Record<string, unknown> = {
        isActive: packForm.isActive,
        validUntil: packForm.validUntil || null,
      };
      if (!pack.inUse) {
        payload.name = packForm.name;
        payload.description = packForm.description || null;
        payload.priceClientArs = Number(packForm.priceClientArs);
        payload.availabilityPhase = packForm.availabilityPhase || null;
        payload.validFrom = packForm.validFrom || null;
      }

      const res = await fetch(`/api/admin/packs/${pack.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo actualizar el pack");
      }
      await loadDetail();
      cancelEditingPack();
    } catch (err) {
      setPackSaveError(err instanceof Error ? err.message : "No se pudo actualizar el pack");
    } finally {
      setPackSaveLoading(false);
    }
  }

  function startCreateStudent() {
    setStudentSaveError(null);
    setEditingStudentHasSensitiveRelations(false);
    setStudentFormMode("create");
    setStudentForm(buildStudentFormState());
  }

  function startEditStudent(student: StudentRow) {
    setStudentSaveError(null);
    setEditingStudentHasSensitiveRelations(student.hasSensitiveRelations);
    setStudentFormMode("edit");
    setStudentForm(buildStudentFormState(student));
  }

  function cancelStudentForm() {
    setStudentFormMode(null);
    setStudentForm(null);
    setStudentSaveError(null);
    setEditingStudentHasSensitiveRelations(false);
  }

  async function handleSaveStudent() {
    if (!detail || !schoolId || !studentForm || !studentFormMode) return;
    setStudentSaveLoading(true);
    setStudentSaveError(null);
    try {
      const payload = {
        firstName: studentForm.firstName,
        lastName: studentForm.lastName,
        level: studentForm.level,
        course: studentForm.course,
        division: studentForm.division,
        shift: studentForm.shift,
        notes: studentForm.notes || null,
        albumId: studentForm.albumId || null,
        rosterEntryId: studentForm.rosterEntryId ?? null,
      };

      let res: Response;
      if (studentFormMode === "create") {
        res = await fetch(`/api/admin/schools/${schoolId}/students`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      } else {
        if (!studentForm.studentId) {
          throw new Error("No se encontró el ID del alumno para editar");
        }
        res = await fetch(`/api/admin/students/${studentForm.studentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar el alumno");
      }
      await loadDetail();
      cancelStudentForm();
    } catch (err) {
      setStudentSaveError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setStudentSaveLoading(false);
    }
  }

  async function handleDeleteStudent(student: StudentRow) {
    if (!confirm(`¿Eliminar el alumno "${student.firstName} ${student.lastName}"?`)) return;
    setDeletingStudentId(student.studentId);
    try {
      const res = await fetch(`/api/admin/students/${student.studentId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo eliminar el alumno");
      }
      await loadDetail();
      if (studentForm?.studentId === student.studentId) {
        cancelStudentForm();
      }
    } catch (err) {
      setStudentSaveError(err instanceof Error ? err.message : "No se pudo eliminar");
    } finally {
      setDeletingStudentId(null);
    }
  }

  async function handleImportStudents() {
    if (!detail || !schoolId) return;
    if (detail.albums.length === 0) {
      setImportError("Primero necesitás asociar o crear un álbum escolar para importar alumnos.");
      return;
    }
    if (!importAlbumId) {
      setImportError("Seleccioná un álbum para continuar.");
      return;
    }
    if (!importFile && !importCsvText.trim()) {
      setImportError("Seleccioná un archivo CSV/Excel o pegá el contenido CSV para importar.");
      return;
    }

    const selectedAlbum = detail.albums.find((album) => String(album.id) === importAlbumId);
    if (!selectedAlbum) {
      setImportError("El álbum seleccionado no pertenece a esta escuela.");
      return;
    }

    setImportLoading(true);
    setImportError(null);
    setImportSummary(null);
    try {
      const endpoint = `/api/admin/albums/${selectedAlbum.id}/student-roster/import?schoolId=${schoolId}`;
      let res: Response;
      if (importFile) {
        const formData = new FormData();
        formData.append("file", importFile);
        res = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      } else {
        res = await fetch(endpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv: importCsvText }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo importar alumnos");
      }
      setImportSummary({
        totalRows: Number(data.totalRows) || Number((data as { total?: unknown }).total) || 0,
        createdCount:
          Number((data as { studentsCreated?: unknown }).studentsCreated) ||
          Number(data.createdCount) ||
          0,
        updatedCount:
          Number((data as { studentsReused?: unknown }).studentsReused) ||
          Number(data.updatedCount) ||
          0,
        skippedCount: Number(data.skippedCount) || Number((data as { skipped?: unknown }).skipped) || 0,
        errorCount: Number(data.errorCount) || Number((data as { errors?: unknown }).errors) || 0,
        enrollmentsCreated: Number((data as { enrollmentsCreated?: unknown }).enrollmentsCreated) || undefined,
        enrollmentsReused: Number((data as { enrollmentsReused?: unknown }).enrollmentsReused) || undefined,
        rosterLinksCreated: Number((data as { rosterLinksCreated?: unknown }).rosterLinksCreated) || undefined,
        rosterLinksUpdated: Number((data as { rosterLinksUpdated?: unknown }).rosterLinksUpdated) || undefined,
        duplicateDniWarnings: Number((data as { duplicateDniMatches?: unknown }).duplicateDniMatches) || undefined,
        rosterSkippedDueToOrders:
          Number((data as { rosterLinksSkippedDueToOrders?: unknown }).rosterLinksSkippedDueToOrders) || undefined,
        rosterSkippedManual:
          Number((data as { rosterLinksSkippedManual?: unknown }).rosterLinksSkippedManual) || undefined,
        rowErrors: Array.isArray(data.rowErrors)
          ? data.rowErrors
              .map((item: { rowNumber?: unknown; message?: unknown }) => ({
                rowNumber: Number(item?.rowNumber) || 0,
                message:
                  typeof item?.message === "string" && item.message.trim()
                    ? item.message
                    : "Error en fila",
              }))
              .filter((item: { rowNumber: number; message: string }) => item.rowNumber > 0)
          : [],
      });
      setImportFile(null);
      setImportCsvText("");
      await loadDetail();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "No se pudo importar alumnos");
    } finally {
      setImportLoading(false);
    }
  }

  function handleConfigureStudentIdentificationNow(alertCode: string) {
    if (!detail) return;
    const albumId = getAlbumIdFromIdentModeDiagnostic(alertCode);
    if (!albumId) return;
    const album = detail.albums.find((item) => item.id === albumId);
    if (!album) return;
    setActiveTab("albumes");
    startEditingAlbum(album);
    setPendingFocusStudentIdentificationAlbumId(albumId);
  }

  function handleOpenPackFromDiagnostic(
    packId: number,
    focusField: "name" | "availabilityPhase" | "validUntil" = "name"
  ) {
    if (!detail) return;
    const pack = detail.packs.find((item) => item.id === packId);
    if (!pack || pack.source !== "PACK_DEFINITION") return;
    setActiveTab("albumes");
    setPendingFocusPackId(packId);
    setPendingFocusPackField(focusField);
    startEditingPack(pack);
  }

  function handleCreatePackFromDiagnostic(albumId: number) {
    setActiveTab("albumes");
    router.push(`/admin/albums?albumId=${albumId}`);
  }

  function handleOpenAlbumFromDiagnostic(albumId: number) {
    if (!detail) return;
    const album = detail.albums.find((item) => item.id === albumId);
    if (!album) return;
    setActiveTab("albumes");
    setPendingFocusAlbumConfigAlbumId(albumId);
    startEditingAlbum(album);
  }

  function closeOrderDetail() {
    setSelectedOrderId(null);
    setSelectedOrderDetail(null);
    setOrderDetailError(null);
    setOrderDetailLoading(false);
  }

  function handleOrderDiagnosticAction(code: string) {
    if (!selectedOrderDetail || !selectedOrderId) return;
    if (code === "manual_student_source") {
      setActiveTab("alumnos");
      closeOrderDetail();
      const studentId = selectedOrderDetail.student.studentId;
      if (!studentId || !detail) return;
      const student = detail.students.find((item) => item.studentId === studentId);
      if (!student) return;
      setStudentSearch(`${student.firstName} ${student.lastName}`.trim());
      startEditStudent(student);
      return;
    }

    if (code === "inactive_or_missing_pack") {
      const packId = selectedOrderDetail.items.find((item) => item.pack != null)?.pack?.id;
      if (!packId) return;
      closeOrderDetail();
      handleOpenPackFromDiagnostic(packId);
      return;
    }

    if (code === "without_pending_selection") {
      router.push(`/admin/pedidos/${selectedOrderId}`);
    }
  }

  async function openOrderDetail(orderId: number) {
    setSelectedOrderId(orderId);
    setOrderDetailLoading(true);
    setOrderDetailError(null);
    setSelectedOrderDetail(null);
    try {
      const res = await fetch(`/api/admin/precompra-orders/${orderId}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo cargar el detalle del pedido");
      }
      setSelectedOrderDetail(data as OrderDetailResponse);
    } catch (err) {
      setOrderDetailError(
        err instanceof Error ? err.message : "No se pudo cargar el detalle del pedido"
      );
    } finally {
      setOrderDetailLoading(false);
    }
  }

  const studentsFiltered = useMemo(() => {
    if (!detail) return [];
    let rows = detail.students;
    if (studentFilterCourse.trim()) rows = rows.filter((s) => s.course === studentFilterCourse);
    if (studentFilterDivision.trim()) rows = rows.filter((s) => s.division === studentFilterDivision);
    if (studentFilterShift.trim()) rows = rows.filter((s) => s.shift === studentFilterShift);

    const q = studentSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return (
        fullName.includes(q) ||
        student.level.toLowerCase().includes(q) ||
        student.course.toLowerCase().includes(q) ||
        student.division.toLowerCase().includes(q) ||
        student.shift.toLowerCase().includes(q)
      );
    });
  }, [
    detail,
    studentSearch,
    studentFilterCourse,
    studentFilterDivision,
    studentFilterShift,
  ]);

  const albumTitleById = useMemo(() => {
    const map = new Map<number, string>();
    if (!detail) return map;
    for (const album of detail.albums) {
      map.set(album.id, album.title);
    }
    return map;
  }, [detail]);

  const schoolOrganizerActiveCount = useMemo(
    () => schoolOrganizers.filter((o) => o.status === "ACTIVE").length,
    [schoolOrganizers]
  );

  const detailTabs = useMemo(
    () => [
      {
        id: "institucion",
        label: "Datos de la institución",
        icon: <Building2 className="h-4 w-4" aria-hidden />,
      },
      { id: "usuarios", label: "Usuarios", icon: <Users className="h-4 w-4" aria-hidden /> },
      {
        id: "alumnos",
        label: "Alumnos",
        icon: <GraduationCap className="h-4 w-4" aria-hidden />,
      },
      { id: "albumes", label: "Álbumes", icon: <Images className="h-4 w-4" aria-hidden /> },
      {
        id: "comisiones",
        label: "Comisiones",
        icon: <Wallet className="h-4 w-4" aria-hidden />,
      },
    ],
    []
  );

  const currentEditingAlbum = useMemo(() => {
    if (!detail || editingAlbumId == null) return null;
    return detail.albums.find((album) => album.id === editingAlbumId) || null;
  }, [detail, editingAlbumId]);

  const currentEditingPack = useMemo(() => {
    if (!detail || editingPackId == null) return null;
    return detail.packs.find((pack) => pack.id === editingPackId) || null;
  }, [detail, editingPackId]);

  const hasAlbumsOwnedByDifferentPhotographer = useMemo(() => {
    if (!detail || !selectedOwnerUser) return false;
    return detail.albums.some((album) => album.ownerUser.id !== selectedOwnerUser.id);
  }, [detail, selectedOwnerUser]);

  const isSchoolOwnerChanged = useMemo(() => {
    if (!detail || !selectedOwnerUser) return false;
    return selectedOwnerUser.id !== detail.school.owner.id;
  }, [detail, selectedOwnerUser]);

  const isChangingSchoolAssociation = useMemo(() => {
    if (!currentEditingAlbum || !albumConfigForm) return false;
    const nextSchoolId =
      albumConfigForm.schoolId.trim() === "" ? null : Number(albumConfigForm.schoolId);
    return nextSchoolId !== currentEditingAlbum.schoolId;
  }, [currentEditingAlbum, albumConfigForm]);

  const schoolOptionsForSelect = useMemo(() => {
    const map = new Map<number, SchoolOption>();
    for (const option of schoolOptions) {
      map.set(option.id, option);
    }
    if (detail?.school?.id && !map.has(detail.school.id)) {
      map.set(detail.school.id, { id: detail.school.id, name: detail.school.name });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [schoolOptions, detail]);

  const diagnosticsFilteredAndGrouped = useMemo(() => {
    if (!detail) {
      return {
        configuracion: [] as DiagnosticAlert[],
        packs: [] as DiagnosticAlert[],
        pedidos: [] as DiagnosticAlert[],
      };
    }
    const filtered = detail.diagnostics.filter(
      (alert) => diagnosticsSeverityFilter === "all" || alert.severity === diagnosticsSeverityFilter
    );
    return {
      configuracion: filtered.filter((alert) => getDiagnosticCategory(alert.code) === "configuracion"),
      packs: filtered.filter((alert) => getDiagnosticCategory(alert.code) === "packs"),
      pedidos: filtered.filter((alert) => getDiagnosticCategory(alert.code) === "pedidos"),
    };
  }, [detail, diagnosticsSeverityFilter]);

  if (loading && !detail) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Cargando detalle de escuela...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-red-700">{error}</p>
        <Button variant="secondary" onClick={() => void loadDetail()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!detail) {
    return <p className="text-gray-600">No se encontró información de la escuela.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/escuelas" className="text-sm text-[#c27b3d] hover:underline">
          ← Volver a escuelas
        </Link>
        <div className="flex items-center gap-3">
          {detail.school.logoUrl ? (
            <div className="h-12 w-12 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detail.school.logoUrl}
                alt={`Logo ${detail.school.name}`}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-xl border border-gray-200 bg-gray-100" />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{detail.school.name}</h1>
        </div>
        <p className="text-gray-600">Detalle operativo en modo solo lectura para ADMIN.</p>
      </div>

      <Card className="p-0">
        <Tabs tabs={detailTabs} activeTab={activeTab} onTabChange={setActiveTab} stickyTabBar contentClassName="p-5 md:p-8 space-y-8">
                    {activeTab === "institucion" && (
            <SchoolInstitutionTab
              detail={detail}
              schoolOrganizerActiveCount={schoolOrganizerActiveCount}
              isEditingSchool={isEditingSchool}
              schoolForm={schoolForm}
              schoolSaveError={schoolSaveError}
              schoolSaveLoading={schoolSaveLoading}
              setSchoolSaveError={setSchoolSaveError}
              setIsEditingSchool={setIsEditingSchool}
              setSchoolForm={setSchoolForm}
              handleSaveSchool={handleSaveSchool}
              buildSchoolFormState={buildSchoolFormState}
              isEditingSchoolOwner={isEditingSchoolOwner}
              startEditingSchoolOwner={startEditingSchoolOwner}
              cancelEditingSchoolOwner={cancelEditingSchoolOwner}
              ownerSearchQuery={ownerSearchQuery}
              setOwnerSearchQuery={setOwnerSearchQuery}
              ownerSearchResults={ownerSearchResults}
              ownerSearchLoading={ownerSearchLoading}
              ownerSearchError={ownerSearchError}
              selectedOwnerUser={selectedOwnerUser}
              setSelectedOwnerUser={setSelectedOwnerUser}
              ownerSaveLoading={ownerSaveLoading}
              ownerSaveError={ownerSaveError}
              handleSaveSchoolOwner={handleSaveSchoolOwner}
              hasAlbumsOwnedByDifferentPhotographer={hasAlbumsOwnedByDifferentPhotographer}
              isSchoolOwnerChanged={isSchoolOwnerChanged}
              diagnostics={{
                diagnosticsSeverityFilter,
                setDiagnosticsSeverityFilter,
                diagnosticsFilteredAndGrouped,
                handleConfigureStudentIdentificationNow,
                handleOpenPackFromDiagnostic,
                handleOpenAlbumFromDiagnostic,
                handleCreatePackFromDiagnostic,
                openOrderDetail,
              }}
            />
          )}

          {activeTab === "usuarios" && (
            <SchoolUsersTab
              organizersError={organizersError}
              schoolOrganizers={schoolOrganizers}
              organizersLoading={organizersLoading}
              isCreatingOrganizerUser={isCreatingOrganizerUser}
              setIsCreatingOrganizerUser={setIsCreatingOrganizerUser}
              createOrganizerForm={createOrganizerForm}
              setCreateOrganizerForm={setCreateOrganizerForm}
              createOrganizerError={createOrganizerError}
              createOrganizerLoading={createOrganizerLoading}
              handleInviteSchoolOrganizerUser={handleInviteSchoolOrganizerUser}
              lastInvitationSent={lastInvitationSent}
              organizerSearch={organizerSearch}
              setOrganizerSearch={setOrganizerSearch}
              organizerCandidates={organizerCandidates}
              organizerSearchLoading={organizerSearchLoading}
              selectedOrganizerUserId={selectedOrganizerUserId}
              setSelectedOrganizerUserId={setSelectedOrganizerUserId}
              organizerSaveLoading={organizerSaveLoading}
              handleAddSchoolOrganizer={handleAddSchoolOrganizer}
              handleRemoveSchoolOrganizer={handleRemoveSchoolOrganizer}
              removingOrganizerId={removingOrganizerId}
              organizerInvitations={organizerInvitations}
              handleResendInvitation={handleResendInvitation}
              resendingInvitationId={resendingInvitationId}
              handleCancelInvitation={handleCancelInvitation}
              cancellingInvitationId={cancellingInvitationId}
            />
          )}


          {activeTab === "albumes" && (
            <SchoolAlbumsTab
              detail={detail}
              albumListFilter={albumListFilter}
              setAlbumListFilter={setAlbumListFilter}
              schoolOptionsForSelect={schoolOptionsForSelect}
              editingAlbumId={editingAlbumId}
              albumConfigForm={albumConfigForm}
              setAlbumConfigForm={setAlbumConfigForm}
              albumSaveError={albumSaveError}
              albumSaveLoading={albumSaveLoading}
              isChangingSchoolAssociation={isChangingSchoolAssociation}
              startEditingAlbum={startEditingAlbum}
              cancelEditingAlbum={cancelEditingAlbum}
              handleSaveAlbumConfig={handleSaveAlbumConfig}
              editingPackId={editingPackId}
              packForm={packForm}
              setPackForm={setPackForm}
              packSaveError={packSaveError}
              packSaveLoading={packSaveLoading}
              currentEditingPack={currentEditingPack}
              startEditingPack={startEditingPack}
              cancelEditingPack={cancelEditingPack}
              handleSavePack={handleSavePack}
              openOrderDetail={openOrderDetail}
              orderDetailLoading={orderDetailLoading}
              selectedOrderId={selectedOrderId}
            />
          )}

          {activeTab === "alumnos" && (
            <SchoolStudentsTab
              detail={detail}
              importAlbumId={importAlbumId}
              setImportAlbumId={setImportAlbumId}
              importFile={importFile}
              setImportFile={setImportFile}
              importCsvText={importCsvText}
              setImportCsvText={setImportCsvText}
              importLoading={importLoading}
              importError={importError}
              importSummary={importSummary}
              setImportSummary={setImportSummary}
              handleImportStudents={handleImportStudents}
              studentSearch={studentSearch}
              setStudentSearch={setStudentSearch}
              studentFilterCourse={studentFilterCourse}
              setStudentFilterCourse={setStudentFilterCourse}
              studentFilterDivision={studentFilterDivision}
              setStudentFilterDivision={setStudentFilterDivision}
              studentFilterShift={studentFilterShift}
              setStudentFilterShift={setStudentFilterShift}
              studentsFiltered={studentsFiltered}
              studentPage={studentPage}
              setStudentPage={setStudentPage}
              studentPageSize={studentPageSize}
              albumTitleById={albumTitleById}
              studentFormMode={studentFormMode}
              studentForm={studentForm}
              setStudentForm={setStudentForm}
              studentSaveError={studentSaveError}
              studentSaveLoading={studentSaveLoading}
              editingStudentHasSensitiveRelations={editingStudentHasSensitiveRelations}
              startCreateStudent={startCreateStudent}
              cancelStudentForm={cancelStudentForm}
              handleSaveStudent={handleSaveStudent}
              startEditStudent={startEditStudent}
              handleDeleteStudent={handleDeleteStudent}
              deletingStudentId={deletingStudentId}
            />
          )}

          {activeTab === "comisiones" && schoolId ? <SchoolCommissionsTab schoolId={schoolId} /> : null}
        </Tabs>
      </Card>

      {selectedOrderId != null ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 md:p-8">
          <div className="w-full max-w-6xl rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 md:px-6">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Soporte de pedido</p>
                <h3 className="text-lg font-semibold text-gray-900">
                  Pedido #{selectedOrderId}
                </h3>
              </div>
              <Button variant="secondary" size="sm" onClick={closeOrderDetail}>
                Cerrar
              </Button>
            </div>

            <div className="max-h-[80vh] overflow-y-auto p-4 md:p-6">
              {orderDetailLoading ? (
                <p className="text-sm text-gray-600">Cargando detalle del pedido...</p>
              ) : orderDetailError ? (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {orderDetailError}
                </p>
              ) : selectedOrderDetail ? (
                <div className="space-y-4">
                  <Card className="p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Resumen
                    </h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <p className="text-xs text-gray-500">Estado de pago</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.order.paymentStatus}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="text-sm text-gray-900">
                          {formatCurrencyArs(selectedOrderDetail.order.total)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Fecha</p>
                        <p className="text-sm text-gray-900">
                          {formatDateTime(selectedOrderDetail.order.createdAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">checkoutPaymentSource</p>
                        <p className="text-sm text-gray-900">
                          {selectedOrderDetail.order.checkoutPaymentSource || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">preCompraPaymentRef</p>
                        <p className="text-sm text-gray-900">
                          {selectedOrderDetail.order.preCompraPaymentRef || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Pedido test</p>
                        <p className="text-sm text-gray-900">
                          {selectedOrderDetail.order.isTest ? "Sí" : "No"}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Cliente
                    </h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <p className="text-xs text-gray-500">Nombre</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.client.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Email</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.client.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">WhatsApp / Teléfono</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.client.phone || "—"}</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Alumno
                    </h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-gray-500">Nombre</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.student.fullName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Nivel</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.student.level || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Curso / División</p>
                        <p className="text-sm text-gray-900">
                          {selectedOrderDetail.student.course || "—"} /{" "}
                          {selectedOrderDetail.student.division || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Turno</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.student.shift || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">studentId</p>
                        <p className="text-sm text-gray-900">
                          {selectedOrderDetail.student.studentId ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">albumRosterEntryId</p>
                        <p className="text-sm text-gray-900">
                          {selectedOrderDetail.student.albumRosterEntryId ?? "—"}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs text-gray-500">Origen del alumno</p>
                        <p className="text-sm text-gray-900">
                          {selectedOrderDetail.student.studentSourceType || "—"}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Álbum / Escuela
                    </h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-gray-500">Escuela</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.school.name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">schoolId</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.school.schoolId ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Álbum</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.album.title}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">albumId</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.album.albumId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">publicSlug</p>
                        <p className="text-sm text-gray-900">{selectedOrderDetail.album.publicSlug || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Álbum test</p>
                        <p className="text-sm text-gray-900">
                          {selectedOrderDetail.album.isTest ? "Sí" : "No"}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Items
                    </h4>
                    <div className="space-y-3">
                      {selectedOrderDetail.items.length === 0 ? (
                        <p className="text-sm text-gray-600">Sin items.</p>
                      ) : (
                        selectedOrderDetail.items.map((item) => (
                          <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                              <div>
                                <p className="text-xs text-gray-500">Item</p>
                                <p className="text-sm text-gray-900">#{item.id}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Pack / Producto</p>
                                <p className="text-sm text-gray-900">
                                  {item.pack?.name || item.product?.name || "Sin referencia"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Cantidad</p>
                                <p className="text-sm text-gray-900">{item.quantity}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Precio</p>
                                <p className="text-sm text-gray-900">{formatCurrencyArs(item.price)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">lineOrigin / Estado</p>
                                <p className="text-sm text-gray-900">
                                  {item.lineOrigin || "—"} / {item.status}
                                </p>
                              </div>
                            </div>
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-medium text-gray-600">
                                Snapshots (solo lectura)
                              </summary>
                              <div className="mt-2 space-y-2">
                                <p className="text-xs text-gray-600">
                                  Alumno snapshot:{" "}
                                  {`${item.snapshots.student.firstName || "—"} ${
                                    item.snapshots.student.lastName || ""
                                  }`.trim()}
                                  , {item.snapshots.student.course || "—"} /{" "}
                                  {item.snapshots.student.division || "—"}, turno{" "}
                                  {item.snapshots.student.shift || "—"}, nivel{" "}
                                  {item.snapshots.student.level || "—"}.
                                </p>
                                <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                                  {JSON.stringify(
                                    {
                                      packPurchase: item.snapshots.packPurchase,
                                      redeemOrderPackSnapshot: item.snapshots.redeemOrderPackSnapshot,
                                      redemptionOrderLineOrigins:
                                        item.snapshots.redemptionOrderLineOrigins,
                                    },
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            </details>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Selección de fotos
                    </h4>
                    <p className="text-sm text-gray-700">
                      {selectedOrderDetail.selection.hasSelection ? "Sí" : "No"} | Cantidad:{" "}
                      {selectedOrderDetail.selection.selectedPhotosCount}
                    </p>
                    {selectedOrderDetail.selection.selectedPhotos.length > 0 ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {selectedOrderDetail.selection.selectedPhotos.map((photo) => (
                          <div
                            key={photo.selectionPhotoId}
                            className="rounded border border-gray-200 px-3 py-2 text-xs text-gray-700"
                          >
                            Foto #{photo.photoId} | Item #{photo.orderItemId} | Posición{" "}
                            {photo.position ?? "—"} | Rol {photo.role || "—"}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Card>

                  <Card className="p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Diseño
                    </h4>
                    <p className="text-sm text-gray-700">
                      {selectedOrderDetail.design.hasDesignProject
                        ? "Hay proyecto(s) de diseño asociado(s)."
                        : "No hay proyectos de diseño asociados."}
                    </p>
                    {selectedOrderDetail.design.projects.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {selectedOrderDetail.design.projects.map((project) => (
                          <div
                            key={project.projectId}
                            className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-700"
                          >
                            Proyecto #{project.projectId} | Item #{project.orderItemId} | Estado{" "}
                            {project.status} | previewUrl: {project.previewUrl || "—"} | exportUrl:{" "}
                            {project.exportUrl || "—"}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Card>

                  <Card className="p-4">
                    <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                      Diagnóstico
                    </h4>
                    {selectedOrderDetail.diagnostics.length === 0 ? (
                      <p className="text-sm text-emerald-800">No se detectaron inconsistencias.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedOrderDetail.diagnostics.map((diag) => (
                          <div
                            key={diag.code}
                            className={`rounded px-3 py-2 text-sm ${
                              diag.severity === "error"
                                ? "border border-red-200 bg-red-50 text-red-800"
                                : "border border-amber-200 bg-amber-50 text-amber-800"
                            }`}
                          >
                            <p>{diag.message}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {diag.code === "manual_student_source" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleOrderDiagnosticAction(diag.code)}
                                >
                                  Ir a alumno
                                </Button>
                              ) : null}
                              {diag.code === "inactive_or_missing_pack" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleOrderDiagnosticAction(diag.code)}
                                >
                                  Ir a pack
                                </Button>
                              ) : null}
                              {diag.code === "without_pending_selection" ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleOrderDiagnosticAction(diag.code)}
                                >
                                  Ir al pedido
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              ) : (
                <p className="text-sm text-gray-600">No hay datos para mostrar.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
