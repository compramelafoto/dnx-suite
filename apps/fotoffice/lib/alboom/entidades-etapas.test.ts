import { describe, expect, it } from "vitest";
import { entidadPorClave } from "./entidades";

describe("etapas de embudos y flujos (extracción)", () => {
  it("cada etapa lleva el id de su embudo/flujo (la forma real de Alboom no lo trae: está en la clave de `stages`)", () => {
    const respuesta = {
      stage_list: [{ id: "1611", name: "Embudo de Ventas DNX 2022" }],
      stages: {
        "1611": [
          { id: "1633", name: "Recepción de la oportunidnad", stage: "1", tasks: null, offset_days: "2" },
          { id: "1634", name: "WSP", stage: "2", tasks: null, offset_days: "1", type_id: "1611" },
        ],
        "1700": [{ id: "1640", name: "Inscripción", stage: "1", tasks: null, offset_days: "0" }],
      },
    };
    for (const clave of ["etapas_embudo", "etapas_flujo"]) {
      const e = entidadPorClave(clave)!;
      expect(e.version).toBe(2);
      if (e.fuente.tipo !== "simple") throw new Error("forma");
      expect(e.fuente.filas(respuesta)).toEqual([
        { id: "1633", name: "Recepción de la oportunidnad", stage: "1", tasks: null, offset_days: "2", type_id: "1611" },
        { id: "1634", name: "WSP", stage: "2", tasks: null, offset_days: "1", type_id: "1611" },
        { id: "1640", name: "Inscripción", stage: "1", tasks: null, offset_days: "0", type_id: "1700" },
      ]);
    }
  });
});
