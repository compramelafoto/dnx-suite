"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { agregarTestimonioAction } from "@/app/actions/testimonios";
import {
  FORMATOS_FOTO_AUTOR,
  MAX_BYTES_FOTO_AUTOR,
  MAX_DETALLE,
  MAX_EXTRACTO,
  MAX_NOMBRE,
  MAX_TEXTO,
  MENSAJE_FOTO_PESADA,
  type CampoTestimonio,
} from "@/lib/testimonios/dominio";
import { achicarFoto } from "./achicar-foto";

type Foto = { estado: "nada" } | { estado: "preparando" } | { estado: "lista"; archivo: Blob; vista: string } | { estado: "error"; error: string };

/**
 * «Agregar testimonio»: carga manual de uno que llegó por otro lado (un mensaje, una reseña). Con
 * «Tengo permiso del autor» queda asentado quién lo marcó y se puede publicar en el acto; sin esa
 * casilla entra pendiente y no se publica. La foto se achica en el navegador y la sube el servidor.
 */
export function AgregarTestimonio() {
  const [abierto, setAbierto] = useState(false);
  const [permiso, setPermiso] = useState(false);
  const [foto, setFoto] = useState<Foto>({ estado: "nada" });
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Partial<Record<CampoTestimonio, string>>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const vistaActual = useRef<string | null>(null);

  useEffect(() => () => {
    if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
  }, []);

  function cambiarVista(url: string | null) {
    if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    vistaActual.current = url;
  }

  async function elegirFoto(file: File | undefined) {
    if (!file) {
      cambiarVista(null);
      setFoto({ estado: "nada" });
      return;
    }
    if (!(FORMATOS_FOTO_AUTOR as readonly string[]).includes(file.type)) {
      setFoto({ estado: "error", error: "La foto tiene que ser JPG, PNG o WebP." });
      return;
    }
    setFoto({ estado: "preparando" });
    try {
      const archivo = await achicarFoto(file);
      if (archivo.size > MAX_BYTES_FOTO_AUTOR) {
        cambiarVista(null);
        setFoto({ estado: "error", error: MENSAJE_FOTO_PESADA });
        return;
      }
      const vista = URL.createObjectURL(archivo);
      cambiarVista(vista);
      setFoto({ estado: "lista", archivo, vista });
    } catch {
      setFoto({ estado: "error", error: "No pudimos leer la foto. Probá con otra o cargalo sin foto." });
    }
  }

  function limpiar() {
    formulario.current?.reset();
    cambiarVista(null);
    setFoto({ estado: "nada" });
    setPermiso(false);
    setErrores({});
    setError(null);
  }

  if (!abierto) {
    return (
      <div className="space-y-2">
        <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => { setAbierto(true); setAviso(null); }}>
          <Plus size={16} aria-hidden /> Agregar testimonio
        </button>
        {aviso ? (
          <p className="text-sm text-[var(--fo-success)]" role="status">
            {aviso}
          </p>
        ) : null}
      </div>
    );
  }

  const campoError = (c: CampoTestimonio) => (errores[c] ? <p className="text-sm text-[var(--fo-danger)]">{errores[c]}</p> : null);

  return (
    <form
      ref={formulario}
      className="fo-card space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (foto.estado === "preparando") return;
        const fd = new FormData(e.currentTarget);
        // Va la foto achicada, nunca la original.
        fd.delete("foto");
        if (foto.estado === "lista") fd.set("foto", foto.archivo, foto.archivo.type === "image/jpeg" ? "foto.jpg" : "foto");
        setError(null);
        setErrores({});
        empezar(async () => {
          try {
            const r = await agregarTestimonioAction(fd);
            if (!r.ok) {
              setError(r.error);
              setErrores(r.errores ?? {});
              return;
            }
            limpiar();
            setAbierto(false);
            setAviso(r.aviso ?? (r.publicado ? "Listo: el testimonio quedó publicado." : "Listo: el testimonio quedó en Pendientes."));
            router.refresh();
          } catch {
            setError("No pudimos conectar con el servidor. Probá de nuevo.");
          }
        });
      }}
    >
      <h2 className="text-base font-semibold text-[var(--fo-text)]">Agregar testimonio</h2>
      <fieldset disabled={pendiente} className="space-y-4">
        <label className="block">
          <span className="fo-label">Testimonio</span>
          <textarea name="texto" rows={5} required maxLength={MAX_TEXTO} className="fo-input" />
          {campoError("texto")}
        </label>
        <label className="block">
          <span className="fo-label">Frase destacada (opcional)</span>
          <textarea name="extracto" rows={2} maxLength={MAX_EXTRACTO} className="fo-input" />
          {campoError("extracto")}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="fo-label">Nombre del autor</span>
            <input name="autorNombre" required maxLength={MAX_NOMBRE} className="fo-input" />
            {campoError("autorNombre")}
          </label>
          <label className="block">
            <span className="fo-label">Detalle (opcional)</span>
            <input name="autorDetalle" maxLength={MAX_DETALLE} placeholder="Fiesta de XV de Cami" className="fo-input" />
            {campoError("autorDetalle")}
          </label>
          <label className="block">
            <span className="fo-label">Instagram o sitio (opcional)</span>
            <input name="autorEnlace" placeholder="@usuario o https://…" className="fo-input" />
            {campoError("autorEnlace")}
          </label>
          <label className="block">
            <span className="fo-label">Calificación (opcional)</span>
            <select name="calificacion" defaultValue="" className="fo-input">
              <option value="">Sin calificación</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)} ({n})
                </option>
              ))}
            </select>
            {campoError("calificacion")}
          </label>
        </div>
        <div className="space-y-2">
          <span className="fo-label">Foto del autor (opcional)</span>
          <div className="flex items-center gap-3">
            {foto.estado === "lista" ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local
              <img src={foto.vista} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : null}
            <input
              type="file"
              name="foto"
              accept={FORMATOS_FOTO_AUTOR.join(",")}
              className="text-sm"
              onChange={(e) => void elegirFoto(e.currentTarget.files?.[0])}
            />
          </div>
          {foto.estado === "preparando" ? <p className="text-xs text-[var(--fo-muted)]">Preparando la foto…</p> : null}
          {foto.estado === "error" ? <p className="text-sm text-[var(--fo-danger)]">{foto.error}</p> : null}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="permiso" checked={permiso} onChange={(e) => setPermiso(e.target.checked)} className="mt-1" />
          <span>
            Tengo permiso del autor para publicarlo.{" "}
            <span className="text-[var(--fo-muted)]">Queda asentado con tu nombre. Sin permiso, el testimonio no se puede publicar.</span>
          </span>
        </label>
        {permiso ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="publicar" defaultChecked className="mt-1" />
            <span>Publicarlo ya en el sitio</span>
          </label>
        ) : null}
      </fieldset>
      {error ? (
        <p className="fo-alert-error text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || foto.estado === "preparando"}>
          {pendiente ? "Guardando…" : "Guardar testimonio"}
        </button>
        <button
          type="button"
          className="fo-btn fo-btn-ghost text-sm"
          disabled={pendiente}
          onClick={() => {
            limpiar();
            setAbierto(false);
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
