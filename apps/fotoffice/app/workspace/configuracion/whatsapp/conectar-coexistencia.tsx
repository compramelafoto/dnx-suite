"use client";

import { useEffect, useRef, useState } from "react";
import { conectarCoexistenciaAction } from "./actions";

/**
 * Botón "Conectar con la app de WhatsApp Business" (registro insertado de Meta en modo coexistencia).
 * Carga el SDK de Facebook sólo al tocarlo, abre la ventana de Meta (ahí se escanea el QR con el
 * celular) y, con el código y los datos del número que manda Meta, guarda la conexión en el servidor.
 */

type FbLogin = (cb: (r: { authResponse?: { code?: string } | null }) => void, opciones: Record<string, unknown>) => void;
type Fb = { init: (o: Record<string, unknown>) => void; login: FbLogin };
declare global {
  interface Window {
    FB?: Fb;
    fbAsyncInit?: () => void;
  }
}

function cargarSdk(appId: string): Promise<Fb> {
  return new Promise((resolve, reject) => {
    if (window.FB) return resolve(window.FB);
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: false, version: "v21.0" });
      resolve(window.FB!);
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/es_LA/sdk.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.onerror = () => reject(new Error("sdk"));
    document.body.appendChild(s);
  });
}

export function ConectarCoexistencia({ appId, configId }: { appId: string; configId: string }) {
  const datos = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  const [estado, setEstado] = useState<{ tipo: "nada" | "esperando" | "ok" | "error"; texto?: string }>({ tipo: "nada" });

  useEffect(() => {
    const escuchar = (e: MessageEvent) => {
      if (typeof e.origin !== "string" || !/(^|\.)facebook\.com$/.test(new URL(e.origin).hostname)) return;
      try {
        const d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
        // Para diagnosticar: qué evento mandó Meta y qué datos trajo (sólo los nombres).
        console.info("[fotoffice] registro insertado de Meta", d.event, Object.keys(d.data ?? {}));
        if (d.event === "CANCEL") setEstado({ tipo: "error", texto: "Se cerró la ventana de Meta sin terminar." });
        else if (d.event === "ERROR") setEstado({ tipo: "error", texto: `Meta informó un error: ${d.data?.error_message ?? "sin detalle"}` });
        else if (d.data?.waba_id || d.data?.phone_number_id) datos.current = { wabaId: d.data.waba_id ? String(d.data.waba_id) : undefined, phoneNumberId: d.data.phone_number_id ? String(d.data.phone_number_id) : undefined };
      } catch {
        // Mensajes de Facebook que no son del registro insertado.
      }
    };
    window.addEventListener("message", escuchar);
    return () => window.removeEventListener("message", escuchar);
  }, []);

  async function conectar() {
    setEstado({ tipo: "esperando" });
    datos.current = {};
    let fb: Fb;
    try {
      fb = await cargarSdk(appId);
    } catch {
      return setEstado({ tipo: "error", texto: "No se pudo cargar Facebook. Revisá que no haya un bloqueador de anuncios." });
    }
    fb.login(
      (r) => {
        const code = r.authResponse?.code;
        if (!code) return setEstado({ tipo: "error", texto: "No se completó la conexión en la ventana de Meta." });
        // Los datos del número llegan por mensaje, a veces un instante después del código.
        void (async () => {
          for (let i = 0; i < 12 && !datos.current.phoneNumberId; i++) await new Promise((x) => setTimeout(x, 250));
          // Si Meta no mandó la cuenta o el número, el servidor los busca con el código.
          const { wabaId, phoneNumberId } = datos.current;
          const res = await conectarCoexistenciaAction({ code, wabaId: wabaId ?? "", phoneNumberId: phoneNumberId ?? "", pagina: `${window.location.origin}${window.location.pathname}` });
          setEstado(res.ok ? { tipo: "ok", texto: res.aviso } : { tipo: "error", texto: res.error });
        })();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      },
    );
  }

  return (
    <section className="fo-card space-y-3 p-5 text-sm" aria-labelledby="wa-coex-titulo">
      <h2 id="wa-coex-titulo" className="text-base font-semibold">Conectar el número del estudio</h2>
      <p className="text-[var(--fo-muted)]">
        Conecta el número que ya usás en la app WhatsApp Business del celular. La app y los grupos siguen funcionando igual y el bot atiende al lado.
        Tené el celular a mano: Meta te va a mostrar un código QR para escanear desde la app (actualizada).
      </p>
      <button type="button" className="fo-btn fo-btn-primary" onClick={conectar} disabled={estado.tipo === "esperando"}>
        {estado.tipo === "esperando" ? "Conectando…" : "Conectar con la app de WhatsApp Business"}
      </button>
      {estado.texto ? (
        <p role="status" className={estado.tipo === "ok" ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}>{estado.texto}</p>
      ) : null}
    </section>
  );
}
