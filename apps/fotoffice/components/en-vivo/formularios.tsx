"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  borrarClaveYoutubeAction,
  crearCanalAction,
  empezarVivoAction,
  guardarClaveYoutubeAction,
  obtenerClaveObsAction,
  olvidarClaveTiktokAction,
  publicarComoClaseAction,
  regenerarClaveObsAction,
  terminarVivoAction,
  type LiveActionState,
} from "@/app/actions/en-vivo";

const inicial: LiveActionState = { error: null, ok: null };

function Aviso({ state }: { state: LiveActionState }) {
  if (state.error) {
    return (
      <p className="text-sm text-[var(--fo-danger)]" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.ok) return <p className="text-sm text-[var(--fo-success)]">{state.ok}</p>;
  return null;
}

/** Un botón que corre una acción del panel y muestra cómo salió. */
function BotonDeAccion({
  action,
  etiqueta,
  pendiente,
  variante = "primary",
  confirmar,
  campos,
}: {
  action: (prev: LiveActionState | undefined, formData: FormData) => Promise<LiveActionState>;
  etiqueta: string;
  pendiente: string;
  variante?: "primary" | "secondary" | "ghost";
  confirmar?: string;
  campos?: Record<string, string>;
}) {
  const [state, submit, pending] = useActionState(action, inicial);
  return (
    <form
      action={submit}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
      className="space-y-2"
    >
      {Object.entries(campos ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" disabled={pending} className={
        variante === "secondary"
          ? "fo-btn fo-btn-secondary text-sm disabled:opacity-60"
          : variante === "ghost"
            ? "fo-btn fo-btn-ghost text-sm disabled:opacity-60"
            : "fo-btn fo-btn-primary text-sm disabled:opacity-60"
      }>
        {pending ? pendiente : etiqueta}
      </button>
      <Aviso state={state} />
    </form>
  );
}

export function CrearCanalBoton() {
  return <BotonDeAccion action={crearCanalAction} etiqueta="Crear el canal" pendiente="Creando…" />;
}

export function RegenerarClaveBoton() {
  return (
    <BotonDeAccion
      action={regenerarClaveObsAction}
      etiqueta="Regenerar clave"
      pendiente="Regenerando…"
      variante="secondary"
      confirmar="La clave actual deja de andar en el momento y vas a tener que pegar la nueva en OBS. ¿Seguimos?"
    />
  );
}

export function BorrarYoutubeBoton() {
  return (
    <BotonDeAccion
      action={borrarClaveYoutubeAction}
      etiqueta="Borrar la clave"
      pendiente="Borrando…"
      variante="ghost"
      confirmar="¿Borrar la clave de YouTube guardada?"
    />
  );
}

export function OlvidarTiktokBoton() {
  return (
    <BotonDeAccion
      action={olvidarClaveTiktokAction}
      etiqueta="Olvidar la clave de TikTok"
      pendiente="Olvidando…"
      variante="ghost"
    />
  );
}

export function TerminarVivoBoton({ sessionId }: { sessionId: string }) {
  return (
    <BotonDeAccion
      action={terminarVivoAction}
      etiqueta="Terminar vivo"
      pendiente="Terminando…"
      campos={{ sessionId }}
      confirmar="Se corta la retransmisión a las redes. Acordate de detener también OBS. ¿Terminamos?"
    />
  );
}

/** Copia un texto que no es secreto (la dirección del servidor). */
export function CopiarTexto({ texto, etiqueta = "Copiar" }: { texto: string; etiqueta?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      className="fo-btn fo-btn-secondary text-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          setCopiado(false);
        }
      }}
    >
      {copiado ? "Copiado" : etiqueta}
    </button>
  );
}

/**
 * Copia la clave de OBS sin mostrarla: se le pide al servidor en el momento del clic y va
 * directo al portapapeles. En pantalla sólo queda enmascarada.
 */
