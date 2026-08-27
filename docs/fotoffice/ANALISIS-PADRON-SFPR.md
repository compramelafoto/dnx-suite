# SFPR — Análisis de los datos del padrón y los pagos

**Fecha:** 2026-08-27
**Fuentes:** tres exportaciones del sistema anterior entregadas por Daniel.

| Archivo | Contenido |
|---|---|
| `SUBSCRIBERS_SFPR_27082026.xlsx` | 146 filas de socios activos, hojas Listado y Detalle |
| `SUBSCRIBERS_SFPR_27082026 (INACTIVOS).xlsx` | 48 filas de socios dados de baja |
| `Reporte_Imputacion_Pagos_2025-08-01_2026-08-26.xlsx` | 333 imputaciones de pago |

Solo se analizaron agregados. No se volcaron datos personales a la conversación ni a este
documento.

## 1. El padrón reconcilia exacto

| Origen | Socios |
|---|---:|
| Activos en la planilla | 145 con número (1 fila sin número) |
| Altas nuevas hechas en FotoOffice | 7 — números **727 a 733** |
| **Total** | **152** |
| En la base de FotoOffice | **152** ✅ |

Ningún socio activo de la planilla falta en la base, y los 7 de más son altas posteriores a la
exportación. La cuenta cierra.

Los **47 socios inactivos nunca se importaron**. Sus bajas van del 2025-10-02 al 2026-05-21 y
arrastran **$723.300** de deuda: 41 con saldo, 7 en cero.

### Inconsistencias del sistema origen

- **El socio 713 figura como activo y como inactivo a la vez.**
- Una fila sin número de socio en cada planilla.

## 2. La cuota subió en marzo de 2026

Derivado del historial de pagos, no de una suposición:

| Período | Valor |
|---|---:|
| 10/2025 a 02/2026 | **$5.000** |
| 03/2026 a 08/2026 | **$8.000** |

En FotoOffice solo está cargado el valor de $8.000, vigente desde el 2026-08-27. **Falta la
escala histórica**, y sin ella cualquier reconstrucción de deuda da mal.

Otros servicios cobrados en el período: Inscripción ($15.000 y $24.000), Plan de
regularización ($10.666,66 en 3 cuotas) y Carnet Socio ($5.000).

## 3. Los pagos vienen cayendo

333 imputaciones, **61 socios distintos**, **$2.213.289** aplicados. Medios: Mercado Pago (289),
transferencia (26), efectivo (18).

| Período | Pagos |
|---|---:|
| 10/2025 | 48 |
| 11/2025 | 40 |
| 12/2025 | 35 |
| 01/2026 | 35 |
| 02/2026 | 32 |
| 03/2026 | 33 |
| 04/2026 | 30 |
| 05/2026 | 28 |
| 06/2026 | 25 |
| 07/2026 | 16 |
| 08/2026 | 11 (mes en curso) |

**Solo 61 de 145 socios activos registran algún pago en once meses.** Los otros 84 no aparecen
en el reporte. Y la serie cae de 48 pagos mensuales a 25 entre octubre y junio: es una caída
sostenida, anterior a cualquier sistema.

## 4. La deuda no se puede reconstruir automáticamente

Se intentó reconstruir el saldo de cada socio período por período, con la escala histórica, los
pagos registrados y la fecha de alta. Resultado sobre los 145 activos:

| Grupo | Socios | Reconstrucción exacta |
|---|---:|---:|
| Con suscripción de $8.000 | 90 | 56 exactos, 2 con diferencia de una cuota, **32 no cierran** |
| Sin suscripción cargada | 47 | **0** |
| Con suscripción en $0 | 8 | 0 — son exentos, saldo cero |

**Solo 56 de 145 socios (39%) reconcilian.** Considerar la fecha de alta no mejora el
resultado.

### Por qué no cierra

Los casos fallidos no comparten una causa: hay socios que deben **más** que once meses —o sea
deuda anterior a octubre de 2025, fuera del reporte—, y otros con saldo cero habiendo pagado
nueve meses, lo que implica condonaciones o ajustes que el reporte tampoco registra.

Aparte, **47 socios no tienen suscripción ni valor de servicio cargados**. La planilla les
muestra "3 cuotas adeudadas", pero sus saldos van de $15.000 a $60.000: ese "3" es un valor por
defecto del sistema origen, no un dato real. De ellos, 34 tienen exactamente $15.000, que es
3 × $5.000: deuda vieja congelada, sin facturación activa.

## 5. Estado de la deuda

| | Socios | Deuda |
|---|---:|---:|
| Activos | 145 | **$4.972.500** |
| — de ellos, sin suscripción activa | 55 | $1.156.500 |
| Inactivos | 47 | $723.300 |
| **Total** | | **$5.695.800** |

