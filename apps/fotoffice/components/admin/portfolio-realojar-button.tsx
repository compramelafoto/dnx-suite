"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Aviso + botón para traer a nuestro bucket las fotos de portfolio que siguen en el sitio viejo.
 *
 * Repite tandas: cada pedido copia unas pocas para no pasarse del tiempo máximo del servidor. El
 * tope de vueltas existe para que un origen que contesta siempre lo mismo no deje la pantalla
 * girando sin fin.
 */
const MAX_VUELTAS = 30;

type Respuesta = {
  traidas: number;
  pendientes: number;
  fallidas: { url: string; motivo: string }[];
  r2Configurado: boolean;
};

export function PortfolioRealojarButton({
  workspaceId,
  pendientes,
}: {
  workspaceId: string;
  pendientes: number;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<"quieto" | "copiando" | "listo" | "error">("quieto");
  const [traidas, setTraidas] = useState(0);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [sinR2, setSinR2] = useState(false);

  async function copiar() {
    setEstado("copiando");
    setMotivos([]);
    let total = 0;
    const errores: string[] = [];

    try {
      for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
        const res = await fetch("/api/admin/portfolios/realojar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ workspaceId }),
        });
        if (!res.ok) throw new Error();
        const r = (await res.json()) as Respuesta;

        if (!r.r2Configurado) {
          setSinR2(true);
          setEstado("error");
          return;
        }

        total += r.traidas;
        errores.push(...r.fallidas.map((f) => f.motivo));
        setTraidas(total);

        // `traidas === 0` corta también cuando todas las de la tanda fallaron: sin eso, una foto
        // que el origen ya no tiene haría girar el botón las 30 vueltas para nada.
        if (r.pendientes === 0 || r.traidas === 0) break;
      }
      setMotivos([...new Set(errores)]);
      setEstado("listo");
      router.refresh();
    } catch {
      setEstado("error");
    }
  }

  const texto =
    estado === "listo"
      ? `Listo: se trajeron ${traidas} fotos.${motivos.length ? " Algunas no se pudieron copiar." : ""}`
      : estado === "copiando"
        ? `Trayendo fotos… ${traidas} hasta ahora. Puede tardar varios minutos.`
        : estado === "error"
          ? sinR2
            ? "Falta configurar R2 en este entorno: sin las claves de escritura no se puede copiar nada."
            : "No se pudieron traer las fotos. Probá de nuevo en un rato."
          : `${pendientes} ${pendientes === 1 ? "foto sigue" : "fotos siguen"} alojadas en el sitio anterior. Si ese sitio se da de baja, los portfolios se vacían.`;

  return (
    <div className="fo-card space-y-3 border-[var(--fo-warning-border)] bg-[var(--fo-warning-soft)] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1">{texto}</p>
        {estado !== "listo" ? (
          <button
            type="button"
            className="fo-btn fo-btn-secondary"
            disabled={estado === "copiando"}
            onClick={() => void copiar()}
          >
            {estado === "copiando" ? "Trayendo…" : "Traerlas a FOTOFFICE"}
          </button>
        ) : null}
      </div>

      {motivos.length > 0 ? (
        <ul className="list-inside list-disc space-y-1 text-xs text-[var(--fo-muted)]">
          {motivos.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
