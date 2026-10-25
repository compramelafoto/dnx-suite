# FOTOFFICE — Gobierno institucional: Proyectos y Reuniones

Fecha: 2026-10-03 · Estado: diseño aprobado en conversación, pendiente de revisión escrita.

## 1. Problema

Hoy la comisión directiva de la SFPR trabaja por un grupo de WhatsApp: ahí se nombran los
temas de la próxima reunión, y después se escribe un resumen de lo decidido sobre cada
proyecto. No queda un lugar donde ver en qué estado está cada proyecto, quién tiene que hacer
qué, cuánto cuesta, cuánto se gastó ni qué se decidió y cuándo. Hay proyectos abiertos y en
ejecución que viven sólo en la memoria del grupo.

## 2. Qué resuelve

- Cada proyecto tiene una ficha con su recorrido completo, desde que alguien lo propone hasta
  que se termina, con etapas, tareas delegadas, archivos, cotizaciones, dinero e historial.
- El temario de la reunión se arma solo, y al tratarlo se genera el acta.
- La comisión vota cada proyecto; el apoyo y la fecha límite ordenan las prioridades.
- Los socios proponen proyectos, ven los que la comisión hace visibles y cumplen las tareas que
  se les asignan.
- Cada gasto e ingreso del proyecto es un movimiento de Caja: el dinero vive en un solo lugar.

## 3. Ubicación en el producto

Se implementa el módulo reservado `governance` ("Gobierno institucional", categoría
`INSTITUTIONAL`, hoy `PLANNED` en `lib/modules/registry.ts`). Tiene dos secciones:
**Proyectos** y **Reuniones**. El ítem "Institucional" del portal (`lib/portal/menu.ts`,
`requiresModule: "governance"`, `built: false`) pasa a `built: true` en la etapa 4.

Se descartó hacer "Proyectos" un módulo aparte: no hay hoy un cliente que quiera proyectos sin
comisión, y temario y proyectos se alimentan mutuamente.

## 4. Decisiones tomadas

| # | Decisión |
|---|---|
| 1 | Visibilidad: la comisión ve todo. Cada proyecto tiene "visible para socios" (por defecto **no**). Los socios sólo leen. |
| 2 | Asignar dinero es **reservar sin mover**: la plata sigue en sus cuentas; Caja muestra *saldo total* y *saldo libre*. |
| 3 | Proponen la comisión **y los socios** desde el portal, con archivos adjuntos de cualquier tipo. |
| 4 | El voto de la comisión **mide apoyo**; la aprobación formal se registra en reunión. |
| 5 | Votan quienes tienen **cargo vigente** en la comisión (diseño de Roles). No hay una lista propia. |
| 6 | Hay **tipos de proyecto** (plantillas) con etapas y tareas que se copian al crear el proyecto. |
| 7 | Las tareas se asignan a integrantes de la comisión **o a cualquier socio**. |
| 8 | El necesario se arma con **cotizaciones recibidas** por etapa, no con un solo número. |
| 9 | En los proyectos visibles, el socio ve **los cuatro números** (necesario, asignado, gastado, restante). |
| 10 | Nada se borra: las correcciones son entradas nuevas en el historial. |

## 5. El proyecto

### 5.1 Datos

Título, descripción, tipo, responsable general, fecha límite (opcional), visible para socios
(sí/no), origen (`COMMISSION` o `MEMBER_PROPOSAL`, con el socio que propuso), archivos.

### 5.2 Estados

```
Propuesta de socio ──(la comisión la acepta)──► Propuesto
        └──(la archiva, con motivo)──► Archivada

Propuesto ──► En tratamiento ──► Aprobado ──► En ejecución ──► Terminado
                    ├──► Postergado (vuelve a En tratamiento)
                    └──► Rechazado
Cualquier estado activo ──► Cancelado (con motivo)
```

Claves: `MEMBER_PROPOSAL`, `ARCHIVED`, `PROPOSED`, `IN_REVIEW`, `POSTPONED`, `REJECTED`,
`APPROVED`, `IN_PROGRESS`, `DONE`, `CANCELLED`.

Reglas:

- Pasar a `APPROVED`, `REJECTED` o `POSTPONED` exige elegir la reunión donde se decidió y
  congela el resultado de la votación en ese momento.
