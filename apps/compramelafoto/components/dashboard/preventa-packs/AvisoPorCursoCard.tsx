"use client";

import { useCallback, useEffect, useState } from "react";

type EstadoCurso = "sin_marcar" | "esperando_proceso" | "avisado";
type Curso = {
  schoolCourseId: number;
  nombre: string;
  packs: number;
  pendientes: number;
  pendientesConEmail: number;
  estado: EstadoCurso;
  marcadoAt: string | null;
  avisoAt: string | null;
};
export type CursosDelAlbumDto = { esEscolar: boolean; cursos: Curso[]; pendientesSinCurso: number };

const FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function textoEstado(c: Curso): { texto: string; clase: string } {
  if (c.estado === "avisado") {
    return {
      texto: c.avisoAt ? `Avisado el ${FECHA.format(new Date(c.avisoAt))}` : "Avisado",
      clase: "bg-[#e8f5ec] text-[#1f6b3a]",
    };
  }
  if (c.estado === "esperando_proceso") {
    return { texto: "Se avisa al terminar de procesar", clase: "bg-[#fff4e5] text-[#7a4a12]" };
  }
  return { texto: "Sin subir", clase: "bg-[#f3f4f6] text-[#4b5563]" };
}

/** Marca cursos como subidos. El aviso a sus familias sale solo cuando el álbum terminó de procesar. */
export async function marcarCursosSubidos(
  albumId: number,
  cursoIds: number[]
): Promise<{ enviados: number; sinEmail: number; esperando: boolean; cursos: CursosDelAlbumDto }> {
  const res = await fetch(`/api/dashboard/albums/${albumId}/cursos-publicados`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cursoIds }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "No se pudieron marcar los cursos.");
  return data;
}

export function mensajeDelAviso(r: { enviados: number; sinEmail: number; esperando: boolean }): string {
  const sinEmail = r.sinEmail
    ? ` ${plural(r.sinEmail, "familia no tiene", "familias no tienen")} email: pasales el link desde «Canjes».`
    : "";
  if (r.esperando) {
    return "Listo. Las fotos todavía se están procesando: el aviso a esas familias sale solo apenas terminen (en general, menos de una hora).";
  }
  if (r.enviados === 0 && !r.sinEmail) return "Listo. Esos cursos no tienen familias pendientes de elegir fotos.";
  return `Listo: ${plural(r.enviados, "correo", "correos")} en camino.${sinEmail}`;
}

/**
 * Cursos de un álbum escolar con preventa. El aviso «ya están las fotos» sale sólo a las
 * familias de los cursos que el fotógrafo marca, para que no entren familias cuyo curso todavía
 * no se subió.
 *
 * - `modo="preventa"`: el fotógrafo tilda cursos y toca «Avisar».
 * - `modo="subida"`: tilda de qué cursos son las fotos que va a subir; al terminar la subida la
 *   página los marca sola (`seleccion` y `onSeleccionChange` los maneja la página).
 */
