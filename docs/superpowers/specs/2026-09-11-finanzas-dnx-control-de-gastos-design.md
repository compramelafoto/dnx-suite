# Finanzas DNX — control de gastos e ingresos por plataforma

**Fecha:** 2026-09-11
**App:** `compramelafoto` (panel admin, ruta `/admin/finanzas-dnx`)
**Paquete nuevo:** `@repo/finance-control` (lógica pura, sin Prisma)
**Bases que lee:** las 4 conexiones de producción de la suite (solo lectura)
**Base que escribe:** únicamente `compramelafoto` / rama `production`

---

## 1. Objetivo

Saber, mes a mes y desde enero 2026, **cuánto dinero sale** para sostener DNX Suite,
**cuánto entra** por cada plataforma, y **qué plataforma deja ganancia y cuál deja
pérdida**.

El módulo tiene que poder responder tres preguntas concretas:

1. ¿Cuánto me costó este mes tener la suite en pie, en pesos reales?
2. ¿En qué servicio se me está yendo el dinero?
3. ¿Cuál de mis cinco plataformas se paga sola y cuál la estoy subsidiando?

## 2. La pieza que hace que la pregunta 3 tenga respuesta

Un gasto **no pertenece a una plataforma**. Vercel es una sola factura que sostiene cinco
aplicaciones. Neon es una sola cuenta con seis proyectos. Si solo cargamos facturas,
sabemos cuánto gastamos en total pero **nunca** cuánto cuesta FotoRank.

Por eso el modelo tiene un **reparto**: cada gasto se asigna en porcentajes a las
plataformas.

```
Vercel  USD 20  →  CLF 50%  ·  Fotoffice 20%  ·  FotoRank 15%
                   Clickatón 10%  ·  InfoSpot 5%
```

El reparto se define **una vez por proveedor** y se hereda solo todos los meses; se puede
corregir mes por mes cuando cambia la realidad. Los repartos de un gasto deben sumar
exactamente 100%.

### Cuando el reparto se puede medir, se mide

Para la mayoría de los proveedores el reparto es una estimación del dueño. Para **Neon no
hace falta estimar**: la API expone el consumo acumulado por proyecto (`cpu_used_sec`), y
comparando dos lecturas separadas en el tiempo se obtiene el consumo real de cada
plataforma. La medición del 2026-09-11 dio esto:

| Proyecto | CU continuas | % del gasto de cómputo |
|---|---:|---:|
| clickaton-production | 1,517 | 44,5% |
| compramelafoto | 1,089 | 31,9% |
| infospot-production | 0,586 | 17,2% |
| dnx-suite-staging | 0,218 | 6,4% |

Un reparto medido vale mucho más que uno inventado, porque responde la pregunta del dueño
sin discusión: Clickatón costaba más que CompraMeLaFoto y nadie lo hubiera adivinado.

Por eso el modelo admite dos orígenes de reparto —`MANUAL` y `MEDIDO`— y la pantalla
distingue cuáles son estimaciones y cuáles no. Medir Neon queda en la etapa 4; el resto
sigue siendo manual.

Existe además una plataforma especial `suite` para el gasto que de verdad no es atribuible
a ningún producto (contador, dominio corporativo, herramientas internas). No se reparte a
la fuerza: se muestra aparte como **costo de estructura**.

## 3. Lo que el módulo NO hace, y por qué

**No baja las facturas solo.** Vercel, Cloudflare, Resend y Mercado Pago no exponen
importes de facturación por API para una cuenta self-serve. El `VERCEL_TOKEN` y el
`CLOUDFLARE_API_TOKEN` que ya existen en `services/dnx-mcp/.env.local` sirven para
deploys y estado, no para leer facturas.

Por lo tanto **la carga de gastos es manual o por importación**, y está diseñada para que
eso no duela:

- botón **"copiar del mes anterior"**, que trae todos los proveedores con sus importes y
  repartos del mes previo para que solo corrijas lo que cambió;
- importación de CSV cuando el proveedor lo ofrece;
- el consumo de Neon sí se puede traer por API (`/consumption_history`) y queda como
  mejora posterior, no como requisito.

Esto se escribe acá para que nadie lo lea después como una falla: es una limitación de los
proveedores, no del diseño.

