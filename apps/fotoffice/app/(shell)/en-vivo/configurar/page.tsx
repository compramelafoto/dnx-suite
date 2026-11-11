import {
  BorrarYoutubeBoton,
  CopiarClaveObs,
  CopiarTexto,
  CrearCanalBoton,
  OlvidarTiktokBoton,
  RegenerarClaveBoton,
  YoutubeForm,
} from "@/components/en-vivo/formularios";
import { requireLive } from "@/lib/en-vivo/acceso";
import { readLiveConfig } from "@/lib/en-vivo/config";
import { mascaraDeTerminacion } from "@/lib/en-vivo/destinos";
import { cargarCanal } from "@/lib/en-vivo/store";

export const dynamic = "force-dynamic";

/**
 * Configurar: el canal (dirección y clave para OBS), la ayuda de OBS en vertical y la clave
 * persistente de YouTube. Ninguna clave completa llega a esta pantalla: la de OBS se copia a
 * pedido y las de destino sólo muestran su terminación.
 */
export default async function ConfigurarEnVivoPage() {
  const { workspace } = await requireLive();
  const config = readLiveConfig();
  const canal = await cargarCanal(workspace.id);

  return (
    <div className="space-y-6">
      <section className="fo-card space-y-4 p-5">
        <h2 className="text-lg font-semibold">1. El canal</h2>
        {!canal ? (
          <>
            <p className="text-sm text-[var(--fo-muted)]">
              El canal es la «puerta» por donde OBS manda el video. Se crea una sola vez y sirve para todos los vivos.
            </p>
            {config.ok ? <CrearCanalBoton /> : null}
          </>
        ) : (
          <dl className="space-y-4 text-sm">
            <div className="space-y-1">
              <dt className="font-medium">Servidor</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-[var(--fo-surface-muted,#f4f4f5)] px-2 py-1 break-all">{canal.rtmpsUrl}</code>
                <CopiarTexto texto={canal.rtmpsUrl} />
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium">Clave de retransmisión</dt>
              <dd className="flex flex-wrap items-start gap-2">
                <code className="rounded bg-[var(--fo-surface-muted,#f4f4f5)] px-2 py-1">••••••••••••••••</code>
                <CopiarClaveObs />
              </dd>
              <p className="text-xs text-[var(--fo-muted)]">
                Es como una contraseña: quien la tenga puede transmitir en nombre de tu espacio. Si se filtró, regenerala.
              </p>
            </div>
          </dl>
        )}
        {canal ? <RegenerarClaveBoton /> : null}
      </section>

      <section className="fo-card space-y-3 p-5 text-sm">
        <h2 className="text-lg font-semibold">2. OBS, paso a paso (formato vertical)</h2>
        <p className="text-[var(--fo-muted)]">
          Recomendamos transmitir en <strong>vertical 9:16</strong>: es como se mira en el celular, en Instagram y en TikTok.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Abrí OBS → <strong>Ajustes → Emisión</strong>. En «Servicio» elegí <strong>Personalizado</strong>. Pegá el{" "}
            <strong>Servidor</strong> y la <strong>Clave de retransmisión</strong> de arriba.
          </li>
          <li>
            <strong>Ajustes → Vídeo</strong>: resolución base y de salida <strong>720x1280</strong> (escribila a mano), 30 FPS. Si
            tu internet sube más de 10 Mbps podés usar 1080x1920.
          </li>
          <li>
            <strong>Ajustes → Salida</strong> (modo Avanzado): codificador H.264, control de frecuencia CBR,{" "}
            <strong>3500 kbps</strong> para 720x1280 (hasta 6000 kbps para 1080x1920), <strong>intervalo de fotogramas clave: 2 s</strong>,
            audio AAC 128 kbps a 48 kHz.
          </li>
          <li>Armá la escena: la cámara o la mesa de dibujo ocupando el lienzo vertical.</li>
          <li>
            Antes de cada vivo, en esta plataforma: <strong>Vivo → Nuevo vivo</strong>. Después, en OBS, <strong>Iniciar transmisión</strong>.
            Al final, <strong>Detener transmisión</strong> en OBS y «Terminar vivo» acá.
          </li>
        </ol>
        <p className="text-xs text-[var(--fo-muted)]">
          Antes de una clase importante hacé un vivo de prueba «Sólo personas socias» de un par de minutos: queda grabado y lo podés mirar en Grabaciones.
        </p>
      </section>

      {canal ? (
        <section className="fo-card space-y-3 p-5 text-sm">
          <h2 className="text-lg font-semibold">3. YouTube</h2>
          <p className="text-[var(--fo-muted)]">
            En YouTube Studio → <strong>Emitir en directo → Emisión</strong>, elegí una clave de transmisión <strong>persistente</strong>{" "}
            (no la «de un solo uso») y pegala acá una sola vez. La primera vez, YouTube puede tardar hasta 24 h en habilitar los vivos del canal.
          </p>
          {canal.youtubeKeyCiphertext ? (
            <p>
              Clave guardada: <code>{mascaraDeTerminacion(canal.youtubeKeyLast4) || "••••••••"}</code>
            </p>
          ) : null}
          {config.ok && config.puedeRecordarClaves ? (
            <YoutubeForm tieneClave={Boolean(canal.youtubeKeyCiphertext)} />
          ) : (
            <p className="text-[var(--fo-muted)]">La plataforma todavía no puede guardar claves cifradas.</p>
          )}
          {canal.youtubeKeyCiphertext ? <BorrarYoutubeBoton /> : null}
        </section>
      ) : null}

      {canal ? (
        <section className="fo-card space-y-3 p-5 text-sm">
          <h2 className="text-lg font-semibold">4. Instagram y TikTok</h2>
          <p className="text-[var(--fo-muted)]">
            <strong>Instagram</strong> da una clave nueva en cada vivo: se pega en «Nuevo vivo» y se descarta al terminar. Hace falta una
            cuenta profesional y entrar desde la computadora (instagram.com → Crear → En vivo).
          </p>
          <p className="text-[var(--fo-muted)]">
            <strong>TikTok</strong> da clave sólo a algunas cuentas (en general, desde 1000 seguidores y mayores de 18). Si la tenés, se pega en
            «Nuevo vivo» y la podés recordar. Si no, usá <strong>TikTok LIVE Studio</strong> en una PC con Windows, en paralelo con OBS.
          </p>
          {canal.tiktokKeyCiphertext ? (
            <div className="space-y-2">
              <p>
                Clave de TikTok recordada: <code>{mascaraDeTerminacion(canal.tiktokKeyLast4) || "••••••••"}</code>
              </p>
              <OlvidarTiktokBoton />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
