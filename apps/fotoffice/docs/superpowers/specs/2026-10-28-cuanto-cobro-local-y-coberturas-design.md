# ¿Cuánto Cobro?: el local se paga solo y las coberturas pagan tu vida — diseño

Fecha: 28/10/2026 · Pedido de Daniel Cuart (DNX Estudio) · Estado: borrador para aprobar

Se apoya en «Mi estudio» (`2026-10-15-mi-estudio-costos-design.md`, en producción desde el 16/10) y
completa la etapa que ese diseño dejó para después: «lo que dejan otras líneas» medido con Caja (§11
de ese documento).

## 1. Para qué

Daniel sentía que los presupuestos de eventos sociales salían mucho más caros que lo que siempre
cobró. Tenía razón. Hoy «Mi estudio» junta en **una sola bolsa** todo lo que el estudio necesita por
mes (alquiler, servicios, publicidad, sueldos de Sabina y Camila, el retiro de Daniel) y la reparte
entre todas las horas vendibles, incluidas las de las chicas del mostrador. Lo que vende el local
(impresiones, carnets, productos) **no resta nada**: el campo «Lo que dejan otras líneas» se carga a
mano y nadie sabe qué poner.

Daniel lo ve como **dos negocios**:

- **El local** (mostrador, impresiones, productos, fotos carnet) tiene que pagar sus propios gastos:
  alquiler, servicios, Sabina y Camila **y un sueldo de $1.000.000 para Daniel** por el 20 % de su
  tiempo que le dedica.
- **Las coberturas** (eventos y sesiones) tienen que pagar **el resto de lo que Daniel necesita
  para vivir**: sus gastos personales menos ese sueldo del local y menos sus otros ingresos.

**Éxito:** el precio de un evento sale de lo que Daniel necesita para vivir dividido por los eventos
que realmente hace, sin cargar al cliente de un XV con el alquiler del local. Y Daniel ve, mes a mes,
si el local se paga solo o no.

## 2. Datos reales de Daniel (perfil `cmv5z6qxwwmmhf0q5gp8qja1j`, 28/10/2026)

Corregidos hoy con su OK: días por semana del dueño 1 → **5** (×9,6 h), parte cobrable del dueño
**50 %** (= 4 eventos de 26 h por mes), sueldos de Sabina y Camila $90.000 → **$900.000**. Copia del
perfil anterior guardada fuera del repo.

| Concepto | Por mes |
|---|---|
| Gastos personales de Daniel (100 % suyos, confirmado) | $3.168.000 |
| Sueldo que le paga el local | $1.000.000 |
| Otros ingresos (`externalMonthlyIncome`) | $200.000 |
| Renovación de equipo + fondo de emergencia | $91.667 |
| Gastos fijos del local (alquiler 450.000, servicios 385.000, software 30.000, publicidad 100.000) | $965.000 |
| Sabina + Camila (900.000 × 13/12 c/u) | $1.950.000 |
| Eventos por mes | 3 a 4 (se calcula con **4**) |
| Horas de una sesión PRE XV con fiesta | 26 (11 cobertura, 11 edición, 2 presupuesto y entrevistas, 1 viaje, 1 entrega) |

**Resultado esperado con este diseño** (simulado con el motor real de `origin/main`):

| | Hoy en producción | Con este diseño |
|---|---|---|
| Necesidad que pagan los eventos | (todo mezclado) $4.006.667 | **$2.163.667** = 3.168.000 − 1.000.000 − 200.000 + 91.667 + 104.000 compartidos |
| Hora de Daniel (4 eventos, 50 % cobrable) | $13.759 | **$20.821** |
| Sesión PRE XV con fiesta, 26 h | $452.740 | **$650.466** |
| Lo que tiene que dejar el local | — | **≈ $3.811.000** = 861.000 (fijos del local + 20 % de compartidos) + 1.950.000 + 1.000.000 |

El precio sube respecto a hoy porque hoy el sistema sólo toma $1.000.000 como necesidad de Daniel
(el retiro) cuando en realidad necesita $3.168.000. Baja muchísimo respecto de lo que se envió en el
presupuesto 0002 ($1.028.237 por 22 h), que estaba inflado por el error de 1 día por semana.

