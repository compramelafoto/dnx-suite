"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type CSSProperties } from "react";
import { enviarTestimonio, type EstadoTestimonioPublico } from "@/app/actions/testimonio-publico";
import { CampoTrampa } from "@/components/consultas/campo-trampa";
import {
  FORMATOS_FOTO_AUTOR,
  MAX_BYTES_FOTO_AUTOR,
  MAX_DETALLE,
  MENSAJE_FOTO_PESADA,
  MAX_NOMBRE,
  MAX_TEXTO,
  type CampoTestimonio,
} from "@/lib/testimonios/dominio";
import { achicarFoto } from "./achicar-foto";
import { levelStyle } from "@/lib/website/typography";

const ESTADO_INICIAL: EstadoTestimonioPublico = { status: "idle" };
const MARCA = { "--fo-accent": "var(--wsite-primary)", "--fo-accent-hover": "var(--wsite-primary)", accentColor: "var(--wsite-primary)" } as CSSProperties;
type Foto = { estado: "nada" } | { estado: "preparando" } | { estado: "lista"; archivo: Blob; vista: string } | { estado: "error"; error: string };

/** Mensaje para un enlace personal que ya no sirve (también si se usó mientras la página estaba abierta). */
export function MensajeEnlace({ estado, enlaceAbierto }: { estado: "USADA" | "VENCIDA" | "INEXISTENTE"; enlaceAbierto: string }) {
  const titulo = estado === "USADA" ? "Este enlace ya se usó" : estado === "VENCIDA" ? "Este enlace venció" : "Este enlace no es válido";
  const texto =
    estado === "USADA"
      ? "Ya recibimos un testimonio con este enlace. ¡Muchas gracias!"
      : "Si querés, podés dejarnos tu testimonio igual desde el formulario abierto.";
  return (
    <div role="status" className="space-y-3 rounded-[var(--wsite-button-radius)] border p-6 text-center" style={{ borderColor: "var(--wsite-primary)" }}>
      <p className="text-lg font-semibold">{titulo}</p>
      <p style={levelStyle("body", { color: true })}>{texto}</p>
      {estado !== "USADA" ? (
        <a href={enlaceAbierto} className="inline-block font-semibold underline" style={{ color: "var(--wsite-primary)" }}>
          Ir al formulario
        </a>
      ) : null}
    </div>
  );
}

/**
 * Formulario público de testimonio (`/w/<slug>/testimonio`, abierto o con `?t=`). El envío va por
 * `onSubmit` y no por `<form action>`: con `action`, React vacía el formulario al terminar y, si hubo
 * un error, la persona perdería lo que escribió.
 *
 * La foto se achica en el navegador apenas se elige (800 px, JPEG) y viaja con el envío; la sube el
 * servidor después de validar todo. No hay subida directa a R2: en un dominio propio el CORS del
 * bucket no lo permitiría.
 */
