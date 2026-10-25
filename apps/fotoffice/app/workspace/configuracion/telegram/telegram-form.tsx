"use client";

import { useActionState } from "react";
import {
  aprobarDesdePanelAction,
  cambiarCategoriaAction,
  conectarTelegramAction,
  desconectarTelegramAction,
  guardarAcuseAction,
  nuevoCodigoAction,
  probarTelegramAction,
  type EstadoTelegramConfig,
} from "./actions";

const INICIAL: EstadoTelegramConfig = { error: null };

export function Mensaje({ estado }: { estado: EstadoTelegramConfig }) {
  if (estado.error) return <p role="alert" className="text-sm text-[var(--fo-danger)]">{estado.error}</p>;
  if (estado.ok) return <p role="status" className="text-sm text-[var(--fo-success)]">{estado.ok}</p>;
  return null;
}

/** Paso 2: pegar el token. NUNCA muestra el token guardado: sólo si hay uno. */
export function ConectarForm({ conectado, botUsername }: { conectado: boolean; botUsername: string | null }) {
  const [estado, conectar, conectando] = useActionState(conectarTelegramAction, INICIAL);
  return (
    <form action={conectar} className="space-y-3">
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="tg-token">Token del bot</label>
        <input
          id="tg-token"
          name="token"
          type="password"
          autoComplete="new-password"
          required
          placeholder={conectado ? "Pegá un token nuevo sólo si querés cambiar de bot" : "123456789:AAH…"}
          className="fo-input"
        />
        <p className="text-xs text-[var(--fo-muted)]">
          {conectado && botUsername ? `Conectado con @${botUsername}. ` : ""}Por seguridad el token nunca se muestra.
        </p>
      </div>
      <Mensaje estado={estado} />
      <button type="submit" disabled={conectando} className="fo-btn fo-btn-primary">
        {conectando ? "Conectando…" : conectado ? "Cambiar de bot" : "Conectar el bot"}
      </button>
    </form>
  );
}

/** Paso 3: vincular el chat (abrir el enlace y tocar "Iniciar"). */
export function VincularForm({ enlace, vinculado }: { enlace: string | null; vinculado: boolean }) {
  const [estado, generar, generando] = useActionState(nuevoCodigoAction, INICIAL);
  const [estadoPrueba, probar, probando] = useActionState(probarTelegramAction, INICIAL);
  return (
    <div className="space-y-3">
      {enlace ? (
        <p>
          <a href={enlace} target="_blank" rel="noreferrer" className="fo-btn fo-btn-primary">
            Abrir Telegram y vincular
          </a>
        </p>
      ) : null}
      <form action={generar}>
        <button type="submit" disabled={generando} className="fo-btn fo-btn-secondary text-sm">
          {generando ? "Generando…" : enlace ? "Generar otro enlace" : vinculado ? "Vincular otro celular" : "Generar el enlace para vincular"}
        </button>
      </form>
      <Mensaje estado={estado} />
      {vinculado ? (
        <form action={probar} className="space-y-2">
          <button type="submit" disabled={probando} className="fo-btn fo-btn-secondary text-sm">
            {probando ? "Mandando…" : "Mandarme un mensaje de prueba"}
          </button>
          <Mensaje estado={estadoPrueba} />
        </form>
      ) : null}
    </div>
  );
}

export function DesconectarForm() {
  const [estado, desconectar, desconectando] = useActionState(desconectarTelegramAction, INICIAL);
  return (
    <form
      action={desconectar}
      onSubmit={(e) => {
        if (!window.confirm("¿Desconectar Telegram? Dejan de llegarte los avisos de presupuestos para aprobar.")) e.preventDefault();
      }}
      className="space-y-2"
    >
      <Mensaje estado={estado} />
      <button type="submit" disabled={desconectando} className="fo-btn fo-btn-secondary text-sm">
        {desconectando ? "Desconectando…" : "Desconectar Telegram"}
      </button>
    </form>
  );
}

/** El interruptor "Aprobar por Telegram" de una categoría. */
export function CategoriaForm({ categoriaId, nombre, encendido }: { categoriaId: string; nombre: string; encendido: boolean }) {
  const [estado, cambiar, cambiando] = useActionState(cambiarCategoriaAction, INICIAL);
  return (
    <form action={cambiar} className="space-y-1">
      <input type="hidden" name="categoriaId" value={categoriaId} />
      <input type="hidden" name="encendido" value={encendido ? "0" : "1"} />
      <button
        type="submit"
        disabled={cambiando}
        role="switch"
        aria-checked={encendido}
        aria-label={`Aprobar por Telegram las consultas de ${nombre}`}
        className={`fo-btn text-sm ${encendido ? "fo-btn-primary" : "fo-btn-secondary"}`}
      >
        {cambiando ? "Guardando…" : encendido ? "Encendido" : "Apagado"}
      </button>
      <Mensaje estado={estado} />
    </form>
  );
}

export function AcuseForm({ encendido, texto, porOmision }: { encendido: boolean; texto: string; porOmision: string }) {
  const [estado, guardar, guardando] = useActionState(guardarAcuseAction, INICIAL);
  return (
    <form action={guardar} className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="acuseEncendido" value="1" defaultChecked={encendido} />
        Cuando la consulta llega por WhatsApp, el bot le contesta enseguida con este texto
      </label>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="tg-acuse">Texto del acuse</label>
        <textarea id="tg-acuse" name="acuseTexto" rows={3} maxLength={500} defaultValue={texto} placeholder={porOmision} className="fo-input" />
        <p className="text-xs text-[var(--fo-muted)]">Si lo dejás vacío, se usa el de ejemplo.</p>
      </div>
      <Mensaje estado={estado} />
      <button type="submit" disabled={guardando} className="fo-btn fo-btn-primary">{guardando ? "Guardando…" : "Guardar el acuse"}</button>
    </form>
  );
}

export function AprobarForm({ aprobacionId, cliente }: { aprobacionId: string; cliente: string }) {
  const [estado, aprobar, aprobando] = useActionState(aprobarDesdePanelAction, INICIAL);
  return (
    <form
      action={aprobar}
      onSubmit={(e) => {
        if (!window.confirm(`¿Enviarle el presupuesto a ${cliente}?`)) e.preventDefault();
      }}
      className="space-y-1"
    >
      <input type="hidden" name="aprobacionId" value={aprobacionId} />
      <button type="submit" disabled={aprobando} className="fo-btn fo-btn-primary text-sm">{aprobando ? "Enviando…" : "Aprobar y enviar"}</button>
      <Mensaje estado={estado} />
    </form>
  );
}
