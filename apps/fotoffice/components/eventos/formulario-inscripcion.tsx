"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { completarEntrada, inscribirseAlEvento, type EstadoInscripcion } from "@/app/actions/evento-inscripcion";
import { CampoTrampa } from "@/components/consultas/campo-trampa";
import { FORMATOS_FOTO_INSCRIPTO, type CampoInscripcion } from "@/lib/eventos/inscripcion";
import { levelStyle } from "@/lib/website/typography";
import { achicarFoto } from "./achicar-foto";

const ESTADO_INICIAL: EstadoInscripcion = { status: "idle" };
const MARCA = { "--fo-accent": "var(--wsite-primary)", "--fo-accent-hover": "var(--wsite-primary)", accentColor: "var(--wsite-primary)" } as CSSProperties;
/** El envío entero no puede pasar de 4 MB: una foto que no se pudo achicar puede no entrar. */
const MAX_BYTES_FOTO = 3.8 * 1024 * 1024;

type Foto = { estado: "nada" } | { estado: "preparando" } | { estado: "lista"; archivo: Blob; vista: string } | { estado: "error"; error: string };

export type DatosPrevios = {
  nombre: string;
  email: string | null;
  telefono: string | null;
  dni: string | null;
  instagram: string | null;
  fotoUrl: string | null;
  aceptoTerminos: boolean;
  aceptoImagen: boolean;
};

/**
 * El formulario de inscripción del asistente: el paso "participante + revisión" del asistente de
 * Clickatón (`PublicRegistrationWizard`), en una sola pantalla. Sirve para las dos puertas:
 *
 * - `modo="entrada"`: el inscripto completa o corrige sus datos desde su enlace personal.
 * - `modo="publica"`: alguien se anota desde la página del evento.
 *
 * La foto se achica en el navegador apenas se elige y viaja con el envío; la sube el servidor.
 */
