# Equipo: jornadas, alertas, liquidación, logros y comisiones

**Fecha:** 2026-10-21 · **Pide:** Daniel Cuart · **Primer uso:** DNX Estudio (`cmv5z6qxwwmmhf0q5gp8qja1j`)

## Para qué existe

DNX Estudio tiene dos empleadas, Sabina y Camila, que atienden el mostrador. Hoy el sueldo se
liquida "de memoria". Daniel quiere **una herramienta para liquidar el sueldo con transparencia**,
no para vigilar al minuto. Con los datos que la Caja ya registra quiere ver cuánto trabajó cada
una y qué salió bien o mal, y llegar a fin de mes con la liquidación armada.

El trato con las empleadas es parte del diseño. Ellas reciben saludos y agradecimientos que
cambian cada día, y ven sus propios logros. **Los errores, las alertas y la liquidación los ve
sólo el dueño.**

## Lo que ya existe y en lo que se apoya

- **Turnos de caja** (`CashShift`, S:19004). Guardan quién abre, quién cierra, el conteo y la
  diferencia. Hay un solo turno abierto por cuenta, que cualquiera con permiso puede cerrar. Las
  acciones están en `app/(shell)/caja/actions.ts` (`openShiftAction`, `closeShiftAction`) y las
  reglas en `lib/cash/shift.ts`.
- **Ventas de mostrador** (`Sale` con `createdByUserId`, y `SaleItem` con `priceWasOverridden` y
  los precios congelados). El `CashMovement` que genera una venta **no** guarda quién la hizo:
  la vendedora se lee de `Sale.createdByUserId`.
- **Roles:** las empleadas tienen el rol `STAFF`. Lo que sólo puede ver el dueño se protege con
  `canManageWorkspaceSettings(role)`.
- **Feriados:** `argentinaHolidays(year)` y `eventDayType()` en
  `packages/cuanto-cobro-core/src/pricing-extras/holidays.ts`. Ya los usa
  `lib/impresiones/dias-habiles.ts`.
- **Tareas programadas:** el arreglo `crons` de `apps/fotoffice/vercel.json`, con
  `isAuthorizedCronRequest`. La plantilla es `app/api/cron/agenda-recordatorios`.
- **Módulos:** `lib/modules/registry.ts` y `WorkspaceFeatureModule`. El menú se arma en
  `components/shell/shell-nav.tsx`.
- **Aviso global:** no hay un lugar en el shell para mostrar avisos. Va en `AdminShell`, antes de
  `{children}`.

## Objetivos

1. Cada día, saber quién trabajó y de qué hora a qué hora, tomando la **apertura y el cierre de
   caja** como referencia.
2. **Alertas** organizadas, con histórico, filtros por período, por empleada y por tipo, y la
   posibilidad de marcarlas como revisadas y anotarlas.
3. **Liquidación mensual** por empleada, con sueldo según el horario fijo, horas extra para
   aprobar, adelantos, comisiones y premios.
4. **Mensajes** que cambian todos los días: al abrir la caja, 5 minutos antes de la hora de
   salida y al cerrar. Incluyen el saludo de cumpleaños.
5. **Logros** (buenas prácticas) que ve cada empleada, con **premios** que configura el dueño.
6. **Comisiones por rubro**, configurables y todas en 0 % al empezar.
7. Un **saldo inicial** de caja que no cuente como ingreso del negocio.

## Lo que no hace (no-objetivos)

- No reemplaza un reloj fichador ni mide la hora de inicio de sesión. Las sesiones duran varios
  días, así que esa hora no dice cuándo llegaron.
- No calcula aportes, cargas sociales ni recibos legales. Las empleadas no están registradas.
- No compara a las empleadas entre sí.

## Lo que lo haría fracasar aunque funcione (anti-objetivos)

- **Que una empleada vea un error o una alerta suya.** Ellas ven sólo saludos, logros y premios.
- **Que se frene la atención al público.** Nada bloquea una venta. Si la caja de la compañera
  quedó abierta, se guía a la empleada para cerrarla, sin trabarla.
