"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { ESTADO_PAGO_LABEL } from "@/lib/eventos/constants";
import { avisarEscaneo, avisoParaTono } from "@/lib/eventos/acreditacion/ui/scan-feedback";
import { esFalloDeConexion } from "@/lib/eventos/acreditacion/ui/offline-queue";
import {
  describirBloqueoDeAcreditacion,
  presentAccreditationEligibilityReason,
} from "@/lib/eventos/acreditacion/elegibilidad";
import { useColaOffline } from "./useColaOffline";
import { ColaOfflinePanel } from "./ColaOfflinePanel";

/**
 * El escáner de la puerta. Es `AccreditationScanner` de Clickatón: cámara con `BarcodeDetector`,
 * ingreso manual, aviso por sonido y vibración, y la cola sin conexión que guarda el escaneo en el
 * celular cuando se cae el wifi. Sin kit ni aparatos de sede (en FOTOFFICE no existen); con la
 * búsqueda por nombre de la puerta anterior y la foto de la persona, que es lo que se mira.
 */

type ScanResult = {
  tone?: "GREEN" | "YELLOW" | "RED" | "BLUE";
  reason?: string;
  canCheckIn?: boolean;
  participant?: {
    inscriptoId: string;
    nombre: string;
    codigo: string;
    tipo: string | null;
    estadoPago: string;
    instagram: string | null;
    fotoUrl: string | null;
    dni: string | null;
  };
  checkIn?: { checkedInAt: string; operatorName: string | null; fuente: string | null } | null;
  error?: string;
  message?: string;
};

type Candidato = {
  inscriptoId: string;
  nombre: string;
  codigo: string;
  tipo: string | null;
  estadoPago: string;
  acreditado: boolean;
  fotoUrl: string | null;
};

const toneClass: Record<string, string> = {
  GREEN: "border-emerald-500/60 bg-emerald-500/10",
  YELLOW: "border-amber-500/60 bg-amber-500/10",
  RED: "border-red-500/60 bg-red-500/10",
  BLUE: "border-sky-500/60 bg-sky-500/10",
};

const toneLabel: Record<string, string> = {
  GREEN: "Listo para acreditar",
  YELLOW: "Revisión necesaria",
  RED: "No válido",
  BLUE: "Ya acreditado",
};

