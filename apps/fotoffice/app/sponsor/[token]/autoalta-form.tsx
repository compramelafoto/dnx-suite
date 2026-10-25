"use client";

import { useActionState } from "react";
import { enviarAutoaltaSponsorAction, type AutoaltaState } from "@/app/actions/sponsor-self-signup";

const INICIAL: AutoaltaState = { error: null, ok: null };

type Actual = {
  name: string;
  websiteUrl: string | null;
  instagram: string | null;
  facebookUrl: string | null;
  description: string | null;
  benefitTitle: string | null;
  benefitText: string | null;
};

// `text-base` en los campos y no `text-sm`: en un teléfono, un campo con letra chica hace que
// el navegador acerque la pantalla al tocarlo. Casi todos los sponsors van a abrir esto desde
// WhatsApp.
const CAMPO = "fo-input text-base";

export function AutoaltaForm({ token, institucion, actual }: { token: string; institucion: string; actual: Actual }) {
  const [state, action, pending] = useActionState(enviarAutoaltaSponsorAction.bind(null, token), INICIAL);
  const v = (campo: string, previo: string | null = null) => state.valores?.[campo] ?? previo ?? "";

  if (state.ok) {
    return (
      <div role="status" className="fo-card space-y-2 p-6">
        <p className="text-base font-semibold">¡Listo, gracias!</p>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
          Tus datos le llegaron a {institucion}.
          {state.ok === "failed"
            ? " El logo no se pudo guardar: mandáselo directamente a la institución y lo suben ellos."
            : ""}{" "}
          Si querés cambiar algo más adelante, pediles un enlace nuevo.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Tu marca</h2>
        <label className="fo-field-stack">
          <span className="fo-label">Nombre de la marca</span>
          <input name="name" required minLength={2} maxLength={120} defaultValue={v("name", actual.name)} className={CAMPO} />
        </label>
        <label className="fo-field-stack">
          <span className="fo-label">Logo</span>
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
          <span className="fo-helper">PNG, JPG o WebP, hasta 4 MB. Mejor con fondo transparente.</span>
        </label>
        <label className="fo-field-stack">
          <span className="fo-label">Sitio web</span>
          <input name="websiteUrl" defaultValue={v("websiteUrl", actual.websiteUrl)} placeholder="tumarca.com.ar" className={CAMPO} inputMode="url" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="fo-field-stack">
            <span className="fo-label">Instagram</span>
            <input name="instagram" defaultValue={v("instagram", actual.instagram)} placeholder="@tumarca" className={CAMPO} />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Facebook</span>
            <input name="facebookUrl" defaultValue={v("facebookUrl", actual.facebookUrl)} placeholder="facebook.com/tumarca" className={CAMPO} inputMode="url" />
          </label>
        </div>
        <label className="fo-field-stack">
          <span className="fo-label">Qué hacen, en pocas palabras</span>
          <textarea name="description" maxLength={2000} rows={3} defaultValue={v("description", actual.description)} className={CAMPO} />
        </label>
      </section>

      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Beneficio para los socios (opcional)</h2>
          <p className="text-sm text-[var(--fo-muted)]">Si les ofrecés un descuento o algo especial, contalo acá. Es lo que ven en el portal.</p>
        </div>
        <label className="fo-field-stack">
          <span className="fo-label">Título</span>
          <input name="benefitTitle" maxLength={120} defaultValue={v("benefitTitle", actual.benefitTitle)} placeholder="Ej.: 15% de descuento en accesorios" className={CAMPO} />
        </label>
        <label className="fo-field-stack">
          <span className="fo-label">Cómo se usa</span>
          <textarea name="benefitText" maxLength={600} rows={3} defaultValue={v("benefitText", actual.benefitText)} placeholder="Ej.: mostrando el carnet de socio en el local o con el código SOCIO15 en la web." className={CAMPO} />
        </label>
      </section>

      <section className="fo-card space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Contacto</h2>
          <p className="text-sm text-[var(--fo-muted)]">Sólo para que {institucion} pueda comunicarse con vos. No se publica.</p>
        </div>
        <label className="fo-field-stack">
          <span className="fo-label">Nombre y apellido</span>
          <input name="contactName" defaultValue={v("contactName")} required maxLength={120} autoComplete="name" className={CAMPO} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="fo-field-stack">
            <span className="fo-label">Correo</span>
            <input name="contactEmail" defaultValue={v("contactEmail")} type="email" maxLength={200} autoComplete="email" className={CAMPO} />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">WhatsApp o teléfono</span>
            <input name="contactPhone" defaultValue={v("contactPhone")} type="tel" maxLength={40} autoComplete="tel" className={CAMPO} />
          </label>
        </div>
      </section>

      {state.error ? (
        <p role="alert" className="fo-alert-error p-3 text-sm leading-relaxed">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="fo-btn fo-btn-primary min-h-11 w-full sm:w-auto">
        {pending ? "Enviando…" : "Enviar mis datos"}
      </button>
    </form>
  );
}
