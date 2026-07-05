"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import PreventaPackList from "./PreventaPackList";
import PreventaPackFormModal, { type PackCoverMeta, type PackFormPayload } from "./PreventaPackFormModal";
import PreventaPackBenefitsModal from "./PreventaPackBenefitsModal";
import PreventaPackCreateWizard from "./PreventaPackCreateWizard";
import PreventaProductModelsNotice from "./PreventaProductModelsNotice";
import { PACK_EMPTY_ACTIVATION_MESSAGE } from "@/lib/preventa-canjeable/pack-activation";
import type { PackRow } from "./types";

export default function PreventaPackDashboardSection({
  albumId,
  albumPublicSlug,
  active,
  onError,
}: {
  albumId: number;
  albumPublicSlug?: string | null;
  /** Solo cargar cuando la pestaña Pre-venta está visible (evita requests extra). */
  active: boolean;
  onError: (message: string | null) => void;
}) {
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [platformFeePercent, setPlatformFeePercent] = useState(10);
  const [loading, setLoading] = useState(false);
  const [packsReordering, setPacksReordering] = useState(false);
  const [createWizardOpen, setCreateWizardOpen] = useState(false);
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<PackRow | null>(null);
  const [duplicateSourcePack, setDuplicateSourcePack] = useState<PackRow | null>(null);
  const [packSaving, setPackSaving] = useState(false);
  const [benefitsPack, setBenefitsPack] = useState<PackRow | null>(null);
  const [togglingPackId, setTogglingPackId] = useState<number | null>(null);

  const loadPacks = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-packs`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudieron cargar los packs");
      }
      const nextPacks: PackRow[] = Array.isArray(data?.packs) ? (data.packs as PackRow[]) : [];
      setPacks(nextPacks);
      const pct = Number(data?.platformFeePercent);
      if (Number.isFinite(pct) && pct >= 0) setPlatformFeePercent(pct);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Error cargando packs");
      setPacks([]);
    } finally {
      setLoading(false);
    }
  }, [albumId, onError]);

  useEffect(() => {
    if (!active || !albumId) return;
    loadPacks();
  }, [active, albumId, loadPacks]);

  function openCreateWizard() {
    onError(null);
    setCreateWizardOpen(true);
  }

  async function handleReorderPacks(orderedIds: number[]) {
    setPacksReordering(true);
    onError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-packs/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packIds: orderedIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo reordenar");
      }
      await loadPacks();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Error al reordenar packs");
    } finally {
      setPacksReordering(false);
    }
  }

  async function handlePackSubmit(payload: PackFormPayload, cover: PackCoverMeta) {
    setPackSaving(true);
    onError(null);
    try {
      let packId: number;
      if (editingPack) {
        packId = editingPack.id;
        const res = await fetch(
          `/api/dashboard/albums/${albumId}/preventa-packs/${packId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "No se pudo guardar");
      } else {
        const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-packs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || data?.detail || "No se pudo crear");
        }
        const createdId = data?.pack?.id;
        if (!Number.isInteger(createdId)) {
          throw new Error("No se obtuvo el pack creado");
        }
        packId = createdId;
      }

      if (cover.remove) {
        const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-packs/${packId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coverImageUrl: null }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "No se pudo quitar la imagen");
      }
      if (cover.file) {
        const fd = new FormData();
        fd.append("file", cover.file);
        const res = await fetch(
          `/api/dashboard/albums/${albumId}/preventa-packs/${packId}/cover`,
          { method: "POST", body: fd }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "No se pudo subir la imagen del pack");
      }

      await loadPacks();
      setPackModalOpen(false);
      setEditingPack(null);
      setDuplicateSourcePack(null);
    } catch (e: unknown) {
      throw e;
    } finally {
      setPackSaving(false);
    }
  }

  async function togglePackPublish(p: PackRow) {
    const nextActive = !p.isActive;
    if (nextActive && (p.benefits?.length ?? 0) === 0) {
      onError(PACK_EMPTY_ACTIVATION_MESSAGE);
      return;
    }

    setTogglingPackId(p.id);
    onError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-packs/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "No se pudo actualizar el pack"
        );
      }
      await loadPacks();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Error al publicar");
    } finally {
      setTogglingPackId(null);
    }
  }

  async function deletePack(p: PackRow) {
    if (!confirm(`¿Eliminar el pack «${p.name}» y todos los productos incluidos?`)) return;
    onError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/preventa-packs/${p.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo eliminar");
      setPacks((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  return (
    <div className="w-full min-w-0 rounded-xl border-2 border-[#c27b3d]/35 bg-gradient-to-b from-[#fef7f3]/40 to-white p-5 sm:p-6">
      <div className="ds-stack-section w-full gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3 w-full">
          <div className="min-w-0 flex-1 space-y-2">
            <PreventaProductModelsNotice />
          </div>
          <Button variant="primary" className="shrink-0 w-full sm:w-auto" onClick={openCreateWizard}>
            Crear pack
          </Button>
        </div>

        <PreventaPackList
          packs={packs}
          platformFeePercent={platformFeePercent}
          loading={loading && packs.length === 0}
          albumPublicSlug={albumPublicSlug}
          hideHeaderCreateButton
          onCreate={openCreateWizard}
          onEdit={(p) => {
            setEditingPack(p);
            setDuplicateSourcePack(null);
            setPackModalOpen(true);
          }}
          onDuplicate={(p) => {
            setDuplicateSourcePack(p);
            setEditingPack(null);
            setPackModalOpen(true);
          }}
          onDelete={deletePack}
          onManageBenefits={(p) => setBenefitsPack(p)}
          onTogglePublish={togglePackPublish}
          togglingPackId={togglingPackId}
          onReorderPacks={handleReorderPacks}
          reordering={packsReordering}
        />

        {createWizardOpen && (
          <PreventaPackCreateWizard
            albumId={albumId}
            platformFeePercent={platformFeePercent}
            albumPublicSlug={albumPublicSlug}
            onClose={() => setCreateWizardOpen(false)}
            onComplete={loadPacks}
            onError={onError}
          />
        )}

        {packModalOpen && (
          <PreventaPackFormModal
            pack={editingPack}
            duplicateSource={duplicateSourcePack}
            platformFeePercent={platformFeePercent}
            saving={packSaving}
            onClose={() => {
              if (!packSaving) {
                setPackModalOpen(false);
                setEditingPack(null);
                setDuplicateSourcePack(null);
              }
            }}
            onSubmit={handlePackSubmit}
          />
        )}

        {benefitsPack && (
          <PreventaPackBenefitsModal
            albumId={albumId}
            pack={benefitsPack}
            onClose={() => setBenefitsPack(null)}
            onPacksChanged={loadPacks}
          />
        )}
      </div>
    </div>
  );
}
