/**
 * Corrector automático de las tareas del curso: revisa cada requisito con los
 * datos de la toma y explica, en palabras simples, qué faltó. Lo usan el
 * simulador (para mostrar la nota al instante) y el servidor (para guardarla).
 */

import type { Criterion, CriterionResult, GradeResult, Lesson, Shot, ShotSubjectKind, StreetShot, StudioShot } from "./types";

/** Círculo de confusión de cuadro completo (mm) y ancho del sensor. */
const COC_MM = 0.03;
const SENSOR_WIDTH_MM = 36;

export function formatShutter(seconds: number): string {
  if (seconds >= 0.95) return `${Math.round(seconds * 10) / 10}"`;
  return `1/${Math.round(1 / seconds)}`;
}

function formatStops(stops: number): string {
  const v = Math.round(Math.abs(stops) * 10) / 10;
  return `${String(v).replace(".", ",")} ${v === 1 ? "paso" : "pasos"}`;
}

const KIND_LABEL: Record<ShotSubjectKind, string> = {
  persona: "una persona",
  corredor: "un corredor",
  auto: "un auto",
  bici: "una bici o monopatín",
  moto: "una moto",
  ninguno: "nada en particular",
};

const PATTERN_LABEL: Record<string, string> = {
  none: "sin luz principal",
  butterfly: "mariposa",
  loop: "loop",
  rembrandt: "Rembrandt",
  split: "dividida (split)",
  rim: "contraluz de borde",
  underlight: "luz desde abajo",
  top: "cenital",
  flat: "plana de frente",
};

/** Disco de desenfoque del fondo lejano como porcentaje del ancho del cuadro. */
export function backgroundBlurPercent(focalMm: number, aperture: number, focusDistanceM: number): number {
  const f = Math.max(1, focalMm);
  const s = Math.max(focusDistanceM * 1000, f * 1.01);
  const disc = (f * f) / (Math.max(1, aperture) * (s - f));
  return (disc / SENSOR_WIDTH_MM) * 100;
}

/** ¿El sujeto cae dentro de la profundidad de campo? */
export function insideDepthOfField(focalMm: number, aperture: number, focusDistanceM: number, subjectDistanceM: number): boolean {
  const f = focalMm / 1000;
  const c = COC_MM / 1000;
  const H = (f * f) / (Math.max(1, aperture) * c) + f;
  const s = Math.max(f * 1.01, focusDistanceM);
  const near = (s * (H - f)) / (H + s - 2 * f);
  const far = s >= H ? Number.POSITIVE_INFINITY : (s * (H - f)) / (H - s);
  // Un poco de margen: el ojo perdona unos centímetros en el borde.
  return subjectDistanceM >= near * 0.97 && subjectDistanceM <= far * 1.03;
}

function street(shot: Shot): StreetShot | null {
  return shot.sim === "calle" ? shot : null;
}

function studio(shot: Shot): StudioShot | null {
  return shot.sim === "estudio" ? shot : null;
}

