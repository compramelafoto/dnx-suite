"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { paymentStatusLabel } from "@/lib/admin-registration/ui/status-labels";
import { presentAdminFulfillmentStatus } from "@/lib/admin-registration/ui/admin-status-presentation";
import { presentAccreditationEligibilityReason } from "@/lib/social-communications/ui/social-communications-status-presentation";

type ScanResult = {
  tone?: "GREEN" | "YELLOW" | "RED" | "BLUE";
  reason?: string;
  canCheckIn?: boolean;
  participant?: {
    registrationId: string;
    firstName: string;
    lastName: string;
    participantNumber: string | null;
    paymentStatus: string;
    instagramHandle: string | null;
    hasProfilePhoto: boolean;
  };
  kitItems?: Array<{
    id: string;
    nameSnapshot: string;
    variantNameSnapshot: string | null;
    fulfillmentStatus: string;
  }>;
  checkIn?: {
    id: string;
    checkedInAt: string;
    operatorName: string | null;
    identityStatus: string;
  } | null;
  window?: { canCheckIn: boolean | null; accreditationEnabled: boolean; serverNow: string };
  error?: string;
  message?: string;
};

const toneClass: Record<string, string> = {
  GREEN: "border-emerald-500/50 bg-emerald-500/10",
  YELLOW: "border-amber-500/50 bg-amber-500/10",
  RED: "border-red-500/50 bg-red-500/10",
  BLUE: "border-sky-500/50 bg-sky-500/10",
};

const toneLabel: Record<string, string> = {
  GREEN: "Listo para acreditar",
  YELLOW: "Revisión necesaria",
  RED: "No válido",
  BLUE: "Ya acreditado",
};

type Props = { editionId: string };

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