De los activos: 126 deben algo, 19 están en cero y **1 tiene crédito a favor de $37.000**
(socio 617).

## 6. La regla de baja alcanzaría al 73% del padrón

La configuración cargada da de baja por 3 cuotas consecutivas impagas. Con estos números,
**107 de 145 socios activos califican**. Y para 47 de ellos el número de cuotas adeudadas no
es confiable.

Si esa regla se aplica automáticamente el día que el sistema se enciende, da de baja a tres
cuartos del padrón usando datos que en buena parte son un valor por defecto.

## 7. Recomendación

**Importar el saldo como punto de partida, no reconstruir mes a mes.**

El saldo de la planilla es lo que la Secretaría le diría al socio por teléfono, y es el único
número consistente en las tres fuentes. Reconstruir período por período solo funciona para el
39% del padrón, y en el 61% restante inventaría deuda o la borraría.

Concretamente:

1. Cargar la **escala histórica** de la cuota ($5.000 y $8.000 con su fecha de cambio), que
   hace falta igual para cualquier cálculo futuro.
2. Para cada socio, un **único cargo de apertura** por su saldo actual, identificado como
   proveniente del sistema anterior.
3. Cargar el **historial de pagos como registro informativo**: 333 movimientos que dan
   trazabilidad aunque no cuadren contra los cargos.
4. De septiembre en adelante, el sistema genera las cuotas con su propia historia, correcta
   desde el día uno.
5. **Desactivar la baja automática por deuda** hasta que los datos sean confiables. Que la
   Comisión decida caso por caso.

### Decisiones tomadas por Daniel el 2026-08-27

**1 · Los exentos son Honorarios.** Los 8 socios con suscripción en $0 pasan a la categoría
`Honorario`, cuya cuota es $0. Ninguno tiene deuda.

**2 · Baja para quienes deben más de 5 cuotas.** Son **45 socios**, que se llevan **$3.088.000**
de deuda. Es una medida transitoria —"hay que organizarlos"— y por lo tanto reversible.

Verificación previa: **los 45 tienen suscripción cargada**, así que su cantidad de cuotas
adeudadas es un dato real y no el valor por defecto que afecta a los 47 sin suscripción.
Nadie queda dado de baja por un número inventado.

Resultado sobre el padrón:

| | Antes | Después |
|---|---:|---:|
| Activos | 145 | **100** (incluye 8 honorarios) |
| Inactivos | 47 | **92** |
| Deuda en el padrón activo | $4.972.500 | **$1.831.500** |

Los 92 que quedan activos y no son honorarios deben entre 0 y 5 cuotas: 12 están al día, y el
grupo más numeroso son los 51 con 3 cuotas.

**3 · Plazo.** El sistema debe estar operativo para el vencimiento de septiembre.

**4 · Fee de la plataforma.** El porcentaje se define en la configuración del super admin. En
cada módulo, el owner elige si el fee **sale del total cobrado** o **se adiciona** al precio.
Queda como configuración pendiente, a resolver cuando se retome el tema de pagos de cuotas.

### Decisiones que siguen pendientes

1. Qué se hace con los **47 socios sin suscripción** cargada: si vuelven a facturarse o siguen
   congelados. De ellos, 34 tienen exactamente $15.000 de deuda vieja.
2. Si los **inactivos se importan** a FotoOffice con su deuda, o quedan fuera del sistema.
3. Qué se hace con el **socio 713**, que figura como activo e inactivo a la vez.
4. Qué se hace con el **crédito a favor de $37.000** del socio 617.
5. Las dos filas **sin número de socio**.

---

# Importación ejecutada — 2026-08-27

Aplicada con `packages/db/scripts/sfpr-import-padron.mts --execute` sobre la base de
producción, en una sola transacción. Lote de auditoría: `sfpr-import-2026-08-27`.

## Resultado verificado

| | Antes | Después |
|---|---:|---:|
| Socios `ACTIVE` | 152 | **107** |
| Socios `INACTIVE` | 0 | **45** |
| Categoría Profesional | 152 | 144 |
| Categoría Honorario | 0 | **8** |
| Valores de cuota | 3 | **5** |
| Cargos de deuda | 0 | **80** |
| Deuda registrada | $0 | **$1.868.500** |

Auditoría del lote: 80 `IMPORTED`, 45 `STATUS_CHANGED`, 8 `UPDATED`. Los 133 socios tocados
quedan trazados y el lote se puede revertir en bloque.

## Escala de cuota vigente

| Categoría | Monto | Desde | Hasta |
|---|---:|---|---|
| Profesional | $5.000 | 2025-10-01 | 2026-02-28 |
| Profesional | $8.000 | 2026-03-01 | vigente |
| Honorario | $0 | 2025-10-01 | vigente |
| Estudiante | $4.000 | 2026-08-27 | vigente |
| Aficionado | $8.000 | 2026-08-27 | vigente |