/** Etiqueta corta para reconocer el escaneo en la lista de pendientes. */
function etiquetaDeEscaneo(input: { qr?: string; shortCode?: string }): string {
  if (input.shortCode) return `Código ${input.shortCode}`;
  if (input.qr) return `QR …${input.qr.slice(-6)}`;
  return "Escaneo sin conexión";
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

/** Un QR de la credencial tiene 43 caracteres; un código de entrada, 6 a 10 letras y números. */
function clasificar(valor: string): { qr: string } | { shortCode: string } | { q: string } {
  if (valor.length > 20 || /[?&]qr=/.test(valor)) return { qr: valor };
  if (/^[A-Za-z0-9]{6,10}$/.test(valor) && /\d/.test(valor)) return { shortCode: valor };
  return { q: valor };
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

export function Escaner({ eventoId, habilitada }: { eventoId: string; habilitada: boolean }) {
  const inputId = useId();
  const [pending, startTransition] = useTransition();
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<string>("");
  const cola = useColaOffline(eventoId);
  const { guardarEscaneo } = cola;

  /**
   * Guarda el escaneo en el celular y avisa por pantalla y por sonido.
   *
   * Es lo que separa un corte de wifi de una acreditación perdida: el operador
   * no puede ver acá si la persona pagó, eso se resuelve al sincronizar.
   */
  const guardarSinConexion = useCallback(
    (payload: { qr?: string; shortCode?: string; inscriptoId?: string; nombre?: string }) => {
      const agregada = guardarEscaneo({
        qr: payload.qr,
        shortCode: payload.shortCode,
        registrationIdHint: payload.inscriptoId,
        etiqueta: payload.nombre ?? etiquetaDeEscaneo(payload),
      });
      avisarEscaneo("warning");
      setResult(null);
      setCandidatos(null);
      setMessage(
        agregada
          ? "Sin conexión: guardado en este celular. Se acredita solo cuando vuelva la señal."
          : "Ese escaneo ya estaba guardado esperando conexión.",
      );
    },
    [guardarEscaneo],
  );

  const runScan = useCallback(
    async (payload: { qr?: string; shortCode?: string; inscriptoId?: string; q?: string }) => {
      // Sin señal ni lo intentamos: en la puerta, esperar el timeout es la fila
      // parada. El escaneo se guarda y se resuelve después. (Una búsqueda por
      // nombre no se puede guardar: necesita el listado.)
      if (!cola.enLinea && !payload.q) {
        guardarSinConexion(payload);
        return;
      }
      setMessage(payload.q ? "Buscando…" : "Validando…");
      let res: Response;
      try {
        res = await fetch(`/api/eventos/${eventoId}/acreditacion/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        if (esFalloDeConexion(error)) {
          if (payload.q) {
            setMessage("Sin conexión no se puede buscar por nombre. Escaneá el QR o tipeá el código de la entrada.");
            return;
          }
          guardarSinConexion(payload);
          return;
        }
        throw error;
      }
      const json = (await res.json().catch(() => ({}))) as ScanResult & { candidatos?: Candidato[] };
      if (!res.ok) {
        avisarEscaneo("error");
        setCandidatos(null);
        setResult({ tone: "RED", reason: json.error ?? "ERROR", message: json.message });
        setMessage(json.message ?? json.error ?? "Error");
        return;
      }
      if (json.candidatos) {
        setResult(null);
        setCandidatos(json.candidatos);
        setMessage(json.candidatos.length === 0 ? "No está en el listado. Probá con otro dato." : null);
        return;
      }
      avisarEscaneo(avisoParaTono(json.tone));
      setCandidatos(null);
      setResult(json);
      setMessage(toneLabel[json.tone ?? ""] ?? json.reason ?? null);
    },
    [eventoId, cola.enLinea, guardarSinConexion],
  );

  const confirmCheckIn = useCallback(
    async (excepcion: boolean) => {
      const participante = result?.participant;
      if (!participante?.inscriptoId) return;

      if (!cola.enLinea) {
        guardarSinConexion({ inscriptoId: participante.inscriptoId, nombre: participante.nombre });
        return;
      }

      setMessage("Confirmando acreditación…");
      let res: Response;
      try {
        res = await fetch(`/api/eventos/${eventoId}/acreditacion/check-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inscriptoId: participante.inscriptoId,
            requestId: crypto.randomUUID(),
            excepcion,
            fuente: lastScanRef.current ? "QR" : "PUERTA",
          }),
        });
      } catch (error) {
        // La caída justo al confirmar es el peor caso: la persona ya está en la
        // puerta y verificada. Se guarda con el inscripto ya resuelto.
        if (esFalloDeConexion(error)) {
          guardarSinConexion({ inscriptoId: participante.inscriptoId, nombre: participante.nombre });
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
      setMessage(json.duplicate ? "Ya estaba acreditado: no se duplicó." : "Acreditado correctamente.");
    },
    [eventoId, result?.participant, cola.enLinea, guardarSinConexion],
  );

  // La cámara no debe reiniciarse porque cambió la conexión: se lee siempre la
  // última versión del escaneo desde el ref.
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

        const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        if (!Detector || !videoRef.current) {
          setMessage("Este navegador no lee QR con la cámara (pasa en iPhone). Tipeá el código de la entrada o buscá por nombre.");
          return;
        }
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
        setMessage("No se pudo abrir la cámara. Usá el ingreso manual.");
        setCameraOn(false);
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [cameraOn]);

  const siguiente = () => {
    setResult(null);
    setCandidatos(null);
    setMessage(null);
    lastScanRef.current = "";
    setManual("");
  };

  const p = result?.participant;
  const motivo = presentAccreditationEligibilityReason(result?.reason);

  return (
    <div className="space-y-5">
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

      {!habilitada ? (
        <p className="rounded border border-amber-500/60 bg-amber-500/10 p-3 text-sm">
          La acreditación está apagada: se puede buscar y escanear, pero no confirmar. Encendela en la página del evento.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={`fo-btn ${cameraOn ? "fo-btn-primary" : "fo-btn-secondary"}`}
          onClick={() => setCameraOn((v) => !v)}
        >
          {cameraOn ? "Cerrar cámara" : "Abrir cámara"}
        </button>
        <button type="button" className="fo-btn fo-btn-ghost" onClick={siguiente}>
          Siguiente persona
        </button>
      </div>

      {cameraOn ? (
        <div className="overflow-hidden rounded border border-[var(--fo-border)]">
          <video ref={videoRef} className="aspect-[3/4] w-full max-w-md bg-black object-cover" muted playsInline />
          <p className="p-3 text-xs text-[var(--fo-muted)]">Apuntá al QR de la credencial.</p>
        </div>
      ) : null}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = manual.trim();
          if (!value) return;
          lastScanRef.current = "";
          startTransition(() => {
            void runScan(clasificar(value));
          });
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          Nombre, DNI, teléfono, código o QR
        </label>
        <input
          id={inputId}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          className="fo-input min-w-0 flex-1 text-lg"
          autoComplete="off"
          placeholder="Nombre, DNI, teléfono o código"
        />
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
          Buscar
        </button>
      </form>

      {message ? (
        <p className="text-sm text-[var(--fo-muted)]" role="status">
          {message}
        </p>
      ) : null}

      {candidatos && candidatos.length > 0 ? (
        <ul className="space-y-2">
          {candidatos.map((c) => (
            <li key={c.inscriptoId}>
              <button
                type="button"
                className="fo-card flex w-full items-center gap-3 p-3 text-left"
                onClick={() => startTransition(() => void runScan({ inscriptoId: c.inscriptoId }))}
              >
                {c.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.fotoUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--fo-surface-2,#eee)] text-sm font-semibold">
                    {c.nombre.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{c.nombre}</span>
                  <span className="block text-sm text-[var(--fo-muted)]">
                    {[c.tipo, c.codigo, ESTADO_PAGO_LABEL[c.estadoPago as keyof typeof ESTADO_PAGO_LABEL] ?? c.estadoPago, c.acreditado ? "ya acreditado" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {result?.tone ? (
        <div className={`space-y-4 rounded border p-5 ${toneClass[result.tone] ?? ""}`} role="status" aria-live="polite">
          <p className="text-sm font-semibold uppercase tracking-wide">
            {toneLabel[result.tone]} · {motivo.label}
          </p>
          <p className="text-sm text-[var(--fo-muted)]">{result.message ?? motivo.description}</p>
          {p ? (
            <div className="flex items-start gap-4">
              {p.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.fotoUrl} alt={`Foto de ${p.nombre}`} className="size-24 shrink-0 rounded-lg object-cover" />
              ) : null}
              <div className="min-w-0 space-y-1 text-sm">
                <p className="text-xl font-semibold">{p.nombre}</p>
                <p>
                  {[p.tipo, `Código ${p.codigo}`, p.dni ? `DNI ${p.dni}` : null].filter(Boolean).join(" · ")}
                </p>
                <p>Pago: {ESTADO_PAGO_LABEL[p.estadoPago as keyof typeof ESTADO_PAGO_LABEL] ?? p.estadoPago}</p>
                {p.instagram ? <p>Instagram: @{p.instagram.replace(/^@/, "")}</p> : null}
                {!p.fotoUrl ? <p className="text-[var(--fo-muted)]">Sin foto cargada.</p> : null}
              </div>
            </div>
          ) : null}

          {result.checkIn ? (
            <p className="text-sm">
              Acreditado el {fechaHora(result.checkIn.checkedInAt)}
              {result.checkIn.operatorName ? ` por ${result.checkIn.operatorName}` : ""}.
            </p>
          ) : null}

          {result.canCheckIn && p ? (
            <div className="space-y-2">
              <button
                type="button"
                className="fo-btn fo-btn-primary w-full py-3 text-base"
                disabled={pending}
                onClick={() => startTransition(() => void confirmCheckIn(false))}
              >
                Confirmar acreditación
              </button>
              <p className="text-sm text-[var(--fo-muted)]">Verificá que la persona coincida con la foto y los datos, y confirmá.</p>
            </div>
          ) : null}

          {!result.canCheckIn && p && result.reason === "PAYMENT_PENDING" && habilitada ? (
            <button
              type="button"
              className="fo-btn fo-btn-secondary w-full py-3"
              disabled={pending}
              onClick={() => {
                if (window.confirm("¿Cobraste en la puerta o la organización autoriza que entre igual?")) {
                  startTransition(() => void confirmCheckIn(true));
                }
              }}
            >
              Acreditar con excepción (cobro en la puerta)
            </button>
          ) : null}

          {!result.canCheckIn && p && result.reason !== "ALREADY_CHECKED_IN" ? (
            <div className="rounded border border-[var(--fo-border)] p-3 text-sm">
              <p className="font-semibold">Qué hacer ahora</p>
              <p className="mt-1 text-[var(--fo-muted)]">{describirBloqueoDeAcreditacion(result.reason)}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
