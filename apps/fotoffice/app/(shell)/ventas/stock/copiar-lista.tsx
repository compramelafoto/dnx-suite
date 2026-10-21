"use client";

import { useEffect, useState } from "react";

/**
 * «Copiar lista»: pone el pedido para un proveedor en el portapapeles, listo para pegar en
 * WhatsApp o en un correo. Si el navegador no deja usar el portapapeles moderno (http, permisos),
 * cae al truco viejo del textarea escondido.
 */
function copiarConTextarea(texto: string): boolean {
  const ta = document.createElement("textarea");
  ta.value = texto;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function CopiarLista({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "error">("listo");

  useEffect(() => {
    if (estado === "listo") return;
    const t = setTimeout(() => setEstado("listo"), 2000);
    return () => clearTimeout(t);
  }, [estado]);

  async function copiar() {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = copiarConTextarea(texto);
    setEstado(ok ? "copiado" : "error");
  }

  return (
    <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={copiar}>
      {estado === "copiado" ? "Copiado" : estado === "error" ? "No se pudo copiar" : "Copiar lista"}
    </button>
  );
}
