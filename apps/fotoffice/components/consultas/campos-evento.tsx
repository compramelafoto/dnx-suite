"use client";

import { useId } from "react";
import { CAMPOS_POR_GRUPO, ETIQUETA_CAMPO_EVENTO, type GrupoConsulta } from "@/lib/consultas/constantes";
import type { FormEvento } from "@/lib/consultas/formulario";

/**
 * Los datos del evento que pide el grupo de la categoría (`CAMPOS_POR_GRUPO`): al cambiar de
 * categoría se muestran u ocultan acá mismo, sin ir al servidor. Los que no se muestran no se
 * mandan, y el servidor tampoco los toca.
 */
export function CamposEvento({
  grupo,
  valor,
  onCambiar,
  deshabilitado,
}: {
  grupo: GrupoConsulta | null;
  valor: FormEvento;
  onCambiar: (v: FormEvento) => void;
  deshabilitado?: boolean;
}) {
  const id = useId();
  if (!grupo) return null;
  const campos = CAMPOS_POR_GRUPO[grupo];
  if (campos.length === 0) return null;
  const poner = (k: keyof FormEvento, v: string) => onCambiar({ ...valor, [k]: v });
  const texto = (k: keyof FormEvento, etiqueta: string, max = 200) => (
    <label key={k} className="fo-field-stack">
      <span className="fo-label">{etiqueta}</span>
      <input
        id={`${id}-${k}`}
        className="fo-input"
        value={valor[k] ?? ""}
        maxLength={max}
        disabled={deshabilitado}
        onChange={(e) => poner(k, e.target.value)}
      />
    </label>
  );

  return (
    <fieldset className="grid gap-3 sm:grid-cols-2" disabled={deshabilitado}>
      <legend className="sr-only">Datos del evento</legend>
      {campos.map((campo) => {
        switch (campo) {
          case "fechaHora":
            return (
              <div key={campo} className="grid grid-cols-2 gap-2 sm:col-span-2">
                <label className="fo-field-stack">
                  <span className="fo-label">Fecha del evento</span>
                  <input type="date" className="fo-input" value={valor.fecha ?? ""} onChange={(e) => poner("fecha", e.target.value)} />
                </label>
                <label className="fo-field-stack">
                  <span className="fo-label">Hora (opcional)</span>
                  <input
                    type="time"
                    className="fo-input"
                    value={valor.hora ?? ""}
                    disabled={deshabilitado || !valor.fecha}
                    onChange={(e) => poner("hora", e.target.value)}
                  />
                </label>
              </div>
            );
          case "invitados":
            return (
              <label key={campo} className="fo-field-stack">
                <span className="fo-label">{ETIQUETA_CAMPO_EVENTO.invitados}</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  className="fo-input"
                  value={valor.invitados ?? ""}
                  onChange={(e) => poner("invitados", e.target.value)}
                />
              </label>
            );
          case "novios":
            return (
              <div key={campo} className="grid grid-cols-2 gap-2 sm:col-span-2">
                {texto("novio1", "Novio/a 1")}
                {texto("novio2", "Novio/a 2")}
              </div>
            );
          case "ceremonia":
            return texto("ceremonia", ETIQUETA_CAMPO_EVENTO.ceremonia);
          case "recepcion":
            return texto("recepcion", ETIQUETA_CAMPO_EVENTO.recepcion);
          case "lugar":
            return texto("lugar", ETIQUETA_CAMPO_EVENTO.lugar);
          case "ciudad":
            return texto("ciudad", ETIQUETA_CAMPO_EVENTO.ciudad);
        }
      })}
    </fieldset>
  );
}
