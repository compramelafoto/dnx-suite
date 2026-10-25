import { describe, expect, it } from "vitest";
import { resolvePortalMenu } from "@/lib/portal/menu";
import { getModuleDefinition, listAvailableModuleKeys } from "@/lib/modules/registry";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { CUANTO_COBRO_SOCIO_MODULE_KEY, RUTA_CUANTO_COBRO_SOCIO } from "./constants";

const seccion = (enabled: string[]) => resolvePortalMenu(new Set(enabled)).find((s) => s.href === RUTA_CUANTO_COBRO_SOCIO);

describe("¿Cuánto Cobro? en el menú del portal", () => {
  it("está disponible sólo con el interruptor de la institución encendido", () => {
    expect(seccion([MEMBERS_MODULE_KEY])?.state).toBe("PROXIMAMENTE");
    expect(seccion([MEMBERS_MODULE_KEY, CUANTO_COBRO_SOCIO_MODULE_KEY])?.state).toBe("DISPONIBLE");
  });

  it("es un módulo real del catálogo, de la familia institución, sin pantalla en el panel", () => {
    expect(listAvailableModuleKeys()).toContain(CUANTO_COBRO_SOCIO_MODULE_KEY);
    const m = getModuleDefinition(CUANTO_COBRO_SOCIO_MODULE_KEY)!;
    expect(m.family).toBe("institucion");
    // La institución no tiene nada que mirar: lo que carga el socio es suyo.
    expect(m.route).toBeUndefined();
    expect(m.dependsOn).toEqual([MEMBERS_MODULE_KEY]);
  });
});