- `ARCHIVED`, `CANCELLED` y `REJECTED` exigen motivo.
- La votación está abierta en `PROPOSED`, `IN_REVIEW` y `POSTPONED`; se cierra al decidir.
- Sólo `APPROVED` e `IN_PROGRESS` aceptan reservas, gastos e ingresos.
- Etapas, tareas y cotizaciones se pueden cargar desde `PROPOSED` (sirven para presentar el
  proyecto); las tareas sólo pueden marcarse hechas desde `APPROVED`.
- Al pasar a `DONE` o `CANCELLED`, la reserva sobrante se libera sola (ver §8.4).

### 5.3 Tipos de proyecto, etapas y tareas

```
Proyecto: "Muestra Día de la Fotografía"   (tipo: Muestra fotográfica)
 ├─ Etapa: Difusión
 │    ├─ Tarea: Diseñar el flyer          → Ana · 10/10 · hecha
 │    └─ Tarea: Publicar en redes         → Juan · 15/10 · pendiente
 ├─ Etapa: Impresión de obras
 ├─ Etapa: Armado de galería
 └─ Etapa: Buffet
```

- **Tipo de proyecto** (por workspace): nombre y lista ordenada de etapas, cada una con sus
  tareas modelo. Vienen sembrados: *Muestra fotográfica*, *Evento o celebración*, *Curso o
  taller*, *Compra u obra*, *En blanco*. El workspace los edita y crea los suyos.
- Al crear un proyecto, las etapas y tareas del tipo se **copian**. Desde ahí el proyecto es
  independiente: editar la plantilla no cambia proyectos existentes.
- **Etapa**: título, orden, costo estimado manual (opcional). Se completa cuando todas sus
  tareas están `DONE` o `NOT_DONE`.
- **Tarea**: título, descripción, responsable (cualquier socio del workspace, o sin asignar),
  fecha, estado `PENDING` | `IN_PROGRESS` | `DONE` | `NOT_DONE` (este último con motivo).
- **Avance de tarea**: texto + archivos, con autor y fecha. Lo cargan el responsable o la
  comisión.
- El proyecto muestra el avance por etapa ("Difusión 2/3") y total.

## 6. Archivos

- Se adjuntan al proyecto, a una tarea (en un avance) o a una cotización.
- Cualquier tipo de archivo, hasta 25 MB cada uno. Se guardan en el bucket R2 propio de
  FOTOFFICE con subida directa firmada (`lib/images/r2-presign.ts`), bajo
  `governance/<workspaceId>/<projectId>/`.
- Cada archivo es **interno por defecto**; la comisión puede marcarlo "visible para socios".
  Los archivos de cotizaciones nunca son visibles (pueden tener datos del proveedor).
- La descarga pasa siempre por una ruta que verifica permiso y firma la URL por pocos minutos.

## 7. Votación y prioridades

- Voto `FOR` | `AGAINST`, uno por integrante con cargo vigente y proyecto. Se puede cambiar
  mientras la votación esté abierta.
- Dentro de la comisión el voto es nominal. El socio ve sólo el total ("5 de 7 a favor").
- Al decidir en reunión se guarda una foto del resultado (a favor, en contra, sin votar,
  total de habilitados).
- **Urgencia** por fecha límite: rojo (vencida o < 15 días), amarillo (15–45), verde (> 45),
  gris (sin fecha).
- **Lista de prioridades**: ordenada por urgencia y, dentro de cada color, por porcentaje a
  favor. Se muestran los dos datos; no hay un puntaje único.

## 8. Dinero

### 8.1 Cotizaciones recibidas

Se llaman **cotizaciones** para no confundirlas con el módulo *Presupuestos* (lo que el
fotógrafo envía a su cliente).

- Por etapa (opcionalmente por tarea): proveedor, monto, fecha, válida hasta, archivo, nota,
  estado `RECEIVED` | `CHOSEN` | `DISCARDED` (motivo opcional). A lo sumo una `CHOSEN` por
  etapa.
- Las vencidas se marcan.

### 8.2 Los cuatro números

| Número | Cálculo |
|---|---|
| **Necesario** | Suma por etapa: cotización elegida; si no hay, la mayor de las recibidas; si no hay ninguna, el costo estimado manual. Se muestra con el detalle ("3 elegidas, 1 en rango, 1 estimada") y el rango mínimo–máximo cuando corresponde. |
| **Asignado** | Reservas vigentes + ingresos de Caja marcados con el proyecto + asignado inicial. |
| **Gastado** | Egresos de Caja marcados con el proyecto (no anulados) + gastado inicial. |
| **Restante** | Asignado − Gastado. |

