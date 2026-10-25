"use client";

import { useState, type ReactNode } from "react";
import {
  FRASE_DE_AUTORIZACION,
  type ListaAImprimir,
  type TextoAImprimir,
} from "@/lib/revision-de-impresion/autorizacion";

/**
 * Revisión antes de imprimir: todos los textos que van a salir, los propios para corregir, las
 * listas de nombres (que no se corrigen a mano: se avisa el error) y la casilla obligatoria de
 * autorización.
 *
 * No sabe nada del canje escolar: recibe los textos y avisa los cambios. Sirve igual para que una
 * familia revise la carpeta del colegio o para que una pareja apruebe su álbum (FOTOFFICE).
 */
export default function RevisionDeImpresion({
  titulo,
  bajada,
  textos,
  onCambiarTexto,
  listas,
  tituloDeListas = "Listado",
  debajoDeListas,
  avisos,
  onAvisos,
  textoAvisarError = "Avisar un error en el listado",
  destinatarioDelAviso = "el fotógrafo",
  autorizado,
  onAutorizar,
  frase = FRASE_DE_AUTORIZACION,
}: {
  titulo: string;
  bajada?: ReactNode;
  textos: TextoAImprimir[];
  onCambiarTexto: (key: string, value: string) => void;
  listas: ListaAImprimir[];
  tituloDeListas?: string;
  /** Lo que va debajo de las listas (por ejemplo, el aviso de la foto grupal y sumar cursos). */
  debajoDeListas?: ReactNode;
  /** Los avisos de error que ya escribió quien revisa. */
  avisos: string[];
  /** Sin esto no se ofrece avisar errores. */
  onAvisos?: (avisos: string[]) => void;
  textoAvisarError?: string;
  destinatarioDelAviso?: string;
  autorizado: boolean;
  onAutorizar: (autorizado: boolean) => void;
  frase?: string;
}) {
  const [escribiendo, setEscribiendo] = useState(false);
  const [borrador, setBorrador] = useState("");
  const editables = textos.filter((t) => t.editable);
  const fijos = textos.filter((t) => !t.editable && t.value.trim());

  function agregarAviso() {
    const t = borrador.trim();
    if (!t || !onAvisos) return;
    onAvisos([...avisos, t].slice(0, 5));
    setBorrador("");
    setEscribiendo(false);
  }

  return (
    <section aria-labelledby="revision-titulo" className="text-left">
      <h2 id="revision-titulo" className="m-0 text-xl font-semibold text-[#1f2328]">
        {titulo}
      </h2>
      {bajada ? <div className="m-0 mt-1 text-sm text-[#4b4f56]">{bajada}</div> : null}

      {editables.length > 0 ? (
        <div className="mt-5 space-y-3">
          <h3 className="m-0 text-sm font-semibold text-[#1f2328]">Tus datos (los podés corregir)</h3>
          {editables.map((t) => (
            <label key={t.key} className="block">
              <span className="mb-1 block text-sm text-[#4b4f56]">{t.label}</span>
              <input
                className="min-h-11 w-full rounded-lg border border-[#d8d0c7] px-3 text-base focus:border-[#c27b3d] focus:outline-none"
                value={t.value}
                maxLength={200}
                onChange={(e) => onCambiarTexto(t.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      ) : null}

      {fijos.length > 0 ? (
        <dl className="mt-5 grid grid-cols-1 gap-x-4 gap-y-2 rounded-xl bg-[#f7f5f2] p-4 sm:grid-cols-[auto_1fr]">
          {fijos.map((t) => (
            <div key={t.key} className="contents">
              <dt className="text-sm text-[#6b6f76]">{t.label}</dt>
              <dd className="m-0 text-sm font-medium text-[#1f2328]">{t.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {listas.length > 0 ? (
        <div className="mt-5">
          <h3 className="m-0 text-sm font-semibold text-[#1f2328]">{tituloDeListas}</h3>
          <div className="mt-2 max-h-80 space-y-4 overflow-y-auto rounded-xl border border-[#efeae4] p-4">
            {listas.map((l, i) => (
              <div key={`${l.title}-${i}`}>
                {l.title ? <p className="m-0 text-sm font-bold text-[#1f2328]">{l.title}</p> : null}
                <ul className="m-0 mt-1 list-none columns-1 gap-6 p-0 text-sm text-[#3d4148] sm:columns-2">
                  {l.names.map((n, j) => (
                    <li key={j} className="break-inside-avoid">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {debajoDeListas}
          {onAvisos ? (
            <div className="mt-3">
              {avisos.length > 0 ? (
                <ul className="m-0 mb-2 list-none space-y-1 p-0">
                  {avisos.map((a, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 rounded-lg bg-[#fff4e5] px-3 py-2 text-sm text-[#7a4a12]">
                      <span>
                        Le avisamos a {destinatarioDelAviso}: «{a}»
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-medium underline"
                        onClick={() => onAvisos(avisos.filter((_, k) => k !== i))}
                      >
                        Quitar
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {escribiendo ? (
                <div>
                  <label className="block">
                    <span className="mb-1 block text-sm text-[#4b4f56]">
                      ¿Qué está mal? Por ejemplo: «Falta Juan Pérez» o «Lucía va con tilde».
                    </span>
                    <textarea
                      className="w-full rounded-lg border border-[#d8d0c7] px-3 py-2 text-base focus:border-[#c27b3d] focus:outline-none"
                      rows={3}
                      maxLength={2000}
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                    />
                  </label>
                  <div className="mt-2 flex gap-3">
                    <button
                      type="button"
                      disabled={!borrador.trim()}
                      onClick={agregarAviso}
                      className="min-h-11 rounded-lg bg-[#c27b3d] px-4 text-sm font-semibold text-white disabled:bg-[#c9c3bc]"
                    >
                      Guardar aviso
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEscribiendo(false);
                        setBorrador("");
                      }}
                      className="min-h-11 px-2 text-sm text-[#6b6f76] underline"
                    >
                      Cancelar
                    </button>
                  </div>
                  <p className="m-0 mt-2 text-xs text-[#6b6f76]">
                    Le llega a {destinatarioDelAviso} junto con tu confirmación, y lo corrige antes de imprimir.
                  </p>
                </div>
              ) : avisos.length < 5 ? (
                <button
                  type="button"
                  onClick={() => setEscribiendo(true)}
                  className="min-h-11 rounded-lg border border-[#c27b3d] px-4 text-sm font-semibold text-[#a8652e]"
                >
                  {textoAvisarError}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <label
        className={`mt-6 flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 ${
          autorizado ? "border-[#2f7d5b] bg-[#eef6f1]" : "border-[#e7e1da]"
        }`}
      >
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-[#2f7d5b]"
          checked={autorizado}
          onChange={(e) => onAutorizar(e.target.checked)}
        />
        <span className="text-[15px] font-medium text-[#1f2328]">{frase}</span>
      </label>
    </section>
  );
}
