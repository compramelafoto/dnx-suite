/**
 * El mensaje de `CLOCK_OFF` es el único texto de la pantalla que se arma con
 * un número, y es el que más fácil se equivoca de culpable: con 5 minutos de
 * tolerancia, una foto sacada hace ocho da CLOCK_OFF aunque el teléfono esté
 * perfecto. Estos tests fijan el orden en que se nombran las dos causas.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  CLOCK_OFF_PROBABLE_FOTO_VIEJA_MAX_MINUTOS,
  clockOffMessage,
} from "./readiness-copy";

/** Dónde aparece cada causa dentro del mensaje, para poder compararlas. */
function posiciones(mensaje: string) {
  return {
    foto: mensaje.indexOf("no sea de recién"),
    reloj: mensaje.indexOf("reloj"),
  };
}

test("un desfasaje chico nombra primero la foto y recién después el reloj", () => {
  const mensaje = clockOffMessage(8);
  const { foto, reloj } = posiciones(mensaje);

  assert.ok(foto >= 0, "tiene que ofrecer la explicación de la foto vieja");
  assert.ok(reloj >= 0, "y tampoco puede esconder la del reloj");
  assert.ok(
    foto < reloj,
    "ocho minutos casi nunca son el reloj: si el reloj aparece primero, la pantalla manda a cambiar un ajuste que estaba bien",
  );
});

test("un desfasaje chico dice cuántos minutos y para qué lado", () => {
  assert.match(clockOffMessage(8), /8 minutos adelantada/);
  assert.match(clockOffMessage(-8), /8 minutos atrasada/);
  assert.match(clockOffMessage(1), /1 minuto adelantada/, "un minuto va en singular");
});

test("un desfasaje grande sí apunta derecho al reloj", () => {
  const mensaje = clockOffMessage(CLOCK_OFF_PROBABLE_FOTO_VIEJA_MAX_MINUTOS + 1);

  assert.match(mensaje, /el reloj de tu teléfono no está en hora/);
  assert.equal(
    posiciones(mensaje).foto,
    -1,
    "más de una hora no se explica por una foto de hace un rato: ofrecer esa salida acá sería marear",
  );
  assert.match(mensaje, /61 minutos adelantada/, "sigue diciendo cuánto y para qué lado");
});

test("justo en el borde todavía ofrece primero la foto", () => {
  const mensaje = clockOffMessage(CLOCK_OFF_PROBABLE_FOTO_VIEJA_MAX_MINUTOS);
  const { foto, reloj } = posiciones(mensaje);

  assert.ok(
    foto >= 0 && foto < reloj,
    "el corte es `>`, no `>=`: el borde exacto sigue siendo del lado prudente",
  );
});