Además: **Falta conseguir** = Necesario − Asignado (si es positivo). Si Gastado > Asignado, el
proyecto se marca en rojo y se avisa, sin bloquear el registro del gasto.

### 8.3 Reservas

Tabla propia (no son movimientos de Caja): monto positivo (reservar) o negativo (liberar),
motivo, reunión opcional, autor, fecha. No están atadas a una cuenta.

### 8.4 Integración con Caja

- `CashMovement` gana `projectId`, `projectStageId` y `projectQuoteId` (opcionales).
- Desde Caja, al cargar un ingreso o egreso, se puede elegir un proyecto `APPROVED` o
  `IN_PROGRESS`. Desde el proyecto, "Registrar gasto" / "Registrar ingreso" crean el
  movimiento en Caja con `sourceModule: "governance"`. Un movimiento existe una sola vez.
- La anulación de Caja (`reversesMovementId`) se respeta: un gasto anulado deja de sumar.
- Gasto atado a cotización → se muestra el desvío ("cotizado $300.000, pagado $340.000, +13%").
- **Saldo libre** en Caja = saldo total − Σ Restante de proyectos `APPROVED`/`IN_PROGRESS` (sólo
  los restantes positivos).
- Al pasar un proyecto a `DONE`/`CANCELLED` se crea una reserva negativa por el restante, con
  motivo automático, y queda en el historial.
- Si el workspace no tiene Caja encendida, la sección de dinero muestra sólo el Necesario y
  las cotizaciones.

### 8.5 Proyectos que ya estaban en curso

Campos de apertura: *asignado antes de usar el sistema*, *gastado antes de usar el sistema* y
su fecha. No generan movimientos en Caja.

### 8.6 Permisos sobre el dinero

Reservas, gastos e ingresos: quien tenga Caja en "Gestionar". El resto de la comisión ve los
números.

## 9. Reuniones

- **Reunión**: fecha y hora, lugar o enlace, asistentes (de los integrantes con cargo vigente),
  estado `PLANNED` | `HELD` | `MINUTES_APPROVED`.
- **Temario**: se precarga con los proyectos `PROPOSED`, `IN_REVIEW` y `POSTPONED`, más los
  **temas sueltos** que cualquier integrante agregue. Orden por defecto: lista de prioridades;
  se puede reordenar.
- **Tratamiento**: a cada ítem se le escribe la decisión en texto; si es un proyecto, el
  resultado (`APPROVED`, `REJECTED`, `POSTPONED` o `CONTINUES`), que cambia el estado del
  proyecto y congela su votación.
- **Acta**: se arma con fecha, asistentes e ítems con su decisión; descarga en PDF. Al
  aprobarla queda fija; las correcciones posteriores son notas agregadas. Cada decisión se ve
  en el historial del proyecto con enlace al acta.

## 10. Portal del socio ("Institucional")

- **Proyectos**: los visibles, con estado, etapas y avance, los cuatro números, resultado de la
  votación y archivos marcados como visibles.
- **Proponer un proyecto**: título, descripción, costo aproximado, fecha límite opcional,
  archivos. Ve el estado de sus propuestas: en revisión, aceptada (enlace al proyecto si es
  visible) o archivada (con motivo).
- **Mis tareas**: sus tareas en cualquier proyecto, aunque sea interno; ve el título del
  proyecto y de la etapa, no el resto. Carga avances y marca hecha o "no se hizo".

## 11. Correos

Por Resend, como el resto de los avisos a socios.

| Evento | Destinatario |
|---|---|
| Te asignaron una tarea | Responsable |
| Resumen diario: tareas que vencen en 3 días y vencidas | Cada responsable (un solo correo) |
| Llegó una propuesta de socio | Integrantes con cargo vigente |
| Tu propuesta fue aceptada / archivada | Socio que propuso |
| Temario de la próxima reunión | Integrantes con cargo vigente |
| Acta aprobada | Integrantes con cargo vigente |

## 12. Historial

Tabla única de eventos por proyecto: tipo, autor, fecha, datos (JSON) y referencias (tarea,
reunión, movimiento, cotización). La generan todas las acciones: cambio de estado, voto,
decisión, tarea creada, asignada, hecha o no hecha, avance, archivo, cotización, reserva,
gasto, ingreso, anulación, nota manual. Se muestra como una línea de tiempo con filtros.