Se eliminó un valor duplicado de Profesional ($8.000 desde 2026-08-27) que quedaba solapado
con el de marzo y que no referenciaba ningún cargo.

## Septiembre está listo para generarse solo

Verificado en el código y en la configuración de producción:

- **El cron existe**: `/api/cron/generar-cuotas`, declarado en `apps/fotoffice/vercel.json`,
  corre todos los días a las 06:00 UTC.
- Cada institución decide su día: la SFPR tiene `generationDay = 1`, así que dispara el 1.
- **`CRON_SECRET` está configurado** en Production. Sin él la tarea respondería 401 y las
  cuotas no se generarían, en silencio.
- La generación es **idempotente** y **excluye a los `INACTIVE`**, así que los 45 dados de baja
  no reciben cuota.
- Una cuota en cero no se emite: los 8 honorarios se saltean como exentos, sin ensuciar el
  cálculo de mora.

Proyección para el 2026-09-01:

| Categoría | Socios | Cuota | Total |
|---|---:|---:|---:|
| Profesional | 99 | $8.000 | **$792.000** |
| Honorario | 8 | $0 | se saltea |

## Lo que sigue pendiente

1. Los **47 socios inactivos** del sistema anterior no se importaron ($723.300).
2. El **crédito a favor de $37.000** del socio 617 no se cargó.
3. El **socio 713** figura como activo e inactivo en el origen.
4. Las dos filas **sin número de socio**.
5. Los **47 socios sin suscripción**: 34 quedaron con cargo de apertura por su deuda vieja de
   $15.000, pero habría que definir si vuelven a facturarse mes a mes.

---

# Corrección de la antigüedad — 2026-08-27

Daniel aportó el listado de cuándo cada socio completó el formulario de inscripción, con la
indicación de no asignar fecha a quien no la tuviera y de ignorar la columna de tipo de socio.

## El problema que apareció al cruzarlo

El `joinedAt` migrado no era confiable, pero **tampoco lo era el listado por sí solo**.

- **80 socios** tenían en la base un valor por defecto de la importación (fechas de 2025).
- **10 socios** tenían fechas imposibles: el socio 476 figuraba asociándose en 1972 habiendo
  nacido en 1967, es decir a los 5 años.
- Pero **44 socios tenían en la base fechas más antiguas y perfectamente creíbles**, verificadas
  contra su fecha de nacimiento.

El listado registra **cuándo alguien llenó un formulario**, no cuándo entró a la Sociedad. La
mayoría de sus fechas son de una campaña de registro de 2020. Aplicarlo a ciegas le habría
dicho al socio 255 —nacido en 1947, con alta en 1972— que tiene 6 años de antigüedad en vez
de 54.

Eso importa más que un dato mal: es lo que el portal le muestra a cada persona sobre su propia
pertenencia, y no hay forma de que lo corrija por su cuenta.

## La regla aplicada

**Se toma la fecha más antigua de las dos, pero la de la base solo gana si es creíble**: que el
socio tuviera al menos 15 años al asociarse y que la fecha no esté en el futuro.

| | Socios |
|---|---:|
| Corregidos con el listado | **92** |
| — porque la base tenía el default de importación | 80 |
| — porque la fecha de la base era imposible | 10 |
| — porque no había fecha de nacimiento para verificarla | 2 |
| Conservan su fecha de la base, más antigua y creíble | **44** |
| Sin fecha en el listado: **no se les asignó ninguna** | **6** (23, 27, 40, 45, 46, 592) |

Aplicado con `packages/db/scripts/sfpr-corregir-antiguedad.mts`, en una transacción, con
auditoría por lote `sfpr-antiguedad-2026-08-27`: 92 registros, reversible en bloque.

## Resultado

| Antigüedad | Socios activos |
|---|---:|
| Más de 15 años | 14 |
| 6 a 15 años | 12 |
| 3 a 6 años | 28 |
| 1 a 3 años | 26 |
| Menos de 1 año | 27 |

Los más antiguos: socio 45 con 62 años (alta 1964), socio 255 con 54, socio 536 con 40. El
socio 45 es justamente uno de los seis que el listado no cubre, así que conservó su fecha
original sin tocarse.

## Para revisar

Los **44 socios que conservaron la fecha de la base** merecen una mirada de la Secretaría: son
creíbles según la edad, pero nadie confirmó que sean correctas. Están listadas en
`packages/db/scripts/data/sfpr-plan-antiguedad-2026-08-27.json`, bajo `conserva`, junto a la
fecha que decía el listado.
