import test from "node:test";
import assert from "node:assert/strict";

import {
  FOTOS_MINIMAS_PARA_ESTIMAR,
  UMBRAL_DE_INACTIVIDAD_SEGUNDOS,
  loQueFalta,
  ritmoDelJurado,
  sumarAlLatido,
} from "./ritmoDelJurado";

/* ---------- el ritmo ---------- */

test("con diez fotos y tres minutos, el ritmo son 18 segundos por foto", () => {
  const r = ritmoDelJurado({ segundosActivos: 180, fotosCalificadas: 10 });
  assert.ok(r);
  assert.equal(r.segundosPorFoto, 18);
});

/** Las primeras fotos siempre son lentas: la media temprana miente. */
test("con menos de diez fotos todavía no se estima", () => {
  for (const fotosCalificadas of [0, 1, 3, 9]) {
    assert.equal(
      ritmoDelJurado({ segundosActivos: 300, fotosCalificadas }),
      null,
      `con ${fotosCalificadas} fotos no debería estimar`,
    );
  }
});

test("el mínimo para estimar son diez fotos", () => {
  assert.equal(FOTOS_MINIMAS_PARA_ESTIMAR, 10);
});

test("sin tiempo activo no hay ritmo que calcular", () => {
  assert.equal(ritmoDelJurado({ segundosActivos: 0, fotosCalificadas: 40 }), null);
});

test("un tiempo negativo no produce un ritmo negativo", () => {
  assert.equal(ritmoDelJurado({ segundosActivos: -50, fotosCalificadas: 40 }), null);
});

/* ---------- lo que falta ---------- */

test("dice lo que falta en palabras, no en minutos sueltos", () => {
  const texto = loQueFalta({ segundosPorFoto: 20, fotosQueFaltan: 270 });
  assert.match(texto, /hora/i);
  assert.doesNotMatch(texto, /\d+ minutos\b.*\d+ segundos/);
});

test("menos de una hora se dice en minutos", () => {
  const texto = loQueFalta({ segundosPorFoto: 20, fotosQueFaltan: 60 });
  assert.match(texto, /minutos/i);
});

/** Una estimación al minuto se lee como una promesa. */
test("redondea: nunca da un número exacto al minuto", () => {
  const texto = loQueFalta({ segundosPorFoto: 17, fotosQueFaltan: 307 });
  assert.doesNotMatch(texto, /87|88|89/);
});

test("sin fotas que falten no queda nada por hacer", () => {
  assert.equal(loQueFalta({ segundosPorFoto: 20, fotosQueFaltan: 0 }), "");
});

/* ---------- el latido ---------- */

test("un latido seguido suma el tiempo transcurrido", () => {
  const r = sumarAlLatido({
    acumulado: 100,
    segundosDesdeElUltimo: 20,
    pantallaVisible: true,
    huboInteraccion: true,
  });
  assert.equal(r, 120);
});

/**
 * Lo que pidió el dueño: si minimiza o se va a otra solapa, no cuenta. Sin
 * esto, dejar la pestaña abierta toda la noche da ocho horas de trabajo.
 */
test("con la pantalla oculta no suma nada", () => {
  const r = sumarAlLatido({
    acumulado: 100,
    segundosDesdeElUltimo: 600,
    pantallaVisible: false,
    huboInteraccion: true,
  });
  assert.equal(r, 100);
});

test("sin interacción tampoco suma, aunque la pantalla esté a la vista", () => {
  const r = sumarAlLatido({
    acumulado: 100,
    segundosDesdeElUltimo: 40,
    pantallaVisible: true,
    huboInteraccion: false,
  });
  assert.equal(r, 100);
});

/** Un salto largo es alguien que volvió, no alguien que trabajó todo ese rato. */
test("un hueco mayor al umbral se recorta al umbral", () => {
  const r = sumarAlLatido({
    acumulado: 100,
    segundosDesdeElUltimo: 3600,
    pantallaVisible: true,
    huboInteraccion: true,
  });
  assert.equal(r, 100 + UMBRAL_DE_INACTIVIDAD_SEGUNDOS);
});

test("el umbral de inactividad es el que trae el modelo", () => {
  assert.equal(UMBRAL_DE_INACTIVIDAD_SEGUNDOS, 75);
});

test("un tiempo negativo entre latidos no descuenta lo acumulado", () => {
  const r = sumarAlLatido({
    acumulado: 100,
    segundosDesdeElUltimo: -30,
    pantallaVisible: true,
    huboInteraccion: true,
  });
  assert.equal(r, 100);
});
