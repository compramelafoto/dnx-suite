# Costos de Vercel: dónde se va la plata

Diagnóstico del 2026-09-11, con la cuenta en mora por USD 175,57.

## El hallazgo

De la factura de septiembre (`RXXM3O0P-0009`, emitida el 2/9):

| Concepto | Costo | Parte |
|---|---:|---:|
| **Build CPU Minutes** | **USD 119,49** | **68 %** |
| Fluid Active CPU | 31,58 | 18 % |
| Fast Origin Transfer | 10,18 | 6 % |
| Fluid Provisioned Memory | 8,67 | 5 % |
| Function Invocations (4,77 M) | 2,86 | 2 % |
| Resto | ~2,79 | 1 % |
| **Edge Requests (5,02 M)** | **0,00** | — |

**No se paga por usar las aplicaciones: se paga por compilarlas.** Cinco millones de
pedidos costaron cero; los minutos de compilación, ciento veinte dólares.

## Por qué

Los siete proyectos apuntan al mismo repositorio. Hasta hoy, **cada push compilaba todos**,
aunque el cambio tocara una sola aplicación. Medido sobre los deploys reales desde el 2 de
septiembre (623 deploys en nueve días):

| Proyecto | Compilaciones | Minutos |
|---|---:|---:|
| fotoffice-dnxsuite | 109 | 235 |
| compramelafoto-dnxsuite | 103 | 481 |
| clickaton-dnxsuite | 101 | 177 |
| **clickaton-staging** | **100** | **378** |
| infospot-dnxsuite | 100 | 106 |
| fotorank-dnxsuite | 100 | 273 |
| subilafoto-dnxsuite | 9 | 8 |
| | | **1.663 min** |

Cien pushes producían seiscientas compilaciones. Y `clickaton-staging` —un entorno que no
se usa— era el **23 %** del tiempo total.

## Lo que se hizo

**1. Compilación condicional en los seis proyectos activos.** Cada uno lleva ahora
`npx turbo-ignore <paquete>` como "Ignored Build Step": Turborepo mira el grafo de
dependencias y cancela la compilación si ese paquete y los que usa no cambiaron.

- Si `packages/db` cambia, compilan todas — correcto, todas dependen de él.
- Si sólo cambia `apps/fotoffice`, compila una sola.
- Si `turbo-ignore` falla por lo que sea, Vercel compila igual. Falla del lado seguro.

**2. `clickaton-staging` pausado, no borrado.** Deja de compilar, pero **conserva sus 78
variables de entorno**. Eliminarlo las perdía, y entre ellas hay configuración de pruebas
de Mercado Pago que costaría reconstruir. Se reactiva desde el panel cuando haga falta.

## Lo que queda por decidir

**Proyectos abandonados.** Hay seis sin dominios propios y con el último despliegue en
error: `compramelafoto`, `clickaton`, `fotorank`, `fotorank-sfef-visual-hotfix`,
`dnx-suite-fotorank-public-inscription-01` y `e2e`. **No cuestan nada** —no compilan— pero
ensucian el panel. Borrarlos es ordenar, no ahorrar, y es irreversible.

**Bases Neon de staging.** `dnx-suite-staging` figura con unas 242 horas de cómputo activo,
comparable con bases de producción. Conviene averiguar qué la mantiene despierta antes de
tocarla: puede ser tráfico legítimo de pruebas o algo apuntando donde no debería.

## Lo que hay que vigilar

El ahorro se ve recién en la factura del 2 de octubre. Vale la pena mirar entonces si los
Build CPU Minutes bajaron de verdad, y no darlo por hecho.

Y una advertencia de calendario: **la próxima factura llega el 2 de octubre, ocho días
antes del lanzamiento de Subí la Foto.** Con la cuenta ya en mora, una suspensión en esa
ventana se lleva puestas las seis aplicaciones y el lanzamiento.
