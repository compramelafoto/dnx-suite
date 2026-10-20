import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { armarResultados } from "@/lib/informes/resultados";
import { periodoInforme } from "@/lib/informes/periodos";
import { MatrizResultadosTabla } from "./matriz-resultados";
import { Semaforo } from "./semaforo";
import { FiltroPeriodo } from "./filtro-periodo";
import { TablaDetalle } from "./tabla-detalle";

const matriz = armarResultados({
  meses: ["2026-09", "2026-10"],
  rubros: [
    { id: "p", nombre: "Ventas", codigo: "3.1", parentId: null, activo: true },
    { id: "h", nombre: "Bodas", codigo: "3.1.1", parentId: "p", activo: true },
    { id: "v", nombre: "Viejo", codigo: "3.9", parentId: null, activo: false },
    { id: "c", nombre: "Insumos", codigo: "4.1", parentId: null, activo: true },
  ],
  asientos: [
    { mes: "2026-10", categoryId: "h", kind: "INGRESO", centavos: 100000, signo: 1 },
    { mes: "2026-10", categoryId: "v", kind: "INGRESO", centavos: 5000, signo: 1 },
    { mes: "2026-10", categoryId: "c", kind: "EGRESO", centavos: 300000, signo: 1 },
    { mes: "2026-09", categoryId: null, kind: "EGRESO", centavos: 1000, signo: 1 },
  ],
});

describe("MatrizResultadosTabla", () => {
  const html = renderToStaticMarkup(<MatrizResultadosTabla matriz={matriz} base="caja" periodo="ultimos-3" />);

  it("muestra bloques, subtotal del padre, hijo, inactivo y 'Sin clasificar'", () => {
    expect(html).toContain("Ingresos");
    expect(html).toContain("3.1 Ventas");
    expect(html).toContain("subtotal");
    expect(html).toContain("3.1.1 Bodas");
    expect(html).toContain("inactivo");
    expect(html).toContain("Sin clasificar (egresos)");
    expect(html).toContain("Sin rubro");
  });

  it("el resultado negativo va en rojo y los importes distintos de cero enlazan a su desglose", () => {
    expect(html).toContain("text-[var(--fo-danger)]");
    expect(html).toContain("-$ 1.960,00");
    expect(html).toContain('href="/informes/resultados/detalle?base=caja&amp;periodo=ultimos-3&amp;bloque=INGRESOS&amp;rubro=p&amp;hijos=1&amp;mes=2026-10"');
    expect(html).toContain("rubro=sin");
    // Los ceros no son enlaces.
    expect(html).toContain("–");
  });
});

describe("Semaforo", () => {
  it("cada estado dice su texto (no depende sólo del color)", () => {
    expect(renderToStaticMarkup(<Semaforo estado="VERDE" />)).toContain("En orden");
    expect(renderToStaticMarkup(<Semaforo estado="AMARILLO" />)).toContain("Cerca del tope");
    expect(renderToStaticMarkup(<Semaforo estado="ROJO" />)).toContain("Tope alcanzado");
    expect(renderToStaticMarkup(<Semaforo estado="SIN_CONFIGURAR" />)).toContain("Sin configurar");
  });
});

describe("FiltroPeriodo", () => {
  it("atajos como enlaces conservando la vista y 'Otro rango' como formulario GET con meses", () => {
    const html = renderToStaticMarkup(<FiltroPeriodo accion="/informes/resultados" periodo={periodoInforme({ periodo: "ultimos-6", hoy: "2026-10-09" })} extra={{ base: "devengado" }} />);
    expect(html).toContain("Este mes");
    expect(html).toContain("periodo=ultimos-6");
    expect(html).toContain("base=devengado");
    expect(html).toContain('name="desde"');
    expect(html).toContain('type="month"');
    expect(html).toContain('method="GET"');
    expect(html).toContain('value="2026-05"');
  });
});

describe("TablaDetalle", () => {
  it("fecha DD/MM/AAAA, importes con formato, negativos en rojo y total", () => {
    const html = renderToStaticMarkup(
      <TablaDetalle
        cantidad={2}
        total={4000}
        truncado={false}
        filas={[
          { clave: "a", fecha: "2026-10-05", origen: "Pedido P-1", contacto: "Ana", descripcion: "Boda", centavos: 5000, href: "/pedidos/p1" },
          { clave: "b", fecha: "2026-10-06", origen: "Anulación", contacto: null, descripcion: "", centavos: -1000, href: null },
        ]}
      />,
    );
    expect(html).toContain("05/10/2026");
    expect(html).toContain("$ 50,00");
    expect(html).toContain("-$ 10,00");
    expect(html).toContain('href="/pedidos/p1"');
    expect(html).toContain("Total (2 renglones)");
    expect(html).not.toContain("Mostramos los primeros");
  });
});
