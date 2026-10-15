"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatArDay } from "@repo/muestras";
import { CopiarEnlace } from "@/components/enlace/copiar-enlace";
import { marcarEnlaceMandado } from "@/lib/concursos/acciones";
import type { PanelDelConcurso } from "@/lib/concursos/consultas";
import { alerta, botonChico, nota } from "./estilos";

type Autor = PanelDelConcurso["autores"][number];

/** El enlace para mandarle al autor a mano (D21): copiar el enlace o el mensaje listo, y "Ya se lo mandé". */
export function EnlaceAutor({ autor: a, editable }: { autor: Autor; editable: boolean }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copiarMensaje = async () => {
    try {
      await navigator.clipboard.writeText(a.mensaje);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <li className="space-y-2 border-b border-[var(--mf-line)] py-4">
      <p className="break-words text-[17px]">
        {a.nombre}{" "}
        <span className={nota}>
          · {a.obras} {a.obras === 1 ? "obra" : "obras"}
          {a.pendientes ? ` · ${a.pendientes} ${a.pendientes === 1 ? "espera" : "esperan"} su respuesta` : ""}
          {a.respondedAt ? ` · respondió el ${formatArDay(a.respondedAt)}` : ""}
          {a.notifiedAt ? ` · se lo mandaste el ${formatArDay(a.notifiedAt)}` : ""}
        </span>
      </p>
      {editable ? (
        <>
          <CopiarEnlace url={a.url} etiqueta={`Enlace para ${a.nombre}`} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={botonChico} onClick={copiarMensaje}>{copiado ? "Mensaje copiado" : "Copiar mensaje"}</button>
            <button
              type="button"
              disabled={pendiente}
              className={botonChico}
              onClick={() => start(async () => {
                const r = await marcarEnlaceMandado(a.id);
                if (!r.ok) setError(r.errores.join(" "));
                router.refresh();
              })}
            >
              Ya se lo mandé
            </button>
          </div>
          {error ? <p role="alert" className={alerta}>{error}</p> : null}
        </>
      ) : null}
    </li>
  );
}