## 4. Restricciones estructurales

**La infraestructura real son 6 proyectos Neon, no 5 bases.** Organización `Dnx`, plan
*launch*:

| Proyecto Neon | Rama | Qué vive ahí |
|---|---|---|
| `compramelafoto` (`divine-hall-10689679`) | `production` | CompraMeLaFoto |
| `compramelafoto` (`divine-hall-10689679`) | `development` | FOTOFFICE y FotoRank |
| `clickaton-production` (`bitter-math-56019731`) | default | Clickatón |
| `infospot-production` (`wandering-pine-79918137`) | default | InfoSpot |
| `compramelafoto-staging`, `clickaton-staging`, `dnx-suite-staging` | — | pruebas: **gasto sin ingreso** |

Consecuencias directas:

- **No alcanza con un cliente Prisma.** Cada plataforma necesita su propia cadena de
  conexión. El informe diario actual usa un único cliente `prisma` para los siete
  colectores (`apps/compramelafoto/lib/daily-report/run-daily-report.ts`), lo que
  significa que casi seguro está informando ceros para Clickatón, InfoSpot, Fotoffice y
  FotoRank. **Ese defecto es anterior a este módulo y queda fuera de alcance**, pero
  obliga a que acá las conexiones sean explícitas.
- **Las migraciones se aplican a mano.** El deploy no corre `prisma migrate deploy`. La
  migración de este módulo se aplica sobre la rama `production` de `compramelafoto` y se
  registra en `_prisma_migrations` para que no quede desincronizada.
- **Las tablas nuevas no rompen a las otras apps.** Son tablas, no columnas: ninguna otra
  aplicación las consulta, así que su ausencia en las otras bases es inocua.
- **El sufijo `Cents` del schema no es confiable.** El propio `schema.prisma` lo advierte
  en su línea 1: hay campos `...Cents` que guardan pesos enteros. Los colectores de
  ingresos deben verificar campo por campo antes de dividir por cien. Las tablas nuevas de
  este módulo **no usan el sufijo `Cents`**: usan `Decimal` y nombran la moneda en el
  campo.

## 5. Arquitectura

Tres capas, con el cálculo separado del acceso a datos:

```
@repo/finance-control          lógica pura y testeable
  ├── money            conversión USD→ARS con impuestos
  ├── allocation       reparto de un gasto entre plataformas
  ├── rollup           armado del resumen mensual y del ranking
  └── contracts/ports  PlatformRevenuePort (un puerto por plataforma)

apps/compramelafoto/lib/finance/    adaptadores (Prisma, una conexión por base)
  ├── revenue-clf.ts
  ├── revenue-fotoffice.ts
  ├── revenue-fotorank.ts
  ├── revenue-clickaton.ts
  ├── revenue-infospot.ts
  └── snapshot-job.ts

apps/compramelafoto/app/admin/finanzas-dnx/   pantallas
```

Es el mismo patrón de puertos y adaptadores que ya usa `@repo/ops-daily-report`, para que
el cálculo se pueda probar sin base de datos.

### Ingresos por snapshot, no en vivo

Un job diario abre las conexiones, calcula los ingresos por plataforma y mes, y **guarda
el resultado** en una tabla. Las pantallas leen solo esa tabla.

Motivos: las pantallas abren instantáneo; el histórico queda congelado y auditable; y no
se despiertan cuatro computes de Neon cada vez que se mira la pantalla — que en un módulo
para controlar costos sería un contrasentido.

El job recalcula **el mes en curso y el anterior** en cada corrida, porque hay pagos que se
acreditan tarde. Si una base no responde, registra el fallo y **deja intacto el snapshot
previo**: nunca reemplaza un número bueno por un cero.

## 6. Modelo de datos

Todas las tablas viven en `packages/db/prisma/schema.prisma` y se aplican **solo** a la
rama `production` de `compramelafoto`.

`platformKey` es **String**, no enum: las plataformas van a crecer (Subí la Foto) y un
enum nuevo obliga a tocar las cinco bases. El catálogo de claves válidas vive en
`@repo/finance-control`.

### ExpenseVendor — el servicio que se paga

