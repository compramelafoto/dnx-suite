import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { appUrl } from "@/lib/app-url";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { ajustesPorCategoria, leerAcuse } from "@/lib/presupuesto-automatico/ajustes";
import { ACUSE_POR_OMISION } from "@/lib/presupuesto-automatico/canales";
import { pendientesDeAprobar } from "@/lib/presupuesto-automatico/flujo";
import { listarPropuestasModelo } from "@/lib/presupuestos/propuestas-modelo";
import { estadoTelegram } from "@/lib/telegram/conexion";
import { AcuseForm, AprobarForm, CategoriaForm, ConectarForm, DesconectarForm, VincularForm } from "./telegram-form";

export const dynamic = "force-dynamic";
/** "Aprobar y enviar" desde acá manda el correo y el WhatsApp en la misma acción. */
export const maxDuration = 60;

const ESTADOS: Record<string, string> = {
  AVISADO: "Esperando tu aprobación",
  AVISO_FALLIDO: "Esperando tu aprobación (no se pudo avisar por Telegram)",
  SIN_PROPUESTA: "Sin propuesta modelo: respondé a mano",
  ENVIANDO: "Enviando…",
  FALLO: "El envío falló: revisá el presupuesto",
};

const fecha = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Configuración → Telegram (spec 2026-10-25): conectar el bot de @BotFather, vincular el chat,
 * elegir qué categorías esperan la aprobación por Telegram, el acuse por WhatsApp y lo que está
 * esperando aprobación. Permiso: `configurar`, antes de cualquier lectura. El token NUNCA se lee
 * hacia la pantalla: `estadoTelegram` sólo dice si hay uno.
 */
