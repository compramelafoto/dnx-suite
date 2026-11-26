"use client";

import { createContext, useContext, useId, useRef, useState } from "react";
import { fotosDe, MAXIMO_DE_FOTOS } from "@/lib/alta-cliente/tipos";
import { confirmarFotoDeAlta, pedirSubidaDeFoto } from "./actions";

/** El token del enlace, para que cada campo de fotos pueda pedir su permiso de subida. */
export const TokenDeAlta = createContext("");

const TIPOS_DIRECTOS = ["image/jpeg", "image/png", "image/webp"];
/** Las fotos del celular pesan 3 a 10 MB: se achican a este lado mayor antes de subir. */
const LADO_MAXIMO = 2400;
const ACHICAR_DESDE_BYTES = 3 * 1024 * 1024;

/**
 * Achica en el navegador las fotos grandes y convierte lo que no sea JPG/PNG/WebP (por ejemplo
 * HEIC del iPhone, si el navegador sabe abrirlo). Si no se puede, devuelve el archivo como vino.
 */
async function prepararFoto(archivo: File): Promise<Blob> {
  const directo = TIPOS_DIRECTOS.includes(archivo.type);
  if (directo && archivo.size <= ACHICAR_DESDE_BYTES) return archivo;
  try {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(imagen.width * escala);
    lienzo.height = Math.round(imagen.height * escala);
    lienzo.getContext("2d")?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    imagen.close();
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.88));
    return blob ?? archivo;
  } catch {
    return archivo;
  }
}

async function subirUna(token: string, archivo: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const blob = await prepararFoto(archivo);
  const tipo = blob.type || archivo.type;
  if (!TIPOS_DIRECTOS.includes(tipo)) return { ok: false, error: `«${archivo.name}» no es una foto JPG, PNG o WebP.` };
  const permiso = await pedirSubidaDeFoto(token, tipo);
  if (!permiso.ok) return permiso;
  const subida = await fetch(permiso.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": tipo } }).catch(
    () => null,
  );
  if (!subida?.ok) return { ok: false, error: `No se pudo subir «${archivo.name}». Revisá la conexión y probá de nuevo.` };
  return confirmarFotoDeAlta(token, permiso.key);
}

/**
 * Un campo de fotos: botón para elegir (en el celular abre la galería o la cámara), miniaturas y
 * «Quitar». El valor son las direcciones, una por renglón.
 */
export function CampoFotos({
  valor,
  poner,
  maximo = MAXIMO_DE_FOTOS,
  etiqueta,
}: {
  valor: string;
  poner: (v: string) => void;
  maximo?: number;
  etiqueta: string;
}) {
  const token = useContext(TokenDeAlta);
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fotos = fotosDe(valor);
  // Lo último que se guardó, para que varias subidas a la vez no se pisen entre sí.
  const actuales = useRef(fotos);
  actuales.current = fotos;
  const ponerUltimo = useRef(poner);
  ponerUltimo.current = poner;

  async function elegir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setError(null);
    const lugar = Math.max(0, maximo - actuales.current.length);
    const archivos = Array.from(lista).slice(0, lugar);
    if (archivos.length < lista.length) setError(`Hasta ${maximo} fotos en este campo.`);
    setSubiendo((n) => n + archivos.length);
    for (const archivo of archivos) {
      const r = await subirUna(token, archivo).catch(() => ({ ok: false as const, error: "No se pudo subir la foto." }));
      setSubiendo((n) => n - 1);
      if (r.ok) {
        const nuevas = [...actuales.current, r.url];
        actuales.current = nuevas;
        ponerUltimo.current(nuevas.join("\n"));
      } else {
        setError(r.error);
      }
    }
    if (entrada.current) entrada.current.value = "";
  }

  function quitar(url: string) {
    const nuevas = actuales.current.filter((x) => x !== url);
    actuales.current = nuevas;
    poner(nuevas.join("\n"));
  }

  return (
    <div className="space-y-2">
      {fotos.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotos.map((url, i) => (
            <li key={url} className="relative overflow-hidden rounded-lg border border-[var(--fo-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura de una foto recién subida */}
              <img src={url} alt={`${etiqueta}: foto ${i + 1}`} className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => quitar(url)}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {fotos.length < maximo ? (
        <>
          <input
            ref={entrada}
            id={id}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            aria-label={`${etiqueta}: elegir fotos`}
            onChange={(e) => void elegir(e.target.files)}
          />
          <label htmlFor={id} className="fo-btn fo-btn-secondary cursor-pointer text-sm">
            {subiendo > 0 ? `Subiendo ${subiendo} foto${subiendo === 1 ? "" : "s"}…` : fotos.length ? "+ Sumar más fotos" : "Subir fotos"}
          </label>
        </>
      ) : null}
      <p className="text-xs text-[var(--fo-muted)]">
        {fotos.length} de {maximo} fotos. JPG, PNG o WebP; las grandes se achican solas.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-[var(--fo-danger,#b91c1c)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
