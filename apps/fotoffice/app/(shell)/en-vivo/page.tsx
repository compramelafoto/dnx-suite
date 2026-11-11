import Link from "next/link";
import { prisma } from "@repo/db";
import { AutoRefresco, NuevoVivoForm, TerminarVivoBoton } from "@/components/en-vivo/formularios";
import { ReproductorStream } from "@/components/en-vivo/reproductor";
import { requireLive } from "@/lib/en-vivo/acceso";
import { readLiveConfig } from "@/lib/en-vivo/config";
import { LIVE_CONFIG_PATH, LIVE_RECORDINGS_PATH } from "@/lib/en-vivo/constantes";
import { leerDestinosUsados, mascaraDeTerminacion, NOMBRE_DESTINO } from "@/lib/en-vivo/destinos";
import { ETIQUETA_ESTADO, seEstaTransmitiendo } from "@/lib/en-vivo/estados";
import { cargarCanal, reconciliarSenal, sesionActiva, urlDeReproduccion } from "@/lib/en-vivo/store";
import { ETIQUETA_VISIBILIDAD } from "@/lib/en-vivo/visibilidad";

export const dynamic = "force-dynamic";

/**
 * El vivo de ahora: si hay uno abierto, su estado (se refresca solo cada 10 segundos, y en cada
 * refresco se le pregunta la señal a Cloudflare); si no, el formulario «Nuevo vivo».
 */
export default async function EnVivoPage() {
  const { workspace } = await requireLive();
  const config = readLiveConfig();
  const canal = await cargarCanal(workspace.id);

  if (!canal) {
    return (
      <section className="fo-card space-y-3 p-5">
        <h2 className="text-lg font-semibold">Todavía no hay canal</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Antes del primer vivo hay que crear el canal y pegar su dirección y su clave en OBS.
        </p>
        <Link href={LIVE_CONFIG_PATH} className="fo-btn fo-btn-primary text-sm">
          Ir a Configurar
        </Link>
      </section>
    );
  }

  await reconciliarSenal(workspace.id);
  const sesion = await sesionActiva(canal.id);

  if (sesion) {
    const destinos = leerDestinosUsados(sesion.destinations);
    const url = seEstaTransmitiendo(sesion.status) ? urlDeReproduccion(canal.liveInputUid, { vivo: true }) : null;
    return (
      <section className="fo-card space-y-4 p-5">
        <AutoRefresco segundos={10} />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{sesion.title}</h2>
          <span
            className={`text-sm font-medium ${sesion.status === "EN_VIVO" ? "text-[var(--fo-success)]" : sesion.status === "SENAL_CORTADA" ? "text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}`}
          >
            {sesion.status === "EN_VIVO" ? "● " : ""}
            {ETIQUETA_ESTADO[sesion.status]}
          </span>
        </div>
        <p className="text-sm text-[var(--fo-muted)]">{ETIQUETA_VISIBILIDAD[sesion.visibility]}</p>

        {sesion.status === "ESPERANDO_SENAL" ? (
          <p className="text-sm">
            Todo listo. En OBS apretá <strong>Iniciar transmisión</strong>: en unos segundos esta pantalla pasa a «En vivo».
          </p>
        ) : null}
        {sesion.status === "SENAL_CORTADA" ? (
          <p className="text-sm">
            OBS dejó de mandar. Si fue un corte, volvé a iniciar la transmisión y sigue el mismo vivo. Si ya terminaste, apretá «Terminar vivo».
          </p>
        ) : null}
        {sesion.lastError ? (
          <p className="text-sm text-[var(--fo-danger)]">Cloudflare avisó un problema con la señal: {sesion.lastError}</p>
        ) : null}

        {url ? <ReproductorStream key={sesion.id} url={url} titulo={sesion.title} /> : null}

        {destinos.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {destinos.map((d) => (
              <li key={d.destino}>
                <strong>{NOMBRE_DESTINO[d.destino]}</strong> {mascaraDeTerminacion(d.terminacion)} —{" "}
                {d.estado === "ACTIVO" ? "conectado" : d.estado === "BORRADO" ? "cerrado" : `no se pudo conectar${d.error ? ` (${d.error})` : ""}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">Sin retransmisión a redes: sólo se graba y se mira en la plataforma.</p>
        )}

        <TerminarVivoBoton sessionId={sesion.id} />
      </section>
    );
  }

  const ultimo = await prisma.fotofficeLiveSession.findFirst({
    where: { channelId: canal.id },
    orderBy: { createdAt: "desc" },
    select: { title: true, status: true, endedAt: true },
  });

  return (
    <div className="space-y-6">
      {ultimo ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Último vivo: «{ultimo.title}» ({ETIQUETA_ESTADO[ultimo.status].toLowerCase()}). La grabación aparece en{" "}
          <Link href={LIVE_RECORDINGS_PATH} className="underline">
            Grabaciones
          </Link>
          .
        </p>
      ) : null}
      <section className="fo-card space-y-4 p-5">
        <h2 className="text-lg font-semibold">Nuevo vivo</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Preparalo unos minutos antes. Todos los vivos quedan grabados; los públicos se pueden retransmitir a las redes.
        </p>
        <NuevoVivoForm
          youtubeGuardada={canal.youtubeKeyCiphertext ? mascaraDeTerminacion(canal.youtubeKeyLast4) || "••••••••" : null}
          tiktokGuardada={canal.tiktokKeyCiphertext ? mascaraDeTerminacion(canal.tiktokKeyLast4) || "••••••••" : null}
          tiktokServidorGuardado={canal.tiktokServerUrl}
          puedeRecordar={config.ok && config.puedeRecordarClaves}
        />
      </section>
    </div>
  );
}
