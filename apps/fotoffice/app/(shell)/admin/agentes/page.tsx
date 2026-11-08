import { PageHeader } from "@/components/page-header";
import { estadoCanalAgentes } from "@/lib/agentes/canal";
import { VARIABLE_TOKEN_AGENTES } from "@/lib/agentes/canal-reglas";
import { MAX_CORRIDAS_POR_DIA, ultimasPropuestas } from "@/lib/agentes/periodista/flujo";
import { fechaHoraArgentina } from "@/lib/agentes/periodista/horario";
import { BotonAgentes } from "./acciones-agentes";

export const dynamic = "force-dynamic";
/** "Correr Periodista ahora" sigue en segundo plano (`after`) hasta 5 minutos. */
export const maxDuration = 300;

const ESTADOS: Record<string, string> = {
  PREPARANDO: "Preparando",
  PENDIENTE: "Esperando tu respuesta",
  PUBLICADA: "Publicada",
  DESCARTADA: "Descartada",
  FALLO: "Falló",
};

const MOTIVOS: Record<string, string> = { CRON: "automática", MANUAL: "a mano", OTRA: "otra noticia" };

/**
 * Equipo de agentes (spec 2026-11-07): el canal de Telegram de los agentes y el Periodista. El
 * acceso lo controla el layout de /admin (sólo SUPER_ADMIN).
 */
export default async function AdminAgentesPage() {
  const [canal, propuestas] = await Promise.all([estadoCanalAgentes(), ultimasPropuestas()]);
  const listo = canal.tieneToken && canal.conectado && canal.vinculado;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agentes"
        description="El canal de Telegram de los agentes y el Periodista, que propone 3 notas por semana para el blog de DNX Estudio."
      />

      <section className="fo-card space-y-4">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Canal de Telegram</h2>
        {!canal.tieneToken ? (
          <div className="fo-alert-error" role="status">
            Falta la variable <code className="text-xs">{VARIABLE_TOKEN_AGENTES}</code> en Vercel. Creá el bot con @BotFather (uno
            nuevo, aparte del de presupuestos), cargá su token en esa variable y volvé a desplegar. Sin ella el Periodista no corre.
          </div>
        ) : null}
        <ul className="text-sm text-[var(--fo-muted)] leading-relaxed space-y-1">
          <li>
            Bot: <span className="text-[var(--fo-text)]">{canal.botUsername ? `@${canal.botUsername}` : "sin conectar"}</span>
          </li>
          <li>
            Chat: <span className="text-[var(--fo-text)]">{canal.vinculado ? `vinculado${canal.chatNombre ? ` (${canal.chatNombre})` : ""}` : "sin vincular"}</span>
          </li>
        </ul>
        {canal.enlaceVinculo ? (
          <p className="text-sm text-[var(--fo-muted)]">
            Para vincular tu chat, abrí este enlace en el celular y tocá «Iniciar» (vale 30 minutos):{" "}
            <a href={canal.enlaceVinculo} target="_blank" rel="noreferrer" className="text-[var(--fo-accent)] underline break-all">
              {canal.enlaceVinculo}
            </a>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-4">
          <BotonAgentes accion="conectar" texto={canal.conectado ? "Reconectar el bot" : "Conectar el bot"} variante={canal.conectado ? "secundario" : "primario"} deshabilitado={!canal.tieneToken} />
          {canal.conectado ? <BotonAgentes accion="enlace" texto="Enlace nuevo para vincular" /> : null}
        </div>
      </section>

      <section className="fo-card space-y-4">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Periodista</h2>
        <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
          Lunes, miércoles y viernes a las 9:00 busca una noticia de fotografía, escribe una nota propia, le pone una foto de tu
          portfolio y te la manda por Telegram. Si tocás Publicar, sale ese día a las 11:00 (o enseguida, si ya pasaron). Para
          corregirla, respondé al mensaje. Nada se publica sin tu OK. Tope: {MAX_CORRIDAS_POR_DIA} corridas por día.
        </p>
        <BotonAgentes accion="correr" texto="Correr Periodista ahora" variante="primario" deshabilitado={!listo} />
        {!listo ? <p className="text-xs text-[var(--fo-muted)]">Para correrlo, primero conectá el bot y vinculá tu chat.</p> : null}
      </section>

      <section className="fo-card space-y-4">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Últimas propuestas</h2>
        {propuestas === null ? (
          <div className="fo-alert-error" role="status">
            Falta aplicar el SQL de <code className="text-xs">FotofficeAgentePropuesta</code> en la base.
          </div>
        ) : propuestas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay propuestas.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {propuestas.map((p) => (
              <li key={p.id} className="py-3 space-y-1 text-sm">
                <p className="text-[var(--fo-text)] font-medium">{p.titulo ?? p.fuenteTitulo ?? "(sin título)"}</p>
                <p className="text-[var(--fo-muted)]">
                  {fechaHoraArgentina(p.creadaEn)} · {ESTADOS[p.estado] ?? p.estado} · {MOTIVOS[p.motivo] ?? p.motivo}
                  {p.correcciones ? ` · ${p.correcciones} ${p.correcciones === 1 ? "corrección" : "correcciones"}` : ""}
                </p>
                {p.error ? <p className="text-[var(--fo-muted)]">Motivo: {p.error}</p> : null}
                <p className="flex flex-wrap gap-3">
                  {p.editorUrl && p.estado !== "DESCARTADA" ? (
                    <a href={p.editorUrl} className="text-[var(--fo-accent)] underline">
                      Ver borrador
                    </a>
                  ) : null}
                  {p.fuenteUrl ? (
                    <a href={p.fuenteUrl} target="_blank" rel="noreferrer" className="text-[var(--fo-accent)] underline">
                      Fuente
                    </a>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
