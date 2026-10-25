"use client";

import RevisionDeImpresion from "@/components/revision-de-impresion/RevisionDeImpresion";
import { listasAImprimir, textosAImprimir } from "@/lib/revision-de-impresion/revision-del-canje";
import { avisoDeMuchaGente, cursosDelListado, type CursoDelAlbum } from "@/lib/design-v2/listado-cursos";
import type { ClassListOptions } from "@repo/template-engine";

/**
 * El último paso del canje con librito: la familia ve todos los textos que se imprimen (con el
 * listado del curso), corrige los suyos, suma cursos si la foto grupal tiene más de uno (y la
 * plantilla lo permite), avisa errores del listado y autoriza la impresión.
 */
export default function RevisionDelLibrito({
  opcionesDelListado,
  textVariables,
  valores,
  onCambiarTexto,
  permiteSumar,
  cursosParaSumar,
  cursosElegidos,
  onCursos,
  carasEnLaGrupal,
  avisos,
  onAvisos,
  fotografo,
  autorizado,
  onAutorizar,
}: {
  textVariables: string[];
  opcionesDelListado?: ClassListOptions;
  /** Los textos como se van a imprimir (ya con las correcciones y los cursos sumados). */
  valores: Record<string, string>;
  onCambiarTexto: (key: string, value: string) => void;
  permiteSumar: boolean;
  cursosParaSumar: CursoDelAlbum[];
  cursosElegidos: string[];
  onCursos: (claves: string[]) => void;
  carasEnLaGrupal: number | null;
  avisos: string[];
  onAvisos: (avisos: string[]) => void;
  fotografo: string | null;
  autorizado: boolean;
  onAutorizar: (v: boolean) => void;
}) {
  const textos = textosAImprimir(textVariables, valores);
  const listas = listasAImprimir(valores, opcionesDelListado);
  const grupos = cursosDelListado(valores);
  // El aviso compara con el listado propio: si ya sumó cursos y alcanzan, deja de avisar.
  const aviso = avisoDeMuchaGente(carasEnLaGrupal, grupos);
  const puedeSumar = permiteSumar && cursosParaSumar.length > 0;
  const mostrarCursos = puedeSumar && (aviso != null || cursosElegidos.length > 0);

  return (
    <RevisionDeImpresion
      titulo="Lo que se va a imprimir"
      bajada="Esto es lo que se va a imprimir. Mirá bien los nombres: después de confirmar no se puede cambiar."
      textos={textos}
      onCambiarTexto={onCambiarTexto}
      listas={listas}
      tituloDeListas={listas.length > 1 ? "Listado de los cursos" : "Listado del curso"}
      debajoDeListas={
        aviso || mostrarCursos ? (
          <div className="mt-3 rounded-xl bg-[#fff4e5] px-4 py-3 text-sm text-[#7a4a12]">
            {aviso ? (
              <p className="m-0">
                En esta foto se ven unas {aviso.caras} personas y el listado tiene {aviso.alumnos}. ¿Hay más de un curso?
              </p>
            ) : null}
            {mostrarCursos ? (
              <fieldset className="m-0 mt-2 border-0 p-0">
                <legend className="mb-1 text-sm font-medium">Sumá los cursos que salen en la foto:</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {cursosParaSumar.map((c) => (
                    <label key={c.key} className="flex min-h-11 items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-5 w-5 accent-[#c27b3d]"
                        checked={cursosElegidos.includes(c.key)}
                        onChange={(e) =>
                          onCursos(
                            e.target.checked
                              ? [...cursosElegidos, c.key]
                              : cursosElegidos.filter((k) => k !== c.key),
                          )
                        }
                      />
                      {c.title} <span className="text-xs">({c.students.length})</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : aviso ? (
              <p className="m-0 mt-1">Si falta otro curso, avisale al fotógrafo con el botón de abajo.</p>
            ) : null}
          </div>
        ) : null
      }
      avisos={avisos}
      onAvisos={grupos.length > 0 ? onAvisos : undefined}
      destinatarioDelAviso={fotografo ?? "el fotógrafo"}
      autorizado={autorizado}
      onAutorizar={onAutorizar}
    />
  );
}