- **Que se vuelva una competencia entre ellas.** Los logros y las conclusiones comparan a cada
  una consigo misma.
- **Que un mensaje se repita seguido o suene a robot.**

## Decisiones de Daniel

- **Se paga según el horario fijo.** La caja mide y avisa, pero no calcula el pago. A fin de mes
  se muestra el tiempo perdido o ganado frente al horario.
- **Es obligatorio abrir y cerrar la caja.** Si una llega y el turno de la otra sigue abierto,
  aparece una advertencia, porque eso significa que no se hizo el conteo y es un error de
  operación.
- **Aviso amable 5 minutos antes de la hora de salida**, con un agradecimiento por la jornada y
  el recordatorio de contar y cerrar. Al abrir la caja también hay un saludo. **Tienen que ser
  cientos de mensajes que cambien**, nombrando el día ("¡Buen lunes!") y el fin de semana los
  viernes y sábados.
- **Cumpleaños:** se saluda el mismo día si trabaja. Si cae sábado o domingo y ese día no
  trabaja, se saluda **el día anterior**.
- **Todas las alertas van en un panel** bien organizado, con histórico, filtros por período y
  por empleada. No hacen falta avisos al celular.
- **Logros y premios:** que el sistema saque conclusiones sobre las buenas prácticas. Las
  empleadas **ven sólo sus logros**, nunca sus errores.
- **Comisiones por rubro,** configurables y todas en 0 % por ahora.

### Datos de DNX Estudio

- **Horario de atención:** de lunes a viernes de 8 a 13 y de 15 a 19; los sábados de 9 a 13.
- **Sabina:** de lunes a viernes de 8 a 13.
- **Camila:** de lunes a viernes de 14 a 19 (el horario de Google Maps dice 15, pero ella entra a las 14).
- **Sábados:** van alternando, uno cada una.
- **Pago:** por jornada de 5 horas o la parte proporcional. La hora de más se paga en
  proporción.
- **Valor de la jornada:** sin dato todavía, Daniel lo averigua.
- **Fechas de nacimiento:** sin dato todavía.
- **Adelanto ya cargado:** 300.000 pesos el 20/10, descripción "Adelanto del sueldo del mes de
  noviembre de Cami". Corresponde a **noviembre**.

## Cómo funciona

### 1. Ficha de empleada

Una ficha por persona del equipo, unida a su `WorkspaceMembership`. Guarda:

- fecha de nacimiento;
- valor de la jornada en pesos, con fecha desde la que rige, porque va a cambiar con el tiempo;
- duración de la jornada de referencia (5 h);
- horario semanal: franjas por día de la semana;
- sábados alternados: una regla de "semana sí, semana no" con una fecha de referencia;
- cambios puntuales por fecha (cambió el turno con la compañera, faltó con aviso, vacaciones);
- si el módulo la cuenta (activa o inactiva).

Las dos hacen jornadas de 5 horas de lunes a viernes (Sabina de 8 a 13, Camila de 14 a 19). El
sueldo de cada día se calcula en proporción a las horas del horario fijo de ese día (horas del
día ÷ 5 × valor de la jornada), así que el sábado de 9 a 13 vale 4/5 de jornada.

### 2. Jornada del día (sale de la caja)

Sólo cuentan los turnos de las cuentas de mostrador: las de efectivo que no son la caja fuerte, que
son las únicas que tienen turno. En DNX Estudio es una sola, la "Caja diaria" (decisión mía).

Para cada persona y cada día:

- **Entrada real:** la apertura del primer turno que abrió ella ese día.
- **Salida real:** el cierre del último turno que **cerró ella misma**.
- **Si su turno lo cerró otra persona:** la jornada queda como **"sin cierre propio"**. Como
  referencia se toma su última actividad del día (su última `Sale` o el último movimiento que
  cargó), y el dueño la puede corregir a mano. Cualquier corrección queda registrada.
