import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * El candado que impide llenar dos veces la misma vacante, verificado sobre el código fuente.
 *
 * Dos coordinadores apretando «Sumar al equipo» en el mismo instante no se puede reproducir en
 * un test: haría falta una base de verdad y dos conexiones simultáneas, y aun así el resultado
 * dependería de qué tan rápido corre cada una. Lo que sí se puede verificar —y es lo que de
 * verdad se rompe— es que la línea del candado siga estando y siga estando ANTES del recuento.
 *
 * Es el tipo de línea que alguien borra por parecer inútil: lee una fila y tira el resultado. El
 * proyecto ya usa esta clase de barrera sobre el fuente en otros tres lugares (ver
 * `lib/coverages/aislamiento.test.ts` y `lib/coverages/emails.test.ts`).
 */
describe("el candado del rol sigue en su lugar", () => {
  const fuente = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "actions.ts"),
    "utf8",
  );

  it("existe una función que toma el candado sobre la fila del rol", () => {
    expect(fuente).toMatch(/FOR UPDATE/);
    expect(fuente).toMatch(/SELECT id FROM "CoverageRole" WHERE id = \$\{roleId\} FOR UPDATE/);
  });

  it("las dos acciones de armar equipo lo toman", () => {
    // Dos llamadas, una por acción. Si alguien agrega una tercera forma de asignar gente y no la
    // bloquea, este número deja de coincidir y el test lo dice.
    const llamadas = fuente.match(/await bloquearRol\(tx, /g) ?? [];
    expect(llamadas).toHaveLength(2);
  });

  it("en las dos, el candado va antes del recuento de asignaciones vivas", () => {
    // Tomarlo después de contar no sirve de nada: lo que hay que serializar es justamente el
    // recuento, no la escritura.
    const candados = [...fuente.matchAll(/await bloquearRol\(tx, /g)].map((m) => m.index!);
    const recuentos = [...fuente.matchAll(/await contarAsignadasVivas\(tx, /g)].map(
      (m) => m.index!,
    );
    expect(recuentos).toHaveLength(2);
    for (const recuento of recuentos) {
      const candadoPrevio = candados.filter((c) => c < recuento).pop();
      expect(candadoPrevio).toBeDefined();
    }
    // Y ninguno de los dos recuentos se queda sin su propio candado: el primer candado no puede
    // estar cubriendo a los dos.
    expect(candados.filter((c) => c < recuentos[1]!)).toHaveLength(2);
  });

  it("está explicado por qué está, para que nadie lo borre por parecer inútil", () => {
    expect(fuente).toMatch(/NO BORRAR/);
  });
});