export function CopiarClaveObs() {
  const [estado, setEstado] = useState<"" | "pidiendo" | "copiado" | string>("");
  return (
    <div className="space-y-1">
      <button
        type="button"
        className="fo-btn fo-btn-secondary text-sm"
        disabled={estado === "pidiendo"}
        onClick={async () => {
          setEstado("pidiendo");
          const r = await obtenerClaveObsAction();
          if (!r.clave) return setEstado(r.error ?? "No se pudo copiar.");
          try {
            await navigator.clipboard.writeText(r.clave);
            setEstado("copiado");
            setTimeout(() => setEstado(""), 2500);
          } catch {
            setEstado("El navegador no dejó copiar. Probá de nuevo.");
          }
        }}
      >
        {estado === "pidiendo" ? "Copiando…" : estado === "copiado" ? "Clave copiada" : "Copiar clave"}
      </button>
      {estado && estado !== "pidiendo" && estado !== "copiado" ? (
        <p className="text-xs text-[var(--fo-danger)]">{estado}</p>
      ) : null}
    </div>
  );
}

export function YoutubeForm({ tieneClave }: { tieneClave: boolean }) {
  const [state, submit, pending] = useActionState(guardarClaveYoutubeAction, inicial);
  return (
    <form action={submit} className="space-y-2">
      <label className="block space-y-1 text-sm">
        <span>{tieneClave ? "Reemplazar la clave de transmisión" : "Clave de transmisión de YouTube"}</span>
        <input
          name="clave"
          type="password"
          autoComplete="off"
          required
          maxLength={500}
          placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
          className="fo-input w-full max-w-md"
        />
      </label>
      <button type="submit" disabled={pending} className="fo-btn fo-btn-primary text-sm disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar clave"}
      </button>
      <Aviso state={state} />
    </form>
  );
}

