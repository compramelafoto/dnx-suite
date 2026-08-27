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

### Antes de importar, decisiones pendientes

1. Qué se hace con los **47 socios sin suscripción**: si vuelven a facturarse o siguen
   congelados.
2. Si los **47 inactivos** se importan como `INACTIVE` con su deuda, o quedan fuera.
3. Qué se hace con el **socio 713**, activo e inactivo a la vez.
4. Qué se hace con el **crédito a favor** del socio 617.
5. Las dos filas **sin número de socio**.
