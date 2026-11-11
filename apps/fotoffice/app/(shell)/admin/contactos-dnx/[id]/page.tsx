import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { CAMPOS_DATO, esAutorUsuario } from "@/lib/agentes/buscador/contactos";
import { fichaContacto, type DnxContactoEvento } from "@/lib/agentes/buscador/consultas-panel";
import {
  ETIQUETA_AUTOR, etiquetaCampo, etiquetaEstado, etiquetaFuente, etiquetaNicho, etiquetaPlataforma, etiquetaRegion,
  etiquetaTipo, etiquetaVinculo,
} from "@/lib/agentes/buscador/etiquetas";
import { fechaHoraArgentina } from "@/lib/agentes/periodista/horario";
import { leerAjustesVendedor } from "@/lib/agentes/vendedor/ajustes";
import { MAX_RESPUESTAS_AUTOMATICAS } from "@/lib/agentes/vendedor/entrante";
import { estadoEntrega, hiloDeContacto, type DnxVendedorCorreo } from "@/lib/agentes/vendedor/estado";
import { ROTULO_GRUPO, type Grupo } from "@/lib/agentes/vendedor/tipos";
import { EditarDato, FusionarCon, NotaNueva, SelectorEstado } from "../acciones-contacto";
import { BotonContactoPrueba } from "../vendedor/acciones-vendedor";

export const dynamic = "force-dynamic";

type Datos = Record<string, unknown>;

const texto = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));

/** Una línea legible para cada evento de la línea de tiempo. */
function describir(e: DnxContactoEvento): string {
  const d = (e.datos && typeof e.datos === "object" ? e.datos : {}) as Datos;
  switch (e.tipo) {
    case "CREADO":
      return "Entró a la base.";
    case "DATO_NUEVO": {
      const campo = etiquetaCampo(texto(d.campo));
      if (d.fuente === "MANUAL") return d.valor ? `Corrigió ${campo}: ${texto(d.valor)}.` : `Borró ${campo} de la ficha.`;
      return `Dato nuevo, ${campo}: ${texto(d.valor)}${d.fuente ? ` (${etiquetaFuente(texto(d.fuente))})` : ""}.`;
    }
    case "ESTADO":
      return `Estado: ${etiquetaEstado(texto(d.de))} → ${etiquetaEstado(texto(d.a))}${d.forzado ? " (forzado: había pedido no ser contactado)" : ""}${d.porFusionCon ? " (por una fusión)" : ""}.`;
    case "NOTA":
      return `Nota: ${texto(d.texto)}`;
    case "FUSIONADO":
      return d.en ? "Se fusionó en otro contacto." : "Se le sumó otro contacto (fusión).";
    case "VINCULADO":
      return `Vinculado: ${etiquetaVinculo(texto(d.vinculo))}${d.por === "email" ? " (por el correo)" : d.por === "telefono" ? " (por el teléfono)" : ""}.`;
    case "BUSQUEDA_CORREO": {
      const via = d.via === "SITIO_PROPIO" ? " en su web" : d.via === "CLAUDE" ? " en internet" : "";
      if (d.resultado === "COMPLETADO") return `El Buscador le encontró el correo${via}: ${texto(d.email)}.`;
      if (d.resultado === "DUPLICADO") return `El Buscador encontró un correo${via} (${texto(d.email)}), pero ya es de otro contacto: no se asignó.`;
      if (d.resultado === "SIN_CORREO") return "El Buscador buscó su correo y no encontró ninguno publicado.";
      if (d.resultado === "YA_TENIA") return "El Buscador encontró un correo, pero la ficha ya tenía uno: no se tocó.";
      if (d.resultado === "REINTENTAR") return "El Buscador no pudo terminar de buscar su correo; lo vuelve a intentar.";
      return "El Buscador intentó buscar su correo.";
    }
    default:
      return e.tipo;
  }
}

// --- Conversación del Vendedor ---------------------------------------------------------------

const ESTADO_HILO: Record<string, string> = {
  PENDIENTE_ENVIO: "Por enviar",
  ENVIADO: "Enviado, esperando respuesta",
  RECORDADO: "Recordatorio enviado, esperando respuesta",
  RESPONDIO: "Respondió",
  ESPERA_DANIEL: "Esperando tu respuesta",
  CERRADO: "Cerrado",
  BAJA: "Se dio de baja",
};
const CIERRE_HILO: Record<string, string> = {
  REBOTE: "el correo rebotó",
  QUEJA: "lo marcó como correo no deseado",
  NO_INTERESA: "no le interesa",
  BAJA: "pidió la baja",
  BAJA_CLF: "se dio de baja en CompraMeLaFoto",
  YA_ERA_USUARIO: "ya era usuario de CompraMeLaFoto",
  FALLO: "no se pudo enviar",
  MANUAL: "lo cerraste vos",
};
const PASO_CORREO: Record<string, string> = {
  PRIMERO: "Primer correo",
  RECORDATORIO: "Recordatorio",
  RESPUESTA: "Respuesta",
  REENVIO: "Reenviado a tu casilla",
};
const CLASE_CORREO: Record<string, string> = {
  INTERESADO: "Interesado",
  CAPACITACION: "Pide capacitación",
  NO_INTERESA: "No le interesa",
  BAJA: "Pide la baja",
  DELICADA: "Delicada",
  AUTOMATICA: "Respuesta automática",
  REBOTE: "Rebote",
};
const VIA_REGISTRO: Record<string, string> = { COOKIE: "por el enlace del correo", EMAIL: "con el mismo correo" };