## 13. Permisos

| Acción | Quién |
|---|---|
| Ver todos los proyectos y reuniones | Gobierno en "Ver" o más |
| Crear y editar proyectos, etapas, tareas, cotizaciones; cambiar estados; reuniones y actas | Gobierno en "Gestionar" |
| Votar | Cargo vigente en la comisión |
| Reservas, gastos, ingresos | Caja en "Gestionar" |
| Cargar avance y cerrar su tarea | Responsable de la tarea (también desde el portal) |
| Proponer | Cualquier socio activo del workspace |

Se apoya en `getModuleLevel` (Roles etapa 1) y en los cargos (Roles etapa 2).

## 14. Modelo de datos (borrador)

Prefijo `Gov`. Todas con `workspaceId` y `onDelete: Cascade` desde `Workspace`.

- `GovProjectType`, `GovProjectTypeStage`, `GovProjectTypeTask` — plantillas.
- `GovProject` — estado, origen, `proposedByMemberId`, `visibleToMembers`, `deadlineAt`,
  `openingAssignedArs`, `openingSpentArs`, `openingAt`, `manualNeededArs`.
- `GovProjectStage`, `GovProjectTask`, `GovTaskUpdate`.
- `GovAttachment` — `projectId`, `taskUpdateId?`, `quoteId?`, clave R2, nombre, tipo, tamaño,
  `visibleToMembers`.
- `GovQuote` — `stageId`, `taskId?`, proveedor, monto, `validUntil`, estado.
- `GovReservation` — monto con signo, motivo, `meetingId?`.
- `GovVote` — `@@unique([projectId, voterUserId])`.
- `GovMeeting`, `GovMeetingAttendee`, `GovMeetingItem` (proyecto o tema suelto, decisión,
  resultado, foto de la votación).
- `GovProjectEvent` — historial.
- `CashMovement`: `projectId?`, `projectStageId?`, `projectQuoteId?`.

Los importes en `Decimal(12, 2)` como el resto de Caja.

## 15. Riesgos de despliegue

- El esquema es compartido y las migraciones se aplican a mano. **Agregar columnas a
  `CashMovement` rompe toda lectura de Caja** en cualquier base donde el SQL no esté aplicado.
  El SQL de esa columna va a las bases que tienen las tablas de Caja **antes** de fusionar, y el
  PR lo dice explícitamente.
- FOTOFFICE no tiene staging: se prueba en local contra una rama de Neon y se publica a
  producción.
- Igual que en Cuotas, el código que toca Caja pregunta si Caja está encendida antes de
  consultar sus tablas.

## 16. Etapas

| Etapa | Contenido | Resultado visible |
|---|---|---|
| 0 | Roles etapas 1 y 2 (PR 317 + pantallas de integrantes y cargos) | La comisión existe en el sistema |
| 1 | Tipos, proyectos, estados, etapas, tareas, avances, archivos, historial; tablero de tareas | Proyectos fuera de WhatsApp, tareas delegadas |
| 2 | Reuniones, temario, votación, prioridades, acta en PDF | Reuniones con acta automática |
| 3 | Cotizaciones, reservas, gastos e ingresos atados a Caja, saldo libre | Cada proyecto en números |
| 4 | Portal: proyectos visibles, propuestas, Mis tareas; correos | Los socios participan |
| 5 | Carga de los proyectos en curso de la SFPR | Todo en un solo lugar |

La etapa 5 puede adelantarse apenas esté la 1.

## 17. Fuera de alcance

Asambleas y votación de socios, publicación de proyectos en el sitio web público, doble firma
de gastos, módulo Transparencia, conciliación bancaria (diseño aparte:
`2026-10-03-fotoffice-conciliacion-design.md`).

## 18. Pruebas

- Unitarias: transiciones de estado válidas e inválidas; cálculo de Necesario con las tres
  fuentes; Asignado/Gastado/Restante con anulaciones y saldos de apertura; saldo libre;
  liberación al terminar; orden de prioridades; quién puede votar.
- Acceso: un socio no ve proyectos internos ni archivos internos, ni votos nominales; un socio
  ve su tarea de un proyecto interno y nada más; sin Caja en "Gestionar" no se registra dinero.
- Idempotencia: "Registrar gasto" repetido no duplica el movimiento.
