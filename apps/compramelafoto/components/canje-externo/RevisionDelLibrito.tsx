"use client";

import RevisionDeImpresion from "@/components/revision-de-impresion/RevisionDeImpresion";
import {
  CLAVES_DEL_NOMBRE_DEL_ALUMNO,
  FRASE_DE_AUTORIZACION_LIBRITO,
  listasAImprimir,
  textosAImprimir,
} from "@/lib/revision-de-impresion/revision-del-canje";
import type { CambioDeNombre } from "@/lib/design-v2/corregir-nombres";
import CorregirNombreDelListado from "./CorregirNombreDelListado";
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
  valoresSinCorregir,
  nombresCorregidos,
  onNombresCorregidos,
  textosEditados = {},
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
  /** Los textos antes de corregir nombres del listado: de ahí se elige a quién corregir. */
  valoresSinCorregir: Record<string, string>;
  nombresCorregidos: CambioDeNombre[];
  onNombresCorregidos: (cambios: CambioDeNombre[]) => void;
  /** Lo que la familia va escribiendo (para que un campo se pueda vaciar mientras se corrige). */
  textosEditados?: Record<string, string>;
}) {
  // El nombre del alumno se pide siempre en dos campos, nombre y apellido, aunque la plantilla
  // imprima uno solo o el nombre completo: así queda bien separado para la tapa y el listado.
  const delAlumno = new Set<string>([...CLAVES_DEL_NOMBRE_DEL_ALUMNO, "student.fullName", "student.lastNameFirst"]);
  const textos = [
    ...CLAVES_DEL_NOMBRE_DEL_ALUMNO.map((key) => ({
      key,
      label: key === "student.firstName" ? "Nombre del alumno" : "Apellido del alumno",
      value: textosEditados[key] ?? valores[key] ?? "",
      editable: true,
    })),
    ...textosAImprimir(textVariables, valores)
      .filter((t) => !delAlumno.has(t.key))
      .map((t) => (t.editable && textosEditados[t.key] != null ? { ...t, value: textosEditados[t.key]! } : t)),
  ];
  const listas = listasAImprimir(valores, opcionesDelListado);
  const grupos = cursosDelListado(valores);
  // El aviso compara con el listado propio: si ya sumó cursos y alcanzan, deja de avisar.
  const aviso = avisoDeMuchaGente(carasEnLaGrupal, grupos);
  const puedeSumar = permiteSumar && cursosParaSumar.length > 0;
  const mostrarCursos = puedeSumar && (aviso != null || cursosElegidos.length > 0);

  return (
    <RevisionDeImpresion
      titulo="Lo que se va a imprimir"
      bajada={
        <>
          Esto es <strong>exactamente</strong> lo que se va a imprimir. Revisá con atención cada nombre, el curso y las
          fotos. Si algo está mal escrito, corregilo ahora.
        </>
      }
      frase={FRASE_DE_AUTORIZACION_LIBRITO}
      antesDeAutorizar={
        <div role="note" className="mt-6 rounded-xl border-2 border-[#b42318] bg-[#fef3f2] p-4 text-[#7a271a]">
          <p className="m-0 text-[15px] font-bold">Importante: después de confirmar no se puede cambiar nada.</p>
          <p className="m-0 mt-1 text-sm">
            El librito se imprime tal cual lo ves acá. No se aceptan cambios ni reclamos por errores que no hayas corregido
            o avisado en este paso.
          </p>
        </div>
      }
      textos={textos}
      onCambiarTexto={onCambiarTexto}
      listas={listas}
      tituloDeListas={listas.length > 1 ? "Listado de los cursos" : "Listado del curso"}
      debajoDeListas={
        <>
        {grupos.length > 0 ? (
          <CorregirNombreDelListado
            valoresSinCorregir={valoresSinCorregir}
            cambios={nombresCorregidos}
            onCambios={onNombresCorregidos}
            fotografo={fotografo ?? "el fotógrafo"}
          />
        ) : null}
        {aviso || mostrarCursos ? (
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
        ) : null}
        </>
      }
      avisos={avisos}
      onAvisos={grupos.length > 0 ? onAvisos : undefined}
      destinatarioDelAviso={fotografo ?? "el fotógrafo"}
      autorizado={autorizado}
      onAutorizar={onAutorizar}
    />
  );
}