export default function AvisoPorCursoCard({
  albumId,
  hasPhotos,
  modo,
  seleccion,
  onSeleccionChange,
  recargar = 0,
  avisoExterno = null,
}: {
  albumId: number;
  hasPhotos: boolean;
  modo: "preventa" | "subida";
  seleccion?: number[];
  onSeleccionChange?: (ids: number[]) => void;
  /** Cambiar el número vuelve a leer el estado (p. ej. después de una subida). */
  recargar?: number;
  /** Resultado del aviso que hizo la página al terminar la subida. */
  avisoExterno?: { tono: "ok" | "error"; texto: string } | null;
}) {
  const [datos, setDatos] = useState<CursosDelAlbumDto | null>(null);
  const [propia, setPropia] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  const elegidos = modo === "subida" ? (seleccion ?? []) : propia;
  const setElegidos = modo === "subida" ? (onSeleccionChange ?? (() => {})) : setPropia;

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/dashboard/albums/${albumId}/cursos-publicados`, { cache: "no-store" });
    if (res.ok) setDatos(await res.json());
  }, [albumId]);

  useEffect(() => {
    void cargar();
  }, [cargar, recargar]);

  if (!datos?.esEscolar || datos.cursos.length === 0) return null;
  const totalPacks = datos.cursos.reduce((n, c) => n + c.packs, 0) + datos.pendientesSinCurso;
  // Sin preventa vendida no hay a quién avisar: en la pestaña Fotos no molesta.
  if (totalPacks === 0) return null;

  function alternar(id: number) {
    setElegidos(elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]);
  }

  const familiasElegidas = datos.cursos
    .filter((c) => elegidos.includes(c.schoolCourseId))
    .reduce((n, c) => n + c.pendientes, 0);
  const yaAvisados = datos.cursos.filter((c) => elegidos.includes(c.schoolCourseId) && c.estado !== "sin_marcar");

  async function avisar() {
    if (!datos || elegidos.length === 0) return;
    const nombres = datos.cursos.filter((c) => elegidos.includes(c.schoolCourseId)).map((c) => c.nombre);
    const repetir = yaAvisados.length
      ? ` ${yaAvisados.map((c) => c.nombre).join(", ")} ya ${yaAvisados.length === 1 ? "estaba marcado" : "estaban marcados"}: a las familias que todavía no eligieron les llega otro correo.`
      : "";
    if (
      !window.confirm(
        `Vas a marcar como subidas las fotos de ${nombres.join(", ")}. Les avisamos a ${plural(familiasElegidas, "familia", "familias")} de esos cursos que ya pueden elegir sus fotos.${repetir} Las de los otros cursos no reciben nada. ¿Seguimos?`
      )
    ) {
      return;
    }
    setEnviando(true);
    setMensaje(null);
    try {
      const r = await marcarCursosSubidos(albumId, elegidos);
      setDatos(r.cursos);
      setElegidos([]);
      setMensaje({ tono: "ok", texto: mensajeDelAviso(r) });
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo mandar el aviso." });
    } finally {
      setEnviando(false);
    }
  }

  const titulo = modo === "subida" ? "¿De qué cursos son las fotos que vas a subir?" : "Avisar a las familias por curso";
  const intro =
    modo === "subida"
      ? "Tildá los cursos que estás subiendo (podés elegir varios). Cuando termine la subida y las fotos se procesen, les avisamos solo a las familias de esos cursos. Si subís un curso en varias tandas, tildalo recién en la última."
      : "Tildá los cursos cuyas fotos ya están completas. Les avisamos solo a las familias de esos cursos, con su link para elegir las fotos del pack. Las de los cursos que faltan no reciben nada hasta que los marques.";

  return (
    <section className="w-full max-w-3xl rounded-xl border border-[#e5e7eb] bg-white p-5 space-y-3">
      <h3 className="m-0 text-base font-semibold text-[#1a1a1a]">{titulo}</h3>
      <p className="m-0 text-sm text-[#4b5563]">{intro}</p>
      {modo === "preventa" && !hasPhotos ? (
        <p className="m-0 text-sm text-amber-700">Subí las fotos antes de avisar: si no, las familias entran y no encuentran nada.</p>
      ) : null}
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {datos.cursos.map((c) => {
          const est = textoEstado(c);
          const marcado = elegidos.includes(c.schoolCourseId);
          return (
            <li key={c.schoolCourseId}>
              <label
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                  marcado ? "border-[#c27b3d] bg-[#fbf3ec]" : "border-[#e5e7eb] bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#c27b3d]"
                  checked={marcado}
                  onChange={() => alternar(c.schoolCourseId)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-[#1f2937]">{c.nombre}</span>
                  <span className="block text-xs text-[#6b7280]">
                    {c.packs === 0
                      ? "Sin packs de preventa"
                      : c.pendientes === 0
                        ? "Todas eligieron"
                        : `${plural(c.pendientes, "familia espera", "familias esperan")}`}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${est.clase}`}>{est.texto}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {datos.pendientesSinCurso > 0 ? (
        <p className="m-0 text-xs text-[#6b7280]">
          {plural(datos.pendientesSinCurso, "pack pendiente no tiene", "packs pendientes no tienen")} curso cargado
          (cobrados por fuera o ventas viejas): a esas familias pasales el link desde «Canjes».
        </p>
      ) : null}
      {modo === "preventa" ? (
        <button
          type="button"
          onClick={() => void avisar()}
          disabled={enviando || !hasPhotos || elegidos.length === 0}
          className="min-h-11 rounded-lg bg-[#c27b3d] px-4 text-sm font-semibold text-white hover:bg-[#a8652e] disabled:bg-[#d1d5db]"
        >
          {enviando
            ? "Mandando…"
            : elegidos.length === 0
              ? "Tildá los cursos que ya subiste"
              : `Avisar a ${plural(elegidos.length, "curso", "cursos")} (${plural(familiasElegidas, "familia", "familias")})`}
        </button>
      ) : elegidos.length > 0 ? (
        <p className="m-0 text-sm font-medium text-[#7a4a12]">
          Al terminar la subida se marcan {plural(elegidos.length, "curso", "cursos")} y se avisa a{" "}
          {plural(familiasElegidas, "familia", "familias")}.
        </p>
      ) : null}
      {(mensaje ?? avisoExterno) ? (
        <p className={`m-0 text-sm ${(mensaje ?? avisoExterno)!.tono === "error" ? "text-red-700" : "text-[#1f2937]"}`}>
          {(mensaje ?? avisoExterno)!.texto}
        </p>
      ) : null}
    </section>
  );
}