export default async function ConfiguracionTelegramPage() {
  const { user, workspace, role } = await requireActiveWorkspaceRole();
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Telegram" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden configurar Telegram.</p>
      </div>
    );
  }
  const ctx = { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
  const [estado, categorias, ajustes, acuse, pendientes] = await Promise.all([
    estadoTelegram(workspace.id),
    listarPropuestasModelo(ctx).then((c) => c ?? []),
    ajustesPorCategoria(workspace.id),
    leerAcuse(workspace.id),
    pendientesDeAprobar(workspace.id),
  ]);
  const sinTablas = ajustes === null;
  const sinDireccion = !appUrl();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Telegram"
        description="Cuando entra una consulta, FOTOFFICE arma el presupuesto solo y te lo manda a Telegram para que lo apruebes con un toque."
      />

      {sinTablas ? (
        <div role="status" className="fo-card p-4 text-sm text-[var(--fo-muted)]">
          Esta función todavía no está activada en la base de datos (falta aplicar su SQL). Podés leer los pasos; para guardar, avisale a quien administra FOTOFFICE.
        </div>
      ) : null}

      <section className="fo-card space-y-2 p-5 text-sm" aria-labelledby="tg-como-titulo">
        <h2 id="tg-como-titulo" className="text-base font-semibold">Cómo funciona</h2>
        <ol className="list-decimal space-y-1 pl-5 text-[var(--fo-muted)]">
          <li>Entra una consulta por el formulario de tu web o por el WhatsApp del estudio.</li>
          <li>Al cliente le llega enseguida un «recibimos tu consulta, en un rato te mandamos la propuesta».</li>
          <li>FOTOFFICE arma el presupuesto con la propuesta modelo de esa categoría (los precios de hoy y ¿Cuánto Cobro?).</li>
          <li>Te llega a Telegram un resumen: quién es, qué evento, qué incluye, el precio y cómo se calculó.</li>
          <li>Tocás <strong>Aprobar y enviar</strong> y al cliente le llega por correo (y por WhatsApp, si se puede) el enlace a su página, con fotos de tus trabajos y el botón para aceptar y pagar la seña. Si querés cambiar algo, tocás <strong>Corregir</strong>.</li>
        </ol>
      </section>

      <section className="fo-card space-y-3 p-5 text-sm" aria-labelledby="tg-paso1-titulo">
        <h2 id="tg-paso1-titulo" className="text-base font-semibold">Paso 1 · Crear tu bot en Telegram (una sola vez)</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>En Telegram, buscá <strong>@BotFather</strong> (tiene el tilde azul) y abrí el chat.</li>
          <li>Escribile <code>/newbot</code>.</li>
          <li>Te pide un nombre: poné, por ejemplo, <em>Presupuestos {workspace.name}</em>.</li>
          <li>Te pide un usuario que termine en <em>bot</em>, por ejemplo <em>dnxestudio_presupuestos_bot</em>.</li>
          <li>Te contesta con un mensaje que trae el <strong>token</strong>: una línea con números, dos puntos y letras. Copiala entera.</li>
        </ol>
        <p className="text-[var(--fo-muted)]">El token es como la llave del bot: no lo compartas con nadie. Acá se guarda cifrado.</p>
      </section>

      <section className="fo-card space-y-3 p-5 text-sm" aria-labelledby="tg-paso2-titulo">
        <h2 id="tg-paso2-titulo" className="text-base font-semibold">Paso 2 · Pegar el token</h2>
        {sinDireccion ? <p className="text-[var(--fo-danger)]">Falta configurar la dirección pública de FOTOFFICE (NEXT_PUBLIC_APP_URL).</p> : null}
        <ConectarForm conectado={estado.conectado} botUsername={estado.botUsername} />
      </section>

      <section className="fo-card space-y-3 p-5 text-sm" aria-labelledby="tg-paso3-titulo">
        <h2 id="tg-paso3-titulo" className="text-base font-semibold">Paso 3 · Vincular tu chat</h2>
        {!estado.conectado ? (
          <p className="text-[var(--fo-muted)]">Primero conectá el bot (paso 2).</p>
        ) : (
          <>
            <p className={estado.vinculado ? "text-[var(--fo-success)]" : "text-[var(--fo-muted)]"}>
              {estado.vinculado
                ? `Vinculado${estado.chatNombre ? ` con ${estado.chatNombre}` : ""}: los avisos te llegan a ese chat.`
                : "Todavía no hay un chat vinculado."}
            </p>
            <p className="text-[var(--fo-muted)]">
              Desde el celular donde querés recibir los avisos, tocá el botón: se abre tu bot en Telegram; ahí tocá <strong>Iniciar</strong>.
              El bot te contesta «¡Listo!». El enlace vale 30 minutos.
              {estado.codigo ? (
                <>
                  {" "}Si el botón no abre Telegram, buscá <strong>@{estado.botUsername}</strong> y mandale <code>/start {estado.codigo}</code>.
                </>
              ) : null}
            </p>
            <VincularForm enlace={estado.enlaceVinculo} vinculado={estado.vinculado} />
          </>
        )}
      </section>

      <section className="fo-card space-y-3 p-5 text-sm" aria-labelledby="tg-cat-titulo">
        <h2 id="tg-cat-titulo" className="text-base font-semibold">Paso 4 · Qué consultas te llegan para aprobar</h2>
        <p className="text-[var(--fo-muted)]">
          Encendelo en las categorías que quieras (vienen apagadas). En esas categorías la propuesta modelo ya no sale sola: siempre espera tu aprobación.
          El portfolio es lo que ve el cliente arriba del presupuesto.
        </p>
        {categorias.length === 0 ? (
          <p className="text-[var(--fo-muted)]">Todavía no hay categorías de consulta activas.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {categorias.map((c) => {
              const a = ajustes?.get(c.categoriaId);
              return (
                <li key={c.categoriaId} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-[var(--fo-text)]">{c.nombre}</p>
                    <p className="text-xs text-[var(--fo-muted)]">
                      {c.tienePropuesta ? "Con propuesta modelo" : "Sin propuesta modelo: el aviso te lo dice y te ofrece abrir la consulta"}
                      {" · "}
                      {a && a.portfolio.length > 0 ? `Portfolio: ${a.portfolio.length} elemento${a.portfolio.length === 1 ? "" : "s"}` : "Sin portfolio"}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-3 text-xs">
                      <Link href={`/workspace/configuracion/telegram/portfolio/${encodeURIComponent(c.categoriaId)}`} className="text-[var(--fo-accent)] hover:underline">
                        Elegir el portfolio
                      </Link>
                      <Link href={`/workspace/configuracion/presupuestos/propuestas/${encodeURIComponent(c.categoriaId)}`} className="text-[var(--fo-accent)] hover:underline">
                        {c.tienePropuesta ? "Ver la propuesta modelo" : "Armar la propuesta modelo"}
                      </Link>
                    </p>
                  </div>
                  <CategoriaForm categoriaId={c.categoriaId} nombre={c.nombre} encendido={a?.telegram ?? false} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="fo-card space-y-3 p-5 text-sm" aria-labelledby="tg-acuse-titulo">
        <h2 id="tg-acuse-titulo" className="text-base font-semibold">El primer mensaje al cliente</h2>
        <p className="text-[var(--fo-muted)]">
          Si la consulta llega por el formulario web, el acuse es la respuesta automática de consultas (un correo): se edita en{" "}
          <Link href="/workspace/configuracion/plantillas" className="text-[var(--fo-accent)] hover:underline">Configuración → Plantillas</Link>{" "}
          y tiene que estar encendida. Si llega por WhatsApp, el bot contesta con este texto:
        </p>
        <AcuseForm encendido={acuse.encendido} texto={acuse.configurado ?? ""} porOmision={ACUSE_POR_OMISION} />
      </section>

      <section className="fo-card space-y-3 p-5 text-sm" aria-labelledby="tg-pend-titulo">
        <h2 id="tg-pend-titulo" className="text-base font-semibold">Esperando aprobación</h2>
        {pendientes.length === 0 ? (
          <p className="text-[var(--fo-muted)]">No hay presupuestos esperando.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {pendientes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-[var(--fo-text)]">
                    {p.cliente}
                    {p.categoria ? ` · ${p.categoria}` : ""}
                  </p>
                  <p className="text-xs text-[var(--fo-muted)]">
                    {fecha.format(p.creada)} · {p.origen === "WHATSAPP" ? "WhatsApp" : "Web"} · {ESTADOS[p.status] ?? p.status}
                    {p.errorCode === "SIN_CANAL" ? " · no dejó correo y no se le puede escribir por WhatsApp" : ""}
                  </p>
                  {p.precios.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs tabular-nums text-[var(--fo-text)]">
                      {p.precios.map((linea) => (
                        <li key={linea}>{linea}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-1 flex flex-wrap gap-3 text-xs">
                    {p.presupuestoId ? (
                      <Link href={`/presupuestos/${encodeURIComponent(p.presupuestoId)}`} className="text-[var(--fo-accent)] hover:underline">Ver o corregir el presupuesto</Link>
                    ) : null}
                    <Link href={`/consultas/${encodeURIComponent(p.leadId)}`} className="text-[var(--fo-accent)] hover:underline">Abrir la consulta</Link>
                  </p>
                </div>
                {p.presupuestoId && (p.status === "AVISADO" || p.status === "AVISO_FALLIDO") ? <AprobarForm aprobacionId={p.id} cliente={p.cliente} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {estado.conectado ? (
        <section className="fo-card space-y-2 p-5 text-sm">
          <p className="text-[var(--fo-muted)]">Si ya no querés recibir avisos por Telegram, podés desconectarlo.</p>
          <DesconectarForm />
        </section>
      ) : null}
    </div>
  );
}