export function FormularioInscripcion({
  modo,
  workspaceSlug,
  eventoSlug,
  codigo,
  token,
  previos,
  pideFoto,
  textoTerminos,
  textoImagen,
}: {
  modo: "entrada" | "publica";
  workspaceSlug: string;
  eventoSlug?: string;
  codigo?: string;
  token?: string;
  previos?: DatosPrevios | null;
  pideFoto: boolean;
  textoTerminos: string;
  textoImagen: string;
}) {
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(modo === "entrada" ? completarEntrada : inscribirseAlEvento, ESTADO_INICIAL);
  const [foto, setFoto] = useState<Foto>({ estado: "nada" });
  const entradaFoto = useRef<HTMLInputElement>(null);
  const vistaActual = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    },
    [],
  );

  useEffect(() => {
    if (state.status !== "ok") return;
    if (state.destino) router.push(`/w/${workspaceSlug}${state.destino}`);
    else if (modo === "entrada") router.refresh();
  }, [state, router, workspaceSlug, modo]);

  if (state.status === "ok" && modo === "publica") {
    return (
      <p role="status" className="rounded-[var(--wsite-button-radius)] border p-6 text-center" style={{ ...levelStyle("body", { color: true }), borderColor: "var(--wsite-primary)" }}>
        {state.mensaje ?? "¡Listo! Te estamos llevando a tu entrada…"}
      </p>
    );
  }

  const errores: Partial<Record<CampoInscripcion, string>> = state.status === "error" ? (state.errores ?? {}) : {};
  const labelStyle = levelStyle("body", { color: true });
  const ayuda = { ...levelStyle("body", { color: true }), fontSize: "0.85em", opacity: 0.7 } as CSSProperties;
  const fotoPrevia = previos?.fotoUrl ?? null;

  function cambiarVista(url: string | null) {
    if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    vistaActual.current = url;
  }

  async function elegirFoto(file: File | undefined) {
    if (!file) return;
    if (!(FORMATOS_FOTO_INSCRIPTO as readonly string[]).includes(file.type)) {
      setFoto({ estado: "error", error: "La foto tiene que ser JPG, PNG o WebP." });
      return;
    }
    setFoto({ estado: "preparando" });
    try {
      const archivo = await achicarFoto(file);
      if (archivo.size > MAX_BYTES_FOTO) {
        cambiarVista(null);
        setFoto({ estado: "error", error: "La foto es muy pesada; probá con otra." });
        return;
      }
      const vista = URL.createObjectURL(archivo);
      cambiarVista(vista);
      setFoto({ estado: "lista", archivo, vista });
    } catch {
      setFoto({ estado: "error", error: "No pudimos leer la foto. Probá con otra." });
    }
  }

  const vista = foto.estado === "lista" ? foto.vista : fotoPrevia;
  const errorFoto = foto.estado === "error" ? foto.error : errores.foto;

  const campo = (id: CampoInscripcion, etiqueta: string, props: React.InputHTMLAttributes<HTMLInputElement>, nota?: string) => (
    <div className="fo-field-stack">
      <label htmlFor={`ins-${id}`} style={labelStyle}>
        {etiqueta}
      </label>
      <input id={`ins-${id}`} name={id} className="fo-input" aria-invalid={errores[id] ? true : undefined} {...props} />
      {nota ? <p style={ayuda}>{nota}</p> : null}
      {errores[id] ? <p className="text-sm text-[var(--fo-danger)]">{errores[id]}</p> : null}
    </div>
  );

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
        if (foto.estado === "lista") fd.set("foto", foto.archivo, "foto.jpg");
        startTransition(() => dispatch(fd));
      }}
    >
      <fieldset disabled={pending} className="space-y-5">
        {modo === "publica" ? <CampoTrampa /> : null}
        <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
        {eventoSlug ? <input type="hidden" name="eventoSlug" value={eventoSlug} /> : null}
        {codigo ? <input type="hidden" name="codigo" value={codigo} /> : null}
        {token ? <input type="hidden" name="t" value={token} /> : null}

        <div className="fo-field-stack">
          <span style={labelStyle}>Tu foto{pideFoto ? "" : " (opcional)"}</span>
          <input
            ref={entradaFoto}
            id="ins-foto"
            name="foto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => void elegirFoto(e.currentTarget.files?.[0])}
          />
          <button
            type="button"
            onClick={() => entradaFoto.current?.click()}
            className="flex w-full items-center gap-4 rounded-[var(--wsite-button-radius)] border-2 border-dashed p-4 text-left"
            style={{ borderColor: vista ? "var(--wsite-primary)" : "color-mix(in srgb, currentColor 30%, transparent)" }}
          >
            {vista ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vista} alt="Tu foto" className="size-20 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid size-20 shrink-0 place-items-center rounded-full text-3xl" style={{ background: "color-mix(in srgb, currentColor 10%, transparent)" }}>
                +
              </span>
            )}
            <span style={labelStyle}>
              <span className="block font-semibold">
                {foto.estado === "preparando" ? "Preparando la foto…" : vista ? "Cambiar foto" : "Elegir foto"}
              </span>
              <span style={ayuda}>Una foto tuya, de frente y con buena luz. Va en tu credencial y en tu placa de bienvenida.</span>
            </span>
          </button>
          {errorFoto ? <p className="text-sm text-[var(--fo-danger)]">{errorFoto}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {campo("nombre", "Nombre y apellido", { required: true, maxLength: 120, autoComplete: "name", defaultValue: previos?.nombre ?? "" })}
          {campo(
            "email",
            modo === "publica" ? "Correo" : "Correo (opcional)",
            { type: "email", required: modo === "publica", maxLength: 160, autoComplete: "email", defaultValue: previos?.email ?? "" },
            modo === "publica" ? "Te mandamos ahí el enlace a tu entrada." : undefined,
          )}
          {campo("telefono", "Teléfono (opcional)", { type: "tel", maxLength: 40, autoComplete: "tel", defaultValue: previos?.telefono ?? "" })}
          {campo("dni", "DNI (opcional)", { inputMode: "numeric", maxLength: 20, defaultValue: previos?.dni ?? "" })}
          {campo("instagram", "Instagram (opcional)", { maxLength: 80, placeholder: "@usuario", defaultValue: previos?.instagram ? `@${previos.instagram}` : "" }, "Para etiquetarte en la placa de bienvenida.")}
        </div>

        <div className="space-y-3">
          <label className="flex gap-3" style={labelStyle}>
            <input type="checkbox" name="terminos" defaultChecked={previos?.aceptoTerminos ?? false} className="mt-1 size-5 shrink-0" />
            <span>{textoTerminos}</span>
          </label>
          {errores.terminos ? <p className="text-sm text-[var(--fo-danger)]">{errores.terminos}</p> : null}
          <label className="flex gap-3" style={labelStyle}>
            <input type="checkbox" name="imagen" defaultChecked={previos?.aceptoImagen ?? false} className="mt-1 size-5 shrink-0" />
            <span>{textoImagen}</span>
          </label>
          {errores.imagen ? <p className="text-sm text-[var(--fo-danger)]">{errores.imagen}</p> : null}
        </div>

        {state.status === "ok" && state.mensaje ? (
          <p role="status" className="text-sm font-semibold" style={{ color: "var(--wsite-primary)" }}>
            {state.mensaje}
          </p>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="text-sm text-[var(--fo-danger)]">
            {state.error}
          </p>
        ) : null}

        <button type="submit" className="fo-btn fo-btn-primary w-full py-3 text-base" disabled={pending || foto.estado === "preparando"}>
          {pending ? "Guardando…" : modo === "publica" ? "Inscribirme" : previos?.aceptoTerminos ? "Guardar cambios" : "Completar mi inscripción"}
        </button>
      </fieldset>
    </form>
  );
}
