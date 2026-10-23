"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { DesignV2Data } from "@/lib/design-v2/design-data";
import type { ListadoDelDiseno } from "@/lib/design-v2/listado-del-diseno";
import type { RevisionDelCliente } from "@/lib/revision-de-impresion/autorizacion";

const FECHA = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

function fecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${FECHA.format(d)} h`;
}

/**
 * El «Listado del curso» del diseño en la revisión del fotógrafo: qué cursos lleva, el aviso si
 * la foto grupal muestra más gente que el listado, sumar o sacar cursos (si la plantilla deja),
 * y lo que la familia avisó o autorizó al confirmar.
 */
export default function ListadoDelCursoPanel({
  designId,
  dataVersion,
  clientReview,
  beforeSave,
  onSaved,
}: {
  designId: string;
  /** Cambia cuando cambian las fotos o los textos del diseño: se vuelve a leer el aviso. */
  dataVersion: string;
  clientReview: RevisionDelCliente | null | undefined;
  beforeSave: () => Promise<boolean>;
  onSaved: (data: DesignV2Data, status: string | null) => void;
}) {
  const [listado, setListado] = useState<ListadoDelDiseno | null>(null);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/fotografo/disenos/${designId}/listado`, { credentials: "include", cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setListado(body.listado);
      setElegidos(body.listado.sumados);
    }
  }, [designId]);

  useEffect(() => {
    void load();
  }, [load, dataVersion]);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      if (!(await beforeSave())) return;
      const res = await fetch(`/api/fotografo/disenos/${designId}/listado`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cursos: elegidos }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo guardar el listado.");
      setListado(body.listado);
      setElegidos(body.listado.sumados);
      onSaved(body.data, body.status ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el listado.");
    } finally {
      setGuardando(false);
    }
  }

  const reports = clientReview?.reports ?? [];
  const autorizacion = clientReview?.authorization ?? null;
  if (!listado?.tieneListado && reports.length === 0 && !autorizacion) return null;

  const cambiado =
    listado != null &&
    (elegidos.length !== listado.sumados.length || elegidos.some((k) => !listado.sumados.includes(k)));

  return (
    <div className="mt-4 space-y-3">
      {reports.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">La familia avisó un error en el listado</p>
          <ul className="mt-1 space-y-1">
            {reports.map((r, i) => (
              <li key={i} className="text-sm text-amber-900">
                «{r.text}» <span className="text-xs text-amber-700">· {r.at ? fecha(r.at) : ""}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-amber-800">
            Corregí el listado antes de aprobar. La familia no puede cambiar los nombres de los compañeros.
          </p>
        </Card>
      ) : null}

      {listado?.tieneListado ? (
        <Card className="p-4">
          <p className="text-sm font-semibold text-[#111827]">Listado del curso</p>
          <p className="mt-1 text-sm text-[#4b5563]">
            {listado.cursos.length === 0
              ? "Este diseño no tiene alumnos en el listado."
              : listado.cursos.map((c) => `${c.title || "Sin título"} (${c.count})`).join(" · ")}
          </p>
          {listado.aviso ? (
            <p role="status" className="mt-2 rounded-lg bg-[#fff4e5] px-3 py-2 text-sm text-[#7a4a12]">
              En esta foto se ven unas {listado.aviso.caras} personas y el listado tiene {listado.aviso.alumnos}. ¿Hay más
              de un curso?
              {listado.permiteSumar && listado.paraSumar.length > 0 ? " Podés sumar los otros cursos acá abajo." : ""}
            </p>
          ) : null}
          {listado.permiteSumar && listado.paraSumar.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium text-[#374151]">Sumar otros cursos del colegio al listado</p>
              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                {listado.paraSumar.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm text-[#111827]">
                    <input
                      type="checkbox"
                      checked={elegidos.includes(c.key)}
                      onChange={(e) =>
                        setElegidos((prev) => (e.target.checked ? [...prev, c.key] : prev.filter((k) => k !== c.key)))
                      }
                    />
                    {c.title} <span className="text-xs text-[#6b7280]">({c.count})</span>
                  </label>
                ))}
              </div>
              {cambiado ? (
                <Button size="sm" variant="primary" className="mt-2" onClick={() => void guardar()} disabled={guardando}>
                  {guardando ? "Guardando…" : "Guardar listado"}
                </Button>
              ) : null}
            </div>
          ) : listado.aviso && !listado.permiteSumar ? (
            <p className="mt-2 text-xs text-[#6b7280]">
              Esta plantilla no deja sumar otros cursos. Se activa en el diseñador, en el bloque del listado: «Permitir
              sumar otros cursos».
            </p>
          ) : null}
          {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        </Card>
      ) : null}

      {autorizacion ? (
        <Card className="border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm text-emerald-900">
            <span className="font-semibold">La familia autorizó la impresión</span> el {fecha(autorizacion.authorizedAt)}
            {autorizacion.by.name ? ` (${autorizacion.by.name})` : ""}: «{autorizacion.statement}».
          </p>
          {autorizacion.edits.length > 0 ? (
            <p className="mt-1 text-xs text-emerald-800">
              Corrigió: {autorizacion.edits.map((e) => `«${e.from || "vacío"}» → «${e.to}»`).join(" · ")}
            </p>
          ) : null}
          {(clientReview?.extraCourseKeys.length ?? 0) > 0 ? (
            <p className="mt-1 text-xs text-emerald-800">Sumó otros cursos al listado.</p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