| Campo | Tipo | Nota |
|---|---|---|
| `id` | Int | |
| `key` | String @unique | `vercel`, `neon`, `cloudflare-r2`, `resend`, `anthropic` |
| `name` | String | nombre visible |
| `category` | String | `INFRA`, `IA`, `EMAIL`, `DOMINIO`, `PUBLICIDAD`, `LEGAL_CONTABLE`, `COBROS`, `OTRO` |
| `billingCurrency` | String | `USD` o `ARS` |
| `billingCycle` | String | `MENSUAL`, `ANUAL`, `USO`, `UNICO` |
| `paymentMethod` | String? | con qué se paga |
| `active` | Boolean | un servicio dado de baja deja de aparecer en "copiar del mes anterior" |
| `notes` | String? | |

### VendorAllocation — el reparto por defecto del proveedor

`vendorId` · `platformKey` · `sharePercent Decimal(5,2)` — único por (`vendorId`, `platformKey`).

### ExpenseEntry — el gasto de un mes

| Campo | Tipo | Nota |
|---|---|---|
| `vendorId` | Int | |
| `periodYear` / `periodMonth` | Int | único junto con `vendorId` |
| `amountOriginal` | Decimal(12,2) | lo que dice la factura |
| `currency` | String | `USD` o `ARS` |
| `fxRate` | Decimal(12,4)? | dólar usado; nulo si la factura ya es en ARS |
| `taxPercent` | Decimal(5,2) | impuestos sobre consumo en dólares |
| `amountArs` | Decimal(14,2) | **calculado y guardado** — congela el histórico |
| `status` | String | `ESTIMADO`, `FACTURADO`, `PAGADO`, `RECHAZADO`, `IMPAGO`, `REEMBOLSADO` |
| `amountRefunded` | Decimal(12,2)? | reembolso parcial o total |
| `source` | String | `MANUAL`, `IMPORTADO`, `API` |
| `invoiceUrl` | String? | comprobante en R2 (etapa posterior) |
| `notes` | String? | |

`amountArs` se guarda en vez de calcularse al vuelo porque el tipo de cambio y los
impuestos de enero no son los de septiembre: recalcular el pasado con el dólar de hoy
falsearía el histórico.

### ExpenseEntryAllocation — el reparto real de ese gasto

`entryId` · `platformKey` · `sharePercent Decimal(5,2)` · `amountArs Decimal(14,2)`.

Se copia del reparto por defecto del proveedor al crear la entrada, y queda editable.

### FxRate — el dólar de cada mes

`periodYear` · `periodMonth` · `usdToArs Decimal(12,4)` · `source String` · `notes String?`.
Único por período. Es el valor por defecto que se propone al cargar gastos en dólares.

### PlatformRevenueSnapshot — los ingresos calculados

| Campo | Nota |
|---|---|
| `platformKey`, `periodYear`, `periodMonth` | único |
| `grossArs` | lo que pagó el cliente final |
| `processorFeeArs` | comisión de Mercado Pago |
| `payoutToThirdPartiesArs` | lo que se va a fotógrafos, laboratorios y referidores |
| `netArs` | **lo que efectivamente queda para DNX** |
| `operationsCount` | cantidad de operaciones |
| `computedAt`, `sourceNote` | trazabilidad |

```
netArs = grossArs − processorFeeArs − payoutToThirdPartiesArs
```

La distinción entre `grossArs` y `netArs` es la que hace que la comparación sirva. En
CompraMeLaFoto la venta bruta no es ingreso propio: el ingreso es la comisión de
plataforma. Comparar gastos contra venta bruta daría un margen inventado.

### Facturado no es pagado

El relevamiento real de septiembre 2026 mostró que esta distinción no es teórica: hay
facturas emitidas que **nunca se cobraron** porque la tarjeta las rechazó, y cobros que se
hicieron y después se **reembolsaron** casi por completo. Contar lo facturado como gasto
daría un número inflado; contar solo lo pagado escondería una deuda que puede dar de baja
un servicio.

Por eso el Resumen muestra **tres cifras separadas**:

- **Facturado** del mes: lo que emitieron los proveedores.
- **Pagado** del mes: lo que efectivamente salió de la cuenta, neto de reembolsos.
- **Deuda acumulada**: facturas en `RECHAZADO` o `IMPAGO` que siguen abiertas.

La deuda acumulada va con aviso visible, porque un servicio impago no es un ahorro: es un
apagón esperando.

