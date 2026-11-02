"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { INTERVALO_PANTALLA_MS, type Comando, type EstadoPantalla } from "@/lib/control-remoto/protocolo";

/**
 * La pantalla grande del control remoto: abre la sesión, publica su estado y ejecuta las órdenes que
 * llegan del celular. La sesión se recuerda en `localStorage`, así sobrevive a recargas y a la demo
 * en vivo, que cambia de página en cada paso.
 * Copia idéntica en ComprameLaFoto (`apps/compramelafoto/components/control-remoto/usePantallaRemota.ts`).
 */

type Guardada = { id: string; clave: string; qr: string; enlace: string; vence: number; seq: number };
export type EstadoCelular = "esperando" | "conectado" | "desconectado";

function leerGuardada(clave: string): Guardada | null {
  try {
    const g = JSON.parse(window.localStorage.getItem(clave) || "null") as Guardada | null;
    return g && g.vence > Date.now() ? g : null;
  } catch {
    return null;
  }
}
function guardar(clave: string, g: Guardada | null) {
  try {
    if (g) window.localStorage.setItem(clave, JSON.stringify(g));
    else window.localStorage.removeItem(clave);
  } catch {}
}

async function hablar(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/control-remoto/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return { res, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

export function usePantallaRemota(opciones: {
  /** Clave de `localStorage` (una por pantalla). */
  clave: string;
  /** Lo que se le manda a `POST /api/control-remoto` para abrir la sesión. */
  pedido: Record<string, unknown>;
  estado: EstadoPantalla;
  alComando: (c: Comando) => void;
  /** Apagado, la pantalla no consulta ni obedece (por ejemplo, la guía abierta en otra ventana). */
  activo?: boolean;
}) {
  const { clave, pedido, activo = true } = opciones;
  const [sesion, setSesion] = useState<Guardada | null>(null);
  const [celular, setCelular] = useState<EstadoCelular>("esperando");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const estadoRef = useRef(opciones.estado);
  const alComandoRef = useRef(opciones.alComando);
  const pedidoRef = useRef(pedido);
  useEffect(() => {
    estadoRef.current = opciones.estado;
    alComandoRef.current = opciones.alComando;
    pedidoRef.current = pedido;
  });

  useEffect(() => {
    setSesion(leerGuardada(clave));
  }, [clave]);

  // El ciclo de consultas: publica el estado si cambió y ejecuta las órdenes nuevas en orden.
  useEffect(() => {
    if (!sesion || !activo) return;
    let cancelado = false;
    let t: number | undefined;
    let publicado = "";
    let seq = sesion.seq;

    const consultar = async () => {
      let pendientes = false;
      const estado = JSON.stringify(estadoRef.current);
      try {
        const { res, data } = await hablar(sesion.id, {
          accion: "pantalla",
          clave: sesion.clave,
          desde: seq,
          estado: estado !== publicado ? estadoRef.current : undefined,
        });
        if (cancelado) return;
        if (res.status === 410) {
          guardar(clave, null);
          setSesion(null);
          return;
        }
        if (res.ok) {
          publicado = estado;
          setCelular(data.celular as EstadoCelular);
          // Una orden por vuelta: la pantalla tiene que redibujarse antes de la siguiente («Siguiente»
          // dos veces seguidas son dos placas, no dos veces la misma). El resto llega en la próxima vuelta.
          const [orden] = (data.comandos as { seq: number; comando: Comando }[]) ?? [];
          const nuevo = orden ? orden.seq : Number(data.seq);
          if (nuevo !== seq) {
            seq = nuevo;
            // Primero se anota hasta dónde se leyó: una orden que cambia de página no se repite al volver.
            const g = leerGuardada(clave);
            if (g && g.id === sesion.id) guardar(clave, { ...g, seq });
          }
          if (orden) alComandoRef.current(orden.comando);
          pendientes = Number(data.seq) > seq;
        }
      } catch {
        // Sin conexión: se reintenta en la próxima vuelta.
      }
      // Si quedaron órdenes en fila, se vuelve enseguida (después de que la pantalla se redibuje).
      if (!cancelado) t = window.setTimeout(consultar, pendientes ? 150 : INTERVALO_PANTALLA_MS);
    };
    void consultar();
    return () => {
      cancelado = true;
      window.clearTimeout(t);
    };
  }, [sesion, clave, activo]);

  const abrir = useCallback(async () => {
    setError(null);
    setTrabajando(true);
    try {
      const res = await fetch("/api/control-remoto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pedidoRef.current),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data.error || "No se pudo abrir el control remoto."));
      // seq -1: la primera consulta sólo averigua el número, sin órdenes viejas.
      const g: Guardada = {
        id: String(data.id),
        clave: String(data.clave),
        qr: String(data.qr),
        enlace: String(data.enlace),
        vence: Number(data.vence),
        seq: -1,
      };
      guardar(clave, g);
      setCelular("esperando");
      setSesion(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el control remoto.");
    } finally {
      setTrabajando(false);
    }
  }, [clave]);

  const nuevoCodigo = useCallback(async () => {
    if (!sesion) return;
    setTrabajando(true);
    try {
      const { res, data } = await hablar(sesion.id, { accion: "renovar", clave: sesion.clave });
      if (!res.ok) throw new Error();
      const g = { ...(leerGuardada(clave) ?? sesion), qr: String(data.qr), enlace: String(data.enlace) };
      guardar(clave, g);
      setCelular("esperando");
      setSesion(g);
    } catch {
      setError("No se pudo pedir un código nuevo.");
    } finally {
      setTrabajando(false);
    }
  }, [sesion, clave]);

  const apagar = useCallback(async () => {
    if (!sesion) return;
    guardar(clave, null);
    setSesion(null);
    await hablar(sesion.id, { accion: "cerrar", clave: sesion.clave }).catch(() => {});
  }, [sesion, clave]);

  return { sesion, celular, error, trabajando, abrir, nuevoCodigo, apagar };
}
