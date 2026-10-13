"use client";

import { useEffect, useState } from "react";

/**
 * "Probar como cliente": abre en otra pestaña el canje del pack de preventa tal cual lo ve una
 * familia, sobre las fotos reales del álbum (elegir fotos, librito armado, confirmar, extras).
 * Lo que se confirma queda en Pedidos como DEMO en $0: no se cobra ni manda correos.
 *
 * Sólo aparece si el álbum tiene packs de preventa canjeables.
 */
export default function ProbarComoClienteButton({
  albumId,
  variant = "card",
}: {
  albumId: number;
  /** "card": bloque con explicación (pestaña Preventa). "link": sólo el botón, en línea. */
  variant?: "card" | "link";
}) {
  const [disponible, setDisponible] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/dashboard/albums/${albumId}/pack-de-prueba`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo) setDisponible(d?.disponible === true);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [albumId]);

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
          ? "rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b06a2f] disabled:opacity-60"
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
    <section className="w-full max-w-3xl rounded-xl border border-[#e5e7eb] bg-white p-5 space-y-3">
      <h3 className="m-0 text-base font-semibold text-[#1a1a1a]">Probar el canje como una familia</h3>
      <p className="m-0 text-sm text-[#4b5563]">
        Abre el canje de un pack en otra pestaña, igual que lo ve una familia: con las fotos del álbum,
        el librito armado con tu plantilla y las fotos extra. Lo que confirmes aparece en{" "}
        <a href="/fotografo/pedidos" className="underline">Pedidos</a> como <strong>DEMO</strong> en $0, con
        las descargas de un pedido real. No se cobra nada, no entra en tus ventas y no se manda ningún
        correo. Cada vez que tocás el botón la prueba empieza de nuevo.
      </p>
      {boton}
      {error ? <p className="m-0 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