## 7. Moneda, tipo de cambio e impuestos

```
currency = "USD"  →  amountArs = amountOriginal × fxRate × (1 + taxPercent / 100)
currency = "ARS"  →  amountArs = amountOriginal
```

Se muestran **las dos cifras**: el importe original en dólares (para comparar contra lo que
cobra el proveedor y detectar si subió el servicio) y el costo real en pesos (que es el que
duele). Si un mes sube el total en pesos pero el USD quedó igual, el módulo lo dice: subió
el dólar, no el servicio.

`taxPercent` es configurable por entrada, con un valor por defecto global, porque el
esquema impositivo argentino sobre consumos en dólares cambia.

## 8. Ingresos: un colector por plataforma

Cada adaptador implementa el mismo puerto:

```ts
interface PlatformRevenuePort {
  monthlyRevenue(period: Period): Promise<PlatformRevenueRow>;
}
```

Conexiones (solo lectura), por variable de entorno:

| Plataforma | Variable | Apunta a |
|---|---|---|
| CompraMeLaFoto | `DATABASE_URL` | `compramelafoto` / `production` |
| FOTOFFICE | `FINANCE_DB_URL_FOTOFFICE` | `compramelafoto` / `development` |
| FotoRank | `FINANCE_DB_URL_FOTORANK` | `compramelafoto` / `development` |
| Clickatón | `FINANCE_DB_URL_CLICKATON` | `clickaton-production` |
| InfoSpot | `FINANCE_DB_URL_INFOSPOT` | `infospot-production` |

Hoy `FINANCE_DB_URL_FOTOFFICE` y `FINANCE_DB_URL_FOTORANK` apuntan a la **misma** rama, así
que comparten un único cliente; están separadas para que el día que FotoRank se mude de
base no haya que tocar código.

Se usan **roles de Postgres de solo lectura** creados en Neon para este fin. Un módulo de
finanzas no tiene por qué poder escribir en la base de Clickatón.

**Tarea de descubrimiento previa a implementar cada colector:** hay que determinar, base
por base, qué tabla representa un ingreso real. En CompraMeLaFoto ya está resuelto (lo
calcula `/api/admin/finance/summary`). En las otras cuatro hay que verificarlo contra la
base, no suponerlo. Es legítimo que alguna plataforma dé **cero ingresos** hoy: ese cero es
justamente el dato que el módulo tiene que mostrar.

## 9. Carga del histórico desde enero 2026

Dos caminos, uno por lado del balance:

- **Ingresos:** script `finance:backfill --desde 2026-01`, que recorre mes por mes
  llamando a los mismos colectores y llena `PlatformRevenueSnapshot`. Automático.
- **Gastos:** carga asistida en pantalla. Se cargan los proveedores una vez, se carga
  enero a mano, y de febrero en adelante se usa "copiar del mes anterior" corrigiendo lo
  que cambió. Nueve meses se cargan en una sesión corta.

**Buena parte del histórico ya está relevada** (2026-09-11), leyendo los paneles y el
correo: Vercel completo de febrero a septiembre, Neon de julio a septiembre, Resend de
julio a agosto, Cloudflare del período en curso y Cursor de enero a septiembre. Ese
relevamiento también dejó a la vista **USD 517,92 en facturas rechazadas por la tarjeta**,
que es justamente lo que la sección anterior obliga a mostrar aparte.

## 10. Pantallas — `/admin/finanzas-dnx`

1. **Resumen.** Mes en curso y acumulado del año: entró, salió, resultado. Variación
   contra el mes anterior. Aviso si hay proveedores del mes anterior sin cargar este mes.
2. **Gastos.** Grilla por mes con el botón "copiar del mes anterior". Muestra importe
   original, dólar, impuestos y costo real en pesos.
3. **Proveedores.** Alta y baja de servicios, categoría, moneda, ciclo y reparto por
   defecto. Valida que el reparto sume 100%.
4. **Por plataforma.** El ranking: ingreso neto, gasto directo, gasto prorrateado,
   resultado y margen, ordenado de la que más deja a la que más cuesta. Más el costo de
   estructura (`suite`) mostrado aparte.
5. **Evolución.** Gráfico mensual desde enero 2026: ingresos, gastos y resultado.

