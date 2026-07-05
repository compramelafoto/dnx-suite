"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Card from "@/components/ui/Card";
import AppModal from "@/components/ui/AppModal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  availabilityPhaseOptions,
  packTypeOptions,
} from "@/lib/album-packs/album-pack-options";
import {
  getAlbumPackPresetsByMode,
  type AlbumModeValue,
  type AlbumPackPreset,
} from "@/lib/album-packs/album-pack-presets";
import {
  ALBUM_PACK_QUANTITY_MODE_HELP,
  encodePackDescriptionWithQty,
} from "@/lib/album-packs/album-pack-quantity-mode";
import { formatARS } from "@/lib/lab/helpers";
import { feeFromBase, totalFromBase } from "@/lib/pricing/fee-formula";
import { MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING } from "@/lib/events/collaborative-event-pricing-lock";
import { Image as ImageIcon, Folder } from "lucide-react";
import { isPreventaUxV2EnabledClient } from "@/lib/preventa-canjeable/preventa-ux-v2-feature-flag";
import {
  ALBUM_PACK_PRODUCT_COMPOSITION_HELP,
  buildComponentsPayloadFromForm,
  inferProductCompositionFromComponents,
  validateAlbumPackDashboardProductFields,
  type AlbumPackProductComposition,
} from "@/lib/album-packs/album-pack-dashboard-form";

type TemplateOption = {
  id: number;
  name: string;
  albumId?: number | null;
  imageUrl?: string;
};

type TemplateV2Option = {
  id: string;
  name: string;
};

type TemplateV2Card = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  preview: { width: number; height: number; background: string | null };
  kind: "owned" | "catalog";
};

type PhotographerProductOption = {
  id: number;
  name: string;
  size: string | null;
  acabado: string | null;
  isActive?: boolean;
};

type AlbumPackComponentApi = {
  id: string;
  kind: "DIGITAL" | "PRINT" | "DESIGN_PRODUCT";
  sortOrder: number;
  unitsPerSelection: number;
  photographerProductId: number | null;
  productName?: string | null;
  size?: string | null;
  finish?: string | null;
};

type AlbumPack = {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl?: string | null;
  price: number;
  includedPhotoCount: number | null;
  requiresSelection: boolean;
  requiresDesign: boolean;
  templateId: number | null;
  templateV2Id?: string | null;
  availabilityPhase: (typeof availabilityPhaseOptions)[number]["value"];
  packType: (typeof packTypeOptions)[number]["value"];
  isActive: boolean;
  components?: AlbumPackComponentApi[];
  compositionFulfillmentKind?: "DIGITAL" | "PRINT" | "MIXED";
  template?: TemplateOption | null;
  templateV2?: TemplateV2Option | null;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  name: string;
  description: string;
  price: string;
  includedPhotoCount: string;
  requiresSelection: boolean;
  requiresDesign: boolean;
  /** Plantilla clásica (imagen + recuadros); vacío si elegís plantilla del nuevo editor. */
  templateId: string;
  templateV2Id: string;
  availabilityPhase: (typeof availabilityPhaseOptions)[number]["value"];
  packType: (typeof packTypeOptions)[number]["value"];
  /** Qué vendés: digital, impresiones o mixto (distinto del modo de selección). */
  productComposition: AlbumPackProductComposition;
  photographerProductId: string;
  isActive: boolean;
};

const defaultFormState: FormState = {
  name: "",
  description: "",
  price: "",
  includedPhotoCount: "",
  requiresSelection: false,
  requiresDesign: false,
  templateId: "",
  templateV2Id: "",
  availabilityPhase: "ALWAYS",
  packType: "DIGITAL",
  productComposition: "DIGITAL",
  photographerProductId: "",
  isActive: true,
};

function parsePackPriceWhole(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Math.round(parseFloat(trimmed.replace(",", ".")));
  return Number.isFinite(n) ? n : null;
}

function deriveAvailability(draft: FormState): FormState["availabilityPhase"] {
  if (draft.requiresSelection || draft.requiresDesign || draft.packType === "PRINT") return "POST_UPLOAD";
  return "ALWAYS";
}

function deriveDefaultName(draft: FormState): string {
  if (draft.packType === "SCHOOL_FOLDER" && draft.requiresDesign) {
    const n = draft.includedPhotoCount.trim();
    return n ? `Carpeta escolar ${n} fotos` : "Carpeta escolar";
  }
  if (draft.productComposition === "MIXED") {
    const n = draft.includedPhotoCount.trim();
    return n ? `Pack mixto ${n} fotos` : "Pack mixto digital + impresión";
  }
  if (draft.productComposition === "PRINT" || draft.packType === "PRINT") {
    const n = draft.includedPhotoCount.trim();
    return n ? `Pack ${n} impresiones` : "Pack de impresiones";
  }
  if (draft.packType === "DIGITAL") {
    if (draft.requiresSelection) {
      const n = draft.includedPhotoCount.trim();
      return n ? `Pack digital ${n} fotos` : "Pack digital con selección";
    }
    return "Pack digital";
  }
  return "Pack";
}

function formatPhotographerProductLabel(product: PhotographerProductOption): string {
  const size = product.size?.trim();
  const finish = product.acabado?.trim();
  const suffix = [size, finish].filter(Boolean).join(" · ");
  return suffix ? `${product.name} (${suffix})` : product.name;
}

type ModalKind = {
  presetId?: string | null;
  preset?: AlbumPackPreset | null;
} | null;

