"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { subirImagen } from "@/components/formulario/subir-imagen";
import { guardarPerfil } from "@/lib/perfiles/acciones";

export type PerfilInicial = {
  displayName: string; slug: string; bio: string; city: string; province: string;
  website: string; instagram: string; avatarUrl: string | null;
};

const campo = "w-full rounded-[2px] border border-[var(--mf-line)] bg-white px-3 py-2";

export function FormularioPerfil({ inicial, esNuevo }: { inicial: PerfilInicial; esNuevo: boolean }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [errores, setErrores] = useState<string[]>([]);
  const [guardado, setGuardado] = useState(false);
  const [avatar, setAvatar] = useState(inicial.avatarUrl);
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

  function enviar(form: HTMLFormElement) {
    const fd = new FormData(form);
    fd.set("avatarUrl", avatar ?? "");
    setGuardado(false);
    start(async () => {
      const r = await guardarPerfil(fd);
      if (!r.ok) return setErrores(r.errores);
      setErrores([]);
      setGuardado(true);
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); enviar(e.currentTarget); }}>
      <div className="flex items-center gap-5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="size-24 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="size-24 rounded-full bg-[var(--mf-surface)]" />
        )}
        <label className="cursor-pointer underline underline-offset-4">
          {subiendo ? "Subiendo…" : avatar ? "Cambiar foto" : "Subir foto"}
          <input type="file" accept="image/*" className="sr-only" disabled={subiendo} onChange={(e) => cambiarAvatar(e.target.files?.[0])} />
        </label>
        {avatar ? <button type="button" className="text-sm text-[var(--mf-muted)] underline" onClick={() => setAvatar(null)}>Quitar</button> : null}
      </div>
      <label className="block space-y-1">
        <span>Nombre como querés que aparezca</span>
        <input name="displayName" required defaultValue={inicial.displayName} className={campo} />
      </label>
      <label className="block space-y-1">
        <span>Dirección de tu perfil</span>
        <span className="flex items-center gap-2">
          <span className="shrink-0 text-sm text-[var(--mf-muted)]">muestrasfotograficas.com/fotografos/</span>
          <input name="slug" defaultValue={inicial.slug} placeholder={esNuevo ? "se arma con tu nombre" : undefined} className={campo} />
        </span>
      </label>
      <label className="block space-y-1">
        <span>Sobre vos</span>
        <textarea name="bio" rows={6} defaultValue={inicial.bio} className={campo} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1"><span>Ciudad</span><input name="city" defaultValue={inicial.city} className={campo} /></label>
        <label className="block space-y-1"><span>Provincia</span><input name="province" defaultValue={inicial.province} className={campo} /></label>
        <label className="block space-y-1"><span>Sitio web</span><input name="website" defaultValue={inicial.website} placeholder="tusitio.com" className={campo} /></label>
        <label className="block space-y-1"><span>Instagram</span><input name="instagram" defaultValue={inicial.instagram} placeholder="@usuario" className={campo} /></label>
      </div>
      {errores.length ? (
        <ul role="alert" className="rounded-[2px] bg-red-50 p-3 text-sm text-red-800">{errores.map((e) => <li key={e}>{e}</li>)}</ul>
      ) : null}
      {guardado ? <p role="status" className="text-sm text-[var(--mf-teal)]">Guardado.</p> : null}
      <button type="submit" disabled={pendiente || subiendo} className="inline-flex h-11 items-center bg-[var(--mf-ink)] px-5 text-white disabled:opacity-50">
        {pendiente ? "Guardando…" : esNuevo ? "Crear mi perfil" : "Guardar"}
      </button>
    </form>
  );
}