export function AccreditationScanner({ editionId }: Props) {
  const inputId = useId();
  const [pending, startTransition] = useTransition();
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<string>("");

  const runScan = useCallback(
    async (payload: { qr?: string; shortCode?: string }) => {
      setMessage("Validando…");
      const res = await fetch(`/api/admin/editions/${editionId}/accreditation/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ScanResult;
      if (!res.ok) {
        setResult({ tone: "RED", reason: json.error ?? "ERROR", message: json.message });
        setMessage(json.message ?? json.error ?? "Error");
        return;
      }
      setResult(json);
      setMessage(toneLabel[json.tone ?? ""] ?? json.reason ?? null);
    },
    [editionId],
  );

  const confirmCheckIn = useCallback(async () => {
    if (!result?.participant?.registrationId) return;
    setMessage("Confirmando check-in…");
    const res = await fetch(`/api/admin/editions/${editionId}/accreditation/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        registrationId: result.participant.registrationId,
        requestId: crypto.randomUUID(),
        identityStatus: "VERIFIED",
      }),
    });
    const json = (await res.json()) as { result?: ScanResult; duplicate?: boolean; error?: string; message?: string };
    if (!res.ok) {
      setMessage(json.message ?? json.error ?? "No se pudo acreditar");
      return;
    }
    if (json.result) setResult(json.result);
    setMessage(json.duplicate ? "Ya estaba acreditado (idempotente)." : "Acreditado correctamente.");
  }, [editionId, result?.participant?.registrationId]);

  const deliverItem = useCallback(
    async (itemId: string) => {
      if (!result?.participant?.registrationId) return;
      setMessage("Registrando entrega…");
      const res = await fetch(`/api/admin/editions/${editionId}/accreditation/kit-deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId: result.participant.registrationId,
          itemId,
        }),
      });
      const json = (await res.json()) as ScanResult & { error?: string; message?: string };
      if (!res.ok) {
        setMessage(json.message ?? json.error ?? "No se pudo entregar");
        return;
      }
      setResult(json);
      setMessage("Artículo marcado como entregado.");
    },
    [editionId, result?.participant?.registrationId],
  );

  useEffect(() => {
    if (!cameraOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
          .BarcodeDetector;
        if (!Detector || !videoRef.current) return;
        const detector = new Detector({ formats: ["qr_code"] });
        const tick = async () => {
          if (!cameraOn || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value && value !== lastScanRef.current) {
              lastScanRef.current = value;
              await runScan({ qr: value });
            }
          } catch {
            /* ignore frame errors */
          }
          if (cameraOn) requestAnimationFrame(() => void tick());
        };
        requestAnimationFrame(() => void tick());
      } catch {
        setMessage("No se pudo abrir la cámara. Usá ingreso manual.");
        setCameraOn(false);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn, runScan]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={cameraOn ? "primary" : "secondary"}
          onClick={() => setCameraOn((v) => !v)}
        >
          {cameraOn ? "Cerrar cámara" : "Abrir cámara"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setResult(null);
            setMessage(null);
            lastScanRef.current = "";
            setManual("");
          }}
        >
          Siguiente participante
        </Button>
      </div>

      {cameraOn ? (
        <div className="overflow-hidden rounded border border-ck-border">
          <video ref={videoRef} className="aspect-[3/4] w-full max-w-md bg-black object-cover" muted playsInline />
          <p className="p-3 text-xs text-ck-text-muted">
            Apuntá al QR. Si el navegador no soporta BarcodeDetector, usá el ingreso manual.
          </p>
        </div>
      ) : null}

      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const value = manual.trim();
          if (!value) return;
          startTransition(() => {
            void runScan(value.length > 20 ? { qr: value } : { shortCode: value });
          });
        }}
      >
        <label className="flex-1 text-sm" htmlFor={inputId}>
          QR / código / número
          <input
            id={inputId}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            className="mt-1 w-full rounded border border-ck-border bg-transparent px-3 py-3 text-base"
            autoComplete="off"
            inputMode="text"
            placeholder="Pegá token QR o número de participante"
          />
        </label>
        <Button type="submit" variant="primary" disabled={pending} className="sm:self-end">
          Buscar
        </Button>
      </form>

      {message ? (
        <p className="text-sm text-ck-text-secondary" role="status">
          {message}
        </p>
      ) : null}

      {result?.tone ? (
        <div
          className={`space-y-4 rounded border p-5 ${toneClass[result.tone] ?? ""}`}
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold uppercase tracking-wide">
            {toneLabel[result.tone]} ·{" "}
            {presentAccreditationEligibilityReason(result.reason).label}
          </p>
          <p className="text-sm text-ck-text-secondary">
            {presentAccreditationEligibilityReason(result.reason).description}
          </p>
          {result.participant ? (
            <div className="space-y-1 text-sm">
              <p className="text-lg font-semibold">
                {result.participant.firstName} {result.participant.lastName}
              </p>
              <p>Número de participante: {result.participant.participantNumber ?? "—"}</p>
              <p>
                Pago:{" "}
                {paymentStatusLabel(
                  result.participant.paymentStatus as Parameters<
                    typeof paymentStatusLabel
                  >[0],
                )}
              </p>
              <p>
                Usuario de Instagram del participante:{" "}
                {result.participant.instagramHandle
                  ? `@${result.participant.instagramHandle.replace(/^@/, "")}`
                  : "Instagram no informado"}
              </p>
              <p>
                Foto de perfil:{" "}
                {result.participant.hasProfilePhoto ? "Disponible" : "No cargada"}
              </p>
            </div>
          ) : null}

          {result.checkIn ? (
            <p className="text-sm">
              Acreditado el {new Date(result.checkIn.checkedInAt).toLocaleString("es-AR")}
              {result.checkIn.operatorName ? ` por ${result.checkIn.operatorName}` : ""}.
              Identidad:{" "}
              {result.checkIn.identityStatus === "VERIFIED"
                ? "Verificada"
                : result.checkIn.identityStatus}
            </p>
          ) : null}

          {result.kitItems && result.kitItems.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {result.kitItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ck-border/50 pt-2">
                  <span>
                    {item.nameSnapshot}
                    {item.variantNameSnapshot ? ` · ${item.variantNameSnapshot}` : ""} ·{" "}
                    {presentAdminFulfillmentStatus(item.fulfillmentStatus).label}
                  </span>
                  {item.fulfillmentStatus !== "DELIVERED" && item.fulfillmentStatus !== "CANCELLED" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => startTransition(() => void deliverItem(item.id))}
                    >
                      Entregar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {result.canCheckIn && result.participant ? (
            <Button
              type="button"
              variant="primary"
              disabled={pending}
              onClick={() => startTransition(() => void confirmCheckIn())}
            >
              Confirmar acreditación
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
