"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  generarEnlaceAutoaltaAction,
  invitarSponsorAction,
  type EnlaceState,
} from "./actions-autoalta";

const INICIAL: EnlaceState = { error: null, url: null, partnerId: null, expiresAt: null };

function venceEl(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

function mensajeParaElSponsor(institucion: string, url: string): string {
  return `¡Hola! Te comparto el enlace para que cargues los datos de tu marca como sponsor de ${institucion}: logo, redes y el beneficio para los socios. ${url}`;
}

/** El enlace recién generado, con las tres formas de mandarlo. */
function EnlaceListo({ url, expiresAt, institucion }: { url: string; expiresAt: string; institucion: string }) {
  const [copiado, setCopiado] = useState(false);
  const texto = mensajeParaElSponsor(institucion, url);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface-muted)] p-4">
      <p className="text-sm font-medium">Enlace listo. Mandáselo al sponsor:</p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="fo-input w-full font-mono text-xs"
        aria-label="Enlace para el sponsor"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copiar} className="fo-btn fo-btn-primary text-sm">
          {copiado ? "¡Copiado!" : "Copiar enlace"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fo-btn fo-btn-secondary text-sm"
        >
          Mandar por WhatsApp
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(`Tus datos como sponsor de ${institucion}`)}&body=${encodeURIComponent(texto)}`}
          className="fo-btn fo-btn-secondary text-sm"
        >
          Mandar por correo
        </a>
      </div>
      <p className="fo-helper">
        Sirve una sola vez y vence el {venceEl(expiresAt)}. Si generás otro, este deja de funcionar.
      </p>
    </div>
  );
}

/** En la ficha de un sponsor que ya está en la institución. */
export function GenerarEnlaceAutoalta({
  partnerId,
  institucion,
  yaHayUno,
}: {
  partnerId: string;
  institucion: string;
  yaHayUno: boolean;
}) {
  const [state, action, pending] = useActionState(generarEnlaceAutoaltaAction.bind(null, partnerId), INICIAL);

  return (
    <div className="space-y-3">
      <form action={action}>
        <button type="submit" disabled={pending} className="fo-btn fo-btn-secondary text-sm">
          {pending ? "Generando…" : yaHayUno || state.url ? "Generar un enlace nuevo" : "Generar enlace para el sponsor"}
        </button>
      </form>
      {state.error ? (
        <p className="fo-alert-error p-3 text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.url && state.expiresAt ? (
        <EnlaceListo url={state.url} expiresAt={state.expiresAt} institucion={institucion} />
      ) : null}
    </div>
  );
}

/** Sponsor nuevo: sólo el nombre, y el enlace para que cargue el resto. */
export function InvitarSponsorForm({ institucion }: { institucion: string }) {
  const [state, action, pending] = useActionState(invitarSponsorAction, INICIAL);

  if (state.url && state.expiresAt) {
    return (
      <div className="space-y-4">
        <EnlaceListo url={state.url} expiresAt={state.expiresAt} institucion={institucion} />
        {state.partnerId ? (
          <Link href={`/sponsors/${state.partnerId}`} className="fo-btn fo-btn-ghost text-sm">
            Ir a la ficha del sponsor
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <label className="fo-field-stack">
        <span className="fo-label">Nombre de la marca</span>
        <input name="name" required minLength={2} maxLength={120} className="fo-input" placeholder="Ej.: Tecnoflash" />
      </label>
      {state.error ? (
        <p className="fo-alert-error p-3 text-sm" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="fo-btn fo-btn-primary text-sm">
        {pending ? "Generando…" : "Crear y generar enlace"}
      </button>
    </form>
  );
}
