"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import {
  derivePreventaSelfieUxPhase,
  preventaSelfieUxCopy,
  type PreCompraSelfieSnapshot,
  type PreventaSelfieUxPhase,
} from "@/lib/preventa-canjeable/preventa-selfie-state";

type PreventaSelfieStepProps = {
  preCompraOrderId: number;
  variant?: "standalone" | "embedded";
  hasPhotos?: boolean;
  redeemHref?: string | null;
  legacySelfieHref?: string;
  onPhaseChange?: (phase: PreventaSelfieUxPhase) => void;
};

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setMobile(mq.matches);
    const fn = () => setMobile(window.matchMedia("(max-width: 768px)").matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return mobile;
}

export default function PreventaSelfieStep({
  preCompraOrderId,
  variant = "embedded",
  hasPhotos = false,
  redeemHref = null,
  legacySelfieHref,
  onPhaseChange,
}: PreventaSelfieStepProps) {
  const [snapshot, setSnapshot] = useState<PreCompraSelfieSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const legacyHref = legacySelfieHref ?? `/order/${preCompraOrderId}/selfies`;
  const uiRouteHeader =
    variant === "standalone" ? "/order/[id]/selfies" : "/cliente/pack/[id]";

  const loadOrder = useCallback(() => {
    setLoading(true);
    fetch(`/api/precompra/order/${preCompraOrderId}`, {
      cache: "no-store",
      headers: { "x-legacy-precompra-ui-route": uiRouteHeader },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("No encontrado"))))
      .then((data) => {
        const order = data.order as PreCompraSelfieSnapshot & {
          id: number;
          buyerEmail: string;
        };
        setSnapshot({
          subjects: order.subjects ?? [],
          items: order.items ?? [],
          album: order.album,
        });
        setError(null);
      })
      .catch(() => setError("No se pudo cargar el pedido."))
      .finally(() => setLoading(false));
  }, [preCompraOrderId, uiRouteHeader]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const phase = snapshot ? derivePreventaSelfieUxPhase(snapshot, hasPhotos) : null;
  const copy = phase ? preventaSelfieUxCopy(phase) : null;
  const showUploadUi = phase === "needs_upload" || phase === "no_matches";

  useEffect(() => {
    if (phase) onPhaseChange?.(phase);
  }, [phase, onPhaseChange]);

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/precompra/order/${preCompraOrderId}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      if (!res.ok) throw new Error("Error al agregar");
      setNewLabel("");
      loadOrder();
    } catch {
      setError("No se pudo agregar el niño.");
    } finally {
      setAdding(false);
    }
  };

  const triggerUpload = (subjectId: number) => {
    setUploadingFor(subjectId);
    fileInputRef.current?.click();
  };

  if (loading && !snapshot) {
    return (
      <div className={variant === "standalone" ? "min-h-[12rem] flex items-center justify-center" : "py-4"}>
        <p className="text-sm text-[#6b7280]">Cargando identificación…</p>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
        {variant === "embedded" ? (
          <p className="mt-2">
            <Link href={legacyHref} className="font-semibold text-[#c27b3d] hover:underline">
              Abrir carga de selfie en otra pantalla
            </Link>
          </p>
        ) : null}
      </div>
    );
  }

  if (!snapshot) return null;

  const selfieCaptureUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/order/${preCompraOrderId}/selfies`
      : "";

  const content = (
    <div className="space-y-4">
      {copy ? (
        <div
          className={`rounded-lg px-4 py-3 ${
            phase === "needs_upload"
              ? "border border-[#c27b3d]/30 bg-amber-50/60"
              : "border border-gray-200 bg-gray-50"
          }`}
          role="status"
        >
          <p className="text-sm font-semibold text-[#1a1a1a] m-0">{copy.title}</p>
          <p className="text-sm text-[#6b7280] mt-1 mb-0">{copy.description}</p>
        </div>
      ) : null}

      {variant === "standalone" && !isMobile ? (
        <Card className="bg-amber-50 border-amber-200">
          <p className="text-sm font-medium text-amber-800 mb-2">Recomendado: usar el celular</p>
          <p className="text-sm text-amber-700 mb-4">
            Para tomar la selfie con la cámara frontal, abrí este mismo link en tu celular. Escaneá el QR:
          </p>
          <div className="inline-block p-3 bg-white rounded-lg">
            <div className="w-32 h-32 bg-gray-200 flex items-center justify-center text-xs text-gray-500">
              QR
            </div>
          </div>
          <p className="text-xs text-amber-600 mt-2 break-all">{selfieCaptureUrl}</p>
        </Card>
      ) : null}

      {showUploadUi ? (
        <Card>
          <h2 className="font-medium text-[#1a1a1a] mb-3">
            {variant === "embedded" ? "Identificación del alumno" : "Niños en este pedido"}
          </h2>
          <form onSubmit={addSubject} className="flex gap-2 mb-4">
            <Input
              placeholder="Nombre del niño (ej. Gime)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="secondary" disabled={adding}>
              {adding ? "…" : "Agregar"}
            </Button>
          </form>

          {snapshot.subjects.length === 0 ? (
            <p className="text-sm text-[#6b7280]">Agregá al menos un niño y luego subí su selfie.</p>
          ) : (
            <ul className="space-y-4 m-0 p-0 list-none">
              {snapshot.subjects.map((subject) => (
                <li key={subject.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-[#1a1a1a]">{subject.label}</div>
                  {subject.selfies.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={subject.selfies[0].imageUrl}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <span className="text-sm text-green-600">Selfie cargada</span>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => triggerUpload(subject.id)}
                      disabled={uploadingFor !== null}
                    >
                      {uploadingFor === subject.id ? "Subiendo…" : "Subir selfie"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : snapshot.subjects.some((s) => s.selfies.length > 0) ? (
        <div className="flex flex-wrap gap-3">
          {snapshot.subjects
            .filter((s) => s.selfies.length > 0)
            .map((subject) => (
              <div key={subject.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <img
                  src={subject.selfies[0].imageUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
                <span className="text-sm text-gray-700">{subject.label}</span>
              </div>
            ))}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || uploadingFor == null) return;
          const form = new FormData();
          form.set("subjectId", String(uploadingFor));
          form.set("file", file);
          try {
            const res = await fetch(`/api/precompra/order/${preCompraOrderId}/selfie`, {
              method: "POST",
              body: form,
            });
            if (!res.ok) throw new Error("Error al subir");
            loadOrder();
          } catch {
            setError("No se pudo subir la selfie.");
          }
          setUploadingFor(null);
          e.target.value = "";
        }}
      />

      {phase === "searching" || phase === "received" ? (
        <p className="text-sm text-gray-600 m-0">
          Te avisamos cuando las fotos estén disponibles. Podés volver a esta página cuando quieras.
        </p>
      ) : null}

      {(phase === "photos_ready" || phase === "can_redeem") && redeemHref ? (
        <Link
          href={redeemHref}
          className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
        >
          Elegir fotos
        </Link>
      ) : null}

      {error ? <p className="text-sm text-red-600 m-0">{error}</p> : null}

      {variant === "embedded" ? (
        <p className="text-xs text-gray-500 m-0">
          Si tenés problemas,{" "}
          <Link href={legacyHref} className="text-[#c27b3d] font-semibold hover:underline">
            abrir carga de selfie en otra pantalla
          </Link>
        </p>
      ) : null}
    </div>
  );

  if (variant === "standalone") {
    return (
      <div className="min-h-screen bg-[#f9fafb] w-full min-w-0">
        <header className="bg-white border-b border-gray-200 py-4 px-4 w-full">
          <div className="w-full max-w-4xl mx-auto px-4 sm:px-6">
            <h1 className="text-xl font-semibold text-[#1a1a1a]">Selfies para tus fotos</h1>
            {snapshot.album ? (
              <p className="text-sm text-[#6b7280] mt-1 max-w-2xl">
                Álbum: {snapshot.album.title}. Agregá cada niño y subí su selfie para que podamos
                mostrar solo sus fotos.
              </p>
            ) : null}
          </div>
        </header>

        <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {content}

          <div className="flex flex-wrap gap-3">
            <Link href={`/order/${preCompraOrderId}`}>
              <Button variant="secondary">Mi pedido</Button>
            </Link>
            {snapshot.album ? (
              <>
                <Link href={`/a/${snapshot.album.publicSlug}`}>
                  <Button variant="secondary">Ver álbum</Button>
                </Link>
                <Link href={`/album/${snapshot.album.publicSlug}`}>
                  <Button variant="secondary">Volver al álbum</Button>
                </Link>
              </>
            ) : null}
          </div>
        </main>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-[#e8dcc8] bg-white p-5 sm:p-6 space-y-4">
      <h2 className="text-lg font-medium text-[#1a1a1a] m-0">Identificación por selfie</h2>
      {content}
    </section>
  );
}
