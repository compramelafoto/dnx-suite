"use client";

import { useActionState } from "react";
import { InputMoneda } from "@/components/campos/input-moneda";
import type { AjustesPorHoras } from "@/lib/presupuesto-automatico/por-horas-puro";
import {
  aprobarDesdePanelAction,
  cambiarCategoriaAction,
  conectarTelegramAction,
  desconectarTelegramAction,
  guardarAcuseAction,
  guardarPorHorasAction,
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

/** Presupuesto por horas: reglas del estudio para los eventos y sesiones sin propuesta modelo. */
export function PorHorasForm({ ajustes: a, categorias }: { ajustes: AjustesPorHoras; categorias: { categoriaId: string; nombre: string }[] }) {
  const [estado, guardar, guardando] = useActionState(guardarPorHorasAction, INICIAL);
  const numero = (name: string, etiqueta: string, valor: number, ayuda?: string, paso = 1) => (
    <div className="fo-field-stack">
      <label className="fo-label" htmlFor={`ph-${name}`}>{etiqueta}</label>
      <input id={`ph-${name}`} name={name} type="number" inputMode="decimal" min={0} step={paso} defaultValue={valor} className="fo-input" />
      {ayuda ? <p className="text-xs text-[var(--fo-muted)]">{ayuda}</p> : null}
    </div>
  );
  return (
    <form action={guardar} className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="porHorasEncendido" value="1" defaultChecked={a.encendido} />
        Armar solo el presupuesto de los eventos y sesiones que no tienen propuesta modelo
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {numero("edicionPorHora", "Horas de edición por cada hora de cobertura", a.edicionPorHora, undefined, 0.5)}
        {numero("disparosPorHora", "Fotos por hora (sólo para el cálculo, no se promete)", a.disparosPorHora)}
        {numero("minimoFotosEvento", "Mínimo de fotos que se promete en eventos", a.minimoFotosEvento)}
        {numero("minimoFotosSesion", "Mínimo de fotos que se promete en sesiones", a.minimoFotosSesion)}
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="ph-pesosPorKm">Traslado: pesos por km de distancia (ida y vuelta)</label>
          <InputMoneda id="ph-pesosPorKm" name="pesosPorKm" defaultValue={a.pesosPorKm} decimales={false} />
          <p className="text-xs text-[var(--fo-muted)]">Se suma al precio sin margen y no se ve aparte. Ej.: a 10 km, 10 × este valor.</p>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="ph-partida">Dirección de partida del traslado</label>
          <input id="ph-partida" name="partida" maxLength={300} defaultValue={a.partida.direccion} className="fo-input" />
          <p className="text-xs text-[var(--fo-muted)]">
            {a.partida.lat !== null ? "Ubicada en el mapa ✓" : "Todavía no está ubicada en el mapa: guardá para ubicarla (calle, número y localidad)."}
          </p>
        </div>
        {numero("segundoFotografoPct", "Segundo fotógrafo: % de tu hora por cada hora de cobertura", a.segundoFotografoPct)}
        {numero("invitadosSegundoFotografo", "Recomendar segundo fotógrafo con más de … invitados", a.invitadosSegundoFotografo, "En bodas va siempre.")}
      </div>
      {categorias.length > 0 ? (
        <fieldset className="space-y-1">
          <legend className="fo-label">Categorías que son sesiones de fotos (las demás son eventos)</legend>
          {categorias.map((c) => (
            <label key={c.categoriaId} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="categoriasSesion" value={c.categoriaId} defaultChecked={a.categoriasSesion.includes(c.categoriaId)} />
              {c.nombre}
            </label>
          ))}
          <p className="text-xs text-[var(--fo-muted)]">Si no marcás ninguna, se toman como sesión las que se llaman “Sesión…”.</p>
        </fieldset>
      ) : null}
      {categorias.length > 0 ? (
        <fieldset className="space-y-1">
          <legend className="fo-label">Categorías que NO se arman solas (te las pasa el bot a vos)</legend>
          {categorias.map((c) => (
            <label key={c.categoriaId} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="categoriasExcluidas" value={c.categoriaId} defaultChecked={a.categoriasExcluidas.includes(c.categoriaId)} />
              {c.nombre}
            </label>
          ))}
          <p className="text-xs text-[var(--fo-muted)]">Para lo que no es una cobertura de fotos: alquileres, glitter, video clip, publicidad…</p>
        </fieldset>
      ) : null}
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="ph-incluye">Qué va incluido siempre</label>
        <input id="ph-incluye" name="incluye" maxLength={500} defaultValue={a.incluye} className="fo-input" />
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="ph-opcionales">Texto de los opcionales</label>
        <input id="ph-opcionales" name="opcionalesTexto" maxLength={500} defaultValue={a.opcionalesTexto} className="fo-input" />
      </div>
      <Mensaje estado={estado} />
      <button type="submit" disabled={guardando} className="fo-btn fo-btn-primary">{guardando ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}
