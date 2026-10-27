import type { MensajeDeChat } from "@/lib/bandeja/lecturas";
import { fechaYHora, pesoLegible, soloHora } from "./formato";

/** Qué se muestra del estado de envío de un mensaje saliente. */
export function textoDeEstado(estado: string, errorCodigo: string | null): { marca: string; texto: string; clase: string } | null {
  switch (estado) {
    case "SIMULADO":
      return { marca: "", texto: "simulado", clase: "text-[var(--fo-muted)]" };
    case "PENDIENTE":
      return { marca: "", texto: "enviando", clase: "text-[var(--fo-muted)]" };
    case "INCIERTO":
      return { marca: "", texto: "sin confirmar", clase: "text-[var(--fo-warning)]" };
    case "ENVIADO":
      return { marca: "✓", texto: "enviado", clase: "text-[var(--fo-muted)]" };
    case "ENTREGADO":
      return { marca: "✓✓", texto: "entregado", clase: "text-[var(--fo-muted)]" };
    case "LEIDO":
      return { marca: "✓✓", texto: "leído", clase: "text-[var(--fo-accent)]" };
    case "FALLO":
      return { marca: "", texto: `no salió${errorCodigo ? ` (${errorCodigo})` : ""}`, clase: "text-[var(--fo-danger)]" };
    default:
      return null;
  }
}

const TIPO_SIN_TEXTO: Record<string, string> = {
  IMAGEN: "Imagen",
  AUDIO: "Audio",
  DOCUMENTO: "Documento",
  VIDEO: "Video",
  UBICACION: "Ubicación",
  PLANTILLA: "Plantilla",
  OTRO: "Mensaje de un tipo que la bandeja no muestra",
};

function cuerpo(m: MensajeDeChat): string {
  const t = m.texto?.trim();
  return t ? t : (TIPO_SIN_TEXTO[m.tipo] ?? "Mensaje");
}

/** Foto en miniatura, video o enlace al archivo que mandó el cliente (bajado al R2 privado). */
function Archivo({ id, archivo: a, tipo }: { id: string; archivo: NonNullable<MensajeDeChat["archivo"]>; tipo: string }) {
  if (a.estado === "PENDIENTE") return <p className="text-xs italic text-[var(--fo-muted)]">Bajando el archivo…</p>;
  if (a.estado === "FALLO") return <p className="text-xs text-[var(--fo-warning)]">No se pudo bajar el archivo de WhatsApp.</p>;
  if (a.estado === "GRANDE")
    return <p className="text-xs text-[var(--fo-warning)]">Archivo de más de 100 MB: pedile al cliente que lo mande por otro medio.</p>;
  const ver = `/api/bandeja/archivos/${id}?modo=ver`;
  const esFoto = tipo === "IMAGEN" || (a.mime?.startsWith("image/") ?? false);
  const datos = [a.ancho && a.alto ? `${a.ancho}×${a.alto}` : null, a.bytes ? pesoLegible(a.bytes) : null].filter(Boolean).join(" · ");
  return (
    <div className="mb-1 space-y-1">
      {esFoto ? (
        <a href={ver} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada que cambia: sin optimizador */}
          <img src={ver} alt={a.nombre} loading="lazy" className="max-h-64 max-w-full rounded-[var(--fo-radius)] object-contain" />
        </a>
      ) : tipo === "VIDEO" ? (
        <video src={ver} controls preload="none" className="max-h-64 max-w-full rounded-[var(--fo-radius)]" />
      ) : tipo === "AUDIO" ? (
        <audio src={ver} controls preload="none" className="max-w-full" />
      ) : (
        <p className="break-all text-sm text-[var(--fo-text)]">📎 {a.nombre}</p>
      )}
      <p className="flex flex-wrap gap-x-2 text-[11px] text-[var(--fo-muted)]">
        {datos ? <span>{datos}</span> : null}
        <a href={`/api/bandeja/archivos/${id}?modo=descargar`} className="text-[var(--fo-accent)] underline">
          Descargar
        </a>
      </p>
    </div>
  );
}

/** Una burbuja: cliente a la izquierda; bot, persona o celular a la derecha; sistema, centrado y chico. */
export function BurbujaDeMensaje({ mensaje: m }: { mensaje: MensajeDeChat }) {
  if (m.autor === "SISTEMA" || m.direccion === "SISTEMA") {
    return (
      <li className="flex justify-center">
        <p className="max-w-full break-words rounded-full bg-[var(--fo-surface-muted)] px-3 py-1 text-center text-xs text-[var(--fo-text-secondary)]">
          {cuerpo(m)} · <time dateTime={m.createdAt.toISOString()}>{fechaYHora(m.createdAt)}</time>
        </p>
      </li>
    );
  }
  const propio = m.autor !== "CLIENTE";
  const autor =
    m.autor === "CLIENTE" ? "Cliente" : m.autor === "BOT" ? "Bot" : m.autor === "CELULAR" ? "Desde el celular" : (m.autorLabel ?? "Equipo");
  const estado = propio ? textoDeEstado(m.estadoEnvio, m.errorCodigo) : null;
  return (
    <li className={`flex ${propio ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] min-w-0 rounded-[var(--fo-radius)] border px-3 py-2 ${
          propio ? "border-[var(--fo-accent-muted)] bg-[var(--fo-accent-soft)]" : "border-[var(--fo-border)] bg-[var(--fo-surface)]"
        }`}
      >
        <p className="text-xs font-semibold text-[var(--fo-text-secondary)]">{autor}</p>
        {m.archivo ? <Archivo id={m.id} archivo={m.archivo} tipo={m.tipo} /> : null}
        {m.archivo && !m.texto?.trim() ? null : <p className="whitespace-pre-wrap break-words text-sm text-[var(--fo-text)]">{cuerpo(m)}</p>}
        <p className="mt-1 flex flex-wrap items-center justify-end gap-x-2 text-[11px] text-[var(--fo-muted)]">
          <time dateTime={m.createdAt.toISOString()}>{soloHora(m.createdAt)}</time>
          {estado ? (
            <span className={estado.clase}>
              {estado.marca ? <span aria-hidden>{estado.marca} </span> : null}
              {estado.texto}
            </span>
          ) : null}
        </p>
      </div>
    </li>
  );
}