function detalleCorreo(c: DnxVendedorCorreo): string {
  if (c.direccion === "SALIDA") return `Enviado · ${c.paso ? (PASO_CORREO[c.paso] ?? c.paso) : "Correo"}`;
  return `Recibido · ${c.clase ? (CLASE_CORREO[c.clase] ?? c.clase) : "Sin clasificar todavía"}`;
}

/** Las fechas de entrega que avisó Resend, en hora argentina. */
function fechasEntrega(c: DnxVendedorCorreo): string {
  return [
    c.entregadoEn ? `entregado ${fechaHoraArgentina(c.entregadoEn)}` : null,
    c.abiertoEn ? `abierto ${fechaHoraArgentina(c.abiertoEn)}` : null,
    c.clicEn ? `enlace ${fechaHoraArgentina(c.clicEn)}` : null,
    c.reboteEn ? `rebotó ${fechaHoraArgentina(c.reboteEn)}` : null,
    c.quejaEn ? `no deseado ${fechaHoraArgentina(c.quejaEn)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Ficha de un contacto de Contactos DNX. El acceso lo controla el layout de /admin (sólo SUPER_ADMIN). */
export default async function FichaContactoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ficha = await fichaContacto(id);
  if (!ficha) notFound();
  const { contacto: c, datos, eventos } = ficha;
  const [conversacion, ajustesVendedor] = await Promise.all([hiloDeContacto(c.id), leerAjustesVendedor()]);

  // Las personas firman con su userId: se muestran con su nombre.
  const ids = [...new Set(eventos.map((e) => e.autor).filter(esAutorUsuario).map(Number))];
  const usuarios = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } })
    : [];
  const autor = (a: string) => {
    if (esAutorUsuario(a)) {
      const u = usuarios.find((x) => x.id === Number(a));
      return u?.name ?? u?.email ?? `usuario ${a}`;
    }
    return ETIQUETA_AUTOR[a] ?? a;
  };

  const lugar = [c.ciudad, c.provincia].filter(Boolean).join(", ");
  const resumen = [etiquetaTipo(c.tipo), lugar, etiquetaRegion(c.region)].filter(Boolean).join(" · ");

  return (
    <div className="space-y-8">
      <p className="text-sm">
        <Link href="/admin/contactos-dnx" className="text-[var(--fo-accent)] underline">
          ← Volver a Contactos DNX
        </Link>
      </p>
      <PageHeader title={c.nombre} description={resumen} />

      {c.fusionadoEnId ? (
        <div className="fo-alert-warning" role="status">
          Este contacto se fusionó en otro y ya no aparece en la lista.{" "}
          <Link href={`/admin/contactos-dnx/${c.fusionadoEnId}`} className="underline">
            Ir al que quedó
          </Link>
        </div>
      ) : null}

      <section className="fo-card space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Resumen</h2>
        <ul className="text-sm text-[var(--fo-muted)] leading-relaxed space-y-1">
          <li>
            Estado: <span className="text-[var(--fo-text)] font-medium">{etiquetaEstado(c.estado)}</span>
          </li>
          <li>
            Nichos: <span className="text-[var(--fo-text)]">{c.nichos.map(etiquetaNicho).join(", ") || "—"}</span>
          </li>
          <li>
            Le sirve: <span className="text-[var(--fo-text)]">{c.plataformas.map(etiquetaPlataforma).join(", ") || "—"}</span>
          </li>
          <li>
            Vínculo: <span className="text-[var(--fo-text)]">{etiquetaVinculo(c.vinculo)}</span>
          </li>
          {c.compradorClf ? (
            <li>
              <span className="text-[var(--fo-text)] font-medium">Compró en CLF</span>
            </li>
          ) : null}
          <li>Alta: {fechaHoraArgentina(c.creadoEn)} ({ETIQUETA_AUTOR[c.creadoPor] ?? c.creadoPor})</li>
        </ul>
        {!c.fusionadoEnId ? <SelectorEstado key={c.estado} id={c.id} estado={c.estado} /> : null}
      </section>

      <section className="fo-card space-y-5">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Datos</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Cada dato muestra de dónde salió. Si corregís uno, queda como «cargado a mano»; si lo dejás vacío, se borra de la ficha
          pero el historial queda.
        </p>
        {CAMPOS_DATO.map((campo) => {
          const vistos = datos.filter((d) => d.campo === campo);
          return (
            <div key={campo} className="space-y-2">
              <p className="fo-label">{etiquetaCampo(campo)}</p>
              {c.fusionadoEnId ? (
                <p className="text-sm text-[var(--fo-text)]">{c[campo] ?? "—"}</p>
              ) : (
                <EditarDato key={c[campo] ?? ""} id={c.id} campo={campo} valor={c[campo]} />
              )}
              {vistos.length > 0 ? (
                <ul className="text-xs text-[var(--fo-muted)] space-y-0.5 pl-1">
                  {vistos.map((d) => (
                    <li key={d.id}>
                      {d.valor} · {etiquetaFuente(d.fuente)} · visto el {fechaHoraArgentina(d.vistoEn)}
                      {d.fuenteUrl ? (
                        <>
                          {" · "}
                          <a href={d.fuenteUrl} target="_blank" rel="noreferrer" className="text-[var(--fo-accent)] underline">
                            ver fuente
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </section>

      {!c.fusionadoEnId ? (
        <>
          <section className="fo-card space-y-3">
            <h2 className="text-base font-semibold text-[var(--fo-text)]">Nota nueva</h2>
            <NotaNueva id={c.id} />
          </section>

          <section className="fo-card space-y-3">
            <h2 className="text-base font-semibold text-[var(--fo-text)]">Fusionar con…</h2>
            <p className="text-sm text-[var(--fo-muted)]">
              Si este contacto está repetido, buscá el otro y fusionalo acá: sus datos, notas e historia pasan a esta ficha y el otro
              deja de aparecer en la lista. Si alguno había pedido no ser contactado, el resultado queda «No contactar».
            </p>
            <FusionarCon id={c.id} />
          </section>
        </>
      ) : null}

      <section className="fo-card space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Conversación del Vendedor</h2>
        {conversacion ? (
          <>
            <ul className="text-sm text-[var(--fo-muted)] leading-relaxed space-y-1">
              <li>
                Estado:{" "}
                <span className="text-[var(--fo-text)] font-medium">{ESTADO_HILO[conversacion.hilo.estado] ?? conversacion.hilo.estado}</span>
                {conversacion.hilo.cierre ? ` (${CIERRE_HILO[conversacion.hilo.cierre] ?? conversacion.hilo.cierre})` : ""}
                {conversacion.hilo.modoManual ? " · lo seguís vos a mano" : ""}
              </li>
              <li>Grupo: {ROTULO_GRUPO[conversacion.hilo.grupo as Grupo] ?? conversacion.hilo.grupo}</li>
              <li>
                {conversacion.hilo.registradoEn ? (
                  <span className="text-[var(--fo-text)] font-medium">
                    Se registró en CompraMeLaFoto el {fechaHoraArgentina(conversacion.hilo.registradoEn)}
                    {conversacion.hilo.viaRegistro ? ` (${VIA_REGISTRO[conversacion.hilo.viaRegistro] ?? conversacion.hilo.viaRegistro})` : ""}
                    {conversacion.hilo.rolClf ? `, como ${conversacion.hilo.rolClf}` : ""}.
                  </span>
                ) : (
                  "Todavía no se registró en CompraMeLaFoto."
                )}
              </li>
              <li>Respuestas automáticas del Vendedor: {conversacion.hilo.respuestasAutomaticas} de {MAX_RESPUESTAS_AUTOMATICAS}.</li>
            </ul>
            {conversacion.correos.length === 0 ? (
              <p className="text-sm text-[var(--fo-muted)]">Todavía no salió ningún correo.</p>
            ) : (
              <ul className="divide-y divide-[var(--fo-border)]">
                {conversacion.correos.map((m) => {
                  const entrega = estadoEntrega(m);
                  const fechas = fechasEntrega(m);
                  return (
                    <li key={m.id} className="py-3 text-sm space-y-1">
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--fo-muted)]">
                        <span className="font-medium text-[var(--fo-text)]">{detalleCorreo(m)}</span>
                        <span>{fechaHoraArgentina(m.creadoEn)}</span>
                        {entrega ? (
                          <span className={m.reboteEn || m.quejaEn ? "text-[var(--fo-danger)] font-medium" : "font-medium"}>{entrega}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-[var(--fo-muted)]">
                        De {m.de} · para {m.para}
                        {fechas ? ` · ${fechas}` : ""}
                      </p>
                      <p className="font-medium text-[var(--fo-text)]">{m.asunto}</p>
                      <details>
                        <summary className="cursor-pointer text-xs text-[var(--fo-accent)]">Ver el texto</summary>
                        <p className="mt-1 whitespace-pre-line text-[var(--fo-text)]">{m.texto}</p>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">El Vendedor todavía no le escribió.</p>
        )}
        {!c.fusionadoEnId ? <BotonContactoPrueba id={c.id} activo={ajustesVendedor.soloContactoPrueba === c.id} /> : null}
      </section>

      <section className="fo-card space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Línea de tiempo</h2>
        {eventos.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Sin movimientos.</p>
        ) : (
          <ul className="divide-y divide-[var(--fo-border)]">
            {eventos.map((e) => (
              <li key={e.id} className="py-2 text-sm space-y-0.5">
                <p className="text-[var(--fo-text)] whitespace-pre-line">{describir(e)}</p>
                <p className="text-xs text-[var(--fo-muted)]">
                  {fechaHoraArgentina(e.creadoEn)} · {autor(e.autor)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
