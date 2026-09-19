"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  agregarPendiente,
  contarSinResolver,
  esFalloDeConexion,
  fusionarActualizaciones,
  guardarAparato,
  guardarCola,
  leerAparato,
  leerCola,
  nuevaEntrada,
  purgarSincronizadas,
  quitarEntrada,
  resumenDeCola,
  type EntradaOffline,
  type ResultadoSincronizacion,
} from "@/lib/accreditation/ui/offline-queue";
import { vaciarCola, type Transporte } from "@/lib/accreditation/ui/offline-sync";

/** Cada cuánto reintenta solo mientras queden pendientes (ms). */
const REINTENTO_MS = 30_000;

type RespuestaEnqueue = {
  id?: string;
  syncStatus?: string;
  error?: string;
  message?: string;
};

/**
 * Cola de escaneos sin conexión, vista desde el componente.
 *
 * Guarda en el celular lo que no se pudo mandar y lo reintenta solo: al volver
 * la señal, cada 30 segundos mientras queden pendientes, y cuando el operador
 * aprieta el botón. `navigator.onLine` miente seguido en una sede (el wifi
 * responde pero no sale a internet), por eso el reintento por tiempo existe.
 */
export function useColaOffline(editionId: string) {
  const [entradas, setEntradas] = useState<EntradaOffline[]>([]);
  const [aparatoId, setAparatoId] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enLinea, setEnLinea] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const entradasRef = useRef<EntradaOffline[]>([]);
  const sincronizandoRef = useRef(false);

  // Carga inicial: sólo en el navegador, y una vez.
  useEffect(() => {
    const guardadas = leerCola(editionId);
    entradasRef.current = guardadas;
    setEntradas(guardadas);
    setAparatoId(leerAparato(editionId));
    setEnLinea(typeof navigator === "undefined" ? true : navigator.onLine);
    setListo(true);
  }, [editionId]);

  // Persistir cada cambio. Antes de terminar de cargar no escribe: pisaría la
  // cola guardada con un array vacío.
  useEffect(() => {
    entradasRef.current = entradas;
    if (listo) guardarCola(editionId, entradas);
  }, [editionId, entradas, listo]);

  const elegirAparato = useCallback(
    (id: string | null) => {
      setAparatoId(id);
      guardarAparato(editionId, id);
    },
    [editionId],
  );

  /** Guarda un escaneo que no pudo salir. Devuelve false si ya estaba en la cola. */
  const guardarEscaneo = useCallback(
    (input: {
      qr?: string | null;
      shortCode?: string | null;
      registrationIdHint?: string | null;
      etiqueta: string;
    }) => {
      const entrada = nuevaEntrada({
        qr: input.qr ?? null,
        shortCode: input.shortCode ?? null,
        registrationIdHint: input.registrationIdHint ?? null,
        etiqueta: input.etiqueta,
        deviceId: aparatoId,
        ahora: new Date(),
        clave: crypto.randomUUID(),
      });
      let agregada = false;
      setEntradas((prev) => {
        const r = agregarPendiente(prev, entrada);
        agregada = r.agregada;
        return r.cola;
      });
      return agregada;
    },
    [aparatoId],
  );

  const sincronizar = useCallback(async () => {
    if (sincronizandoRef.current) return;
    if (!entradasRef.current.some((e) => e.estado === "PENDIENTE")) return;

    sincronizandoRef.current = true;
    setSincronizando(true);
    setMensaje("Sincronizando acreditaciones guardadas…");
    const url = `/api/admin/editions/${editionId}/accreditation/offline`;

    const transporte: Transporte = {
      enviar: async (e) => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "enqueue",
            idempotencyKey: e.idempotencyKey,
            action: "CHECKIN",
            clientOccurredAt: e.clientOccurredAt,
            qr: e.qr ?? undefined,
            shortCode: e.shortCode ?? undefined,
            registrationIdHint: e.registrationIdHint ?? undefined,
            deviceId: e.deviceId ?? undefined,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as RespuestaEnqueue;
        if (!res.ok || !json.id) {
          return { ok: false, motivo: json.error ?? `HTTP_${res.status}` };
        }
        return { ok: true, id: json.id, syncStatus: json.syncStatus };
      },
      procesar: async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "sync" }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          results?: ResultadoSincronizacion[];
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          return { ok: false, motivo: json.message ?? json.error ?? "No se pudo sincronizar." };
        }
        return { ok: true, resultados: json.results ?? [] };
      },
    };

    try {
      const { cola, mensaje: aviso } = await vaciarCola(entradasRef.current, transporte);
      // Fusionar y no reemplazar: mientras esto viajaba, el operador pudo
      // escanear a otra persona.
      setEntradas((prev) => fusionarActualizaciones(prev, cola));
      setMensaje(aviso);
    } catch (error) {
      setMensaje(
        esFalloDeConexion(error)
          ? "Sigue sin conexión. Las acreditaciones quedan guardadas en este aparato."
          : "No se pudo sincronizar. Se reintenta solo.",
      );
    } finally {
      sincronizandoRef.current = false;
      setSincronizando(false);
    }
  }, [editionId]);

  // Reacciona a la conexión del navegador.
  useEffect(() => {
    const alVolver = () => {
      setEnLinea(true);
      void sincronizar();
    };
    const alCaer = () => setEnLinea(false);
    window.addEventListener("online", alVolver);
    window.addEventListener("offline", alCaer);
    return () => {
      window.removeEventListener("online", alVolver);
      window.removeEventListener("offline", alCaer);
    };
  }, [sincronizar]);

  // Reintento por tiempo: la única defensa cuando el wifi responde pero no
  // llega a internet, que es el caso típico de una sede llena.
  const hayPendientes = entradas.some((e) => e.estado === "PENDIENTE");
  useEffect(() => {
    if (!listo || !hayPendientes) return;
    void sincronizar();
    const id = setInterval(() => void sincronizar(), REINTENTO_MS);
    return () => clearInterval(id);
  }, [listo, hayPendientes, sincronizar]);

  const quitar = useCallback(
    (clave: string) => setEntradas((prev) => quitarEntrada(prev, clave)),
    [],
  );
  const limpiarSincronizadas = useCallback(
    () => setEntradas((prev) => purgarSincronizadas(prev)),
    [],
  );

  return {
    entradas,
    resumen: resumenDeCola(entradas),
    sinResolver: contarSinResolver(entradas),
    enLinea,
    sincronizando,
    mensaje,
    aparatoId,
    elegirAparato,
    guardarEscaneo,
    sincronizar,
    quitar,
    limpiarSincronizadas,
  };
}