## 3. Objetivos, no-objetivos y lo que no puede pasar

**Objetivos**
1. Dentro de «Mi estudio», un modo **«Separar el local de las coberturas»**.
2. Cada gasto fijo y cada persona del equipo se marca como **del local**, **de las coberturas** o
   **compartido**.
3. **Cuenta del local**: lo que gasta (incluido el sueldo del dueño) contra lo que deja.
4. **Cuenta de las coberturas**: gastos personales del dueño − sueldo del local − otros ingresos +
   reservas de equipo + su parte de lo compartido + ganancia deseada, ÷ horas vendibles del dueño.
5. Lo que deja el local se **mide con Caja** cuando hay datos; mientras tanto se estima.
6. Un **semáforo mensual** del local: «se pagó solo y sobraron $X» / «le faltaron $X».

**No-objetivos**
- No cambia los precios de lista de los productos ni el catálogo.
- No recalcula solos los presupuestos ya enviados (siguen con su instantánea, como hoy).
- No toca cómo se cargan los movimientos de Caja.
- No es contabilidad: el semáforo es una guía para decidir precios, no un balance.

**Lo que no puede pasar (anti-objetivos)**
- Que el precio de un evento vuelva a cargar en silencio el alquiler o los sueldos del local.
- Que la cuenta de las coberturas tome sólo el retiro y deje afuera gastos personales reales.
- Que un perfil que no enciende el modo nuevo cambie de precio.

## 4. Cómo funciona (decidido con Daniel)

### 4.1 El modo
- Interruptor nuevo en «Mi estudio»: **«Separar el local de las coberturas»**. Apagado = todo como
  hoy (mismos números, sin excepción).
- Al encenderlo, el sistema propone la clasificación y Daniel la corrige.

### 4.2 A quién pertenece cada cosa
- **Gastos fijos**: cada renglón lleva `scope`: `local` | `coverage` | `shared`. Propuesta inicial:
  Local, Servicios, Seguros del local, Mantenimiento → `local`; Software, Publicidad,
  Administración → `shared`; Otros → `local`.
- **Compartidos**: se reparten con un porcentaje único del estudio, **`coverageSharePercent`**, que
  por defecto es la parte del tiempo del dueño que va a coberturas (Daniel: **80 %**). Se puede
  cambiar.
- **Personas del equipo**: cada una lleva `scope`: `local` | `coverage`. Sabina y Camila → `local`.
  Una persona `local` **no suma horas vendibles a las coberturas** ni recargo. Si alguna vez se la
  asigna a un evento, sus horas se cobran a su **costo por hora** sin recargo de estructura.
- **El dueño**: **`ownerLocalTimePercent`** (Daniel: 20 %) es el tiempo que le da al local. Sirve
  para el valor por defecto de `coverageSharePercent` y como tope: la «parte cobrable» del dueño
  **se aplica sobre sus horas totales** (como hoy) y no puede superar 100 − `ownerLocalTimePercent`.
  Daniel: 5 × 9,6 × 4,33 × 50 % ≈ 104 h = 4 eventos de 26 h. Las horas del local no restan de ahí:
  la parte cobrable ya es «las horas que de verdad le vendés a clientes de coberturas».

### 4.3 Cuenta de las coberturas (la que define el precio)
```
necesidadPersonal   = suma de personalExpenseGroups del perfil   (Daniel: 3.168.000)
sueldoDelLocal      = ownerLocalSalaryMonthly                    (Daniel: 1.000.000)
otrosIngresos       = externalMonthlyIncome                      (Daniel: 200.000)
compartidos         = Σ fijos shared × coverageSharePercent
fijosCobertura      = Σ fijos coverage
equipoCobertura     = Σ costoMes de personas coverage
reservas            = renovación + expansión + fondo de emergencia (como hoy)
base                = max(0, necesidadPersonal − sueldoDelLocal − otrosIngresos)
                      + compartidos + fijosCobertura + equipoCobertura + reservas
                      + fijosDeImpuestos (pricingExtras, como hoy)
ganancia            = como hoy (monto fijo | % sobre base)
necesidad           = max(0, base + ganancia)
capacidad           = horas vendibles del dueño en coberturas + las de personas coverage
tarifa del dueño    = necesidad repartida igual que hoy (costo propio + estructura por hora)
```
En este modo **el retiro (`ownerDrawMonthly`) deja de usarse**: lo reemplazan la necesidad personal
y el sueldo del local. **El costo propio del dueño** (para su tarifa por persona) es la necesidad
personal neta, `max(0, necesidadPersonal − sueldoDelLocal − otrosIngresos)`, más sus insumos: ocupa
el lugar que hoy tiene el retiro, y se mantiene la propiedad Σ tarifa × horas = necesidad.
`otrosIngresos` respeta el interruptor actual (`livesOnlyFromPhotography === "no"`).
`otherLinesMonthlyContribution` se ignora en modo separado (lo reemplaza la cuenta del local).
El posicionamiento comercial («Estoy creciendo» +10 %) se aplica como hoy.

