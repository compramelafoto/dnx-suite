"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { editarConsultaAction } from "@/app/actions/consultas";
import { valoresDeVencimiento } from "@/lib/circuitos/ficha-vista";
import { CAMPOS_POR_GRUPO, ETIQUETA_CAMPO_EVENTO, type GrupoConsulta } from "@/lib/consultas/constantes";
import type { DatosConsultaFicha } from "@/lib/consultas/ficha";
import { formularioDelEvento, marcaDeCampo, type CampoConError, type FormEvento } from "@/lib/consultas/formulario";
import { fechaBA, fechaDeEvento, fechaHoraBA } from "@/lib/ficha/formato";
import { CamposEvento } from "./campos-evento";
import { SelectorContacto, type ContactoElegido } from "./selector-contacto";

const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";

type Opcion = { id: string; nombre: string };

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });

/** "aaaa-mm-dd" → "dd/mm/aaaa" (fecha de calendario, sin zona). */
function diaVisible(ymd: string): string {
  const [a, m, d] = ymd.split("-");
  return `${d}/${m}/${a}`;
}

/** Los datos del grupo, en el orden de `CAMPOS_POR_GRUPO`, con su valor visible. */
function filasDelEvento(grupo: GrupoConsulta, ev: DatosConsultaFicha["evento"]): { termino: string; valor: string | null }[] {
  return CAMPOS_POR_GRUPO[grupo].map((campo) => {
    switch (campo) {
      case "fechaHora":
        return {
          termino: "Fecha del evento",
          valor: ev.startsAt ? (ev.horaConocida ? fechaHoraBA(ev.startsAt) : fechaDeEvento(ev.startsAt)) : null,
        };
      case "invitados":
        return { termino: ETIQUETA_CAMPO_EVENTO.invitados, valor: ev.guests === null ? null : String(ev.guests) };
      case "novios":
        return { termino: ETIQUETA_CAMPO_EVENTO.novios, valor: [ev.partnerOneName, ev.partnerTwoName].filter(Boolean).join(" y ") || null };
      case "ceremonia":
        return { termino: ETIQUETA_CAMPO_EVENTO.ceremonia, valor: ev.ceremonyVenue };
      case "recepcion":
        return { termino: ETIQUETA_CAMPO_EVENTO.recepcion, valor: ev.receptionVenue };
      case "lugar":
        return { termino: ETIQUETA_CAMPO_EVENTO.lugar, valor: ev.venue };
      case "ciudad":
        return { termino: ETIQUETA_CAMPO_EVENTO.ciudad, valor: ev.city };
    }
  });
}

/**
 * Columna de datos de la ficha de una consulta (spec §3.2): contacto, categoría, datos del grupo,
 * origen, referente, valor, cierre previsto, responsable y siguiente acción. Con "Gestionar" en
 * Consultas se editan acá; la siguiente acción es el vencimiento de la etapa (`stageDueAt`) y su
 * cambio queda en el historial.
 */