- La jornada se compara con el horario fijo de ese día y da los minutos de llegada tarde, salida
  temprana o tiempo extra, más el tiempo sin actividad. Se considera "sin actividad" un tramo de
  tiempo extra sin ninguna `Sale` ni movimiento cargado por ella.
- **Tolerancia:** 10 minutos por defecto, configurable (decisión mía).

### 3. Pase de turno entre empleadas

Cuando alguien entra a Caja y el turno abierto de la cuenta es de otra persona:

1. Ve una pantalla clara: "La caja la abrió *Sabina* y no se cerró. Antes de empezar, contá la
   plata y cerrá su turno".
2. Hace el conteo. El cierre se registra en el turno de la compañera, con
   `closedByUserId` = quien contó. Si hay diferencia, queda en el turno de la compañera, con la
   nota obligatoria de siempre.
3. Se le ofrece abrir su propio turno con el monto que contó.
4. Se generan las alertas "Turno cerrado por otra persona" y "Jornada sin cierre propio".

Si elige no hacerlo en ese momento, puede vender igual: la venta cae en el turno abierto, como
hoy. Ese día queda marcado para revisar.

### 4. Mensajes a las empleadas

- **Momentos:** al abrir la caja, 5 minutos antes de la hora de salida del horario fijo, y al
  cerrar la caja.
- **Aviso de salida:** es un aviso global en `AdminShell`, visible en cualquier pantalla. Sólo
  aparece si la persona tiene un turno abierto a su nombre y su horario termina dentro de 5
  minutos. Se puede cerrar con una cruz y no vuelve a aparecer ese día.
