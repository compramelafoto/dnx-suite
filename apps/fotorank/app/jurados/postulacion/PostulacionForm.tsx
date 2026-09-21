"use client";

import { useActionState } from "react";
import { useMemo } from "react";

import {
  postularseComoJuradoAction,
  type EstadoDelFormulario,
} from "../../actions/judgePublicSignup";
import { BIO_MINIMA, PASSWORD_MINIMA } from "../../lib/fotorank/judges/publicSignupForm";
import {
  DIRECTORIO_ES_DE_TODA_LA_PLATAFORMA,
  EXTERNAL_PAYMENT_DISCLAIMER,
  QUE_PASA_DESPUES_DE_POSTULARSE,
} from "../../lib/fotorank/judges/legalCopy";

const INICIAL: EstadoDelFormulario = { error: null };

const campo =
  "w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-fr-primary placeholder:text-fr-muted-soft focus:border-fr-primary focus:outline-none";

function Error({ texto }: { texto?: string }) {
  if (!texto) return null;
  return <p className="mt-1 text-xs text-red-300">{texto}</p>;
}

export function PostulacionForm() {
  const [estado, enviar, pendiente] = useActionState(postularseComoJuradoAction, INICIAL);
  const errores = estado.errores ?? {};

  // Se manda la hora de carga para medir cuánto tardó en llenarse: un robot
  // tarda menos de tres segundos.
  const cargadoEn = useMemo(() => String(Date.now()), []);

  return (
    <form action={enviar} className="space-y-8">
      <input type="hidden" name="cargadoEn" value={cargadoEn} />

      {/* Campo trampa: invisible para las personas, tentador para un robot.
          No se usa type="hidden" porque los robots lo saltean. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="sitioWeb2">No completar</label>
        <input id="sitioWeb2" name="sitioWeb2" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <section className="rounded border border-zinc-700 bg-zinc-900/40 p-4">
        <p className="text-sm text-fr-muted">{DIRECTORIO_ES_DE_TODA_LA_PLATAFORMA}</p>
        <p className="mt-2 text-sm text-fr-muted">{QUE_PASA_DESPUES_DE_POSTULARSE}</p>
      </section>

      {estado.error ? (
        <p role="alert" className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {estado.error}
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-fr-primary">Quién sos</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="mb-1 block text-sm text-fr-muted">Nombre</label>
            <input id="firstName" name="firstName" required className={campo} autoComplete="given-name" />
            <Error texto={errores.firstName} />
          </div>
          <div>
            <label htmlFor="lastName" className="mb-1 block text-sm text-fr-muted">Apellido</label>
            <input id="lastName" name="lastName" required className={campo} autoComplete="family-name" />
            <Error texto={errores.lastName} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-fr-muted">Correo</label>
            <input id="email" name="email" type="email" required className={campo} autoComplete="email" />
            <Error texto={errores.email} />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-fr-muted">
              Contraseña <span className="text-fr-muted-soft">({PASSWORD_MINIMA} caracteres o más)</span>
            </label>
            <input id="password" name="password" type="password" required minLength={PASSWORD_MINIMA} className={campo} autoComplete="new-password" />
            <Error texto={errores.password} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="city" className="mb-1 block text-sm text-fr-muted">Ciudad</label>
            <input id="city" name="city" required className={campo} />
            <Error texto={errores.city} />
          </div>
          <div>
            <label htmlFor="country" className="mb-1 block text-sm text-fr-muted">País</label>
            <input id="country" name="country" required className={campo} />
            <Error texto={errores.country} />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm text-fr-muted">
              Teléfono <span className="text-fr-muted-soft">(opcional)</span>
            </label>
            <input id="phone" name="phone" className={campo} autoComplete="tel" />
            <p className="mt-1 text-xs text-fr-muted-soft">No se muestra en público.</p>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold text-fr-primary">Tu trabajo</legend>

        <div>
          <label htmlFor="professionalHeadline" className="mb-1 block text-sm text-fr-muted">
            En una línea, a qué te dedicás
          </label>
          <input
            id="professionalHeadline"
            name="professionalHeadline"
            required
            className={campo}
            placeholder="Fotógrafa documental y docente"
          />
          <Error texto={errores.professionalHeadline} />
        </div>

        <div>
          <label htmlFor="shortBio" className="mb-1 block text-sm text-fr-muted">
            Contanos de vos <span className="text-fr-muted-soft">({BIO_MINIMA} caracteres o más)</span>
          </label>
          <textarea id="shortBio" name="shortBio" required rows={5} minLength={BIO_MINIMA} className={campo} />
          <Error texto={errores.shortBio} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="specialtiesText" className="mb-1 block text-sm text-fr-muted">
              Especialidades <span className="text-fr-muted-soft">(separadas por coma)</span>
            </label>
            <input id="specialtiesText" name="specialtiesText" required className={campo} placeholder="retrato, documental" />
            <Error texto={errores.specialtiesText} />
          </div>
          <div>
            <label htmlFor="experienceYears" className="mb-1 block text-sm text-fr-muted">
              Años de experiencia
            </label>
            <input id="experienceYears" name="experienceYears" type="number" min={0} max={80} required className={campo} />
            <Error texto={errores.experienceYears} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="languagesText" className="mb-1 block text-sm text-fr-muted">
              Idiomas <span className="text-fr-muted-soft">(opcional)</span>
            </label>
            <input id="languagesText" name="languagesText" className={campo} placeholder="español, inglés" />
          </div>
          <div>
            <label htmlFor="region" className="mb-1 block text-sm text-fr-muted">
              Región <span className="text-fr-muted-soft">(opcional)</span>
            </label>
            <input id="region" name="region" className={campo} placeholder="Litoral" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="website" className="mb-1 block text-sm text-fr-muted">
              Sitio web <span className="text-fr-muted-soft">(opcional)</span>
            </label>
            <input id="website" name="website" className={campo} placeholder="tusitio.com" />
          </div>
          <div>
            <label htmlFor="instagram" className="mb-1 block text-sm text-fr-muted">
              Instagram <span className="text-fr-muted-soft">(opcional)</span>
            </label>
            <input id="instagram" name="instagram" className={campo} placeholder="@tuusuario" />
          </div>
          <div>
            <label htmlFor="portfolioUrl" className="mb-1 block text-sm text-fr-muted">
              Portfolio <span className="text-fr-muted-soft">(opcional)</span>
            </label>
            <input id="portfolioUrl" name="portfolioUrl" className={campo} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-semibold text-fr-primary">Para terminar</legend>

        <label className="flex items-start gap-3 text-sm text-fr-muted">
          <input type="checkbox" name="wantsDirectoryListing" className="mt-1" defaultChecked />
          <span>Quiero aparecer en el directorio para que los organizadores puedan convocarme.</span>
        </label>

        <label className="flex items-start gap-3 text-sm text-fr-muted">
          <input type="checkbox" name="aceptaTerminos" className="mt-1" required />
          <span>Acepto los términos de FotoRank.</span>
        </label>
        <Error texto={errores.aceptaTerminos} />

        <label className="flex items-start gap-3 text-sm text-fr-muted">
          <input type="checkbox" name="aceptaDatos" className="mt-1" required />
          <span>Acepto que FotoRank trate mis datos para este fin.</span>
        </label>
        <Error texto={errores.aceptaDatos} />

        <p className="pt-2 text-xs text-fr-muted-soft">{EXTERNAL_PAYMENT_DISCLAIMER}</p>
      </fieldset>

      <button type="submit" disabled={pendiente} className="fr-btn fr-btn-primary">
        {pendiente ? "Enviando…" : "Postularme como jurado"}
      </button>
    </form>
  );
}
