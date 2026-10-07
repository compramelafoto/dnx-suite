"use client";

import { useId, useState } from "react";
import { COMMERCIAL_POSITIONING_OPTIONS } from "@repo/cuanto-cobro-core";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { pesos } from "@/lib/presupuestos/editor";
import {
  calcularItemDelPanel,
  PERFIL_VACIO,
  TIPOS_TRABAJO,
  trabajoDesdeMotor,
  trabajoVacio,
  type DatosItemCalculado,
  type PerfilPanel,
  type TrabajoPanel,
} from "@/lib/presupuestos/panel-cuanto-cobro";

/**
 * Panel de ¿Cuánto Cobro? de un ítem (spec §3.2). SÓLO se dibuja para quien tiene `configurar`
 * (R4): pide el perfil del fotógrafo (gastos, horas) y el trabajo, corre el motor en el navegador y
 * muestra el precio sugerido con su costo y su margen. "Usar este precio" pega el ítem en el
 * presupuesto; al guardar, el servidor repite la cuenta con la misma entrada (R2).
 */

export function CampoTexto({
  etiqueta,
  valor,
  onCambio,
  ayuda,
  tipo = "number",
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  ayuda?: string;
  tipo?: "number" | "text";
}) {
  const id = useId();
  return (
    <div className="fo-field-stack">
      <label htmlFor={id} className="fo-label">
        {etiqueta}
      </label>
      <input
        id={id}
        className="fo-input"
        type={tipo}
        inputMode={tipo === "number" ? "decimal" : undefined}
        min={tipo === "number" ? 0 : undefined}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
      />
      {ayuda ? <p className="text-xs text-[var(--fo-muted)]">{ayuda}</p> : null}
    </div>
  );
}

