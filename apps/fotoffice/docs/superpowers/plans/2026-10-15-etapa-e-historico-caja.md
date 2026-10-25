# Etapa E · Histórico de Caja, saldo de apertura y analítica — plan

Fecha: 15/10/2026. Spec: `docs/superpowers/specs/2026-10-15-presupuesto-a-caja-y-estudio-design.md`
(rama `docs/fotoffice-presupuesto-caja-estudio`), secciones 7.1, 7.3, 7.4, 7.5 y 7.6.

## Objetivo

Cargar los libros de caja de DNX Estudio (ene-2024 a oct-2026) como **histórico**, mes por mes y con revisión,
sin tocar el saldo de Caja; dejar preparado el saldo de apertura de las cuentas reales; y tener las funciones de
analítica que va a usar el tablero del estudio.

## Límites (para no chocar con la etapa B, que se programa en paralelo)

- No se toca `lib/pedidos`, `lib/presupuestos` ni el código de Mercado Pago.
- No se toca `lib/cash/constants.ts` (la etapa B le suma un `sourceModule`): la apertura define su constante
  en `lib/cash/apertura.ts`.
- En el esquema sólo se agregan tablas nuevas y relaciones inversas en `Workspace`.

## Diseño

### Datos (SQL aditivo, migración `20261214120000_fotoffice_historico_caja`; NO se aplica en este PR)

- `FotofficeHistoricoLote`: un lote por (workspace, mes "AAAA-MM"). Estado `BORRADOR | CONFIRMADO | DESCARTADO`,
  archivo, huella (sha-256 del contenido), cantidad de filas, totales y resumen (JSON), avisos, quién confirmó.
- `FotofficeHistoricoMovimiento`: fecha, turno, medio, concepto original y normalizado, importe con signo
  (+ entra, − sale), clase (`INGRESO | COSTO_VARIABLE | GASTO_FIJO | RETIRO_DUENO | MOVIMIENTO_INTERNO |
  SIN_CLASIFICAR`), código y nombre de rubro, regla aplicada, referencia de origen (archivo | pestaña | celda),
  origen (`CSV | EXTRACTO | ESTIMADO`), `estimado`, `revisar` y motivos de revisión.
- `FotofficeHistoricoMapeo`: concepto (+ signo y monto mínimo opcionales) → rubro y clase; se guarda al confirmar
  un lote ("aprendido de cada confirmación").
- No son `CashMovement`: no tocan saldo, turnos ni arqueos.

### Clasificación por código de rubro (spec 7.1)

`3…` ingresos (los hijos son las líneas de negocio), `4…` costos variables, `5…` gastos fijos, `6…` retiro del
dueño, `0…` movimientos internos (no son ingreso ni gasto: p. ej. "RETIROS" de 2026 = fondos para pagar gastos
fuera de caja). La clase de cada rubro se valida contra su código.

### Importación (módulo puro + script)

1. `csv.ts`: lee el CSV normalizado (formato `movimientos.csv`), importes a centavos sin flotantes.
2. `mapeo.ts`: valida el archivo de mapeo (JSON, zod) y clasifica cada fila; la regla más específica gana
   (con monto mínimo > con signo > general).
3. `estimados.ts`: genera las filas estimadas del mes (con "sólo si no hay X en el mes", p. ej. expensas).
4. `revision.ts`: motivos para revisar: confianza baja, signo contrario, sin concepto, sin regla, monto fuera de
   lo común para su concepto, posible duplicado (mismo concepto e importe grande en ≤ 45 días).
5. `faltantes.ts`: gasto recurrente (mismo rubro y concepto en ≥ 3 de los 6 meses anteriores) que no aparece en
   el mes.
6. `lote.ts`: arma el lote del mes (movimientos + resumen + huella). Idempotente: misma entrada, misma huella.
7. `reporte.ts`: informe de la corrida en seco (Markdown), por mes y por año, con control contra un resumen de
   referencia opcional.
8. `repositorio.ts` (servidor): guardar borrador (reemplaza el lote del mes; un lote CONFIRMADO sólo con
   `--reemplazar`), confirmar, descartar, leer lotes y totales.
9. Script `pnpm --filter fotoffice caja:importar-historico`: en seco por omisión (no abre la base); con
   `--aplicar --workspace <slug>` escribe borradores mes por mes.

### Pantalla "Historial importado" (`/caja/historial`, permiso configurar)

Lista de meses con estado, ingresos, egresos por clase, estimados, filas para revisar y avisos; detalle del mes
con totales por línea y por clase, estimados, filas para revisar, faltantes; botones Confirmar y Descartar.

### Saldo de apertura (spec 7.5)

`lib/cash/apertura.ts`: plan puro (crear cuenta si falta; registrar, corregir o dejar pendiente el saldo) y
aplicación en una transacción. Movimiento `sourceModule = "apertura"`, `sourceRef = accountId` (el único
`(sourceModule, sourceRef)` que ya existe garantiza uno por cuenta: no hace falta índice nuevo), sin turno.
Saldo desconocido = pendiente (no se crea nada); saldo 0 = nada que registrar. Los informes lo excluyen
(`asientoDeMovimiento` y `movementsForReport`); el saldo de la cuenta sí lo cuenta. Script `caja:apertura`, en
seco por omisión.

### Analítica (`analitica.ts`, pura)

Ingresos por línea y mes, egresos por clase y mes, promedio real de fijos de los últimos 3 meses cerrados (marca
si incluye estimados o meses con fijos incompletos), punto de equilibrio (contribución necesaria = fijos + retiro;
ventas necesarias = contribución ÷ margen de contribución).

## Tareas (TDD)

1. Plan (este archivo).
2. Tipos, CSV y centavos — pruebas primero.
3. Mapeo y clasificación — pruebas primero.
4. Estimados, revisión y faltantes — pruebas primero.
5. Lote y huella — pruebas primero.
6. Analítica — pruebas primero.
7. Reporte en seco — pruebas primero.
8. Esquema Prisma + migración SQL (sin aplicar).
9. Repositorio + script de importación.
10. Apertura (plan puro con pruebas, aplicación, exclusión en informes con pruebas) + script.
11. Pantalla "Historial importado" + entrada del menú.
12. Mapeo de Daniel (fuera del repo) y corrida en seco con informe por mes (fuera del repo).
13. Pruebas y typecheck de FOTOFFICE y de las apps que compilan contra `packages/db`.

## Fuera de este PR

- Aplicar la migración (Daniel + `prisma migrate resolve --applied`).
- Subir el CSV desde la pantalla (v1 = script).
- Tablero del estudio (etapa E, usa `analitica.ts`), `FotofficeGastoRecurrente`, equipo y horas.