- **Cómo se arman:** combinando piezas. Un saludo que depende del día de la semana y del momento,
  una frase del medio elegida al azar (ánimo, agradecimiento o un dato de su jornada, como "hoy
  pasaron 12 clientes") y un cierre que depende del momento. El viernes y el sábado al cerrar
  dice "¡Que tengas un lindo fin de semana!". Con unas 15 a 20 variantes por pieza alcanza para
  miles de combinaciones.
- **No repetir:** no se usa la misma combinación con la misma persona en 30 días.
- **Ocasiones especiales:** feriados y víspera de feriado (con `eventDayType`), fin de mes y
  cumpleaños. El cumpleaños se saluda el mismo día si trabaja. Si no trabaja ese día (domingo, el
  sábado que le toca a la otra, feriado o franco), se saluda en **su último día de trabajo antes
  del cumpleaños**.
- **Logros en el mensaje:** si tiene un logro nuevo o una racha, puede aparecer al cerrar, por
  ejemplo "¡Llevás 10 días impecables!".
- **Repertorio editable:** el dueño puede agregar, editar o apagar piezas en Equipo → Mensajes.
  El repertorio inicial lo escribe el constructor, en castellano rioplatense, cálido y sin
  exagerar.

### 5. Alertas (las ve sólo el dueño)

Cada alerta tiene tipo, gravedad (importante, para mirar o informativa), persona, fecha y un
enlace al turno, movimiento o venta que la generó. Se puede marcar como revisada y anotarle algo.
No se borran.

| Grupo | Alerta | Gravedad por defecto |
|---|---|---|
| Plata | Una cuenta de caja quedó en negativo | importante |
| Plata | Diferencia en el conteo al cerrar (faltante o sobrante) | importante si supera un umbral; si no, para mirar |
| Plata | Diferencias chicas que se repiten (3 o más en el mes del mismo signo) | para mirar |
| Plata | Egreso grande cargado por una empleada (umbral configurable) | para mirar |
| Plata | Una empleada anuló un movimiento | para mirar |
| Plata | Movimiento cargado con fecha u hora muy distinta de cuando se cargó | para mirar |
| Plata | El pase a la caja fuerte fue menor a lo recaudado menos el fondo fijo | para mirar |
| Plata | Venta cargada directo en la caja fuerte | informativa |
| Plata | Adelanto mayor a lo que lleva ganado en el mes | para mirar |
| Horarios | Llegó tarde, se fue temprano o se fue tarde (fuera de la tolerancia) | informativa |
| Horarios | No abrió un día que le tocaba | importante |
| Horarios | Abrió un día u horario que no le tocaba | para mirar |
| Horarios | La caja quedó abierta de noche o nunca se cerró | importante |
| Horarios | El turno lo cerró otra persona | para mirar |
| Horarios | Jornada de más de 8 horas | para mirar |
| Actividad | Tiempo de más sin ventas ni movimientos | para mirar |
| Actividad | Un turno entero sin ventas | informativa |
| Actividad | Venta cargada después de que cerró su turno | para mirar |
| Ventas | Precio cobrado por debajo del de lista (`priceWasOverridden` y precio menor) o con descuento | para mirar |
| Ventas | Proporción de ventas en efectivo inusual frente a sus meses anteriores | informativa |

**Cuándo se calculan.** Las que dependen de un hecho puntual se generan en el momento: al abrir o
cerrar un turno, al cargar un movimiento o una venta. Las que dependen de algo que *no* pasó (no
abrió, la caja quedó abierta, resumen del mes) las genera una tarea programada que corre cada
noche a las 23:30, hora argentina. Si se calcula dos veces, la alerta no se duplica: lleva una
clave única por tipo, persona y referencia.

**Pantalla.** Equipo → Alertas tiene filtros por período (mes por defecto, o un rango), por
empleada, por tipo y por "sin revisar". Arriba muestra contadores por gravedad y abajo la lista
agrupada en Plata, Horarios, Actividad y Ventas. Daniel aprobó el boceto con esta forma el
21/10.

### 6. Liquidación mensual (la ve sólo el dueño)

Una por persona y mes. Contiene:

- **Sueldo según el horario fijo:** **sólo se pagan las jornadas a las que asistió**, al valor
  proporcional de su horario fijo de ese día. Una falta, aun con aviso, no se paga.
- **Feriados:** la jornada trabajada en un feriado (`eventDayType`) **se paga al doble**. El
  feriado que no trabajó no se paga, por la regla de arriba (lectura mía de "sólo se pagan las
  jornadas que asisten"; confirmarlo con Daniel antes de la etapa 4). La alerta "No abrió un día
  que le tocaba" no salta en los feriados.
- **Mes de la liquidación:** es el mes **trabajado**. La liquidación de noviembre es por lo
  trabajado en noviembre.
- **Tiempo frente al horario:** minutos de llegadas tarde, salidas temprano y tiempo de más, con
  cuánto de eso fue sin actividad, y el saldo del mes. **No cambia el pago.**
- **Horas extra:** no se pagan solas. El dueño las aprueba con un botón ("Pagar estas horas"),
  a valor de jornada ÷ 5 por hora, en proporción.
- **Adelantos y pagos:** todo egreso de sueldo, sea adelanto o pago, se asigna a una persona y a
  un mes de liquidación. Se cargan en la Caja como hoy (egreso en "Sueldos") y se unen a la
  empleada con una tabla de enlace, porque la regla del modelo es que `CashMovement` no cambia.
  Al cargar un egreso en "Sueldos", la pantalla pide a quién corresponde y de qué mes (decisión
  mía). Lo pendiente de pago es el total menos lo enlazado. El adelanto existente de 300.000 pesos va a
  **Camila, liquidación de noviembre 2026** (Daniel, 21/10).
- **Comisiones** y **premios** del mes.
- **Total a pagar** y estado: borrador → cerrada. Una liquidación cerrada queda congelada, igual
  que el arqueo de un turno.
- **Día por día:** horario, apertura, cierre y diferencia, con las marcas de "sin cierre propio".

Pagar el sueldo **no** genera un movimiento de caja automático en esta etapa. Daniel lo carga como
hoy, y la liquidación muestra lo que ya se pagó desde la Caja.

### 7. Logros, conclusiones y premios

- **Catálogo de logros:** mes sin diferencias de caja; cerró siempre su propio turno; todas las
  ventas en la caja correcta; puntualidad del mes (cero o un retraso); nunca dejó la caja abierta;
  mejor mes de ventas desde que usa el sistema; superó el promedio de sus últimos 3 meses; racha
  de N días sin alertas.
- **Conclusiones del mes,** sólo para el dueño: un texto corto por persona con lo que hizo bien,
  lo que puede mejorar y cómo viene frente a sus meses anteriores. Se arma con reglas a partir de
  los mismos datos, sin inteligencia artificial en esta etapa.
- **Premios:** el dueño asigna a cada logro un premio, que puede ser un monto en pesos, un día
  libre o sólo un reconocimiento. Todos empiezan **apagados**. Cuando se aprueban, entran a la
  liquidación.
- **Lo que ve la empleada:** una sección "Mis logros" con sus logros y premios. Nunca ve alertas,
  errores ni conclusiones de mejora.

### 8. Comisiones por rubro

- Un porcentaje por rubro de ingreso, todos en **0 %** al empezar.
- **Por ítem, no por venta (decisión mía):** cada ítem vendido toma el rubro de ingreso de su
  producto. Una venta con productos de varios rubros reparte la comisión según cada uno. El
  constructor elige la tabla de rubro que tengan los productos del mostrador.
- **Base:** las ventas `COMPLETADA` de mostrador hechas por la persona (`Sale.createdByUserId`),
  menos las anuladas en el mes, a precio efectivamente cobrado.
- Entran solas a la liquidación del mes.

### 9. Saldo inicial de cuenta de caja

Hoy cualquier ingreso que no sea un pase cuenta como ingreso en los informes. El 21/10 se cargó
el saldo inicial de la Caja fuerte de DNX Estudio (movimiento `cmfix1021saldoinicial`, 193.900
pesos, sin categoría), y por eso aparece como "Sin rubro" en los informes de octubre.

Hace falta una forma de marcar un movimiento como **saldo inicial**: que sume al saldo de la
cuenta pero quede afuera de ingresos y egresos, igual que las patas de un pase. Después se
convierte ese movimiento. Es un cambio de Caja para todos los espacios y no depende del módulo
Equipo (decisión mía).

## Visibilidad y permisos

- **Dueño o administrador** (`canManageWorkspaceSettings`): todo el panel Equipo.
- **STAFF:** sólo los mensajes, el aviso de salida, el saludo de cumpleaños y "Mis logros".
- Es un módulo nuevo del registro (`lib/modules/registry.ts`), encendido sólo en DNX Estudio.

## Orden de construcción (decisión mía)

0. Saldo inicial de caja (chico, independiente).
1. Fichas de empleada, horario con sábados alternados, jornada del día y pase de turno entre
   empleadas.
2. Mensajes: saludo al abrir, aviso de salida, saludo al cerrar, cumpleaños y feriados.
3. Panel de alertas con histórico y filtros.
4. Liquidación mensual con adelantos y horas extra.
5. Logros, conclusiones y premios.
6. Comisiones por rubro.

Cada etapa sale a producción por separado. FOTOFFICE no tiene staging, y las migraciones se
aplican a mano y se registran con `resolve`.

## Lo que queda a criterio del constructor

- Nombres de tablas y columnas, siguiendo el estilo del esquema: comentarios en castellano y
  relaciones inversas sin cambiar `CashMovement`.
- Umbrales por defecto (egreso grande, diferencia importante), siempre configurables desde
  Equipo → Configuración.
- Cómo se guarda el repertorio de mensajes y cómo se evita repetirlos.
- Cómo se muestran "Mis logros" a la empleada, mientras sea fácil de encontrar desde su menú.

## Pendientes de Daniel

- Valor de la jornada de cada una.
- Fechas de nacimiento.
- Qué sábado arranca cada una (la fecha de referencia de la alternancia).
- Si las vacaciones se pagan (no hace falta hasta la etapa 4).

## Fuera de este documento

Daniel pidió también una **página de análisis de ventas**: horas pico de atención, días de mejores
ventas con estadísticas y análisis por producto. Es independiente de Equipo (sale sólo de las
ventas), así que lleva su propio diseño.
