"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { paymentStatusLabel } from "@/lib/admin-registration/ui/status-labels";
import { presentAdminFulfillmentStatus } from "@/lib/admin-registration/ui/admin-status-presentation";
import { presentAccreditationEligibilityReason } from "@/lib/social-communications/ui/social-communications-status-presentation";
import { avisarEscaneo, avisoParaTono } from "@/lib/accreditation/ui/scan-feedback";
import { describirBloqueoDeAcreditacion } from "@/lib/accreditation/ui/scan-guidance";
import { esFalloDeConexion } from "@/lib/accreditation/ui/offline-queue";
import { useColaOffline } from "./useColaOffline";
import { ColaOfflinePanel } from "./ColaOfflinePanel";
import { fechaHoraAr } from "@/lib/fecha-ar";

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
  window?: {
    canCheckIn: boolean | null;
    accreditationEnabled: boolean;
    serverNow: string;
    opensAt?: string | null;
    closesAt?: string | null;
    timezone?: string | null;
  };
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

export type AparatoDeSede = { id: string; name: string };

type Props = { editionId: string; devices?: AparatoDeSede[] };

/** Etiqueta corta para reconocer el escaneo en la lista de pendientes. */
function etiquetaDeEscaneo(input: { qr?: string; shortCode?: string }): string {
  if (input.shortCode) return `Nº ${input.shortCode}`;
  if (input.qr) return `QR …${input.qr.slice(-6)}`;
  return "Escaneo sin conexión";
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

export function AccreditationScanner({ editionId, devices = [] }: Props) {
  const inputId = useId();
  const aparatoId = useId();
  const [pending, startTransition] = useTransition();
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<string>("");
  const cola = useColaOffline(editionId);
  const { guardarEscaneo } = cola;

  /**
   * Guarda el escaneo en el celular y avisa por pantalla y por sonido.
   *
   * Es lo que separa un corte de wifi de una acreditación perdida: el operador
   * no puede ver acá si la persona pagó, eso se resuelve al sincronizar.
   */
  const guardarSinConexion = useCallback(
    (payload: { qr?: string; shortCode?: string; registrationId?: string; nombre?: string }) => {
      const agregada = guardarEscaneo({
        qr: payload.qr,
        shortCode: payload.shortCode,
        registrationIdHint: payload.registrationId,
        etiqueta: payload.nombre ?? etiquetaDeEscaneo(payload),
      });
      avisarEscaneo("warning");
      setResult(null);
      setMessage(
        agregada
          ? "Sin conexión: guardado en este celular. Se acredita solo cuando vuelva la señal."
          : "Ese escaneo ya estaba guardado esperando conexión.",
      );
    },
    [guardarEscaneo],
  );

  const runScan = useCallback(
    async (payload: { qr?: string; shortCode?: string }) => {
      // Sin señal ni lo intentamos: en la puerta, esperar el timeout es la fila
      // parada. El escaneo se guarda y se resuelve después.
      if (!cola.enLinea) {
        guardarSinConexion(payload);
        return;
      }
      setMessage("Validando…");
      let res: Response;
      try {
        res = await fetch(`/api/admin/editions/${editionId}/accreditation/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        if (esFalloDeConexion(error)) {
          guardarSinConexion(payload);
          return;
        }
        throw error;
      }
      const json = (await res.json().catch(() => ({}))) as ScanResult;
      if (!res.ok) {
        avisarEscaneo("error");
        setResult({ tone: "RED", reason: json.error ?? "ERROR", message: json.message });
        setMessage(json.message ?? json.error ?? "Error");
        return;
      }
      avisarEscaneo(avisoParaTono(json.tone));
      setResult(json);
      setMessage(toneLabel[json.tone ?? ""] ?? json.reason ?? null);
    },
    [editionId, cola.enLinea, guardarSinConexion],
  );

  const confirmCheckIn = useCallback(async () => {
    const participante = result?.participant;
    if (!participante?.registrationId) return;
    const nombre = `${participante.firstName} ${participante.lastName}`.trim();

    if (!cola.enLinea) {
      guardarSinConexion({ registrationId: participante.registrationId, nombre });
      return;
    }

    setMessage("Confirmando check-in…");
    let res: Response;
    try {
      res = await fetch(`/api/admin/editions/${editionId}/accreditation/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId: participante.registrationId,
          requestId: crypto.randomUUID(),
          identityStatus: "VERIFIED",
          deviceId: cola.aparatoId ?? undefined,
        }),
      });
    } catch (error) {
      // La caída justo al confirmar es el peor caso: la persona ya está en la
      // puerta y verificada. Se guarda con la inscripción ya resuelta.
      if (esFalloDeConexion(error)) {
        guardarSinConexion({ registrationId: participante.registrationId, nombre });
        return;
      }
      throw error;
    }
    const json = (await res.json().catch(() => ({}))) as {
      result?: ScanResult;
      duplicate?: boolean;
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      avisarEscaneo("error");
      setMessage(json.message ?? json.error ?? "No se pudo acreditar");
      return;
    }
    avisarEscaneo(json.duplicate ? "warning" : "ok");
    if (json.result) setResult(json.result);
    setMessage(json.duplicate ? "Ya estaba acreditado (idempotente)." : "Acreditado correctamente.");
  }, [editionId, result?.participant, cola.enLinea, cola.aparatoId, guardarSinConexion]);

  const deliverItem = useCallback(
    async (itemId: string) => {
      if (!result?.participant?.registrationId) return;
      setMessage("Registrando entrega…");
      let res: Response;
      try {
        res = await fetch(`/api/admin/editions/${editionId}/accreditation/kit-deliver`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationId: result.participant.registrationId,
            itemId,
          }),
        });
      } catch (error) {
        // La entrega del kit no tiene respaldo sin conexión: el servidor sólo
        // sabe reponer acreditaciones. Se dice en claro en vez de fingir.
        if (esFalloDeConexion(error)) {
          avisarEscaneo("error");
          setMessage(
            "Sin conexión no se puede registrar la entrega del kit. Entregalo y cargalo cuando vuelva la señal.",
          );
          return;
        }
        throw error;
      }
      const json = (await res.json().catch(() => ({}))) as ScanResult & {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setMessage(json.message ?? json.error ?? "No se pudo entregar");
        return;
      }
      setResult(json);
      setMessage("Artículo marcado como entregado.");
    },
    [editionId, result?.participant?.registrationId],
  );

  // La cámara no debe reiniciarse porque cambió la conexión o el aparato
  // elegido: se lee siempre la última versión del escaneo desde el ref.
  const runScanRef = useRef(runScan);
  useEffect(() => {
    runScanRef.current = runScan;
  }, [runScan]);

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
          // `cancelled` y no `cameraOn`: el valor del closure queda viejo y el
          // bucle seguía girando para siempre después de cerrar la cámara.
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value && value !== lastScanRef.current) {
              lastScanRef.current = value;
              await runScanRef.current({ qr: value });
            }
          } catch {
            /* ignore frame errors */
          }
          if (!cancelled) requestAnimationFrame(() => void tick());
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
  }, [cameraOn]);

  return (
    <div className="space-y-6">
      <ColaOfflinePanel
        entradas={cola.entradas}
        sinResolver={cola.sinResolver}
        enLinea={cola.enLinea}
        sincronizando={cola.sincronizando}
        mensaje={cola.mensaje}
        onSincronizar={() => void cola.sincronizar()}
        onQuitar={cola.quitar}
        onLimpiar={cola.limpiarSincronizadas}
      />

      {devices.length > 0 ? (
        <label className="block text-sm" htmlFor={aparatoId}>
          Aparato de la sede
          <select
            id={aparatoId}
            value={cola.aparatoId ?? ""}
            onChange={(e) => cola.elegirAparato(e.target.value || null)}
            className="mt-1 w-full rounded border border-ck-border bg-transparent px-3 py-3 text-base"
          >
            <option value="">Sin identificar</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ck-text-muted">
            Queda registrado con qué aparato se acreditó a cada persona. Se recuerda en este
            celular.
          </span>
        </label>
      ) : null}

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
              Acreditado el {fechaHoraAr(result.checkIn.checkedInAt)}
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
            <div className="space-y-2">
              <Button
                type="button"
                variant="primary"
                disabled={pending}
                onClick={() => startTransition(() => void confirmCheckIn())}
              >
                Confirmar acreditación
              </Button>
              <p className="text-sm text-ck-text-secondary">
                Verificá que la persona coincida con los datos y confirmá.
                {result.kitItems && result.kitItems.length > 0
                  ? " Después registrá la entrega de cada ítem del kit."
                  : ""}
              </p>
            </div>
          ) : null}

          {!result.canCheckIn && result.participant && result.reason !== "ALREADY_CHECKED_IN" ? (
            <div className="rounded border border-ck-border/60 bg-ck-black/20 p-3 text-sm">
              <p className="font-semibold">Qué hacer ahora</p>
              <p className="mt-1 text-ck-text-secondary">
                {describirBloqueoDeAcreditacion({
                  reason: result.reason,
                  window: result.window,
                })}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
