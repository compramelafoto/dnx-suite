"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Aviso + botón para traer las imágenes del blog anterior. Repite tandas hasta terminar: cada
 * pedido copia unas pocas para no pasarse del tiempo máximo del servidor.
 */
export function LocalizeImagesButton({ pendientes }: { pendientes: number }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"quieto" | "copiando" | "listo" | "error">("quieto");
  const [copiadas, setCopiadas] = useState(0);
  const [fallidas, setFallidas] = useState<string[]>([]);

  async function copiar() {
    setEstado("copiando");
    let total = 0;
    const errores: string[] = [];
    try {
      for (let vuelta = 0; vuelta < 20; vuelta++) {
        const res = await fetch("/api/website/blog/media/localize", { method: "POST" });
        if (!res.ok) throw new Error();
        const r = (await res.json()) as { copiadas: number; pendientes: number; fallidas: { motivo: string }[] };
        total += r.copiadas;
        errores.push(...r.fallidas.map((f) => f.motivo));
        setCopiadas(total);
        if (r.pendientes === 0 || r.copiadas === 0) break;
      }
      setFallidas(errores);
      setEstado("listo");
      router.refresh();
    } catch {
      setEstado("error");
    }
  }

  return (
    <div className="fo-card flex flex-wrap items-center justify-between gap-3 border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-4 text-sm">
      <p className="min-w-0 flex-1">
        {estado === "listo"
          ? `Listo: se copiaron ${copiadas} imágenes.${fallidas.length ? ` ${fallidas.length} no se pudieron copiar.` : ""}`
          : estado === "copiando"
            ? `Copiando imágenes… ${copiadas} hasta ahora.`
            : estado === "error"
              ? "No se pudieron copiar las imágenes. Probá de nuevo en un rato."
              : `${pendientes} ${pendientes === 1 ? "imagen sigue" : "imágenes siguen"} guardadas en el sitio anterior. Si ese sitio se da de baja, se pierden.`}
      </p>
      {estado !== "listo" ? (
        <button type="button" className="fo-btn fo-btn-secondary" disabled={estado === "copiando"} onClick={() => void copiar()}>
          {estado === "copiando" ? "Copiando…" : "Traerlas a FOTOFFICE"}
        </button>
      ) : null}
    </div>
  );
}
