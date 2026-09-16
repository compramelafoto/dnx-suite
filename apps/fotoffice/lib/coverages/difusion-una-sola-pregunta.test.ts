import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * El permiso de difusión se pregunta una sola vez.
 *
 * `showcaseScope` ("¿nos autorizan a compartir material del evento?", con cuatro niveles) y el
 * tilde de `USO_INSTITUCIONAL` ("autorizo a mostrar imágenes de este trabajo") son la misma
 * pregunta. Preguntar las dos no es sólo redundante: habilita que las respuestas se
 * contradigan, y entonces nadie sabe qué autorizó la organización.
 *
 * La regla vive en dos lugares que tienen que estar de acuerdo —la pantalla decide si dibuja el
 * tilde, la acción decide qué se guarda— y el acuerdo no se puede verificar renderizando. Se
 * verifica sobre el código, igual que hace `aislamiento.test.ts` con el `workspaceId`: si
 * alguien saca el filtro de la pantalla, el formulario vuelve a preguntar dos veces lo mismo y
 * ningún otro test se entera.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const fuente = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

const PANTALLA = "app/w/[workspaceSlug]/coberturas/solicitar/page.tsx";
const ACCION = "app/actions/coverage-request.ts";

describe("el permiso de difusión, cuando se pregunta el alcance", () => {
  it("la pantalla saca el tilde de la lista de permisos", () => {
    const src = fuente(PANTALLA);
    expect(src).toContain('isRequestFieldVisible("showcaseScope"');
    expect(src).toContain("DERIVED_SHOWCASE_CONSENT");
  });

  it("la acción deduce el permiso de la respuesta, no del `FormData`", () => {
    const src = fuente(ACCION);
    expect(src).toContain('isRequestFieldVisible("showcaseScope"');
    expect(src).toContain("deriveShowcaseConsent(parsed.data.showcaseScope)");
  });

  it("la acción decide con la configuración del servidor, no con lo que mandó la pestaña", () => {
    // `campos` sale de `loadSettings`, que se lee antes de parsear. Si la decisión se tomara
    // con algo del formulario, esconder el campo dejaría de significar algo.
    const src = fuente(ACCION);
    const configuracion = src.indexOf("const settings = await loadSettings(");
    const decision = src.indexOf('isRequestFieldVisible("showcaseScope"');
    expect(configuracion).toBeGreaterThan(-1);
    expect(decision).toBeGreaterThan(configuracion);
  });
});