/** Refresca la pantalla cada tantos segundos mientras haya un vivo abierto. */
export function AutoRefresco({ segundos = 10 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}

export function NuevoVivoForm({
  youtubeGuardada,
  tiktokGuardada,
  tiktokServidorGuardado,
  puedeRecordar,
}: {
  youtubeGuardada: string | null;
  tiktokGuardada: string | null;
  tiktokServidorGuardado: string | null;
  puedeRecordar: boolean;
}) {
  const [state, submit, pending] = useActionState(empezarVivoAction, inicial);
  const [visibilidad, setVisibilidad] = useState<"PUBLICA" | "SOCIOS">("PUBLICA");
  const [instagram, setInstagram] = useState(false);
  const [tiktok, setTiktok] = useState(false);
  const publica = visibilidad === "PUBLICA";

  return (
    <form action={submit} className="space-y-5">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Título</span>
        <input name="title" required maxLength={200} placeholder="Clase abierta de dibujo" className="fo-input w-full max-w-xl" />
      </label>

      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">¿Quién lo puede ver?</legend>
        <label className="flex items-start gap-2">
          <input type="radio" name="visibility" value="PUBLICA" checked={publica} onChange={() => setVisibilidad("PUBLICA")} />
          <span>
            <strong>Público.</strong> Se puede mirar en el sitio y se retransmite a las redes que elijas.
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="visibility" value="SOCIOS" checked={!publica} onChange={() => setVisibilidad("SOCIOS")} />
          <span>
            <strong>Sólo personas socias activas.</strong> Se mira en el portal, con su sesión. No va a redes.
          </span>
        </label>
      </fieldset>

      {publica ? (
        <fieldset className="space-y-4 text-sm">
          <legend className="font-medium">Retransmitir a</legend>

          <label className="flex items-start gap-2">
            <input type="checkbox" name="youtube" disabled={!youtubeGuardada} />
            <span>
              <strong>YouTube</strong>{" "}
              {youtubeGuardada ? (
                <span className="text-[var(--fo-muted)]">con la clave guardada {youtubeGuardada}</span>
              ) : (
                <span className="text-[var(--fo-muted)]">— primero guardá la clave en Configurar.</span>
              )}
            </span>
          </label>

          <div className="space-y-2">
            <label className="flex items-start gap-2">
              <input type="checkbox" name="instagram" checked={instagram} onChange={(e) => setInstagram(e.target.checked)} />
              <span>
                <strong>Instagram</strong>{" "}
                <span className="text-[var(--fo-muted)]">
                  — en la compu, instagram.com → Crear → En vivo. Copiá «URL de transmisión» y «Clave de transmisión». La clave cambia en cada vivo.
                </span>
              </span>
            </label>
            {instagram ? (
              <div className="grid gap-2 pl-6 sm:grid-cols-2">
                <input name="instagramServer" required placeholder="rtmps://edgetee-upload-….facebook.com:443/rtmp/" className="fo-input" />
                <input name="instagramKey" type="password" autoComplete="off" required placeholder="Clave de transmisión" className="fo-input" />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="flex items-start gap-2">
              <input type="checkbox" name="tiktok" checked={tiktok} onChange={(e) => setTiktok(e.target.checked)} />
              <span>
                <strong>TikTok</strong>{" "}
                <span className="text-[var(--fo-muted)]">
                  — sólo si tu cuenta tiene «clave de transmisión» (TikTok LIVE Center). {tiktokGuardada ? `Hay una recordada: ${tiktokGuardada}.` : ""}
                </span>
              </span>
            </label>
            {tiktok ? (
              <div className="space-y-2 pl-6">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    name="tiktokServer"
                    required={!tiktokServidorGuardado}
                    defaultValue=""
                    placeholder={tiktokServidorGuardado ?? "rtmp://…tiktokcdn…/stage/"}
                    className="fo-input"
                  />
                  <input
                    name="tiktokKey"
                    type="password"
                    autoComplete="off"
                    required={!tiktokGuardada}
                    placeholder={tiktokGuardada ? "Vacío = usar la recordada" : "Clave de transmisión"}
                    className="fo-input"
                  />
                </div>
                {puedeRecordar ? (
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="tiktokRemember" /> Recordar esta clave para el próximo vivo
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>

          <p className="fo-card p-3 text-xs text-[var(--fo-muted)]">
            <strong>¿TikTok no te da la clave?</strong> A las cuentas chicas no se la da. La alternativa es transmitir a
            TikTok con <em>TikTok LIVE Studio</em> desde una PC con Windows, en paralelo: OBS sigue mandando acá (grabación
            y demás redes) y LIVE Studio manda a TikTok.
          </p>
        </fieldset>
      ) : null}

      <button type="submit" disabled={pending} className="fo-btn fo-btn-primary disabled:opacity-60">
        {pending ? "Preparando…" : "Preparar el vivo"}
      </button>
      <Aviso state={state} />
    </form>
  );
}

export function PublicarClaseForm({
  recordingId,
  tituloSugerido,
  cursos,
}: {
  recordingId: string;
  tituloSugerido: string;
  cursos: { id: string; title: string }[];
}) {
  const [state, submit, pending] = useActionState(publicarComoClaseAction, inicial);
  if (state.ok) return <p className="text-sm text-[var(--fo-success)]">{state.ok}</p>;
  if (cursos.length === 0) {
    return (
      <p className="text-xs text-[var(--fo-muted)]">
        Para publicarla como clase necesitás un curso grabado (Cursos → nuevo curso, modalidad «Grabado»).
      </p>
    );
  }
  return (
    <form action={submit} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="recordingId" value={recordingId} />
      <label className="space-y-1 text-xs">
        <span className="block">Título de la clase</span>
        <input name="title" defaultValue={tituloSugerido} maxLength={200} className="fo-input w-56 text-sm" />
      </label>
      <label className="space-y-1 text-xs">
        <span className="block">Curso</span>
        <select name="courseId" required className="fo-input w-56 text-sm" defaultValue="">
          <option value="" disabled>
            Elegí un curso grabado
          </option>
          {cursos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="fo-btn fo-btn-primary text-sm disabled:opacity-60">
        {pending ? "Publicando…" : "Publicar como clase"}
      </button>
      <div className="w-full">
        <Aviso state={state} />
      </div>
    </form>
  );
}