Autorización: el mismo guard que protege el resto de `/admin`. No se agrega un rol nuevo.

## 11. Cálculos

Un gasto es **directo** cuando todo el gasto es de una sola plataforma (el reparto le
asigna el 100%), y **prorrateado** cuando llega como parte de un gasto compartido. Los dos
salen de la misma tabla de repartos; se separan al mostrarlos porque responden preguntas
distintas: el directo es el que se puede recortar apagando esa plataforma, el prorrateado
seguiría existiendo igual.

```
gastoDirecto(p, mes)     = Σ allocations donde platformKey = p  y  sharePercent = 100
gastoProrrateado(p, mes) = Σ allocations donde platformKey = p  y  sharePercent < 100
gastoTotal(p, mes)       = gastoDirecto + gastoProrrateado
ingresoNeto(p, mes)      = snapshot.netArs
resultado(p, mes)        = ingresoNeto − gastoTotal
margen(p, mes)           = resultado / ingresoNeto          (nulo si ingreso = 0)
costoEstructura(mes)     = Σ allocations donde platformKey = "suite"
resultadoSuite(mes)      = Σ resultado(p) − costoEstructura
```

Cuando el ingreso de una plataforma es cero, el margen se muestra como "sin ingresos", no
como -100%: son cosas distintas y confundirlas lleva a decisiones malas.

## 12. Pruebas

Todo el cálculo vive en `@repo/finance-control` y se prueba con Vitest, sin base:

- conversión USD→ARS con y sin impuestos, y con `fxRate` ausente;
- reparto que no suma 100% → error explícito;
- gasto repartido entre cinco plataformas, verificando que la suma de las partes iguale el
  total (sin centavos perdidos por redondeo);
- ranking por plataforma con una plataforma de ingreso cero;
- mes sin datos de gasto y mes sin snapshot de ingreso.

Los adaptadores se prueban contra una rama Neon de prueba, nunca contra producción.

## 13. Riesgos

| Riesgo | Mitigación |
|---|---|
| La migración queda sin registrar y `_prisma_migrations` se desincroniza | Aplicar el SQL y registrar la migración en la misma sesión, siguiendo el procedimiento ya documentado |
| Tres cadenas de conexión más guardadas en Vercel | Roles de Postgres de solo lectura, creados específicamente para esto |
| El job despierta computes y genera costo | Corre una vez por día, no por visita a la pantalla |
| Un colector lee un campo `Cents` que en realidad son pesos | Verificación campo por campo documentada en cada adaptador, más una prueba con un importe conocido |
| Los gastos se dejan de cargar y el módulo miente por omisión | El Resumen avisa qué proveedores del mes anterior faltan este mes |

## 14. Decisiones cerradas

- Vive dentro del admin de CompraMeLaFoto. No se crea una app ni un proyecto de Vercel
  nuevo: sería agregar costo fijo a un módulo cuyo propósito es bajarlo.
- Los ingresos se calculan automáticamente desde las bases; no se cargan a mano.
- Doble moneda con impuestos, guardando el costo real en pesos congelado por mes.
- Alcance de gasto: servicios técnicos, dominios y legales, comisiones de cobro, y
  publicidad y marketing.
- `platformKey` como String, no como enum de Prisma.

## 15. Fuera de alcance

- Traer facturas automáticamente de Vercel, Cloudflare, Resend o Mercado Pago.
- Conciliar contra el resumen de la tarjeta de crédito.
- Presupuestos, proyecciones y alertas de desvío.
- Exportación contable o impositiva.
- Multiusuario y permisos finos.
- Arreglar el informe diario, aunque este spec documente su defecto.

## 16. Etapas

1. **Paquete y carga de gastos.** `@repo/finance-control`, migración, pantallas de
   Proveedores y Gastos con reparto y "copiar del mes anterior". Con esto solo, ya se
   responde "en qué se me va el dinero".
2. **Histórico de gastos.** Carga real de enero a septiembre 2026 junto al dueño.
3. **Ingresos.** Descubrimiento por base, los cinco colectores, el job diario y el
   backfill.
4. **Comparativa.** Pantalla por plataforma y evolución mensual.

Cada etapa deja algo usable. La etapa 1 sirve incluso si la 3 nunca se hace.