/** El perfil del fotógrafo en corto. Lo comparten el panel y el asistente. */
export function CamposPerfil({ perfil, onCambio }: { perfil: PerfilPanel; onCambio: (p: PerfilPanel) => void }) {
  const set = (k: keyof PerfilPanel) => (v: string) => onCambio({ ...perfil, [k]: v });
  const idPos = useId();
  const idVive = useId();
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto etiqueta="Gastos personales del mes ($)" valor={perfil.gastosPersonales} onCambio={set("gastosPersonales")} ayuda="Vivienda, comida, servicios, todo lo de tu casa." />
        <div className="fo-field-stack">
          <label htmlFor={idVive} className="fo-label">
            ¿Vivís sólo de la fotografía?
          </label>
          <select
            id={idVive}
            className="fo-input"
            value={perfil.viveSoloDeLaFoto ? "si" : "no"}
            onChange={(e) => onCambio({ ...perfil, viveSoloDeLaFoto: e.target.value === "si" })}
          >
            <option value="si">Sí</option>
            <option value="no">No, tengo otros ingresos</option>
          </select>
        </div>
        {!perfil.viveSoloDeLaFoto ? <CampoTexto etiqueta="Otros ingresos del mes ($)" valor={perfil.ingresosExternos} onCambio={set("ingresosExternos")} /> : null}
        <CampoTexto etiqueta="Alquiler o estudio ($/mes)" valor={perfil.alquiler} onCambio={set("alquiler")} />
        <CampoTexto etiqueta="Software y herramientas ($/mes)" valor={perfil.software} onCambio={set("software")} />
        <CampoTexto etiqueta="Publicidad ($/mes)" valor={perfil.marketing} onCambio={set("marketing")} />
        <CampoTexto etiqueta="Colaboradores fijos" valor={perfil.colaboradores} onCambio={set("colaboradores")} />
        {perfil.colaboradores.trim() !== "" && perfil.colaboradores.trim() !== "0" ? (
          <CampoTexto etiqueta="Costo del equipo ($/mes)" valor={perfil.costoColaboradores} onCambio={set("costoColaboradores")} />
        ) : null}
        <CampoTexto etiqueta="Horas de trabajo por semana" valor={perfil.horasSemanales} onCambio={set("horasSemanales")} />
        <CampoTexto etiqueta="De esas, horas de cobertura" valor={perfil.horasCobertura} onCambio={set("horasCobertura")} ayuda="Las que se cobran; el resto es edición y gestión." />
        <CampoTexto etiqueta="Renovación de equipo ($/mes)" valor={perfil.renovacionEquipo} onCambio={set("renovacionEquipo")} />
        <CampoTexto etiqueta="Fondo de emergencia ($/mes)" valor={perfil.fondoEmergencia} onCambio={set("fondoEmergencia")} />
        <CampoTexto etiqueta="Ahorro y vacaciones ($/mes)" valor={perfil.ahorro} onCambio={set("ahorro")} />
      </div>
      <div className="fo-field-stack">
        <label htmlFor={idPos} className="fo-label">
          Momento del negocio
        </label>
        <select id={idPos} className="fo-input" value={perfil.posicionamiento} onChange={(e) => onCambio({ ...perfil, posicionamiento: e.target.value as PerfilPanel["posicionamiento"] })}>
          {COMMERCIAL_POSITIONING_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Los datos de un concepto del trabajo, según su tipo. */
export function CamposTrabajo({ trabajo, onCambio, conNombre = true }: { trabajo: TrabajoPanel; onCambio: (t: TrabajoPanel) => void; conNombre?: boolean }) {
  const set = (k: keyof TrabajoPanel) => (v: string) => onCambio({ ...trabajo, [k]: v });
  const idTipo = useId();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {conNombre ? <CampoTexto etiqueta="Concepto" tipo="text" valor={trabajo.nombre} onCambio={set("nombre")} /> : null}
      <div className="fo-field-stack">
        <label htmlFor={idTipo} className="fo-label">
          Tipo
        </label>
        <select id={idTipo} className="fo-input" value={trabajo.tipo} onChange={(e) => onCambio({ ...trabajo, tipo: e.target.value as TrabajoPanel["tipo"] })}>
          {TIPOS_TRABAJO.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </div>
      <CampoTexto etiqueta="Cantidad que cubre" valor={trabajo.cantidad} onCambio={set("cantidad")} ayuda="El renglón queda con el precio del trabajo entero." />
      {trabajo.tipo === "own-service" ? (
        <>
          <CampoTexto etiqueta="Horas de cobertura" valor={trabajo.horasCobertura} onCambio={set("horasCobertura")} />
          <CampoTexto etiqueta="Horas de edición" valor={trabajo.horasEdicion} onCambio={set("horasEdicion")} />
          <CampoTexto etiqueta="Horas de entrega" valor={trabajo.horasEntrega} onCambio={set("horasEntrega")} />
          <CampoTexto etiqueta="Horas de viaje" valor={trabajo.horasViaje} onCambio={set("horasViaje")} />
          <CampoTexto etiqueta="Costos directos ($)" valor={trabajo.costoDirecto} onCambio={set("costoDirecto")} ayuda="Asistente, traslado, insumos." />
        </>
      ) : null}
      {trabajo.tipo === "physical-product" ? (
        <>
          <CampoTexto etiqueta="Costo del proveedor ($)" valor={trabajo.costoProveedor} onCambio={set("costoProveedor")} />
          <CampoTexto etiqueta="Horas de diseño" valor={trabajo.horasDiseno} onCambio={set("horasDiseno")} />
          <CampoTexto etiqueta="Envío ($)" valor={trabajo.costoEnvio} onCambio={set("costoEnvio")} />
          <CampoTexto etiqueta="Ganancia deseada (%)" valor={trabajo.margenDeseado} onCambio={set("margenDeseado")} />
        </>
      ) : null}
      {trabajo.tipo === "outsourced" ? (
        <>
          <CampoTexto etiqueta="Costo tercerizado ($)" valor={trabajo.costoTercerizado} onCambio={set("costoTercerizado")} />
          <CampoTexto etiqueta="Horas de gestión" valor={trabajo.horasGestion} onCambio={set("horasGestion")} />
          <CampoTexto etiqueta="Margen (%)" valor={trabajo.margenDeseado} onCambio={set("margenDeseado")} />
        </>
      ) : null}
      {trabajo.tipo === "expense" ? (
        <>
          <CampoTexto etiqueta="Costo del gasto ($)" valor={trabajo.costoGasto} onCambio={set("costoGasto")} />
          <CampoTexto etiqueta="Recargo (%)" valor={trabajo.margenDeseado} onCambio={set("margenDeseado")} />
        </>
      ) : null}
      <CampoTexto etiqueta="Horas con el cliente" valor={trabajo.horasCliente} onCambio={set("horasCliente")} ayuda="Reuniones, ventas, coordinación." />
      <CampoTexto etiqueta="Precio a mano en el motor ($)" valor={trabajo.precioManual} onCambio={set("precioManual")} ayuda="Vacío: el recomendado." />
    </div>
  );
}

/** El trabajo guardado en un ítem calculado, para reabrir el panel. */
export function trabajoDelItem(item: ItemPresupuesto | null): { trabajo: TrabajoPanel; tipoDeTrabajo: string } {
  const guardado = item?.calculo ? trabajoDesdeMotor((item.calculo.entrada as { presupuesto?: unknown } | null)?.presupuesto) : null;
  return guardado ?? { trabajo: trabajoVacio(item?.nombre ?? ""), tipoDeTrabajo: "" };
}

export function PanelCuantoCobro({
  item,
  perfilInicial,
  onUsar,
  onCerrar,
}: {
  /** El ítem que se calcula (su clave, nombre, sección…); con cálculo previo, se reabre con esos datos. */
  item: ItemPresupuesto;
  perfilInicial: PerfilPanel | null;
  onUsar: (item: ItemPresupuesto, perfil: PerfilPanel) => void;
  onCerrar: () => void;
}) {
  const inicial = trabajoDelItem(item);
  const [perfil, setPerfil] = useState<PerfilPanel>(perfilInicial ?? PERFIL_VACIO);
  const [verPerfil, setVerPerfil] = useState(perfilInicial === null);
  const [trabajo, setTrabajo] = useState<TrabajoPanel>(inicial.trabajo);
  const [tipoDeTrabajo, setTipoDeTrabajo] = useState(inicial.tipoDeTrabajo);

  const datos: DatosItemCalculado = {
    id: item.id,
    nombre: item.nombre || trabajo.nombre,
    seccion: item.seccion,
    opcional: item.opcional,
    descuento: item.descuento,
    productId: item.productId,
  };
  // El motor es puro y rápido: corre en cada cambio, sin ir al servidor.
  const resultado = calcularItemDelPanel(perfil, trabajo, tipoDeTrabajo, datos);
  const c = resultado.ok ? resultado.item.calculo : null;

  return (
    <section aria-label="Calcular con ¿Cuánto Cobro?" className="space-y-4 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--fo-text)]">Calcular con ¿Cuánto Cobro?</h3>
          <p className="text-xs text-[var(--fo-muted)]">El cálculo queda guardado junto al ítem. Sólo lo ven el dueño y los administradores.</p>
        </div>
        <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={onCerrar}>
          Cerrar
        </button>
      </div>

      <div className="space-y-2">
        <button type="button" className="text-sm font-medium text-[var(--fo-accent)] hover:underline" onClick={() => setVerPerfil((v) => !v)} aria-expanded={verPerfil}>
          {verPerfil ? "Ocultar tu perfil" : "Tu perfil (gastos y horas)"}
        </button>
        {verPerfil ? <CamposPerfil perfil={perfil} onCambio={setPerfil} /> : null}
      </div>

      <CampoTexto etiqueta="Tipo de trabajo" tipo="text" valor={tipoDeTrabajo} onCambio={setTipoDeTrabajo} ayuda="Por ejemplo: Boda, 15 años, Corporativo." />
      <CamposTrabajo trabajo={trabajo} onCambio={setTrabajo} />

      {resultado.ok && c ? (
        <div className="space-y-2 rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-hover)] p-3 text-sm">
          <p className="text-base font-semibold text-[var(--fo-text)]">Precio sugerido: {pesos(c.precioSugerido)}</p>
          <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            <div className="flex justify-between gap-2"><dt className="text-[var(--fo-muted)]">Mínimo sostenible</dt><dd>{pesos(c.precioMinimo)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--fo-muted)]">Recomendado</dt><dd>{pesos(c.precioRecomendado)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--fo-muted)]">Costo del trabajo</dt><dd>{pesos(c.costoBase)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--fo-muted)]">Margen</dt><dd>{pesos(c.margenElegido)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--fo-muted)]">Valor hora</dt><dd>{pesos(c.valorHora)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-[var(--fo-muted)]">Horas totales</dt><dd>{Math.round(c.horasTotales * 10) / 10} h</dd></div>
          </dl>
          {c.advertencias.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--fo-muted)]">
              {c.advertencias.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => onUsar(resultado.item, perfil)}>
            Usar este precio
          </button>
        </div>
      ) : (
        <div className="rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-hover)] p-3 text-sm" role="status">
          <p className="text-[var(--fo-text)]">{resultado.ok ? "" : resultado.error}</p>
          {!resultado.ok && resultado.faltan.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[var(--fo-muted)]">
              {resultado.faltan.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}