export function FormularioTestimonio({
  workspaceSlug,
  estudio,
  textoPermiso,
  token,
  nombreSugerido,
  detalleSugerido,
  enlaceAbierto,
}: {
  workspaceSlug: string;
  estudio: string;
  textoPermiso: string;
  token: string | null;
  nombreSugerido?: string | null;
  detalleSugerido?: string | null;
  enlaceAbierto: string;
}) {
  const [state, dispatch, pending] = useActionState(enviarTestimonio, ESTADO_INICIAL);
  const [foto, setFoto] = useState<Foto>({ estado: "nada" });
  const [largo, setLargo] = useState(0);
  const [calificacion, setCalificacion] = useState(0);
  const entradaFoto = useRef<HTMLInputElement>(null);
  const vistaActual = useRef<string | null>(null);

  useEffect(() => () => {
    if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
  }, []);

  if (state.status === "ok") {
    return (
      <p role="status" className="rounded-[var(--wsite-button-radius)] border p-6 text-center" style={{ ...levelStyle("body", { color: true }), borderColor: "var(--wsite-primary)" }}>
        ¡Gracias por tu testimonio! {estudio} lo va a leer y, cuando lo publique, va a aparecer en su sitio.
      </p>
    );
  }
  if (state.status === "enlace") return <MensajeEnlace estado={state.estado} enlaceAbierto={enlaceAbierto} />;

  const errores: Partial<Record<CampoTestimonio, string>> = state.status === "error" ? (state.errores ?? {}) : {};
  const labelStyle = levelStyle("body", { color: true });
  const ayuda = { ...levelStyle("body", { color: true }), fontSize: "0.85em", opacity: 0.7 } as CSSProperties;

  function cambiarVista(url: string | null) {
    if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    vistaActual.current = url;
  }

  async function elegirFoto(file: File | undefined) {
    if (!file) return;
    if (!(FORMATOS_FOTO_AUTOR as readonly string[]).includes(file.type)) {
      setFoto({ estado: "error", error: "La foto tiene que ser JPG, PNG o WebP." });
      return;
    }
    setFoto({ estado: "preparando" });
    try {
      const archivo = await achicarFoto(file);
      // El envío entero no puede pasar de 4 MB: una foto que no se pudo achicar puede no entrar.
      if (archivo.size > MAX_BYTES_FOTO_AUTOR) {
        cambiarVista(null);
        setFoto({ estado: "error", error: MENSAJE_FOTO_PESADA });
        return;
      }
      const vista = URL.createObjectURL(archivo);
      cambiarVista(vista);
      setFoto({ estado: "lista", archivo, vista });
    } catch {
      setFoto({ estado: "error", error: "No pudimos leer la foto. Probá con otra o enviá el testimonio sin foto." });
    }
  }

  function sacarFoto() {
    cambiarVista(null);
    setFoto({ estado: "nada" });
    if (entradaFoto.current) entradaFoto.current.value = "";
  }

  const errorGeneral = state.status === "error" ? state.error : null;

  return (
    <form
      className="space-y-5"
      style={MARCA}
      onSubmit={(e) => {
        e.preventDefault();
        if (foto.estado === "preparando") return;
        const fd = new FormData(e.currentTarget);
        // Va la foto achicada, nunca la original que eligió la persona.
        fd.delete("foto");
        if (foto.estado === "lista") fd.set("foto", foto.archivo, foto.archivo.type === "image/jpeg" ? "foto.jpg" : "foto");
        startTransition(() => dispatch(fd));
      }}
    >
      <fieldset disabled={pending} className="space-y-5">
        <CampoTrampa />
        <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
        {token ? <input type="hidden" name="t" value={token} /> : null}
        <input type="hidden" name="calificacion" value={calificacion > 0 ? String(calificacion) : ""} />

        <div className="fo-field-stack">
          <label htmlFor="tst-texto" style={labelStyle}>
            Tu testimonio
          </label>
          <textarea
            id="tst-texto"
            name="texto"
            rows={6}
            required
            maxLength={MAX_TEXTO}
            className="fo-input"
            aria-invalid={errores.texto ? true : undefined}
            onChange={(e) => setLargo(e.currentTarget.value.length)}
          />
          <p style={ayuda}>
            {largo.toLocaleString("es-AR")} / {MAX_TEXTO.toLocaleString("es-AR")}
          </p>
          {errores.texto ? <p className="text-sm text-[var(--fo-danger)]">{errores.texto}</p> : null}
        </div>

        <fieldset className="fo-field-stack">
          <legend style={labelStyle}>Calificación (opcional)</legend>
          <div className="flex gap-1" role="radiogroup" aria-label="Calificación">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={calificacion === n}
                aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
                onClick={() => setCalificacion(calificacion === n ? 0 : n)}
                className="text-3xl leading-none"
                style={{ color: n <= calificacion ? "var(--wsite-primary)" : "color-mix(in srgb, currentColor 25%, transparent)" }}
              >
                ★
              </button>
            ))}
          </div>
          {errores.calificacion ? <p className="text-sm text-[var(--fo-danger)]">{errores.calificacion}</p> : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label htmlFor="tst-nombre" style={labelStyle}>
              Tu nombre
            </label>
            <input
              id="tst-nombre"
              name="autorNombre"
              required
              maxLength={MAX_NOMBRE}
              autoComplete="name"
              defaultValue={nombreSugerido ?? ""}
              className="fo-input"
              aria-invalid={errores.autorNombre ? true : undefined}
            />
            {errores.autorNombre ? <p className="text-sm text-[var(--fo-danger)]">{errores.autorNombre}</p> : null}
          </div>
          <div className="fo-field-stack">
            <label htmlFor="tst-detalle" style={labelStyle}>
              ¿Qué hicimos juntos? (opcional)
            </label>
            <input
              id="tst-detalle"
              name="autorDetalle"
              maxLength={MAX_DETALLE}
              defaultValue={detalleSugerido ?? ""}
              placeholder="Casamiento en Rosario, XV de Cami…"
              className="fo-input"
            />
            {errores.autorDetalle ? <p className="text-sm text-[var(--fo-danger)]">{errores.autorDetalle}</p> : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label htmlFor="tst-enlace" style={labelStyle}>
              Instagram o web (opcional)
            </label>
            <input id="tst-enlace" name="autorEnlace" maxLength={500} placeholder="@tuusuario" className="fo-input" />
            {errores.autorEnlace ? <p className="text-sm text-[var(--fo-danger)]">{errores.autorEnlace}</p> : null}
          </div>
          <div className="fo-field-stack">
            <label htmlFor="tst-correo" style={labelStyle}>
              Correo (opcional, no se publica)
            </label>
            <input id="tst-correo" name="autorEmail" type="email" maxLength={254} autoComplete="email" className="fo-input" />
            {errores.autorEmail ? <p className="text-sm text-[var(--fo-danger)]">{errores.autorEmail}</p> : null}
          </div>
        </div>

        <div className="fo-field-stack">
          <label htmlFor="tst-foto" style={labelStyle}>
            Tu foto (opcional)
          </label>
          <div className="flex items-center gap-4">
            {foto.estado === "lista" ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa local de la foto elegida
              <img src={foto.vista} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : null}
            <input
              ref={entradaFoto}
              id="tst-foto"
              name="foto"
              type="file"
              accept={FORMATOS_FOTO_AUTOR.join(",")}
              onChange={(e) => void elegirFoto(e.currentTarget.files?.[0])}
              className="text-sm"
            />
            {foto.estado === "lista" ? (
              <button type="button" onClick={sacarFoto} className="text-sm underline">
                Sacar
              </button>
            ) : null}
          </div>
          {foto.estado === "preparando" ? <p style={ayuda}>Preparando la foto…</p> : null}
          {foto.estado === "error" ? <p className="text-sm text-[var(--fo-danger)]">{foto.error}</p> : null}
        </div>

        <label className="flex items-start gap-3" style={labelStyle}>
          <input type="checkbox" name="consentimiento" value="si" required className="mt-1 h-4 w-4 shrink-0" />
          <span>{textoPermiso}</span>
        </label>
      </fieldset>

      {errorGeneral ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {errorGeneral}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || foto.estado === "preparando"}
        className="w-full disabled:opacity-60"
        style={{
          ...levelStyle("button", { color: false }),
          backgroundColor: "var(--wsite-primary)",
          color: "#ffffff",
          borderRadius: "var(--wsite-button-radius)",
          paddingInline: "var(--wsite-button-padding-x)",
          paddingBlock: "var(--wsite-button-padding-y)",
        }}
      >
        {pending ? "Enviando…" : foto.estado === "preparando" ? "Preparando la foto…" : "Enviar testimonio"}
      </button>
    </form>
  );
}
