import { duracionLegible, horaLegible } from "@/lib/equipo/fechas";
import type { HorarioDelDia } from "@/lib/equipo/horario";
import { MOTIVOS_CAMBIO } from "@/lib/equipo/horario";
import { ETIQUETAS_ESTADO, type Jornada } from "@/lib/equipo/jornada";

/** Texto del horario fijo de un día. */
export function textoHorario(h: HorarioDelDia): string {
  const franjas = h.franjas.map((f) => `${horaLegible(f.inicioMin)} a ${horaLegible(f.finMin)}`).join(" y ");
  const base =
    h.origen === "NO_TRABAJA"
      ? `No trabaja${h.motivo ? ` (${MOTIVOS_CAMBIO[h.motivo].toLowerCase()})` : ""}`
      : h.origen === "SABADO_LIBRE"
        ? "Sábado libre"
        : h.origen === "SIN_HORARIO"
          ? "Sin horario"
          : `${franjas}${h.origen === "CAMBIO" ? " (cambio puntual)" : ""}`;
  return h.feriado ? `${base} · Feriado: ${h.feriado}` : base;
}

/** Las diferencias frente al horario, sólo las que superan la tolerancia (las demás, en gris). */
export function Diferencias({ j }: { j: Jornada }) {
  const partes: { texto: string; fuera: boolean }[] = [];
  if (j.llegadaTardeMin > 0) partes.push({ texto: `Llegó ${duracionLegible(j.llegadaTardeMin)} tarde`, fuera: j.fueraDeTolerancia.tarde });
  if (j.salidaTempranaMin > 0) partes.push({ texto: `Se fue ${duracionLegible(j.salidaTempranaMin)} antes`, fuera: j.fueraDeTolerancia.temprano });
  if (j.extraMin > 0) {
    const sin = j.extraSinActividadMin > 0 ? ` (${duracionLegible(j.extraSinActividadMin)} sin actividad)` : "";
    partes.push({ texto: `${duracionLegible(j.extraMin)} de más${sin}`, fuera: j.fueraDeTolerancia.extra });
  }
  if (partes.length === 0) return <span className="text-[var(--fo-muted-soft)]">—</span>;
  return (
    <span className="flex flex-col gap-0.5">
      {partes.map((p) => (
        <span key={p.texto} className={p.fuera ? "font-medium" : "text-[var(--fo-muted-soft)]"}>
          {p.texto}
        </span>
      ))}
    </span>
  );
}

export function EstadoJornada({ j }: { j: Jornada }) {
  const marcas = [ETIQUETAS_ESTADO[j.estado]];
  if (j.cerroTurnoAjeno) marcas.push("Cerró el turno de otra persona");
  if (j.corregida) marcas.push("Corregida a mano");
  return <span>{marcas.join(" · ")}</span>;
}

export function EntradaSalida({ j }: { j: Jornada }) {
  const entrada = j.entradaMin !== null ? horaLegible(j.entradaMin) : "—";
  const salida = j.salidaMin !== null ? `${horaLegible(j.salidaMin)}${j.salidaEsReferencia ? " (última actividad)" : ""}` : "—";
  return (
    <span className="tabular-nums">
      {entrada} → {salida}
    </span>
  );
}
