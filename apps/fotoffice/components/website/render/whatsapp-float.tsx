"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { WHATSAPP_BUTTON_SIZE_PX, type WhatsappButtonSide, type WhatsappButtonSize } from "@/lib/website/site-settings";

const CLAVE_CERRADO = "fo-wa-bienvenida-cerrada";

/**
 * Botón flotante de WhatsApp del sitio público (Sitio web → Ajustes). El enlace llega armado
 * desde el servidor con `whatsappHref` (número normalizado + texto inicial del chat).
 *
 * El globito de bienvenida es opcional y se puede cerrar; cerrado, no vuelve a aparecer en esa
 * pestaña (sessionStorage, protegido con try/catch: en modo privado puede fallar).
 *
 * Para no tapar el final de la página en el celular, deja un espacio del alto del botón al pie.
 */
export function WhatsappFloat({
  href,
  welcomeMessage,
  side,
  size,
}: {
  href: string;
  welcomeMessage: string;
  side: WhatsappButtonSide;
  size: WhatsappButtonSize;
}) {
  const px = WHATSAPP_BUTTON_SIZE_PX[size];
  const [globo, setGlobo] = useState(false);

  useEffect(() => {
    if (!welcomeMessage) return;
    let cerrado = false;
    try {
      cerrado = window.sessionStorage.getItem(CLAVE_CERRADO) === "1";
    } catch {
      // sin almacenamiento: se muestra igual
    }
    if (cerrado) return;
    const t = window.setTimeout(() => setGlobo(true), 1500);
    return () => window.clearTimeout(t);
  }, [welcomeMessage]);

  function cerrarGlobo() {
    setGlobo(false);
    try {
      window.sessionStorage.setItem(CLAVE_CERRADO, "1");
    } catch {
      // nada
    }
  }

  const lado = side === "left" ? { left: "max(16px, env(safe-area-inset-left))" } : { right: "max(16px, env(safe-area-inset-right))" };

  return (
    <>
      {/* Espacio al final de la página: lo último del pie no queda debajo del botón. */}
      <div aria-hidden="true" style={{ height: px + 24, backgroundColor: "var(--wsite-bg)" }} />
      <div
        className={`fixed z-40 flex items-end gap-2 ${side === "left" ? "flex-row" : "flex-row-reverse"}`}
        style={{ ...lado, bottom: "max(16px, env(safe-area-inset-bottom))" }}
      >
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escribinos por WhatsApp"
          title="Escribinos por WhatsApp"
          className="flex shrink-0 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ width: px, height: px, backgroundColor: "#25D366", color: "#fff" }}
        >
          <svg viewBox="0 0 24 24" width={px * 0.55} height={px * 0.55} fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
          </svg>
        </a>
        {globo ? (
          <div
            role="status"
            className="relative mb-1 rounded-2xl bg-white px-4 py-3 pr-9 text-sm text-neutral-800 shadow-lg"
            style={{ maxWidth: `min(260px, calc(100vw - ${px + 56}px))` }}
          >
            <a href={href} target="_blank" rel="noopener noreferrer" className="block">
              {welcomeMessage}
            </a>
            <button
              type="button"
              onClick={cerrarGlobo}
              aria-label="Cerrar mensaje"
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
