"use client";

import { useActionState, useRef, useState } from "react";
import { guardarPortadaAction, type EstadoPortada } from "@/app/actions/portada";
import { TAMANO_MAXIMO_PORTADA, validarPortada } from "@/lib/portada";

/**
 * La portada del evento y de quién es la fiesta.
 *
 * Son los dos datos que el invitado ve primero al escanear el QR, antes que nada: la
 * foto y el nombre.
 *
 * La imagen va **derecha al bucket** con una dirección firmada, igual que las fotos de
 * los invitados y que el logo. Lo que viaja al formulario es la clave, en un campo
 * oculto: elegir una foto y no guardar no cambia nada.
 */
export function FormularioDePortada({
  eventoId,
  anfitrionesIniciales,
  vistaPreviaInicial,
}: {
  eventoId: string;
  anfitrionesIniciales: string;
  vistaPreviaInicial: string | null;
}) {
  const [estado, accion, enviando] = useActionState<EstadoPortada, FormData>(
    guardarPortadaAction,
    {},
  );

  const entrada = useRef<HTMLInputElement>(null);
  const [clave, setClave] = useState("");
  const [vista, setVista] = useState<string | null>(vistaPreviaInicial);
  const [quitada, setQuitada] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [errorDeSubida, setErrorDeSubida] = useState<string | null>(null);

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return;

    // La misma revisión que hace el servidor, antes de gastar una subida.
    const revision = validarPortada({ tipo: archivo.type, bytes: archivo.size });
    if (!revision.ok) {
      setErrorDeSubida(revision.motivo ?? "Esa imagen no sirve como portada.");
      return;
    }

    setSubiendo(true);
    setErrorDeSubida(null);
    setQuitada(false);
    // Se muestra apenas la elige, sin esperar a que termine de subir.
    setVista(URL.createObjectURL(archivo));

    try {
      const permiso = await fetch(`/api/panel/eventos/${eventoId}/portada`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tipo: archivo.type, bytes: archivo.size }),
      });
      const datos = (await permiso.json()) as { url?: string; clave?: string; error?: string };
      if (!permiso.ok || !datos.url) {
        throw new Error(datos.error ?? "No pudimos preparar la subida.");
      }

      const puesta = await fetch(datos.url, {
        method: "PUT",
        headers: { "content-type": archivo.type },
        body: archivo,
      });
      if (!puesta.ok) throw new Error("La subida se cortó. Probá de nuevo.");

      setClave(datos.clave ?? "");
    } catch (e) {
      setErrorDeSubida(e instanceof Error ? e.message : "No pudimos subir la portada.");
      setVista(vistaPreviaInicial);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <form action={accion} className="mt-10 space-y-8">
      <input type="hidden" name="eventoId" value={eventoId} />
      <input type="hidden" name="clave" value={clave} />
      <input type="hidden" name="quitarPortada" value={quitada ? "1" : "0"} />

      <div>
        <label htmlFor="anfitriones" className="block text-sm font-extrabold">
          ¿De quién es la fiesta?
        </label>
        <input
          id="anfitriones"
          name="anfitriones"
          type="text"
          maxLength={80}
          defaultValue={anfitrionesIniciales}
          placeholder="Sofía · Los 15 de Sofi · Ana y Martín"
          className="mt-3 w-full rounded-xl px-4 py-3"
          style={{ border: "1px solid var(--slf-borde)" }}
        />
        <p className="mt-2 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          Aparece debajo del nombre del evento, en la pantalla que ve el invitado al
          escanear el código.
        </p>
      </div>

      <div>
        <span className="block text-sm font-extrabold">Portada</span>

        <input
          ref={entrada}
          id="archivoPortada"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => void alElegir(e.target.files?.[0])}
        />

        <div className="mt-3 flex flex-wrap items-center gap-4">
          {vista ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vista}
              alt="Portada del evento"
              className="h-28 w-28 rounded-2xl object-cover"
              style={{ border: "1px solid var(--slf-borde)" }}
            />
          ) : null}

          <label
            htmlFor="archivoPortada"
            className="inline-flex min-h-[44px] cursor-pointer items-center rounded-xl border-2 px-5 text-sm font-extrabold"
            style={{ borderColor: "var(--slf-violeta)", color: "var(--slf-violeta-texto)" }}
          >
            {subiendo ? "Subiendo…" : vista ? "Cambiar" : "Elegir foto"}
          </label>

          {vista ? (
            <button
              type="button"
              onClick={() => {
                setClave("");
                setVista(null);
                setQuitada(true);
                if (entrada.current) entrada.current.value = "";
              }}
              className="inline-flex min-h-[44px] items-center text-sm font-extrabold underline underline-offset-4"
              style={{ color: "var(--slf-tinta-suave)" }}
            >
              Quitar
            </button>
          ) : null}
        </div>

        <p
          className="mt-2 text-sm"
          style={{ color: "var(--slf-tinta-suave)" }}
          aria-live="polite"
        >
          {errorDeSubida ??
            `JPG, PNG o WEBP, hasta ${Math.round(TAMANO_MAXIMO_PORTADA / 1024 / 1024)} MB. Se borra con el evento, a los 30 días.`}
        </p>
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm font-extrabold" style={{ color: "#b00020" }}>
          {estado.error}
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={enviando || subiendo}
          className="inline-flex min-h-[44px] items-center rounded-xl px-6 font-extrabold disabled:opacity-60"
          style={{ background: "var(--slf-violeta)", color: "white" }}
        >
          {enviando ? "Guardando…" : "Guardar"}
        </button>

        {estado.guardado && !enviando ? (
          <span className="text-sm font-extrabold" style={{ color: "var(--slf-violeta-texto)" }}>
            Guardado
          </span>
        ) : null}
      </div>
    </form>
  );
}
