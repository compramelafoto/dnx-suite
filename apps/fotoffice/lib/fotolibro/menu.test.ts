import { describe, expect, it } from "vitest";
import { resolvePortalMenu } from "@/lib/portal/menu";
import { getModuleDefinition } from "@/lib/modules/registry";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { FOTOLIBROS_SOCIO_MODULE_KEY, RUTA_FOTOLIBROS_SOCIO } from "./constantes";

const seccion = (enabled: string[]) => resolvePortalMenu(new Set(enabled)).find((s) => s.href === RUTA_FOTOLIBROS_SOCIO);

describe("Mis fotolibros en el portal", () => {
  it("está disponible sólo con el interruptor de la institución encendido", () => {
    expect(seccion([MEMBERS_MODULE_KEY])?.state).toBe("PROXIMAMENTE");
    expect(seccion([MEMBERS_MODULE_KEY, FOTOLIBROS_SOCIO_MODULE_KEY])?.state).toBe("DISPONIBLE");
  });

  it("es de la familia institución y la institución no tiene pantalla para mirarlos", () => {
    const m = getModuleDefinition(FOTOLIBROS_SOCIO_MODULE_KEY)!;
    expect(m.family).toBe("institucion");
    expect(m.route).toBeUndefined();
    expect(m.dependsOn).toEqual([MEMBERS_MODULE_KEY]);
  });
});