### 4.4 Cuenta del local (no toca precios: informa)
```
gastosLocal = Σ fijos local + Σ fijos shared × (1 − coverageSharePercent)
            + Σ costoMes de personas local + ownerLocalSalaryMonthly
dejaLocal   = ventas del local − costo de mercadería       (ver §4.6)
resultado   = dejaLocal − gastosLocal                       (+ sobra / − falta)
```

### 4.5 Cuando el local no se paga solo o le sobra
**Decidido por Daniel (28/10): sólo avisar, en los dos sentidos.** Lo que pase en el local nunca
cambia el precio de los eventos: si le falta, el semáforo lo muestra en rojo con el monto; si le
sobra, lo muestra en verde con el monto. La cuenta de las coberturas no tiene ningún término del local y no hay opción para
cambiarlo.

### 4.6 Lo que deja el local
- **Con Caja**: ingresos de las categorías de Caja asociadas a las líneas que «no venden horas»
  (`businessLines[].cashCategoryIds`, campo que ya existe) en los **últimos meses completos** (hasta
  3). Se guarda **cada mes por separado** y el promedio. El semáforo muestra el último mes completo
  y los anteriores; el promedio es el que se usa si algún día el local afecta precios (§4.5).
- **Asociar categorías a líneas entra en este trabajo**: en el paso «Local y coberturas», cada línea
  que no vende horas tiene un selector múltiple de categorías de INGRESO de Caja. Propuesta inicial:
  «Ventas» → «Productos e impresiones». Sin esto el estado «medido» nunca se activaría.
- **Costo de mercadería**: `localGoodsCostPercent` (lo carga Daniel una vez, p. ej. 40 %). Más
  adelante se puede reemplazar por el costo del catálogo; no en este diseño.
- **Mientras no haya 2 meses completos en Caja**: se usa un monto a mano
  (`localMonthlyContributionManual`) y el semáforo dice **«estimado»**. Si tampoco hay monto a mano,
  el semáforo dice «sin datos todavía» y no muestra resultado.
- El motor sigue **puro**: nunca lee Caja. La app calcula el promedio y lo pasa en el perfil
  (como pensaba `cashSync`).
- Hoy DNX Estudio tiene **9 días** de Caja (19–27/10): ≈ $1.130.000 en «Ventas» y ≈ $785.000 en
  «sin categoría» u «Otros ingresos». Hay que asociar categorías a líneas para medir bien.

## 5. Pantallas

- **Configuración → Precios → Mi estudio**: interruptor del §4.1 y un paso nuevo **«Local y
  coberturas»** con: clasificación de gastos y personas (un selector de tres opciones por renglón),
  % compartido, tu tiempo en el local, tu sueldo del local, costo de mercadería, monto estimado del
  local.
- **Resumen** (donde hoy se ve la necesidad del estudio): dos recuadros lado a lado,
  **«Tus coberturas»** (necesidad, horas, tu hora) y **«El local»** (gastos, lo que deja, semáforo).
- **Presupuesto**: sin cambios visibles; usa la tarifa nueva. La instantánea del cálculo guarda
  además `modo: "separado"` para saber con qué criterio se cotizó.
