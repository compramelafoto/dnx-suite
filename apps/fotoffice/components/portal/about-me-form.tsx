"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { saveAboutMeAction, registerFeaturedPhotoAction, type AboutMeState } from "@/app/actions/about-me";
import {
  ABOUT_ME_INTRO,
  ABOUT_ME_QUESTIONS,
  MAX_FEATURED_PHOTOS,
  type AboutMe,
} from "@/lib/spotlight/about";

const initial: AboutMeState = { error: null, ok: null };

/**
 * «Más sobre mí»: las preguntas para que los colegas lo conozcan, el permiso de WhatsApp, el aviso
 * de que va a salir como Socio de la semana y las fotos de su placa.
 *
 * Componente cliente por las fotos: elegirlas y subirlas necesita el navegador. Las respuestas
 * viajan en el formulario de siempre.
 */
export function AboutMeForm({
  about,
  phone,
  institution,
  portfolioPhotos,
}: {
  about: AboutMe | null;
  phone: string | null;
  institution: string;
  portfolioPhotos: { url: string; width: number; height: number }[];
}) {
  const [state, submit, pending] = useActionState(saveAboutMeAction, initial);
  const [elegidas, setElegidas] = useState<string[]>(about?.featuredPhotoUrls ?? []);
  const [subiendo, setSubiendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Las del portfolio, y además las subidas para la placa (no están en el portfolio).
  const urlsPortfolio = new Set(portfolioPhotos.map((p) => p.url));
  const opciones = [
    ...portfolioPhotos.map((p) => p.url),
    ...elegidas.filter((u) => !urlsPortfolio.has(u)),
  ];
  const lleno = elegidas.length >= MAX_FEATURED_PHOTOS;

  function alternar(url: string) {
    setErrorFoto(null);
    setElegidas((prev) =>
      prev.includes(url)
        ? prev.filter((u) => u !== url)
        : prev.length >= MAX_FEATURED_PHOTOS
          ? prev
          : [...prev, url],
    );
  }

  async function subir(file: File | undefined) {
    if (!file) return;
    setErrorFoto(null);
    setSubiendo(true);
    try {
      const permiso = await fetch("/api/portal/sobre-mi/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const datos = (await permiso.json().catch(() => null)) as
        | { uploadUrl?: string; key?: string; error?: string }
        | null;
      if (!permiso.ok || !datos?.uploadUrl || !datos.key) {
        setErrorFoto(datos?.error ?? "No pudimos preparar la subida.");
        return;
      }
      const subida = await fetch(datos.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      }).catch(() => null);
      if (!subida?.ok) {
        setErrorFoto("La subida se cortó. Revisá tu conexión y probá de nuevo.");
        return;
      }
      const registro = await registerFeaturedPhotoAction({ key: datos.key });
      if (!registro.ok) {
        setErrorFoto(registro.error);
        return;
      }
      const nueva = registro.urls[registro.urls.length - 1];
      setElegidas((prev) => (prev.includes(nueva) ? prev : [...prev, nueva].slice(0, MAX_FEATURED_PHOTOS)));
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  const campoConError = (key: string) =>
    state.field === key ? "border-[var(--fo-danger)]" : "";

  return (
    <form action={submit} className="space-y-6">
      <section className="fo-card space-y-3 p-5">
        <h2 className="text-sm font-semibold">{ABOUT_ME_INTRO.titulo}</h2>
        {ABOUT_ME_INTRO.parrafos.map((p) => (
          <p key={p.slice(0, 20)} className="text-sm leading-relaxed text-[var(--fo-text-secondary)]">
            {p}
          </p>
        ))}
      </section>

      <section className="fo-card space-y-5 p-5">
        <h2 className="text-sm font-semibold">Contanos de vos</h2>
        {ABOUT_ME_QUESTIONS.map((q) => (
          <label key={q.key} className="fo-field-stack">
            <span className="fo-label">{q.pregunta}</span>
            {"ayuda" in q && q.ayuda ? <span className="fo-helper">{q.ayuda}</span> : null}
            <textarea
              name={q.key}
              defaultValue={about?.[q.key] ?? ""}
              maxLength={q.max}
              rows={q.max > 300 ? 3 : 2}
              className={`fo-input ${campoConError(q.key)}`}
            />
            {q.key === "proudPhotoText" ? (
              <input
                name="proudPhotoUrl"
                type="text"
                inputMode="url"
                defaultValue={about?.proudPhotoUrl ?? ""}
                placeholder="Link a la foto (Instagram, tu web…), opcional"
                className={`fo-input mt-2 ${campoConError("proudPhotoUrl")}`}
              />
            ) : null}
          </label>
        ))}
      </section>

      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Fotos para tu placa</h2>
          <p className="fo-helper">
            Cuando seas el Socio de la semana, el área de comunicación publica una placa con tu foto
            de perfil y hasta {MAX_FEATURED_PHOTOS} fotos tuyas. Elegilas de tu portfolio o subilas
            acá. Si no elegís ninguna, la placa sale sólo con tu foto de perfil.
          </p>
        </div>

        {opciones.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {opciones.map((url) => {
              const orden = elegidas.indexOf(url);
              const activa = orden >= 0;
              return (
                <li key={url}>
                  <button
                    type="button"
                    onClick={() => alternar(url)}
                    aria-pressed={activa}
                    disabled={!activa && lleno}
                    className={`relative block aspect-square w-full overflow-hidden rounded-lg border-2 ${
                      activa ? "border-[var(--fo-accent)]" : "border-transparent"
                    } disabled:opacity-40`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto de R2 */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {activa ? (
                      <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--fo-accent)] text-xs font-semibold text-white">
                        {orden + 1}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-[var(--fo-muted)]">
            Todavía no tenés fotos en tu portfolio.{" "}
            <Link href="/portal/portfolio" className="underline underline-offset-2">
              Armalo acá
            </Link>{" "}
            o subí fotos sólo para tu placa.
          </p>
        )}

        {elegidas.map((u) => (
          <input key={u} type="hidden" name="featuredPhotoUrls" value={u} />
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id="foto-placa"
            onChange={(e) => subir(e.target.files?.[0])}
            disabled={subiendo || lleno}
          />
          <label
            htmlFor="foto-placa"
            className={`fo-btn fo-btn-secondary cursor-pointer text-xs ${subiendo || lleno ? "pointer-events-none opacity-50" : ""}`}
          >
            {subiendo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
            {subiendo ? "Subiendo…" : "Subir una foto"}
          </label>
          <span className="text-xs text-[var(--fo-muted)]">
            {elegidas.length} de {MAX_FEATURED_PHOTOS} elegidas
          </span>
        </div>
        {errorFoto ? (
          <p className="text-xs text-[var(--fo-danger)]" role="alert">
            {errorFoto}
          </p>
        ) : null}
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Para que te contacten tus colegas</h2>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="whatsappOptIn"
            defaultChecked={about?.whatsappOptIn ?? false}
            className="mt-1"
          />
          <span className="space-y-1 text-sm">
            <span className="block font-medium">Quiero que mis colegas me escriban por WhatsApp</span>
            <span className="fo-helper block">
              Cuando seas el Socio de la semana, aparece un botón «Escribile por WhatsApp» con tu
              teléfono{phone ? ` (${phone})` : ""}. Sólo lo ven los socios de {institution} con su
              sesión iniciada, nunca el sitio público. Quien te escriba va a ver tu número.
            </span>
            {!phone ? (
              <span className="block text-xs text-[var(--fo-warning)]">
                No tenés un teléfono cargado. Agregalo en{" "}
                <Link href="/portal/perfil" className="underline underline-offset-2">
                  tus datos
                </Link>{" "}
                para que el botón funcione.
              </span>
            ) : null}
          </span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="spotlightNotice"
            defaultChecked={about?.spotlightNoticeAt != null}
            className="mt-1"
          />
          <span className="space-y-1 text-sm">
            <span className="block font-medium">
              Sé que en algún momento voy a aparecer como Socio de la semana en el panel de los socios
            </span>
            <span className="fo-helper block">
              Todos los socios activos salen por turno, uno por semana. Si preferís no salir, avisale a
              la institución.
            </span>
          </span>
        </label>
      </section>

      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="flex items-center gap-2 text-sm text-[var(--fo-success)]">
          <Check className="h-4 w-4" aria-hidden />
          {state.ok}
        </p>
      ) : null}

      <button type="submit" disabled={pending || subiendo} className="fo-btn fo-btn-primary text-sm">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
