"use client";

import { useEffect, useState } from "react";

/**
 * "Probar como cliente": abre en otra pestaña el canje del pack de preventa tal cual lo ve una
 * familia, sobre las fotos reales del álbum (elegir fotos, librito armado, confirmar, extras).
 * Lo que se confirma queda en Pedidos como DEMO en $0: no se cobra ni manda correos.
 *
 * En la pestaña Preventa y en Canjes sólo aparece si el álbum tiene packs para canjear. En el
 * encabezado del álbum («Probar canje») aparece en todos los álbumes escolares; si todavía no hay
 * pack, explica que primero hay que armarlo y lleva a la pestaña Preventa.
 */
export default function ProbarComoClienteButton({
  albumId,
  variant = "card",
  onIrAPreventa,
}: {
  albumId: number;
  /**
   * "card": bloque con explicación (pestaña Preventa). "link": sólo el botón, en línea.
   * "header": botón «Probar canje» del encabezado del álbum.
   */
  variant?: "card" | "link" | "header";
  /** Encabezado: lleva a la pestaña Preventa cuando todavía no hay pack para probar. */
  onIrAPreventa?: () => void;
}) {
  const [disponible, setDisponible] = useState(false);
  const [escolar, setEscolar] = useState(false);
  const [sinPack, setSinPack] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/dashboard/albums/${albumId}/pack-de-prueba`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return;
        setDisponible(d?.disponible === true);
        setEscolar(d?.escolar === true);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [albumId]);

  if (variant === "header") {
    if (!escolar) return null;
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => (disponible ? void probar() : setSinPack((v) => !v))}
          disabled={abriendo}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-[#c27b3d]/40 bg-white px-3 text-sm font-semibold text-[#c27b3d] shadow-sm transition-colors hover:bg-[#c27b3d]/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c27b3d] disabled:opacity-60"
          title="Abrir el canje como lo ve una familia, con las fotos del álbum. Queda en Pedidos como DEMO, en $0."
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {abriendo ? "Preparando…" : "Probar canje"}
        </button>
        {sinPack ? (
          <div className="absolute right-0 top-12 z-30 w-72 rounded-lg border border-[#e5e7eb] bg-white p-3 text-sm text-[#374151] shadow-lg">
            Para probar el canje, primero armá el pack de preventa del álbum (qué fotos y qué librito
            recibe cada familia).
            {onIrAPreventa ? (
              <button
                type="button"
                onClick={() => {
                  setSinPack(false);
                  onIrAPreventa();
                }}
                className="mt-2 block font-semibold text-[#c27b3d] underline"
              >
                Ir a Preventa
              </button>
            ) : null}
          </div>
        ) : null}
        {error ? (
          <div className="absolute right-0 top-12 z-30 w-72 rounded-lg border border-red-200 bg-white p-3 text-sm text-red-700 shadow-lg">
            {error}
          </div>
        ) : null}
      </div>
    );
  }

  if (!disponible) return null;

  async function probar() {
    setError(null);
    setAbriendo(true);
    // La pestaña se abre antes de esperar al servidor: si se abre después, el navegador la toma
    // como ventana emergente y la bloquea.
    const ventana = window.open("about:blank", "_blank");
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/pack-de-prueba`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "No pudimos armar la prueba.");
      if (ventana) ventana.location.href = data.url;
      else window.location.href = data.url;
    } catch (e) {
      ventana?.close();
      setError(e instanceof Error ? e.message : "No pudimos armar la prueba.");
    } finally {
      setAbriendo(false);
    }
  }

  const boton = (
    <button
      type="button"
      onClick={() => void probar()}
      disabled={abriendo}
      className={
        variant === "card"
          ? "inline-flex items-center rounded-lg bg-[#c27b3d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#b06a2f] disabled:opacity-60"
          : "font-medium text-[#c27b3d] underline disabled:opacity-60"
      }
    >
      {abriendo ? (variant === "card" ? "Preparando la prueba…" : "preparando la prueba…") : variant === "card" ? "Probar como cliente" : "probalo como cliente"}
    </button>
  );

  if (variant === "link") {
    return (
      <span>
        Guardá los cambios y {boton} para recorrer el canje con las fotos del álbum, como una
        familia (queda en Pedidos como DEMO, en $0).
        {error ? <span className="ml-2 text-red-700">{error}</span> : null}
      </span>
    );
  }

  return (
    <section className="w-full max-w-3xl rounded-xl border border-[#e5e7eb] bg-white p-6">
      <h3 className="m-0 text-base font-semibold text-[#1a1a1a]">Probar el canje como una familia</h3>
      {/* Márgenes explícitos: `space-y` no separaba el botón del texto y quedaban pegados. */}
      <p className="m-0 mt-2 text-sm leading-relaxed text-[#4b5563]">
        Abre el canje de un pack en otra pestaña, igual que lo ve una familia: con las fotos del álbum,
        el librito armado con tu plantilla y las fotos extra. Lo que confirmes aparece en{" "}
        <a href="/fotografo/pedidos" className="underline">Pedidos</a> como <strong>DEMO</strong> en $0, con
        las descargas de un pedido real. No se cobra nada, no entra en tus ventas y no se manda ningún
        correo. Cada vez que tocás el botón la prueba empieza de nuevo.
      </p>
      <div className="mt-5">{boton}</div>
      {error ? <p className="m-0 mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
