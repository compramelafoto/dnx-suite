"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { EXHIBITOR_TEXT_LIMITS, RIGHTS_TEXT, RIGHTS_TEXT_VERSION } from "@repo/muestras";
import { subirImagen } from "@/components/formulario/subir-imagen";
import { sumarmeComoExpositor } from "@/lib/expositores/alta";
import { botonLleno, campo, nota, seccion } from "./estilos";

type PerfilPropio = { displayName: string; tieneBio: boolean } | null;

/**
 * Sumarse a una muestra (spec D3): cómo firma, su perfil de fotógrafo (se crea acá si no tiene; si
 * tiene, sólo se completa la biografía si falta) y la aceptación de derechos. El token no viaja
 * como prop: se lee de la dirección, donde ya está.
 */
export function AltaExpositor({ nombreSugerido, perfil }: { nombreSugerido: string; perfil: PerfilPropio }) {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function cambiarAvatar(file: File | undefined) {
    if (!file) return;
    setSubiendo(true);
    setErrores([]);
    try {
      setAvatar(await subirImagen(file, "avatar"));
    } catch (e) {
      setErrores([e instanceof Error ? e.message : "No pudimos subir la foto."]);
    } finally {
      setSubiendo(false);
    }
  }

  const enviar = (fd: FormData) => {
    fd.set("token", token);
    fd.set("avatarUrl", avatar ?? "");
    empezar(async () => {
      const r = await sumarmeComoExpositor(fd);
      if (!r.ok) return setErrores(r.errores);
      router.push(`/panel/expositor/${r.id}`);
    });
  };

  const bio = (
    <label className="block space-y-1">
      <span>Biografía</span>
      <span className={`block ${nota}`}>Contá quién sos y qué fotografiás. Es lo que va a leer el público de la muestra.</span>
      <textarea name="bio" rows={6} className={campo} />
    </label>
  );

  return (
    <form action={enviar} className="space-y-8">
      <section className={seccion}>
        <h2 className="text-lg">Cómo firmás tus obras</h2>
        <label className="block space-y-1">
          <span className={nota}>Así va a aparecer tu nombre en las fichas y en la muestra.</span>
          <input name="firma" required maxLength={EXHIBITOR_TEXT_LIMITS.displayName} defaultValue={perfil?.displayName ?? nombreSugerido} className={campo} />
        </label>
      </section>

      {perfil ? (
        perfil.tieneBio ? (
          <p className={nota}>Vamos a usar tu perfil de fotógrafo ({perfil.displayName}). Podés cambiarlo cuando quieras en &quot;Mi perfil de fotógrafo&quot;.</p>
        ) : (
          <section className={seccion}>
            <h2 className="text-lg">Completá tu perfil</h2>
            {bio}
          </section>
        )
      ) : (
        <section className={seccion}>
          <h2 className="text-lg">Tu perfil de fotógrafo</h2>
          <p className={nota}>Es tu página pública: tu biografía y tu portfolio, para todas las muestras donde expongas.</p>
          <div className="flex items-center gap-5">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="size-20 rounded-full object-cover" />
            ) : (
              <span aria-hidden className="size-20 rounded-full bg-[var(--mf-surface)]" />
            )}
            <label className="cursor-pointer underline underline-offset-4">
              {subiendo ? "Subiendo…" : avatar ? "Cambiar foto" : "Subir tu foto"}
              <input type="file" accept="image/*" className="sr-only" disabled={subiendo} onChange={(e) => cambiarAvatar(e.target.files?.[0])} />
            </label>
          </div>
          <label className="block space-y-1">
            <span>Nombre del perfil</span>
            <input name="displayName" defaultValue={nombreSugerido} className={campo} />
          </label>
          {bio}
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1"><span>Ciudad</span><input name="city" className={campo} /></label>
            <label className="block space-y-1"><span>Provincia</span><input name="province" className={campo} /></label>
            <label className="block space-y-1"><span>Instagram</span><input name="instagram" placeholder="@usuario" className={campo} /></label>
          </div>
        </section>
      )}

      <section className={seccion}>
        <label className="flex items-start gap-2 text-[15px]">
          <input type="checkbox" name="derechos" value="1" required className="mt-1" />
          <input type="hidden" name="derechosVersion" value={RIGHTS_TEXT_VERSION} />
          <span>{RIGHTS_TEXT}</span>
        </label>
      </section>

      {errores.length ? (
        <ul role="alert" className="space-y-1 text-[var(--mf-alerta)]">{errores.map((e) => <li key={e}>{e}</li>)}</ul>
      ) : null}
      <p>
        <button type="submit" className={botonLleno} disabled={pendiente || subiendo}>
          {pendiente ? "Sumándote…" : "Sumarme a la muestra"}
        </button>
      </p>
    </form>
  );
}