- **DNX Bot** (guía de perfil y motor de trabajo): en modo separado pregunta en este orden: gastos
  personales, sueldo que te paga el local, tiempo en el local, cuántos eventos hacés por mes. Nunca
  pregunta ni dice los gastos personales a clientes.

## 6. Datos

Todo dentro de `studioStructure` (JSON del perfil), **sin migración**, como «Mi estudio»:
```ts
separateLocal?: boolean;                 // el interruptor
coverageSharePercent?: string;           // compartidos que van a coberturas (default = 100 − ownerLocalTimePercent)
ownerLocalTimePercent?: string;          // tiempo del dueño en el local
ownerLocalSalaryMonthly?: string;        // sueldo que le paga el local
localGoodsCostPercent?: string;          // costo de mercadería sobre ventas del local
localMonthlyContributionManual?: string; // estimado a mano
localCashSummary?: {                     // lo pone la app; el motor sólo lo lee
  months: { month: string /* AAAA-MM */; sales: number }[]; // hasta 3 meses completos
  salesMonthlyAverage: number;
  computedAt: string;
} | null;
// en StudioFixedCostItem y StudioPerson:
scope?: "local" | "coverage" | "shared"; // personas: sólo local | coverage
```
`normalizeStudioStructure` completa los valores por defecto. Perfiles sin `separateLocal` quedan
idénticos.

## 7. Pruebas que tienen que existir

- **Caracterización**: perfil de Daniel del §2 → hora del dueño **$20.821** y sesión PRE XV de 26 h
  **$650.466** (con los $50.000 de gastos directos y +10 %).
- **Modo apagado**: todos los fixtures actuales de «Mi estudio» dan exactamente lo mismo.
- **Propiedad**: Σ tarifa × horas vendibles de coberturas = necesidad de coberturas.
- **Nada del local en el precio**: cambiar el alquiler o un sueldo `local` no cambia la hora del
  dueño.
- **Semáforo**: «sin datos», «estimado» (manual o < 2 meses) y «medido» (≥ 2 meses de Caja).

## 8. Pendiente de Daniel

Nada. (Resuelto el 28/10: el local sólo avisa, ver §4.5.)

## 9. Decisiones que tomé yo (Claude), corregibles

- Compartidos al 80 % para coberturas (= el tiempo de Daniel en eventos).
- Clasificación inicial de gastos del §4.2.
- Medir el local con hasta 3 meses completos de Caja; «estimado» por debajo de 2.
- Sueldo del local con un número fijo, no un %.
- El retiro (`ownerDrawMonthly`) no se usa en modo separado.
- Parte cobrable sobre las horas totales del dueño, con tope 100 − tiempo en el local.
- Costo propio del dueño = necesidad personal neta + insumos.
- En modo separado los gastos personales se editan dentro del paso «Local y coberturas» (se reusa
  el componente del paso personal) y son **obligatorios**: sin ellos no hay cálculo.
- La pantalla para asociar categorías de Caja a líneas entra en este trabajo.
- El semáforo muestra mes por mes (hasta 3) además del promedio.
- Prueba de caracterización: un concepto `own-service` con 11 h cobertura, 11 h edición, 2 h
  `salesHours`, 1 h viaje, 1 h entrega, `directCost` 50.000, asignado al dueño, posicionamiento
  «Estoy creciendo». Si da 27 h, es el doble conteo del §10 y se corrige antes.

## 10. Para revisar al programar

- Al simular, una hora de entrega cargada a la vez en `deliveryHours` y en una asignación pareció
  contar doble (27 h en vez de 26). Puede haber sido la forma en que armé la prueba (incluía una
  asignación con actividad `sales`, que no existe). Verificar con una prueba y corregir si es real.
- El diseño del bot «Presupuesto por horas» (`2026-10-28-presupuesto-por-horas-design.md`) usa
  «la hora de Daniel que calcula ¿Cuánto cobro?» para el segundo fotógrafo (30 %). Con este diseño
  esa hora pasa a ser la de coberturas; no hay que cambiar nada allá, pero el número sube.

## 11. Lo que queda a criterio de quien programe

Nombres internos, orden de los PR, textos de ayuda, diseño visual del semáforo dentro del estilo
de FOTOFFICE, y cómo la app arma el promedio de Caja (consulta y caché).