export default function AlbumPacksSection({
  albumId,
  active,
  albumMode,
  albumPackPayEnabled,
  onAlbumPackPayEnabledChange,
  eventOfficialDigitalAlbumPricing = false,
}: {
  albumId: number;
  active: boolean;
  albumMode: AlbumModeValue;
  albumPackPayEnabled?: boolean;
  onAlbumPackPayEnabledChange?: (next: boolean) => void;
  /** Evento colaborativo con precio digital oficial: no crear/editar/borrar packs digitales del fotógrafo. */
  eventOfficialDigitalAlbumPricing?: boolean;
}) {
  const [packs, setPacks] = useState<AlbumPack[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templatesV2Owned, setTemplatesV2Owned] = useState<TemplateV2Card[]>([]);
  const [templatesV2Catalog, setTemplatesV2Catalog] = useState<TemplateV2Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FormState>(defaultFormState);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [modalPresetMeta, setModalPresetMeta] = useState<ModalKind>(null);
  const uxV2 = isPreventaUxV2EnabledClient();
  const [platformCommissionPercent, setPlatformCommissionPercent] = useState<number | null>(null);
  const [templateV2PickTab, setTemplateV2PickTab] = useState<"owned" | "catalog">("owned");
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState<TemplateV2Card | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneSaving, setCloneSaving] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [photographerProducts, setPhotographerProducts] = useState<PhotographerProductOption[]>([]);
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const inlineCoverInputRef = useRef<HTMLInputElement>(null);
  const [inlineCoverPackId, setInlineCoverPackId] = useState<string | null>(null);
  const [inlineCoverUploadingId, setInlineCoverUploadingId] = useState<string | null>(null);

  const editingPack = useMemo(
    () => (editingPackId ? packs.find((pack) => pack.id === editingPackId) ?? null : null),
    [editingPackId, packs]
  );

  const coverPreviewObjectUrl = useMemo(() => {
    if (!pendingCoverFile) return null;
    return URL.createObjectURL(pendingCoverFile);
  }, [pendingCoverFile]);

  useEffect(() => {
    return () => {
      if (coverPreviewObjectUrl) URL.revokeObjectURL(coverPreviewObjectUrl);
    };
  }, [coverPreviewObjectUrl]);

  const coverDisplaySrc =
    pendingCoverFile && coverPreviewObjectUrl
      ? coverPreviewObjectUrl
      : !removeCover && editingPack?.coverImageUrl
        ? editingPack.coverImageUrl
        : null;

  function resetCoverDraftState() {
    setPendingCoverFile(null);
    setRemoveCover(false);
    if (coverFileInputRef.current) coverFileInputRef.current.value = "";
  }

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setWizardStep(1);
    setModalPresetMeta(null);
    setEditingPackId(null);
    setDraft(defaultFormState);
    setError(null);
    setTemplateV2PickTab("owned");
    setCloneModalOpen(false);
    setCloneSource(null);
    setCloneName("");
    setCloneSaving(false);
    setCloneError(null);
    resetCoverDraftState();
  }, []);

  const presetBundle = useMemo(() => getAlbumPackPresetsByMode(albumMode), [albumMode]);
  const wizardPresetBundle = useMemo(() => {
    if (!eventOfficialDigitalAlbumPricing) return presetBundle;
    return {
      ...presetBundle,
      presets: presetBundle.presets.filter((p) => p.packType !== "DIGITAL"),
    };
  }, [eventOfficialDigitalAlbumPricing, presetBundle]);
  const presetLockedFields = Boolean(modalPresetMeta?.presetId);
  const templateV2PickCount = templatesV2Owned.length + templatesV2Catalog.length;

  const thumbnailByTemplateV2Id = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of templatesV2Owned) {
      if (c.thumbnailUrl) m.set(c.id, c.thumbnailUrl);
    }
    for (const c of templatesV2Catalog) {
      if (c.thumbnailUrl) m.set(c.id, c.thumbnailUrl);
    }
    return m;
  }, [templatesV2Owned, templatesV2Catalog]);

  const thumbnailByTemplateId = useMemo(() => {
    const m = new Map<number, string>();
    for (const t of templates) {
      if (t.imageUrl) m.set(t.id, t.imageUrl);
    }
    return m;
  }, [templates]);

  /** Alinea el permiso de cobro del álbum con si hay packs activos (un solo lugar para el fotógrafo). */
  const syncAlbumPackPayEnabled = useCallback(
    async (nextPacks: AlbumPack[]) => {
      if (!albumId) return;
      const shouldEnable = nextPacks.some((p) => p.isActive);
      if (shouldEnable === Boolean(albumPackPayEnabled)) return;
      try {
        const res = await fetch(`/api/dashboard/albums/${albumId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ albumPackPayEnabled: shouldEnable }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        onAlbumPackPayEnabledChange?.(Boolean(data.albumPackPayEnabled));
      } catch {
        /* El flag se reintenta en la próxima carga o cambio de pack. */
      }
    },
    [albumId, albumPackPayEnabled, onAlbumPackPayEnabledChange]
  );

  const loadData = useCallback(async () => {
    if (!albumId) return;
    setLoading(true);
    setError(null);
    try {
      const [packsRes, templatesRes] = await Promise.all([
        fetch(`/api/dashboard/albums/${albumId}/packs`, { cache: "no-store" }),
        fetch(`/api/dashboard/albums/${albumId}/templates`, { cache: "no-store" }),
      ]);

      const packsPayload = await packsRes.json().catch(() => ({}));
      if (!packsRes.ok) {
        throw new Error(packsPayload?.error || "No se pudieron cargar los packs");
      }
      const nextPacks = Array.isArray(packsPayload?.packs)
        ? (packsPayload.packs as AlbumPack[])
        : [];
      setPacks(nextPacks);
      await syncAlbumPackPayEnabled(nextPacks);

      const templatesPayload = await templatesRes.json().catch(() => ({}));
      if (templatesRes.ok) {
        const raw = Array.isArray(templatesPayload?.templates)
          ? (templatesPayload.templates as Array<{
              id: number;
              name: string;
              albumId?: number | null;
              imageUrl?: string;
            }>)
          : [];
        setTemplates(
          raw.map((t) => ({
            id: t.id,
            name: t.name,
            albumId: t.albumId ?? null,
            imageUrl: typeof t.imageUrl === "string" ? t.imageUrl : undefined,
          }))
        );
        const rawOwned = Array.isArray(templatesPayload?.templatesV2Owned)
          ? (templatesPayload.templatesV2Owned as TemplateV2Card[])
          : [];
        const rawCatalog = Array.isArray(templatesPayload?.templatesV2Catalog)
          ? (templatesPayload.templatesV2Catalog as TemplateV2Card[])
          : [];
        if (rawOwned.length > 0 || rawCatalog.length > 0) {
          setTemplatesV2Owned(rawOwned);
          setTemplatesV2Catalog(rawCatalog);
        } else {
          const flat = Array.isArray(templatesPayload?.templatesV2)
            ? (templatesPayload.templatesV2 as Array<{ id: string; name: string }>)
            : [];
          setTemplatesV2Owned(
            flat.map((t) => ({
              id: t.id,
              name: t.name,
              thumbnailUrl: null,
              preview: { width: 3, height: 4, background: "#f1f5f9" },
              kind: "owned",
            }))
          );
          setTemplatesV2Catalog([]);
        }
      } else {
        setTemplates([]);
        setTemplatesV2Owned([]);
        setTemplatesV2Catalog([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando packs");
      setPacks([]);
      setTemplates([]);
      setTemplatesV2Owned([]);
      setTemplatesV2Catalog([]);
    } finally {
      setLoading(false);
    }
  }, [albumId, syncAlbumPackPayEnabled]);

  useEffect(() => {
    if (!active) return;
    loadData();
  }, [active, loadData]);

  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    fetch("/api/fotografo/products", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list = Array.isArray(data.products) ? data.products : [];
        setPhotographerProducts(
          list
            .filter((p: PhotographerProductOption) => p.isActive !== false)
            .map((p: PhotographerProductOption) => ({
              id: Number(p.id),
              name: String(p.name ?? ""),
              size: p.size ?? null,
              acabado: p.acabado ?? null,
              isActive: p.isActive !== false,
            }))
            .filter((p: PhotographerProductOption) => Number.isInteger(p.id) && p.id > 0)
        );
      })
      .catch(() => setPhotographerProducts([]));
    return () => {
      cancelled = true;
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    let cancelled = false;
    fetch("/api/dashboard/photographer", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const p = Number(data.platformCommissionPercent);
        if (Number.isFinite(p) && p >= 0 && p <= 100) setPlatformCommissionPercent(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [modalOpen]);

  function openCreateModal() {
    setEditingPackId(null);
    setDraft({ ...defaultFormState, availabilityPhase: "ALWAYS" });
    setModalPresetMeta(null);
    setWizardStep(1);
    resetCoverDraftState();
    setModalOpen(true);
    setError(null);
  }

  function openEditModal(pack: AlbumPack) {
    if (eventOfficialDigitalAlbumPricing && pack.packType === "DIGITAL") {
      setError(MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING);
      return;
    }
    setEditingPackId(pack.id);
    setModalPresetMeta(null);
    const productComposition = inferProductCompositionFromComponents(pack.components);
    const printComponent = pack.components?.find((c) => c.kind === "PRINT");
    setDraft({
      name: pack.name,
      description: pack.description || "",
      price: String(pack.price),
      includedPhotoCount:
        pack.includedPhotoCount != null ? String(pack.includedPhotoCount) : "",
      requiresSelection: pack.requiresSelection,
      requiresDesign: pack.requiresDesign,
      templateId: pack.templateId != null ? String(pack.templateId) : "",
      templateV2Id: pack.templateV2Id?.trim() ? pack.templateV2Id.trim() : "",
      availabilityPhase: pack.availabilityPhase,
      packType: pack.packType,
      productComposition,
      photographerProductId:
        printComponent?.photographerProductId != null
          ? String(printComponent.photographerProductId)
          : "",
      isActive: pack.isActive,
    });
    setWizardStep(4);
    resetCoverDraftState();
    setModalOpen(true);
    setError(null);
  }

  async function uploadPackCoverFile(packId: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/dashboard/albums/${albumId}/packs/${packId}/cover`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        typeof data?.error === "string" ? data.error : "No se pudo subir la imagen del pack"
      );
    }
  }

  async function removePackCover(packId: string) {
    const res = await fetch(`/api/dashboard/albums/${albumId}/packs/${packId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coverImageUrl: null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "No se pudo quitar la imagen del pack");
    }
  }

  async function syncPackCoverAfterSave(packId: string) {
    if (removeCover && !pendingCoverFile) {
      await removePackCover(packId);
    }
    if (pendingCoverFile) {
      await uploadPackCoverFile(packId, pendingCoverFile);
    }
  }

  function startInlineCoverUpload(packId: string) {
    if (inlineCoverUploadingId) return;
    setInlineCoverPackId(packId);
    inlineCoverInputRef.current?.click();
  }

  async function handleInlineCoverFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const packId = inlineCoverPackId;
    e.target.value = "";
    setInlineCoverPackId(null);
    if (!file || !packId) return;

    setInlineCoverUploadingId(packId);
    setError(null);
    setInfo(null);
    try {
      await uploadPackCoverFile(packId, file);
      setInfo("Foto del pack actualizada.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen del pack");
    } finally {
      setInlineCoverUploadingId(null);
    }
  }

  async function handleInlineRemoveCover(packId: string) {
    if (inlineCoverUploadingId) return;
    setInlineCoverUploadingId(packId);
    setError(null);
    setInfo(null);
    try {
      await removePackCover(packId);
      setInfo("Foto del pack quitada.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar la imagen del pack");
    } finally {
      setInlineCoverUploadingId(null);
    }
  }

  function handleModalBack() {
    setError(null);
    if (!editingPackId) {
      setWizardStep((s) => Math.max(1, s - 1));
      return;
    }
    setWizardStep((s) => (s === 2 ? 4 : Math.max(2, s - 1)));
  }

  function applyCategory(
    key:
      | "digital"
      | "selection"
      | "folder"
      | "all-my-photos"
      | "all-event-photos"
      | "print"
      | "mixed"
  ) {
    setModalPresetMeta(null);
    if (
      eventOfficialDigitalAlbumPricing &&
      (key === "digital" || key === "selection")
    ) {
      setError(MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING);
      return;
    }
    if (key === "all-my-photos") {
      setDraft((prev) => ({
        ...prev,
        name: "Todas mis fotos",
        description: encodePackDescriptionWithQty(
          "Todas las fotos donde aparece el cliente en el álbum.",
          "ALL_MY_PHOTOS"
        ),
        packType: "DIGITAL",
        productComposition: "DIGITAL",
        requiresSelection: false,
        requiresDesign: false,
        photographerProductId: "",
        includedPhotoCount: "",
        templateId: "",
        templateV2Id: "",
        availabilityPhase: "POST_UPLOAD",
      }));
      setWizardStep(2);
      return;
    }
    if (key === "all-event-photos") {
      setDraft((prev) => ({
        ...prev,
        name: "Todas las fotos",
        description: encodePackDescriptionWithQty(
          "Todas las fotos publicadas del álbum en un solo pack.",
          "ALL_EVENT_PHOTOS"
        ),
        packType: "DIGITAL",
        productComposition: "DIGITAL",
        requiresSelection: false,
        requiresDesign: false,
        includedPhotoCount: "",
        templateId: "",
        templateV2Id: "",
        availabilityPhase: "POST_UPLOAD",
      }));
      setWizardStep(2);
      return;
    }
    if (key === "digital") {
      setDraft((prev) => ({
        ...prev,
        packType: "DIGITAL",
        productComposition: "DIGITAL",
        requiresSelection: false,
        requiresDesign: false,
        photographerProductId: "",
        includedPhotoCount: "",
        templateId: "",
        templateV2Id: "",
        availabilityPhase: "ALWAYS",
      }));
      setWizardStep(2);
      return;
    }
    if (key === "selection") {
      setDraft((prev) => ({
        ...prev,
        packType: "DIGITAL",
        productComposition: "DIGITAL",
        requiresSelection: true,
        requiresDesign: false,
        photographerProductId: "",
        includedPhotoCount: prev.includedPhotoCount || "",
        availabilityPhase: "POST_UPLOAD",
      }));
      setWizardStep(2);
      return;
    }
    if (key === "print") {
      setDraft((prev) => ({
        ...prev,
        name: "Pack de impresiones",
        description: "",
        packType: "PRINT",
        productComposition: "PRINT",
        requiresSelection: true,
        requiresDesign: false,
        includedPhotoCount: prev.includedPhotoCount || "4",
        photographerProductId: "",
        templateId: "",
        templateV2Id: "",
        availabilityPhase: "POST_UPLOAD",
      }));
      setWizardStep(2);
      return;
    }
    if (key === "mixed") {
      setDraft((prev) => ({
        ...prev,
        name: "Pack mixto",
        description: "",
        packType: "DIGITAL",
        productComposition: "MIXED",
        requiresSelection: true,
        requiresDesign: false,
        includedPhotoCount: prev.includedPhotoCount || "4",
        photographerProductId: "",
        templateId: "",
        templateV2Id: "",
        availabilityPhase: "POST_UPLOAD",
      }));
      setWizardStep(2);
      return;
    }
    setDraft((prev) => ({
      ...prev,
      packType: "SCHOOL_FOLDER",
      requiresSelection: true,
      requiresDesign: true,
      includedPhotoCount: prev.includedPhotoCount || "",
      availabilityPhase: "POST_UPLOAD",
      templateId: "",
      templateV2Id: "",
    }));
    setWizardStep(2);
  }

  function applyPreset(preset: AlbumPackPreset) {
    if (eventOfficialDigitalAlbumPricing && preset.packType === "DIGITAL") {
      setError(MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING);
      return;
    }
    setModalPresetMeta({ presetId: preset.id, preset });
    setDraft({
      name: preset.name,
      description: preset.description || "",
      price: preset.price ? String(preset.price) : "",
      includedPhotoCount:
        preset.includedPhotoCount != null ? String(preset.includedPhotoCount) : "",
      requiresSelection: preset.requiresSelection,
      requiresDesign: preset.requiresDesign,
      templateId: "",
      templateV2Id: "",
      availabilityPhase: preset.availabilityPhase,
      packType: preset.packType,
      productComposition: preset.packType === "PRINT" ? "PRINT" : "DIGITAL",
      photographerProductId: "",
      isActive: true,
    });
    if (preset.requiresDesign && templateV2PickCount === 0) {
      setError(
        "Este pack necesita una plantilla. Configurá al menos una plantilla en el álbum antes de continuar."
      );
      setWizardStep(2);
      return;
    }
    setError(null);
    setWizardStep(2);
  }

  function validateDraft(): string | null {
    if (!draft.name.trim()) return "El nombre es obligatorio.";
    const price = Number(draft.price);
    if (!Number.isInteger(price) || price < 0) return "El precio debe ser un entero mayor o igual a 0.";
    if (draft.requiresSelection) {
      const count = Number(draft.includedPhotoCount);
      if (!Number.isInteger(count) || count <= 0) {
        return "Si el pack incluye selección, la cantidad de fotos debe ser mayor a 0.";
      }
    }
    if (draft.requiresDesign && !draft.requiresSelection) {
      return "Los packs con diseño requieren también selección de fotos.";
    }
    const productValidation = validateAlbumPackDashboardProductFields(draft);
    if (productValidation) return productValidation;

    if (draft.requiresDesign) {
      const legacy = draft.templateId.trim();
      const v2 = draft.templateV2Id.trim();
      if (!legacy && !v2) {
        return "Elegí una plantilla Template V2.";
      }
      if (legacy && v2) {
        return "Elegí solo una plantilla.";
      }
      if (legacy) {
        const templateId = Number(legacy);
        if (!Number.isInteger(templateId) || !templates.some((t) => t.id === templateId)) {
          return "La plantilla clásica no es válida.";
        }
      }
      if (v2) {
        const known =
          templatesV2Owned.some((t) => t.id === v2) || templatesV2Catalog.some((t) => t.id === v2);
        if (!known) {
          return "La plantilla seleccionada ya no está disponible. Volvé a elegir una plantilla Template V2.";
        }
      }
    }
    return null;
  }

  async function handleConfirmCatalogClone() {
    if (!cloneSource || cloneSaving) return;
    const nameTrim = cloneName.trim();
    if (!nameTrim) {
      setCloneError("Escribí un nombre para tu plantilla.");
      return;
    }
    setCloneSaving(true);
    setCloneError(null);
    try {
      const res = await fetch(`/api/template-v2/templates/${cloneSource.id}/clone`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameTrim }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || "No se pudo copiar la plantilla.");
      }
      const newId = String(data.templateId ?? "");
      const finalName =
        typeof data.name === "string" && data.name.trim() !== "" ? data.name.trim() : nameTrim;
      const nextCard: TemplateV2Card = {
        id: newId,
        name: finalName,
        thumbnailUrl: cloneSource.thumbnailUrl,
        preview: cloneSource.preview,
        kind: "owned",
      };
      setTemplatesV2Owned((prev) =>
        [...prev.filter((c) => c.id !== nextCard.id), nextCard].sort((a, b) =>
          a.name.localeCompare(b.name, "es", { sensitivity: "base" })
        )
      );
      setDraft((prev) => ({
        ...prev,
        templateV2Id: newId,
        templateId: "",
      }));
      setCloneModalOpen(false);
      setCloneSource(null);
      setCloneName("");
      setTemplateV2PickTab("owned");
      setInfo("Plantilla guardada en tu cuenta.");
    } catch (e) {
      setCloneError(e instanceof Error ? e.message : "Error al copiar plantilla");
    } finally {
      setCloneSaving(false);
    }
  }

  async function submitPack(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setInfo(null);
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (
      eventOfficialDigitalAlbumPricing &&
      !editingPackId &&
      draft.packType === "DIGITAL"
    ) {
      setError(MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING);
      return;
    }

    setSaving(true);
    try {
      const components = buildComponentsPayloadFromForm(draft);
      const payload: Record<string, unknown> = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        price: Number(draft.price),
        includedPhotoCount: draft.requiresSelection
          ? Number(draft.includedPhotoCount)
          : null,
        requiresSelection: draft.requiresSelection,
        requiresDesign: draft.requiresDesign,
        templateId: draft.templateV2Id.trim() ? null : draft.templateId ? Number(draft.templateId) : null,
        templateV2Id: draft.templateId.trim() ? null : draft.templateV2Id.trim() || null,
        availabilityPhase: draft.availabilityPhase,
        packType:
          draft.productComposition === "PRINT"
            ? "PRINT"
            : draft.productComposition === "MIXED"
              ? "DIGITAL"
              : draft.packType,
        isActive: draft.isActive,
      };
      if (components) {
        payload.components = components;
      }

      const endpoint = editingPackId
        ? `/api/dashboard/albums/${albumId}/packs/${editingPackId}`
        : `/api/dashboard/albums/${albumId}/packs`;
      const method = editingPackId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar el pack");
      }

      const savedPackId = String(editingPackId ?? data?.pack?.id ?? "").trim();
      if (!savedPackId) {
        throw new Error("No se obtuvo el pack guardado");
      }
      if (pendingCoverFile || removeCover) {
        await syncPackCoverAfterSave(savedPackId);
      }

      setInfo(editingPackId ? "Pack actualizado." : "Pack creado.");
      closeModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(pack: AlbumPack) {
    if (
      eventOfficialDigitalAlbumPricing &&
      pack.packType === "DIGITAL"
    ) {
      setError(MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING);
      return;
    }
    if (togglingActiveId) return;
    setError(null);
    setInfo(null);
    setTogglingActiveId(pack.id);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/packs/${pack.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !pack.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar el estado");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error actualizando estado");
    } finally {
      setTogglingActiveId(null);
    }
  }

  async function handleDelete(pack: AlbumPack) {
    if (
      eventOfficialDigitalAlbumPricing &&
      pack.packType === "DIGITAL"
    ) {
      setError(MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING);
      return;
    }
    if (!confirm(`¿Eliminar el pack "${pack.name}"?`)) return;
    setDeletingId(pack.id);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/packs/${pack.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo eliminar");
      setInfo("Pack eliminado.");
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error eliminando pack");
    } finally {
      setDeletingId(null);
    }
  }

  function packBadges(pack: AlbumPack): string[] {
    const b: string[] = [];
    const fulfillment =
      pack.compositionFulfillmentKind ??
      inferProductCompositionFromComponents(pack.components);
    if (fulfillment === "MIXED") b.push("Mixto");
    else if (pack.packType === "PRINT" || fulfillment === "PRINT") b.push("Impresiones");
    else if (pack.packType === "DIGITAL") b.push("Digital");
    if (pack.packType === "SCHOOL_FOLDER") b.push("Carpeta escolar");
    if (pack.requiresSelection) b.push("Con selección");
    if (pack.requiresDesign) b.push("Con diseño");
    return b;
  }

  const packThumbClassName =
    "h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f9fafb] sm:h-20 sm:w-20";

  function PackThumbnail({ pack }: { pack: AlbumPack }) {
    const coverUrl = String(pack.coverImageUrl ?? "").trim() || null;
    const v2Thumb =
      pack.templateV2Id && pack.requiresDesign
        ? thumbnailByTemplateV2Id.get(pack.templateV2Id) ?? null
        : null;
    const v1Thumb =
      pack.requiresDesign && pack.templateId != null
        ? thumbnailByTemplateId.get(pack.templateId) ?? pack.template?.imageUrl
        : null;
    const url = coverUrl || v2Thumb || v1Thumb;
    if (url) {
      return (
        <div className={packThumbClassName}>
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      );
    }
    if (pack.requiresDesign || pack.packType === "SCHOOL_FOLDER") {
      return (
        <div
          className={`flex items-center justify-center border-[#e8dcc8] bg-[#fdf8f3] ${packThumbClassName}`}
        >
          <Folder className="h-8 w-8 text-[#c27b3d] sm:h-9 sm:w-9" strokeWidth={1.25} aria-hidden />
        </div>
      );
    }
    return (
      <div className={`flex items-center justify-center ${packThumbClassName}`}>
        <ImageIcon className="h-8 w-8 text-[#9ca3af] sm:h-9 sm:w-9" strokeWidth={1.25} aria-hidden />
      </div>
    );
  }

  const stepTitle = editingPackId
    ? wizardStep === 4
      ? "Editar pack"
      : `Editar · paso ${wizardStep} de 4`
    : `Paso ${wizardStep} de 4`;

  return (
    <Card className="ds-fill-width w-full min-w-0 p-5 sm:p-6">
      <input
        ref={inlineCoverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void handleInlineCoverFileChange(e)}
      />
      <div className="ds-stack-section gap-6">
      <div className="border-b border-[#ebe8e4] pb-6 ds-stack-section gap-4 w-full">
        <div className="ds-content-container w-full space-y-2">
          <h2 className="text-lg font-semibold text-[#1a1a1a] m-0">Packs en la galería</h2>
          <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-base text-gray-600 m-0">
            Estos packs se muestran directamente en la galería del cliente para compra después de subir fotos.
          </p>
          <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-gray-600 m-0">
            Gestioná los productos que querés ofrecer en la galería de este álbum, incluidos los packs
            «Todas mis fotos» (con selfie) y «Todas las fotos» del álbum.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          className="w-full sm:w-auto whitespace-nowrap"
          onClick={openCreateModal}
        >
          Agregar pack
        </Button>
      </div>
      {error && !modalOpen && (
        <p className="text-sm rounded-md border border-red-200 bg-red-50 text-red-800 px-3 py-2">{error}</p>
      )}
      {info && (
        <p className="text-sm rounded-md border border-green-200 bg-green-50 text-green-800 px-3 py-2">{info}</p>
      )}

      {eventOfficialDigitalAlbumPricing && (
        <div
          className="ds-info-panel w-full rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
          role="status"
        >
          {MSG_ORGANIZER_CONTROLS_EVENT_DIGITAL_PRICING}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#6b7280]">Cargando…</p>
      ) : packs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e5e7eb] bg-[#fafafa] px-6 py-12 text-center ds-catalog-empty-shell">
          <h3 className="text-base font-semibold text-[#1a1a1a]">
            {uxV2 ? "La galería todavía no tiene packs" : "Todavía no agregaste productos"}
          </h3>
          <p className="ds-intro-prose ds-intro-prose--fluid mx-auto mt-2 text-sm text-gray-600 m-0">
            {uxV2
              ? "Los packs de galería se venden después de subir fotos. Es distinto de la preventa (venta anticipada)."
              : "Creá tu primer pack digital, producto impreso o carpeta escolar para ofrecerlo en la galería."}
          </p>
          <Button type="button" className="mt-6" variant="primary" onClick={openCreateModal}>
            {uxV2 ? "Agregar pack de galería" : "Agregar pack"}
          </Button>
        </div>
      ) : (
        <>
          <h3 className="text-base font-semibold text-[#1a1a1a]">Tus packs</h3>
          <ul className="space-y-2">
            {packs.map((pack) => {
              const digitalLockedPack =
                eventOfficialDigitalAlbumPricing && pack.packType === "DIGITAL";
              return (
              <li
                key={pack.id}
                className={`flex flex-col gap-4 rounded-lg border border-[#e5e7eb] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
                  pack.isActive ? "" : "opacity-[0.72]"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex shrink-0 flex-col items-center gap-1.5">
                    <PackThumbnail pack={pack} />
                    <button
                      type="button"
                      disabled={inlineCoverUploadingId === pack.id}
                      onClick={() => startInlineCoverUpload(pack.id)}
                      className="w-16 text-center text-[11px] font-medium leading-tight text-[#c27b3d] hover:text-[#a0652d] hover:underline disabled:opacity-50 sm:w-20"
                    >
                      {inlineCoverUploadingId === pack.id
                        ? "Subiendo…"
                        : pack.coverImageUrl
                          ? "Cambiar foto"
                          : "Agregar foto"}
                    </button>
                    {pack.coverImageUrl ? (
                      <button
                        type="button"
                        disabled={inlineCoverUploadingId === pack.id}
                        onClick={() => void handleInlineRemoveCover(pack.id)}
                        className="w-16 text-center text-[11px] leading-tight text-[#6b7280] hover:text-red-600 hover:underline disabled:opacity-50 sm:w-20"
                      >
                        Quitar foto
                      </button>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[#1a1a1a]">{pack.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          pack.isActive
                            ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300"
                            : "bg-gray-200/90 text-gray-700 ring-1 ring-gray-300"
                        }`}
                      >
                        {pack.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="m-0 text-sm text-[#1a1a1a]">
                      <span className="font-semibold">
                        {formatARS(Math.max(0, Math.round(Number(pack.price) || 0)))}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {packBadges(pack).map((b) => (
                        <span
                          key={`${pack.id}-${b}`}
                          className="rounded-md bg-[#fdf8f3] px-2 py-0.5 text-[11px] font-medium text-[#a0652d] ring-1 ring-[#e8dcc8]"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={digitalLockedPack}
                    onClick={() => openEditModal(pack)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={pack.isActive ? "outline" : "primary"}
                    disabled={digitalLockedPack || togglingActiveId === pack.id}
                    onClick={() => void handleToggleActive(pack)}
                  >
                    {togglingActiveId === pack.id ? "…" : pack.isActive ? "Desactivar" : "Activar"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      digitalLockedPack ||
                      deletingId === pack.id ||
                      togglingActiveId === pack.id
                    }
                    onClick={() => void handleDelete(pack)}
                  >
                    {deletingId === pack.id ? "…" : "Eliminar"}
                  </Button>
                </div>
              </li>
              );
            })}
          </ul>
        </>
      )}

      {modalOpen ? (
        <AppModal
          open={modalOpen}
          onClose={() => {
            if (saving || cloneSaving) return;
            closeModal();
          }}
          size="lg"
          title={stepTitle}
          titleId="pack-modal-title"
          closeOnBackdrop={!saving && !cloneSaving}
          closeOnEscape={!saving && !cloneSaving}
        >
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
              {error && (
                <p className="mb-3 text-sm rounded-md border border-red-200 bg-red-50 text-red-800 px-3 py-2">
                  {error}
                </p>
              )}

              {!editingPackId && wizardStep === 1 ? (
                <div className="ds-stack-section w-full gap-5">
                  <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-gray-600 m-0">
                    Elegí un tipo de pack o una sugerencia para ir más rápido.
                  </p>
                  <div className="grid gap-3 w-full sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={eventOfficialDigitalAlbumPricing}
                      onClick={() => applyCategory("all-my-photos")}
                      className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4 text-left transition hover:border-[#c27b3d] hover:bg-[#fdf8f3] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#e8e8e8] disabled:hover:bg-[#fafafa]"
                    >
                      <p className="font-semibold text-[#1a1a1a]">Todas mis fotos</p>
                      <p className="mt-1 text-xs text-[#6b7280]">
                        {ALBUM_PACK_QUANTITY_MODE_HELP.ALL_MY_PHOTOS}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={eventOfficialDigitalAlbumPricing}
                      onClick={() => applyCategory("all-event-photos")}
                      className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4 text-left transition hover:border-[#c27b3d] hover:bg-[#fdf8f3] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#e8e8e8] disabled:hover:bg-[#fafafa]"
                    >
                      <p className="font-semibold text-[#1a1a1a]">Todas las fotos</p>
                      <p className="mt-1 text-xs text-[#6b7280]">
                        {ALBUM_PACK_QUANTITY_MODE_HELP.ALL_EVENT_PHOTOS}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={eventOfficialDigitalAlbumPricing}
                      onClick={() => applyCategory("digital")}
                      className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4 text-left transition hover:border-[#c27b3d] hover:bg-[#fdf8f3] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#e8e8e8] disabled:hover:bg-[#fafafa]"
                    >
                      <p className="font-semibold text-[#1a1a1a]">Pack digital</p>
                      <p className="mt-1 text-xs text-[#6b7280]">Ventas sin selección obligatoria de fotos.</p>
                    </button>
                    <button
                      type="button"
                      disabled={eventOfficialDigitalAlbumPricing}
                      onClick={() => applyCategory("selection")}
                      className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4 text-left transition hover:border-[#c27b3d] hover:bg-[#fdf8f3] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#e8e8e8] disabled:hover:bg-[#fafafa]"
                    >
                      <p className="font-semibold text-[#1a1a1a]">Pack con selección</p>
                      <p className="mt-1 text-xs text-[#6b7280]">El cliente elige la cantidad de fotos incluidas.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCategory("print")}
                      className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4 text-left transition hover:border-[#c27b3d] hover:bg-[#fdf8f3]"
                    >
                      <p className="font-semibold text-[#1a1a1a]">Pack de impresiones</p>
                      <p className="mt-1 text-xs text-[#6b7280]">
                        {ALBUM_PACK_PRODUCT_COMPOSITION_HELP.PRINT}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCategory("mixed")}
                      className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4 text-left transition hover:border-[#c27b3d] hover:bg-[#fdf8f3]"
                    >
                      <p className="font-semibold text-[#1a1a1a]">Pack mixto</p>
                      <p className="mt-1 text-xs text-[#6b7280]">
                        {ALBUM_PACK_PRODUCT_COMPOSITION_HELP.MIXED}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => applyCategory("folder")}
                      className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] p-4 text-left transition hover:border-[#c27b3d] hover:bg-[#fdf8f3] sm:col-span-2"
                    >
                      <p className="font-semibold text-[#1a1a1a]">Carpeta con diseño</p>
                      <p className="mt-1 text-xs text-[#6b7280]">Carpeta escolar con plantilla y selección.</p>
                    </button>
                  </div>

                  {wizardPresetBundle.presets.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">
                        Sugeridos
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {wizardPresetBundle.presets.map((p) => (
                          <Button
                            key={p.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={() => applyPreset(p)}
                          >
                            {p.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {wizardStep === 2 ? (
                <div className="ds-form-stack w-full max-w-none">
                  {draft.productComposition === "PRINT" || draft.productComposition === "MIXED" ? (
                    <div className="ds-info-panel w-full rounded-lg border border-[#e8dcc8] bg-[#fdf8f3] px-4 py-3 text-sm leading-relaxed text-[#1a1a1a]">
                      <p className="font-semibold m-0">
                        {draft.productComposition === "MIXED"
                          ? "Pack mixto digital + impresión"
                          : "Pack de impresiones"}
                      </p>
                      <p className="mt-2 m-0 text-[#4b5563]">
                        {ALBUM_PACK_PRODUCT_COMPOSITION_HELP[draft.productComposition]}
                      </p>
                    </div>
                  ) : (
                    <div className="w-full">
                      <span className="text-sm font-medium text-[#1a1a1a] block mb-2">Tipo de pack</span>
                      <Select
                        className="w-full"
                        value={draft.packType}
                        disabled={presetLockedFields}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            packType: e.target.value as FormState["packType"],
                            productComposition: "DIGITAL",
                            availabilityPhase: deriveAvailability({
                              ...prev,
                              packType: e.target.value as FormState["packType"],
                            }),
                          }))
                        }
                      >
                        {packTypeOptions
                          .filter(
                            (option) =>
                              option.value !== "SCHOOL_FOLDER" &&
                              !(
                                eventOfficialDigitalAlbumPricing &&
                                !editingPackId &&
                                option.value === "DIGITAL"
                              )
                          )
                          .map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                      </Select>
                    </div>
                  )}

                  {draft.productComposition === "PRINT" || draft.productComposition === "MIXED" ? (
                    <label className="block w-full space-y-1">
                      <span className="text-sm font-medium text-[#1a1a1a]">Producto impreso</span>
                      {photographerProducts.length === 0 ? (
                        <p className="text-sm text-amber-800 m-0">
                          Configurá productos de impresión activos en tu catálogo antes de crear este pack.
                        </p>
                      ) : (
                        <Select
                          className="w-full"
                          value={draft.photographerProductId}
                          onChange={(e) =>
                            setDraft((prev) => ({
                              ...prev,
                              photographerProductId: e.target.value,
                            }))
                          }
                        >
                          <option value="">Elegí un producto</option>
                          {photographerProducts.map((product) => (
                            <option key={product.id} value={String(product.id)}>
                              {formatPhotographerProductLabel(product)}
                            </option>
                          ))}
                        </Select>
                      )}
                    </label>
                  ) : null}

                  {draft.requiresSelection ||
                  draft.packType === "SCHOOL_FOLDER" ||
                  draft.productComposition === "PRINT" ||
                  draft.productComposition === "MIXED" ? (
                    <label className="block w-full space-y-1">
                      <span className="text-sm font-medium text-[#1a1a1a]">Cantidad de fotos incluidas</span>
                      <Input
                        className="w-full"
                        type="number"
                        min={1}
                        step={1}
                        value={draft.includedPhotoCount}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, includedPhotoCount: e.target.value }))
                        }
                      />
                    </label>
                  ) : null}

                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#c27b3d]"
                      checked={draft.requiresSelection}
                      disabled={
                        draft.packType === "SCHOOL_FOLDER" ||
                        draft.productComposition === "PRINT" ||
                        draft.productComposition === "MIXED" ||
                        Boolean(presetLockedFields && modalPresetMeta?.preset?.requiresSelection)
                      }
                      onChange={(e) => {
                        const v = e.target.checked;
                        setDraft((prev) => ({
                          ...prev,
                          requiresSelection: v || prev.requiresDesign,
                          includedPhotoCount: v || prev.requiresDesign ? prev.includedPhotoCount : "",
                          availabilityPhase: deriveAvailability({
                            ...prev,
                            requiresSelection: v || prev.requiresDesign,
                          }),
                        }));
                      }}
                    />
                    <span className="text-sm text-[#1a1a1a]">Requiere selección de fotos</span>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#c27b3d]"
                      checked={draft.requiresDesign}
                      disabled={
                        draft.packType === "SCHOOL_FOLDER" ||
                        Boolean(presetLockedFields && modalPresetMeta?.preset?.requiresDesign)
                      }
                      onChange={(e) => {
                        const v = e.target.checked;
                        setDraft((prev) => ({
                          ...prev,
                          requiresDesign: v,
                          requiresSelection: v ? true : prev.requiresSelection,
                          templateId: v ? prev.templateId : "",
                          templateV2Id: v ? prev.templateV2Id : "",
                          availabilityPhase: deriveAvailability({
                            ...prev,
                            requiresDesign: v,
                            requiresSelection: v ? true : prev.requiresSelection,
                          }),
                        }));
                      }}
                    />
                    <span className="text-sm text-[#1a1a1a]">Requiere diseño (plantilla)</span>
                  </label>

                  {draft.requiresDesign ? (
                    <div className="ds-stack-section w-full gap-4">
                      {draft.templateId.trim() !== "" ? (
                        <div className="ds-info-panel w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
                          <p className="font-semibold text-amber-950">Plantilla clásica asignada</p>
                          <p className="mt-2 text-amber-950/95">
                            Este pack usa una plantilla del editor anterior. Para usar solo Template V2 en este flujo,
                            elegí una plantilla nueva; eso reemplazará esta asignación al guardar.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() =>
                              setDraft((prev) => ({
                                ...prev,
                                templateId: "",
                              }))
                            }
                          >
                            Elegir plantilla Template V2
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="ds-content-container w-full leading-relaxed">
                            <span className="text-sm font-medium text-[#1a1a1a]">Plantilla Template V2</span>
                            <p className="mt-1 ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-gray-600 m-0">
                              Elegí una plantilla propia o una oficial del sistema. Las oficiales se copian a tu cuenta con
                              el nombre que elijas antes de asignarlas al pack.
                            </p>
                          </div>

                          <div
                            role="tablist"
                            className="flex w-full gap-1 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-1"
                          >
                            <button
                              type="button"
                              role="tab"
                              aria-selected={templateV2PickTab === "owned"}
                              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                                templateV2PickTab === "owned"
                                  ? "bg-white text-[#1a1a1a] shadow-sm ring-1 ring-[#e5e7eb]"
                                  : "text-[#6b7280] hover:text-[#1a1a1a]"
                              }`}
                              onClick={() => setTemplateV2PickTab("owned")}
                            >
                              Mis plantillas
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={templateV2PickTab === "catalog"}
                              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                                templateV2PickTab === "catalog"
                                  ? "bg-white text-[#1a1a1a] shadow-sm ring-1 ring-[#e5e7eb]"
                                  : "text-[#6b7280] hover:text-[#1a1a1a]"
                              }`}
                              onClick={() => setTemplateV2PickTab("catalog")}
                            >
                              Plantillas del sistema
                            </button>
                          </div>

                          {draft.templateV2Id.trim() ? (
                            <p className="text-sm text-[#374151]">
                              Seleccionada:{" "}
                              <strong>
                                {templatesV2Owned.find((c) => c.id === draft.templateV2Id.trim())?.name ??
                                  templatesV2Catalog.find((c) => c.id === draft.templateV2Id.trim())?.name ??
                                  draft.templateV2Id.trim()}
                              </strong>
                              <button
                                type="button"
                                className="ml-3 text-sm font-medium text-[#c27b3d] underline underline-offset-2 hover:text-[#a0632f]"
                                onClick={() => setDraft((prev) => ({ ...prev, templateV2Id: "" }))}
                              >
                                Quitar
                              </button>
                            </p>
                          ) : null}

                          {templateV2PickCount === 0 ? (
                            <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-sm text-amber-800 m-0">
                              No hay plantillas Template V2 disponibles. Creá o publicá plantillas desde Diseños, o
                              contactá soporte si esperabas ver el catálogo oficial.
                            </p>
                          ) : (
                            <ul className="grid gap-3 sm:grid-cols-2">
                              {(templateV2PickTab === "owned" ? templatesV2Owned : templatesV2Catalog).map((card) => {
                                const selected = draft.templateV2Id.trim() === card.id;
                                const ar = card.preview.width / Math.max(1, card.preview.height);
                                return (
                                  <li key={card.id}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setError(null);
                                        if (card.kind === "catalog") {
                                          setCloneSource(card);
                                          setCloneName(card.name);
                                          setCloneModalOpen(true);
                                          setCloneError(null);
                                          return;
                                        }
                                        setDraft((prev) => ({
                                          ...prev,
                                          templateV2Id: card.id,
                                          templateId: "",
                                        }));
                                      }}
                                      className={`w-full rounded-xl border bg-white p-3 text-left transition hover:border-[#c27b3d] hover:shadow-sm ${
                                        selected
                                          ? "border-[#c27b3d] ring-2 ring-[#c27b3d]/30"
                                          : "border-[#e5e7eb]"
                                      }`}
                                    >
                                      <div
                                        className="relative w-full overflow-hidden rounded-lg bg-[#f3f4f6]"
                                        style={{ aspectRatio: ar }}
                                      >
                                        {card.thumbnailUrl ? (
                                          <img
                                            src={card.thumbnailUrl}
                                            alt=""
                                            className="absolute inset-0 h-full w-full object-cover"
                                          />
                                        ) : (
                                          <div
                                            className="absolute inset-0"
                                            style={{ backgroundColor: card.preview.background ?? "#f1f5f9" }}
                                          />
                                        )}
                                        <span
                                          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                            card.kind === "catalog"
                                              ? "bg-slate-900/85 text-white"
                                              : "bg-white/90 text-[#1a1a1a] ring-1 ring-[#e5e7eb]"
                                          }`}
                                        >
                                          {card.kind === "catalog" ? "Oficial" : "Propia"}
                                        </span>
                                      </div>
                                      <p className="mt-2 line-clamp-2 text-sm font-medium text-[#1a1a1a]">
                                        {card.name}
                                      </p>
                                      {card.kind === "catalog" ? (
                                        <p className="mt-0.5 text-xs text-[#6b7280]">Requiere guardar copia en tu cuenta</p>
                                      ) : null}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  ) : null}

                  <details className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2 text-xs">
                    <summary className="cursor-pointer font-medium text-[#374151]">Disponibilidad (avanzado)</summary>
                    <div className="mt-2">
                      <Select
                        value={draft.availabilityPhase}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            availabilityPhase: e.target.value as FormState["availabilityPhase"],
                          }))
                        }
                      >
                        {availabilityPhaseOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </details>
                </div>
              ) : null}

              {wizardStep === 3 ? (
                <div className="ds-form-stack w-full max-w-none">
                  <label className="block w-full space-y-1">
                    <span className="text-sm font-medium text-[#1a1a1a]">Precio del pack (ARS)</span>
                    <div className="relative w-full">
                      <span
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-medium text-[#6b7280]"
                        aria-hidden
                      >
                        $
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        className="pl-9"
                        value={draft.price}
                        onChange={(e) => setDraft((prev) => ({ ...prev, price: e.target.value }))}
                      />
                    </div>
                  </label>

                  {(() => {
                    const baseWhole = parsePackPriceWhole(draft.price);
                    const pct = platformCommissionPercent;
                    if (
                      pct == null ||
                      !Number.isFinite(pct) ||
                      baseWhole == null ||
                      baseWhole <= 0
                    ) {
                      return (
                        <p className="text-xs text-[#6b7280]">
                          Ingresá un precio para ver el simulador. El % de comisión se carga desde tu cuenta.
                        </p>
                      );
                    }
                    const feeWhole = feeFromBase(baseWhole, pct);
                    const totalWhole = totalFromBase(baseWhole, pct);
                    return (
                      <div className="rounded-lg border border-[#e8e4df] bg-[#fdfbf8] p-3 text-sm text-[#374151]">
                        <p className="font-semibold text-[#1a1a1a]">Simulador (referencia checkout digital)</p>
                        <ul className="mt-2 space-y-1 text-[#4b5563] text-sm">
                          <li>
                            <span className="text-[#6b7280]">Precio pack (vos):</span>{" "}
                            <strong>{formatARS(baseWhole)}</strong>
                          </li>
                          <li>
                            <span className="text-[#6b7280]">Comisión plataforma ~{pct}%:</span>{" "}
                            <strong>{formatARS(feeWhole)}</strong>
                          </li>
                          <li>
                            <span className="text-[#6b7280]">Cliente pagaría ~</span>{" "}
                            <strong>{formatARS(totalWhole)}</strong>
                          </li>
                        </ul>
                        <p className="mt-2 text-[11px] text-[#6b7280]">
                          Misma prioridad que el asistente de álbum: puede variar por medios de pago u otras reglas.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ) : null}

              {wizardStep === 4 ? (
                <div className="ds-form-stack w-full max-w-none">
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
                      Foto del pack (opcional, 1:1)
                    </label>
                    <p className="ds-intro-prose ds-intro-prose--start ds-intro-prose--fluid text-xs text-gray-600 m-0 mb-2">
                      Se muestra en la galería pública del álbum. La imagen se recorta al centro en formato
                      cuadrado (800×800 px). JPG, PNG, WebP o GIF, máx. 5 MB.
                    </p>
                    <div className="flex flex-wrap items-start gap-4">
                      <div
                        className="w-32 h-32 shrink-0 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] overflow-hidden flex items-center justify-center"
                        style={{ aspectRatio: "1" }}
                      >
                        {coverDisplaySrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={coverDisplaySrc}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-[#9ca3af] text-center px-2">Sin imagen</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 min-w-0">
                        <input
                          ref={coverFileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                          disabled={saving}
                          className="text-sm text-[#374151] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-[#e5e7eb] file:bg-white file:text-sm"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setRemoveCover(false);
                              setPendingCoverFile(file);
                            }
                          }}
                        />
                        {coverDisplaySrc ? (
                          <button
                            type="button"
                            disabled={saving}
                            className="text-sm text-red-600 hover:text-red-700 underline text-left"
                            onClick={() => {
                              setPendingCoverFile(null);
                              setRemoveCover(true);
                              if (coverFileInputRef.current) coverFileInputRef.current.value = "";
                            }}
                          >
                            Quitar imagen
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {editingPackId ? (
                      <p className="mt-2 text-xs text-[#6b7280] m-0">
                        También podés cambiar la foto desde la lista con «Cambiar foto», sin abrir todo el
                        formulario.
                      </p>
                    ) : null}
                  </div>
                  <label className="block space-y-1">
                    <span className="text-sm font-medium text-[#1a1a1a]">Nombre del pack</span>
                    <Input
                      value={draft.name}
                      onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </label>
                  <div className="rounded-xl border border-[#e5e7eb] bg-[#f9fafb] p-4 text-sm space-y-2">
                    <p className="font-semibold text-[#1a1a1a]">Resumen</p>
                    <ul className="space-y-1 text-[#4b5563]">
                      <li>
                        <strong className="text-[#374151]">Precio:</strong>{" "}
                        {formatARS(Math.max(0, Math.round(Number(draft.price) || 0)))}
                      </li>
                      <li>
                        <strong className="text-[#374151]">Tipo:</strong>{" "}
                        {packTypeOptions.find((o) => o.value === draft.packType)?.label ?? draft.packType}
                      </li>
                      <li>
                        <strong className="text-[#374151]">Selección:</strong>{" "}
                        {draft.requiresSelection
                          ? `${draft.includedPhotoCount || "—"} fotos`
                          : "No"}
                      </li>
                      <li>
                        <strong className="text-[#374151]">Diseño:</strong>{" "}
                        {draft.requiresDesign
                          ? (() => {
                              const v2Id = draft.templateV2Id.trim();
                              if (v2Id) {
                                return (
                                  templatesV2Owned.find((t) => t.id === v2Id)?.name ??
                                  templatesV2Catalog.find((t) => t.id === v2Id)?.name ??
                                  "Plantilla"
                                );
                              }
                              const n = Number(draft.templateId);
                              if (!Number.isInteger(n)) return "—";
                              return templates.find((t) => t.id === n)?.name ?? "Plantilla clásica";
                            })()
                          : "No"}
                      </li>
                      <li>
                        <strong className="text-[#374151]">Disponibilidad:</strong>{" "}
                        {availabilityPhaseOptions.find((o) => o.value === draft.availabilityPhase)?.label}
                      </li>
                      <label className="flex cursor-pointer items-center gap-2 pt-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#c27b3d]"
                          checked={draft.isActive}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, isActive: e.target.checked }))
                          }
                        />
                        <span>Pack activo al guardar</span>
                      </label>
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#ebe8e4] px-5 py-4 sm:px-6">
              <Button type="button" variant="outline" onClick={closeModal} disabled={saving}>
                Cancelar
              </Button>
              <div className="flex flex-wrap gap-2">
                {(!editingPackId && wizardStep > 1) || (Boolean(editingPackId) && wizardStep >= 2) ? (
                  <Button type="button" variant="secondary" onClick={handleModalBack} disabled={saving}>
                    Atrás
                  </Button>
                ) : null}
                {wizardStep === 2 ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={saving}
                    onClick={() => {
                      setError(null);
                      setDraft((prev) => ({
                        ...prev,
                        name: prev.name.trim() || deriveDefaultName(prev),
                        availabilityPhase: modalPresetMeta?.preset
                          ? prev.availabilityPhase
                          : deriveAvailability(prev),
                      }));
                      setWizardStep(3);
                    }}
                  >
                    Siguiente: precio
                  </Button>
                ) : null}
                {wizardStep === 3 ? (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={saving}
                    onClick={() => {
                      setError(null);
                      setDraft((prev) => ({
                        ...prev,
                        name: prev.name.trim() || deriveDefaultName(prev),
                      }));
                      setWizardStep(4);
                    }}
                  >
                    Siguiente: confirmar
                  </Button>
                ) : null}
                {wizardStep === 4 ? (
                  <Button type="button" variant="primary" disabled={saving} onClick={() => void submitPack()}>
                    {saving ? "Guardando…" : editingPackId ? "Guardar cambios" : "Crear pack"}
                  </Button>
                ) : null}
              </div>
            </div>
        </AppModal>
      ) : null}

      <AppModal
        open={cloneModalOpen}
        onClose={() => {
          if (cloneSaving) return;
          setCloneModalOpen(false);
          setCloneSource(null);
          setCloneName("");
          setCloneError(null);
        }}
        size="lg"
        zIndexClass="z-[90]"
        title="Guardar como mi plantilla"
        titleId="pack-clone-template-title"
        closeOnBackdrop={!cloneSaving}
        closeOnEscape={!cloneSaving}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {cloneError ? (
            <p className="mb-3 text-sm rounded-md border border-red-200 bg-red-50 text-red-800 px-3 py-2">{cloneError}</p>
          ) : null}
          <div className="ds-form-stack w-full max-w-none">
            <p className="text-sm text-[#4b5563]">
              Esta plantilla se va a copiar a tu cuenta para que puedas usarla y editarla.
            </p>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-[#1a1a1a]">Nombre</span>
              <Input
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="Nombre de la plantilla"
                disabled={cloneSaving}
                autoFocus
              />
            </label>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#ebe8e4] px-5 py-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            disabled={cloneSaving}
            onClick={() => {
              if (cloneSaving) return;
              setCloneModalOpen(false);
              setCloneSource(null);
              setCloneName("");
              setCloneError(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={cloneSaving}
            onClick={() => void handleConfirmCatalogClone()}
          >
            {cloneSaving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </AppModal>
      </div>
    </Card>
  );
}