export function DatosConsulta({
  leadId,
  datos,
  categorias,
  origenes,
  responsables,
  responsableId,
  nombreResponsable,
  siguienteAccion,
  recorridoAbierto,
  puedeEditar,
  veContactos,
}: {
  leadId: string;
  datos: DatosConsultaFicha;
  /** Activas; la actual se suma aunque esté archivada. */
  categorias: (Opcion & { grupo: GrupoConsulta })[];
  origenes: Opcion[];
  responsables: { id: number; nombre: string }[];
  responsableId: number | null;
  nombreResponsable: string | null;
  /** `stageDueAt` del recorrido abierto (ISO), o null. */
  siguienteAccion: string | null;
  recorridoAbierto: boolean;
  puedeEditar: boolean;
  /** "Ver" en Clientes (R10): sin él, el referente se muestra pero no se elige otro. */
  veContactos: boolean;
}) {
  const idError = useId();
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<{ mensaje: string; campo?: CampoConError } | null>(null);
  const marca = (c: CampoConError | readonly CampoConError[]) => marcaDeCampo(error, c, idError);
  const [estado, setEstado] = useState("");

  const inicial = () => ({
    categoriaId: datos.categoria.id,
    evento: formularioDelEvento(datos.evento) as FormEvento,
    origenId: datos.origen?.id ?? "",
    referente: datos.referente ? ({ ...datos.referente, email: null, telefono: null } as ContactoElegido) : null,
    valor: datos.valorEstimado === null ? "" : String(datos.valorEstimado).replace(".", ","),
    cierre: datos.cierrePrevisto ?? "",
    responsable: responsableId === null ? "" : String(responsableId),
    siguiente: valoresDeVencimiento(siguienteAccion).fecha,
  });
  const [form, setForm] = useState(inicial);

  const opcionesCategoria = categorias.some((c) => c.id === datos.categoria.id)
    ? categorias
    : [{ id: datos.categoria.id, nombre: `${datos.categoria.nombre} (archivada)`, grupo: datos.categoria.grupo }, ...categorias];
  const opcionesOrigen =
    datos.origen && !origenes.some((o) => o.id === datos.origen!.id)
      ? [{ id: datos.origen.id, nombre: `${datos.origen.nombre} (archivado)` }, ...origenes]
      : origenes;
  const grupoElegido = opcionesCategoria.find((c) => c.id === form.categoriaId)?.grupo ?? null;

  function guardar() {
    setError(null);
    iniciar(async () => {
      try {
        const r = await editarConsultaAction({
          leadId,
          form: {
            categoriaId: form.categoriaId,
            evento: form.evento,
            origenId: form.origenId || null,
            referenteClientId: form.referente?.id ?? null,
            valor: form.valor,
            cierrePrevisto: form.cierre,
            ...(recorridoAbierto
              ? { responsableUserId: form.responsable ? Number(form.responsable) : null, siguienteAccion: form.siguiente || null }
              : {}),
          },
        });
        if (!r.ok) {
          setError({ mensaje: r.error, campo: r.campo });
          return;
        }
        setEditando(false);
        setEstado("Datos guardados.");
        router.refresh();
      } catch {
        setError({ mensaje: MENSAJE_FALLA });
      }
    });
  }

  const filas: { termino: string; valor: React.ReactNode }[] = [
    {
      termino: "Contacto",
      valor: (
        <Link href={`/clientes/${datos.contacto.id}`} className="text-[var(--fo-accent)] hover:underline">
          {datos.contacto.nombre}
        </Link>
      ),
    },
    { termino: "Categoría", valor: `${datos.categoria.nombre}${datos.categoria.archivada ? " (archivada)" : ""}` },
    ...filasDelEvento(datos.categoria.grupo, datos.evento),
    { termino: "Origen", valor: datos.origen ? datos.origen.nombre : null },
    {
      termino: "Referente",
      valor: datos.referente ? (
        <Link href={`/clientes/${datos.referente.id}`} className="text-[var(--fo-accent)] hover:underline">
          {datos.referente.nombre}
        </Link>
      ) : null,
    },
    { termino: "Valor estimado", valor: datos.valorEstimado === null ? null : pesos.format(datos.valorEstimado) },
    { termino: "Cierre previsto", valor: datos.cierrePrevisto ? diaVisible(datos.cierrePrevisto) : null },
    { termino: "Responsable", valor: nombreResponsable },
    { termino: "Siguiente acción", valor: siguienteAccion ? fechaBA(siguienteAccion) : null },
  ];

  return (
    <section aria-labelledby="consulta-datos-titulo" className="fo-card space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="consulta-datos-titulo" className="text-base font-semibold text-[var(--fo-text)]">
          Consulta
        </h2>
        {puedeEditar && !editando ? (
          <button
            type="button"
            className="fo-btn fo-btn-ghost text-xs"
            onClick={() => {
              setForm(inicial());
              setEstado("");
              setEditando(true);
            }}
          >
            Editar
          </button>
        ) : null}
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {estado}
      </p>

      {!editando ? (
        <dl className="space-y-2 text-sm">
          {filas.map((d) => (
            <div key={d.termino}>
              <dt className="text-xs text-[var(--fo-muted)]">{d.termino}</dt>
              <dd className="break-words text-[var(--fo-text)]">{d.valor || "—"}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <form
          className="space-y-3 text-sm"
          aria-label="Editar los datos de la consulta"
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <fieldset className="space-y-3" disabled={pendiente}>
            <label className="fo-field-stack">
              <span className="fo-label">Categoría</span>
              <select className="fo-input" value={form.categoriaId} {...marca("categoria")} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>
                {opcionesCategoria.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <CamposEvento grupo={grupoElegido} valor={form.evento} onCambiar={(evento) => setForm({ ...form, evento })} deshabilitado={pendiente} marca={(c) => marca(c)} />
            <label className="fo-field-stack">
              <span className="fo-label">Origen</span>
              <select className="fo-input" value={form.origenId} {...marca("origen")} onChange={(e) => setForm({ ...form, origenId: e.target.value })}>
                <option value="">Sin especificar</option>
                {opcionesOrigen.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </label>
            {veContactos ? (
              <SelectorContacto
                etiqueta="Referente"
                elegido={form.referente}
                onElegir={(referente) => setForm({ ...form, referente })}
                excluir={[datos.contacto.id]}
                deshabilitado={pendiente}
                marca={marca("referente")}
              />
            ) : (
              <div className="fo-field-stack">
                <span className="fo-label">Referente</span>
                <span className="text-sm text-[var(--fo-text)]">{datos.referente?.nombre ?? "—"}</span>
              </div>
            )}
            <label className="fo-field-stack">
              <span className="fo-label">Valor estimado</span>
              <input className="fo-input" inputMode="decimal" maxLength={20} value={form.valor} {...marca("valor")} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
            </label>
            <label className="fo-field-stack">
              <span className="fo-label">Cierre previsto</span>
              <input type="date" className="fo-input" value={form.cierre} {...marca("cierrePrevisto")} onChange={(e) => setForm({ ...form, cierre: e.target.value })} />
            </label>
            {recorridoAbierto ? (
              <>
                <label className="fo-field-stack">
                  <span className="fo-label">Responsable</span>
                  <select className="fo-input" value={form.responsable} {...marca("responsable")} onChange={(e) => setForm({ ...form, responsable: e.target.value })}>
                    <option value="">Sin responsable</option>
                    {responsableId !== null && !responsables.some((r) => r.id === responsableId) ? (
                      <option value={responsableId}>Responsable actual (sin permiso para gestionar)</option>
                    ) : null}
                    {responsables.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fo-field-stack">
                  <span className="fo-label">Siguiente acción</span>
                  <input type="date" className="fo-input" value={form.siguiente} {...marca("siguienteAccion")} onChange={(e) => setForm({ ...form, siguiente: e.target.value })} />
                  <span className="text-xs text-[var(--fo-muted)]">Es el vencimiento de la etapa: el cambio queda en el historial.</span>
                </label>
              </>
            ) : (
              <p className="text-xs text-[var(--fo-muted)]">El responsable y la siguiente acción se cambian cuando la consulta está en un circuito abierto.</p>
            )}
          </fieldset>
          {error ? (
            <p id={idError} role="alert" className="text-sm text-[var(--fo-danger)]">
              {error.mensaje}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setEditando(false)} disabled={pendiente}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
