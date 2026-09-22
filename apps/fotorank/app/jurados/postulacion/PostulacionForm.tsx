"use client";

import { useActionState, useMemo, useState } from "react";

import {
  postularseComoJuradoAction,
  type EstadoDelFormulario,
} from "../../actions/judgePublicSignup";
import { BIO_MINIMA, PASSWORD_MINIMA } from "../../lib/fotorank/judges/publicSignupForm";
import {
  COBRO_POR_LA_PLATAFORMA_PROXIMAMENTE,
  EXTERNAL_PAYMENT_DISCLAIMER,
} from "../../lib/fotorank/judges/legalCopy";
import { achicarImagen } from "../../lib/fotorank/judges/ui/achicarImagen";

const INICIAL: EstadoDelFormulario = { error: null };

/**
 * Un campo ocupa su fila en el teléfono y comparte la fila en el escritorio.
 * La densidad cambia con el dispositivo; no es la misma columna estirada.
 */
function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  opcional,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--foreground)]">
        {etiqueta}
        {opcional ? (
          <span className="ml-1.5 font-normal text-[var(--foreground-muted)]">opcional</span>
        ) : null}
      </label>
      {children}
      {ayuda && !error ? (
        <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">{ayuda}</p>
      ) : null}
      {error ? (
        <p className="text-xs leading-relaxed text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-[var(--border)] pt-10 first:border-t-0 first:pt-0">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">{titulo}</h2>
        {descripcion ? (
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-[var(--foreground-muted)]">
            {descripcion}
          </p>
        ) : null}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

const ENTRADA =
  "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[15px] text-[var(--foreground)] transition-colors placeholder:text-[var(--foreground-muted)]/60 hover:border-[var(--foreground-muted)]/40 focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/30";

export function PostulacionForm() {
  const [estado, enviar, pendiente] = useActionState(postularseComoJuradoAction, INICIAL);
  const errores = estado.errores ?? {};

  // Se manda la hora de carga para medir cuánto tardó en llenarse: un robot
  // tarda menos de tres segundos.
  const cargadoEn = useMemo(() => String(Date.now()), []);

  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);

  const elegirFoto = async (archivo: File | undefined) => {
    if (!archivo) {
      setVistaPrevia(null);
      return;
    }
    const achicada = await achicarImagen(archivo);
    setVistaPrevia(URL.createObjectURL(achicada.archivo));

    const input = document.getElementById("foto") as HTMLInputElement | null;
    if (input) {
      const lista = new DataTransfer();
      lista.items.add(achicada.archivo);
      input.files = lista.files;
    }
  };

  return (
    <form action={enviar} className="space-y-10">
      <input type="hidden" name="cargadoEn" value={cargadoEn} />

      {/* Campo trampa: invisible para las personas, tentador para un robot.
          No se usa type="hidden" porque los robots lo saltean. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="sitioWeb2">No completar</label>
        <input id="sitioWeb2" name="sitioWeb2" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {estado.error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]"
        >
          {estado.error}
        </p>
      ) : null}

      <Seccion titulo="Quién sos">
        <div className="grid gap-6 sm:grid-cols-2">
          <Campo id="firstName" etiqueta="Nombre" error={errores.firstName}>
            <input id="firstName" name="firstName" required className={ENTRADA} autoComplete="given-name" />
          </Campo>
          <Campo id="lastName" etiqueta="Apellido" error={errores.lastName}>
            <input id="lastName" name="lastName" required className={ENTRADA} autoComplete="family-name" />
          </Campo>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Campo id="email" etiqueta="Correo" error={errores.email}>
            <input id="email" name="email" type="email" required className={ENTRADA} autoComplete="email" />
          </Campo>
          <Campo
            id="password"
            etiqueta="Contraseña"
            ayuda={`Al menos ${PASSWORD_MINIMA} caracteres.`}
            error={errores.password}
          >
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={PASSWORD_MINIMA}
              className={ENTRADA}
              autoComplete="new-password"
            />
          </Campo>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Campo id="city" etiqueta="Ciudad" error={errores.city}>
            <input id="city" name="city" required className={ENTRADA} autoComplete="address-level2" />
          </Campo>
          <Campo id="country" etiqueta="País" error={errores.country}>
            <input id="country" name="country" required className={ENTRADA} autoComplete="country-name" />
          </Campo>
          <Campo id="phone" etiqueta="Teléfono" opcional ayuda="No se muestra en público.">
            <input id="phone" name="phone" className={ENTRADA} autoComplete="tel" />
          </Campo>
        </div>

        <Campo
          id="foto"
          etiqueta="Tu foto"
          opcional
          ayuda="Una ficha con cara se convoca mucho más. La achicamos sola antes de subirla."
        >
          <div className="flex items-center gap-4">
            {vistaPrevia ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={vistaPrevia}
                alt="Tu foto"
                className="h-20 w-20 shrink-0 rounded-full border border-[var(--border)] object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-xs text-[var(--foreground-muted)]">
                sin foto
              </div>
            )}
            <input
              id="foto"
              name="foto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void elegirFoto(e.target.files?.[0])}
              className="min-w-0 flex-1 text-xs text-[var(--foreground-muted)] file:mr-3 file:rounded-[var(--radius-sm)] file:border-0 file:bg-[var(--secondary)] file:px-3 file:py-2 file:text-xs file:text-[var(--foreground)] hover:file:bg-[var(--surface-secondary)]"
            />
          </div>
        </Campo>
      </Seccion>

      <Seccion
        titulo="Tu trabajo"
        descripcion="Esto es lo que lee un organizador cuando busca jurado para su concurso."
      >
        <Campo
          id="professionalHeadline"
          etiqueta="En una línea, a qué te dedicás"
          error={errores.professionalHeadline}
        >
          <input
            id="professionalHeadline"
            name="professionalHeadline"
            required
            className={ENTRADA}
            placeholder="Fotógrafa documental y docente"
          />
        </Campo>

        <Campo
          id="shortBio"
          etiqueta="Contanos de vos"
          ayuda={`Al menos ${BIO_MINIMA} caracteres. Dónde trabajaste, qué concursos jurados, qué mirás en una foto.`}
          error={errores.shortBio}
        >
          <textarea
            id="shortBio"
            name="shortBio"
            required
            rows={5}
            minLength={BIO_MINIMA}
            className={`${ENTRADA} resize-y leading-relaxed`}
          />
        </Campo>

        <div className="grid gap-6 sm:grid-cols-2">
          <Campo
            id="specialtiesText"
            etiqueta="Especialidades"
            ayuda="Separadas por coma."
            error={errores.specialtiesText}
          >
            <input
              id="specialtiesText"
              name="specialtiesText"
              required
              className={ENTRADA}
              placeholder="retrato, documental"
            />
          </Campo>
          <Campo
            id="experienceYears"
            etiqueta="Años de experiencia"
            error={errores.experienceYears}
          >
            <input
              id="experienceYears"
              name="experienceYears"
              type="number"
              min={0}
              max={80}
              required
              className={ENTRADA}
            />
          </Campo>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Campo id="languagesText" etiqueta="Idiomas" opcional>
            <input id="languagesText" name="languagesText" className={ENTRADA} placeholder="español, inglés" />
          </Campo>
          <Campo id="region" etiqueta="Región" opcional>
            <input id="region" name="region" className={ENTRADA} placeholder="Litoral" />
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="Dónde verte" descripcion="Todo opcional, pero ayuda a que te encuentren.">
        <div className="grid gap-6 sm:grid-cols-3">
          <Campo id="website" etiqueta="Sitio web" opcional>
            <input id="website" name="website" className={ENTRADA} placeholder="tusitio.com" />
          </Campo>
          <Campo id="instagram" etiqueta="Instagram" opcional>
            <input id="instagram" name="instagram" className={ENTRADA} placeholder="@tuusuario" />
          </Campo>
          <Campo id="portfolioUrl" etiqueta="Portfolio" opcional>
            <input id="portfolioUrl" name="portfolioUrl" className={ENTRADA} />
          </Campo>
        </div>
      </Seccion>

      <Seccion titulo="Para terminar">
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
            <input
              type="checkbox"
              name="wantsDirectoryListing"
              defaultChecked
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span>Quiero aparecer en el directorio para que los organizadores puedan convocarme.</span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
            <input
              type="checkbox"
              name="aceptaTerminos"
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span>Acepto los términos de FotoRank.</span>
          </label>
          {errores.aceptaTerminos ? (
            <p className="text-xs text-[var(--danger)]">{errores.aceptaTerminos}</p>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
            <input
              type="checkbox"
              name="aceptaDatos"
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
            />
            <span>Acepto que FotoRank trate mis datos para este fin.</span>
          </label>
          {errores.aceptaDatos ? (
            <p className="text-xs text-[var(--danger)]">{errores.aceptaDatos}</p>
          ) : null}
        </div>

        <div className="max-w-prose space-y-3">
          <p className="border-l-2 border-[var(--primary)] pl-4 text-sm leading-relaxed text-[var(--foreground-muted)]">
            {COBRO_POR_LA_PLATAFORMA_PROXIMAMENTE}
          </p>
          <p className="text-xs leading-relaxed text-[var(--foreground-muted)]">
            <span className="text-[var(--foreground)]">Mientras tanto:</span>{" "}
            {EXTERNAL_PAYMENT_DISCLAIMER}
          </p>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={pendiente}
            className="w-full rounded-[var(--radius-sm)] bg-[var(--primary)] px-6 py-3 text-[15px] font-semibold text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--background)] disabled:opacity-60 sm:w-auto sm:min-w-56"
          >
            {pendiente ? "Enviando…" : "Postularme como jurado"}
          </button>
        </div>
      </Seccion>
    </form>
  );
}