/** Revisa un requisito: [cumple, qué faltó]. */
export function checkCriterion(c: Criterion, shot: Shot): [boolean, string] {
  const s = street(shot);
  const st = studio(shot);
  switch (c.type) {
    case "exposure": {
      const e = shot.exposureError;
      if (Math.abs(e) <= c.tolerance) return [true, ""];
      return [false, e > 0 ? `Quedó sobreexpuesta ${formatStops(e)}: entró luz de más.` : `Quedó subexpuesta ${formatStops(e)}: faltó luz.`];
    }
    case "exposureRange": {
      const e = shot.exposureError;
      if (e >= c.min && e <= c.max) return [true, ""];
      return [false, e < c.min ? `Quedó ${formatStops(c.min - e)} más oscura de lo pedido.` : `Quedó ${formatStops(e - c.max)} más clara de lo pedido.`];
    }
    case "shutterMax":
      return shot.shutterSeconds <= c.seconds * 1.02
        ? [true, ""]
        : [false, `Usaste ${formatShutter(shot.shutterSeconds)}: hacía falta ${formatShutter(c.seconds)} o más corto.`];
    case "shutterMin":
      return shot.shutterSeconds >= c.seconds * 0.98
        ? [true, ""]
        : [false, `Usaste ${formatShutter(shot.shutterSeconds)}: hacía falta ${formatShutter(c.seconds)} o más largo.`];
    case "apertureMax":
      return shot.aperture <= c.f + 0.05 ? [true, ""] : [false, `Usaste f/${shot.aperture}: hacía falta f/${c.f} o más abierto (número más chico).`];
    case "apertureMin":
      return shot.aperture >= c.f - 0.05 ? [true, ""] : [false, `Usaste f/${shot.aperture}: hacía falta f/${c.f} o más cerrado (número más grande).`];
    case "isoMax":
      return shot.iso <= c.iso ? [true, ""] : [false, `Usaste ISO ${shot.iso}: hacía falta ISO ${c.iso} o menos.`];
    case "isoMin":
      return shot.iso >= c.iso ? [true, ""] : [false, `Usaste ISO ${shot.iso}: hacía falta ISO ${c.iso} o más.`];
    case "focalMax":
      return shot.focalLengthMm <= c.mm + 0.5 ? [true, ""] : [false, `Usaste ${Math.round(shot.focalLengthMm)} mm: hacía falta ${c.mm} mm o menos (más angular).`];
    case "focalMin":
      return shot.focalLengthMm >= c.mm - 0.5 ? [true, ""] : [false, `Usaste ${Math.round(shot.focalLengthMm)} mm: hacía falta ${c.mm} mm o más (más tele).`];
    case "mode":
      if (!s) return [false, "Esta tarea se hace en la calle."];
      return c.modes.includes(s.mode) ? [true, ""] : [false, `La cámara estaba en modo ${s.mode}: tenía que estar en ${c.modes.join(" o ")}.`];
    case "metering": {
      if (!s) return [false, "Esta tarea se hace en la calle."];
      const names = { MATRIX: "matricial", CENTER: "ponderada al centro", SPOT: "puntual" } as const;
      return c.modes.includes(s.metering) ? [true, ""] : [false, `La medición estaba en ${names[s.metering]}: tenía que estar en ${c.modes.map((m) => names[m]).join(" o ")}.`];
    }
    case "compensation":
      if (!s) return [false, "Esta tarea se hace en la calle."];
      return s.exposureCompensation >= c.min - 0.01 && s.exposureCompensation <= c.max + 0.01
        ? [true, ""]
        : [false, `La compensación estaba en ${s.exposureCompensation > 0 ? "+" : ""}${s.exposureCompensation}: tenía que estar entre ${c.min} y ${c.max > 0 ? "+" : ""}${c.max}.`];
    case "compensationUsed":
      if (!s) return [false, "Esta tarea se hace en la calle."];
      return Math.abs(s.exposureCompensation) >= 0.3 ? [true, ""] : [false, "La compensación quedó en 0: usá los botones − o + de compensación."];
    case "whiteBalance":
      return shot.whiteBalance >= c.min && shot.whiteBalance <= c.max
        ? [true, ""]
        : [false, `El balance de blancos estaba en ${shot.whiteBalance} K: tenía que estar entre ${c.min} y ${c.max} K.`];
    case "focusMode":
      if (!s) return [false, "Esta tarea se hace en la calle."];
      return c.modes.includes(s.focusMode) ? [true, ""] : [false, `El enfoque estaba en ${s.focusMode}: tenía que estar en ${c.modes.join(" o ")}.`];
    case "subject":
      if (!s) return [false, "Esta tarea se hace en la calle."];
      return c.kinds.includes(s.subject.kind)
        ? [true, ""]
        : [false, s.subject.kind === "ninguno" ? `No había nada enfocado: enfocá ${c.kinds.map((k) => KIND_LABEL[k]).join(" o ")} (tocá o apretá C).` : `Enfocaste ${KIND_LABEL[s.subject.kind]}: la tarea pide ${c.kinds.map((k) => KIND_LABEL[k]).join(" o ")}.`];
    case "subjectSharp":
      if (!s || s.subject.distanceM == null) return [false, "No había un sujeto enfocado para revisar la nitidez."];
      return insideDepthOfField(s.focalLengthMm, s.aperture, s.focusDistanceM, s.subject.distanceM)
        ? [true, ""]
        : [false, `El sujeto estaba a ${s.subject.distanceM.toFixed(1).replace(".", ",")} m pero el foco a ${s.focusDistanceM.toFixed(1).replace(".", ",")} m: quedó fuera de foco.`];
    case "subjectDistanceMax":
      if (!s || s.subject.distanceM == null) return [false, "No había un sujeto enfocado."];
      return s.subject.distanceM <= c.meters ? [true, ""] : [false, `El sujeto estaba a ${Math.round(s.subject.distanceM)} m: acercate a menos de ${c.meters} m.`];
    case "frozen": {
      if (!s) return [false, "Esta tarea se hace en la calle."];
      const blur = s.subject.speedMps * s.shutterSeconds;
      return blur <= c.maxBlurM ? [true, ""] : [false, `En ${formatShutter(s.shutterSeconds)} el sujeto se movió ${Math.round(blur * 100)} cm: quedó movido. Acortá el tiempo de exposición.`];
    }
    case "motionBlur": {
      if (!s) return [false, "Esta tarea se hace en la calle."];
      if (s.subject.speedMps < 0.5) return [false, "El sujeto enfocado estaba quieto: buscá a alguien que se mueva."];
      const blur = s.subject.speedMps * s.shutterSeconds;
      return blur >= c.minBlurM ? [true, ""] : [false, `En ${formatShutter(s.shutterSeconds)} el sujeto se movió sólo ${Math.round(blur * 100)} cm: alargá el tiempo de exposición para que se vea el movimiento.`];
    }
    case "panning":
      if (!s) return [false, "Esta tarea se hace en la calle."];
      if (s.panningMatch == null) return [false, "No hubo barrido: seguí al sujeto con la cámara mientras obturás."];
      return s.panningMatch >= c.minMatch ? [true, ""] : [false, `El barrido acompañó al sujeto un ${Math.round(s.panningMatch * 100)} %: seguilo de forma más pareja.`];
    case "backgroundBlur": {
      const pct = backgroundBlurPercent(shot.focalLengthMm, shot.aperture, shot.sim === "calle" ? shot.focusDistanceM : 2.5);
      return pct >= c.minPercent ? [true, ""] : [false, "El fondo quedó bastante nítido: abrí el diafragma, acercate al sujeto o usá una focal más larga."];
    }
    case "deepFocus": {
      const pct = backgroundBlurPercent(shot.focalLengthMm, shot.aperture, shot.sim === "calle" ? shot.focusDistanceM : 2.5);
      return pct <= c.maxPercent ? [true, ""] : [false, "El fondo quedó desenfocado: cerrá el diafragma (f/8 o más) o enfocá más lejos."];
    }
    case "thirds": {
      if (!s || s.subject.frameX == null) return [false, "El sujeto enfocado no quedó dentro del cuadro."];
      const x = s.subject.frameX;
      const ok = Math.abs(x - 1 / 3) <= c.tolerance || Math.abs(x - 2 / 3) <= c.tolerance;
      return ok ? [true, ""] : [false, "El sujeto no quedó sobre una línea de tercios: corré el encuadre para que quede a un tercio del borde."];
    }
    case "level":
      if (!s) return [false, "Esta tarea se hace en la calle."];
      return Math.abs(s.rollDeg) <= c.maxDeg ? [true, ""] : [false, `La cámara estaba inclinada ${Math.round(Math.abs(s.rollDeg))}°: enderezá el horizonte.`];
    case "sunBetween":
      if (!s) return [false, "Esta tarea se hace en la calle."];
      return s.sunElevationDeg >= c.minDeg && s.sunElevationDeg <= c.maxDeg ? [true, ""] : [false, "No era la hora pedida: cambiá la hora en Luz natural."];
    case "weather": {
      if (!s) return [false, "Esta tarea se hace en la calle."];
      const names = { sunny: "soleado", cloudy: "nublado", rain: "lluvia" } as const;
      return c.kinds.includes(s.weather) ? [true, ""] : [false, `El clima estaba en ${names[s.weather]}: tenía que estar en ${c.kinds.map((k) => names[k]).join(" o ")}.`];
    }
    case "cameraHeightMax":
      if (!s) return [false, "Esta tarea se hace en la calle."];
      return s.cameraHeightM <= c.meters ? [true, ""] : [false, `La cámara estaba a ${s.cameraHeightM.toFixed(1).replace(".", ",")} m del piso: agachate (tecla K o la flecha ▼).`];
    case "puddleNear":
      if (!s) return [false, "Esta tarea se hace en la calle."];
      return s.puddleDistanceM != null && s.puddleDistanceM <= c.meters ? [true, ""] : [false, "No había un charco cerca a la vista: buscá uno y encuadralo."];
    case "pattern":
      if (!st) return [false, "Esta tarea se hace en el Estudio."];
      return c.patterns.includes(st.pattern)
        ? [true, ""]
        : [false, `El esquema quedó ${PATTERN_LABEL[st.pattern] ?? st.pattern}: tenía que ser ${c.patterns.map((p) => PATTERN_LABEL[p] ?? p).join(" o ")}. Mové la luz principal.`];
    case "ratio":
      if (!st) return [false, "Esta tarea se hace en el Estudio."];
      if (st.ratio == null) return [false, "No hay relleno: la sombra quedó negra. Sumá una luz o un reflector del lado de la sombra."];
      return st.ratio >= c.min && st.ratio <= c.max
        ? [true, ""]
        : [false, `La relación de luces quedó ${st.ratio.toFixed(1).replace(".", ",")}:1, tenía que estar entre ${c.min}:1 y ${c.max}:1. ${st.ratio < c.min ? "Bajá el relleno." : "Subí el relleno."}`];
    case "side":
      if (!st) return [false, "Esta tarea se hace en el Estudio."];
      return st.side === c.side ? [true, ""] : [false, c.side === "short" ? "La luz tiene que llegar al lado de la cara más lejano a la cámara (iluminación corta). Girá al modelo o mové la luz." : "La luz tiene que llegar al lado de la cara más cercano a la cámara (iluminación ancha)."];
    case "backgroundEv":
      if (!st || st.backgroundEv == null) return [false, "No se pudo medir el fondo."];
      return st.backgroundEv >= c.min && st.backgroundEv <= c.max
        ? [true, ""]
        : [false, st.backgroundEv < c.min ? "El fondo quedó demasiado oscuro: ilumínalo o acercá el modelo." : "El fondo quedó demasiado claro: alejá el modelo del fondo o apagá la luz que le llega."];
    case "noOverSync":
      if (!st) return [false, "Esta tarea se hace en el Estudio."];
      return !st.overSync ? [true, ""] : [false, "El tiempo de exposición es más corto que la sincronización del flash: aparece una franja negra. Usá 1/200 o más largo."];
    case "lightsOnMin":
      if (!st) return [false, "Esta tarea se hace en el Estudio."];
      return st.lightsOn >= c.count ? [true, ""] : [false, `Había ${st.lightsOn} ${st.lightsOn === 1 ? "luz encendida" : "luces encendidas"}: hacían falta ${c.count}.`];
    case "keyModifier":
      if (!st) return [false, "Esta tarea se hace en el Estudio."];
      return st.keyModifier != null && c.modifiers.includes(st.keyModifier) ? [true, ""] : [false, "La luz principal no tenía el modificador pedido: cambialo en el panel de la luz."];
    case "hairLight":
      if (!st) return [false, "Esta tarea se hace en el Estudio."];
      return st.hasHairLight ? [true, ""] : [false, "Falta una luz de pelo: una luz detrás del modelo apuntando al pelo."];
    case "backgroundLight":
      if (!st) return [false, "Esta tarea se hace en el Estudio."];
      return st.hasBackgroundLight ? [true, ""] : [false, "Falta una luz apuntando al fondo."];
  }
}

/** Nota de una toma para una lección: aprueba si cumple todo lo obligatorio; cada opcional suma una estrella. */
export function gradeShot(lesson: Lesson, shot: Shot): GradeResult {
  const results: CriterionResult[] = lesson.criteria.map((lc) => {
    const [ok, hint] = checkCriterion(lc.criterion, shot);
    return { label: lc.label, required: lc.required, ok, hint };
  });
  const passed = shot.sim === (lesson.simulator === "calle" ? "calle" : "estudio") && results.every((r) => !r.required || r.ok);
  const bonus = results.filter((r) => !r.required && r.ok).length;
  return { passed, stars: passed ? Math.min(3, 1 + bonus) : 0, results };
}
