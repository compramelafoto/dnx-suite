"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  updateMyEditorialProfileAction,
  type ProfileFormState,
} from "@/app/actions/profile";

const fieldClass = "is-input mt-2";

const initial: ProfileFormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar perfil"}
    </button>
  );
}

export type EditorialProfileValues = {
  firstName: string;
  lastName: string;
  email: string;
  bio: string;
  city: string;
  province: string;
  website: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  whatsapp: string;
  logoUrl: string | null;
};

export function EditorialProfileForm({
  initialValues,
}: {
  initialValues: EditorialProfileValues;
}) {
  const [state, action] = useActionState(updateMyEditorialProfileAction, initial);
  const [logoUrl, setLogoUrl] = useState(initialValues.logoUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onAvatarChange(file: File | null) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("purpose", "avatar");
      const res = await fetch("/api/redaccion/upload", { method: "POST", body });
      const data = (await res.json()) as { url?: string; avatar?: { url: string }; error?: string };
      if (!res.ok || !(data.url || data.avatar?.url)) {
        throw new Error(data.error || "No se pudo subir la foto");
      }
      setLogoUrl(data.url || data.avatar!.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error de subida");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const avatarInitial = (
    initialValues.firstName.trim()[0] ||
    initialValues.email[0] ||
    "?"
  ).toUpperCase();

  return (
    <form action={action} className="space-y-10">
      <input type="hidden" name="logoUrl" value={logoUrl} />

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--is-text)]">Foto de perfil</h2>
        <p className="text-sm leading-relaxed text-[var(--is-muted)]">
          Se muestra en Redacción y en la firma de tus notas públicas. JPG, PNG o WebP · máx. 5 MB.
        </p>
        <div className="flex flex-wrap items-center gap-5">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar R2 / Google
            <img
              src={logoUrl}
              alt=""
              width={80}
              height={80}
              className="size-20 rounded-full object-cover ring-1 ring-[var(--is-border)]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              aria-hidden
              className="inline-flex size-20 items-center justify-center rounded-full bg-[var(--is-bg-secondary)] text-xl font-semibold text-[var(--is-muted)] ring-1 ring-[var(--is-border)]"
            >
              {avatarInitial}
            </span>
          )}
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              className="block w-full max-w-xs text-sm text-[var(--is-muted)] file:mr-3 file:rounded-[var(--is-radius-sm)] file:border-0 file:bg-[var(--is-bg-secondary)] file:px-3 file:py-2 file:text-sm file:font-medium file:text-[var(--is-text)]"
              onChange={(e) => void onAvatarChange(e.target.files?.[0] ?? null)}
            />
            {uploading ? (
              <p className="text-sm text-[var(--is-muted)]">Subiendo…</p>
            ) : null}
            {uploadError ? (
              <p className="text-sm text-red-700" role="alert">
                {uploadError}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="text-sm font-semibold text-[var(--is-text)]">
            Nombre
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            defaultValue={initialValues.firstName}
            className={fieldClass}
            placeholder="Nombre"
            maxLength={80}
          />
        </div>
        <div>
          <label htmlFor="lastName" className="text-sm font-semibold text-[var(--is-text)]">
            Apellido
          </label>
          <input
            id="lastName"
            name="lastName"
            defaultValue={initialValues.lastName}
            className={fieldClass}
            placeholder="Apellido"
            maxLength={120}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="bio" className="text-sm font-semibold text-[var(--is-text)]">
            Bio corta
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            defaultValue={initialValues.bio}
            className={`${fieldClass} min-h-[7rem] py-3 leading-relaxed`}
            placeholder="Quién sos, de dónde cubrís, enfoque editorial…"
            maxLength={600}
          />
          <p className="mt-2 text-xs text-[var(--is-muted)]">Hasta 600 caracteres. Visible en tu ficha de autor.</p>
        </div>

        <div>
          <label htmlFor="city" className="text-sm font-semibold text-[var(--is-text)]">
            Ciudad
          </label>
          <input id="city" name="city" defaultValue={initialValues.city} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="province" className="text-sm font-semibold text-[var(--is-text)]">
            Provincia
          </label>
          <input
            id="province"
            name="province"
            defaultValue={initialValues.province}
            className={fieldClass}
          />
        </div>
      </section>

      <section className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--is-text)]">Contacto y redes</h2>
          <p className="mt-1 text-sm text-[var(--is-muted)]">
            Opcional. El email de cuenta ({initialValues.email}) no se publica.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="website" className="text-sm font-semibold text-[var(--is-text)]">
              Sitio web
            </label>
            <input
              id="website"
              name="website"
              type="url"
              defaultValue={initialValues.website}
              className={fieldClass}
              placeholder="https://"
            />
          </div>
          <div>
            <label htmlFor="instagram" className="text-sm font-semibold text-[var(--is-text)]">
              Instagram
            </label>
            <input
              id="instagram"
              name="instagram"
              defaultValue={initialValues.instagram}
              className={fieldClass}
              placeholder="@usuario o URL"
            />
          </div>
          <div>
            <label htmlFor="facebook" className="text-sm font-semibold text-[var(--is-text)]">
              Facebook
            </label>
            <input
              id="facebook"
              name="facebook"
              defaultValue={initialValues.facebook}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="tiktok" className="text-sm font-semibold text-[var(--is-text)]">
              TikTok
            </label>
            <input
              id="tiktok"
              name="tiktok"
              defaultValue={initialValues.tiktok}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="whatsapp" className="text-sm font-semibold text-[var(--is-text)]">
              WhatsApp
            </label>
            <input
              id="whatsapp"
              name="whatsapp"
              defaultValue={initialValues.whatsapp}
              className={fieldClass}
              placeholder="+54 9 …"
            />
          </div>
        </div>
      </section>

      {state.error ? (
        <p
          className="rounded-[var(--is-radius-sm)] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}

      <div className="border-t border-[var(--is-border)] pt-8">
        <SubmitButton />
      </div>
    </form>
  );
}
