# Etapa 0.4 · El motor de etapas

> 30/09/2026 · Diseño aprobado por Daniel en la conversación del 30/09. Parte de la Etapa 0 (Cimientos)
> del reemplazo de Alboom (`docs/alboom/00-mapa-general-y-plan.md` §3.1 y §4). Se apoya en 0.1
> (permisos, PR 277), 0.2 (listado estándar, PR 281) y 0.3 (ficha estándar y línea de tiempo, PR 286).

## 1. Qué problema resuelve

En Alboom hay dos motores parecidos y separados: los **embudos** de las oportunidades y los **flujos**
de los proyectos (`docs/alboom/01-…` §3 y `03-…` §4–5). Los dos guardan la etapa **por posición**: si
se reordena una etapa, cada registro pasa a "apuntar" a otra. Las tareas de cada etapa son texto con
`[ ]` que nadie tilda. DNX tiene 4 embudos y 17 flujos (`docs/alboom/09-configuracion-real-dnx.md`),
103 oportunidades y 56 proyectos vencidos y 494 tareas pendientes el día del relevamiento.

En FOTOFFICE no hay motor: Captación (`ServiceSalesLead`) tiene un estado fijo (NEW, CONTACTED,
QUOTED, INTERESTED, WON, LOST) que se muestra como etiqueta, sin tablero ni cambio desde la lista, y
Coberturas tiene su recorrido escrito a mano.

## 2. Alcance

**Entra:**

1. Motor de etapas genérico: circuitos, etapas, recorridos, historial, tareas, vencimientos,
   proyección, reglas de avance automático, motivos de pérdida.
2. Configuración → Circuitos (Dueño y Administrador).
3. Carga inicial de DNX Estudio: sus 4 embudos y 17 flujos de Alboom, con los nombres corregidos.
4. **Estreno en Captación**: tablero por etapas, "Modo lista", ficha de la consulta con su recorrido,
   tareas e historial.
5. "Mis tareas" en el inicio del panel.
6. Informe por circuito: días promedio y pérdidas por etapa.

**No entra (queda anotado):**

- Consultas completas (etapa 1): Captación es su embrión; la etapa 1 la amplía.
- Proyectos (etapa 4): los 17 flujos quedan cargados y listos, sin registros que los usen.
- Pasar Coberturas al motor: cuando se toque ese módulo.
- Disparadores reales de avance automático más allá de "consulta nueva": cada módulo los conecta
  cuando exista (Presupuestos, Contratos, Galería, DNX FLUX, Cobranzas).
- Mensajes automáticos al cambiar de etapa (correo/WhatsApp): etapa 0.6, Plantillas.

## 3. Cómo lo vive quien usa el sistema

### 3.1 Circuitos y etapas (Configuración → Circuitos)

- Dos clases de circuito: **de venta** (embudos) y **de trabajo** (flujos de proyecto).
- Cada circuito: nombre, clase, activo/inactivo, y sus etapas en orden. Clonar un circuito copia sus
  etapas y tareas modelo.
- Cada etapa: nombre, color (paleta fija de 8, la misma de las etiquetas), **días de duración**
  (0 = sin vencimiento), **tareas modelo** (texto, días desde que se entra a la etapa, obligatoria o no)
  y la marca **"exige tareas completas para avanzar"**.
- Las etapas se **reordenan arrastrando**. Cada etapa tiene identidad propia: reordenar, renombrar o
  agregar etapas **nunca** cambia en qué etapa está un registro en marcha. Una etapa con registros
  adentro no se puede borrar: se archiva (deja de aparecer para registros nuevos; los que están adentro
  siguen y se pueden mover).
- Cada circuito termina en **salidas fijas**: **Ganada / Perdida** (venta) o **Terminado / Cancelado**
  (trabajo). Perder o cancelar pide un **motivo** de una lista editable por organización.
- Cada etapa puede tener **reglas de avance automático**: "cuando pase *evento*, pasar a esta etapa"
  (ver §3.6).

### 3.2 Carga inicial de DNX Estudio

- Los 4 embudos (Colaboradores, Embudo de Ventas DNX 2022, Plataforma 360, Workshops) y los 17 flujos
  con sus etapas, días y tareas tal como están en `09-configuracion-real-dnx.md`, con las erratas
  corregidas ("oportunidnad", "Confecciónar", "Eidción", "Instalr").
- Las tareas `[ ]` de Alboom pasan a tareas modelo, una por línea.
- "Stand de glitter" queda **sin tareas** (en Alboom eran una copia de Selpix) para que Daniel las
  complete.
- Motivos de pérdida iniciales: Precio, Fecha no disponible, Eligió a otro, No respondió, Canceló el
  evento, Otro.
- Las demás organizaciones arrancan sin circuitos; al abrir el tablero de Captación por primera vez se
  les crea uno de venta mínimo: Nueva → Contactada → Presupuesto enviado → Interesada.

### 3.3 El tablero

- Una columna por etapa activa y una tarjeta por registro: nombre, tipo y fecha del evento, días en la
  etapa, tareas pendientes ("2/3") y **punto rojo si la etapa está vencida**.
- Se mueve **arrastrando** en la computadora y con **"Mover a…"** en el celular (y como alternativa
  accesible con teclado).
- Arriba: selector de circuito, filtro por responsable y "sólo vencidas". A la derecha, las zonas
  **Ganada / Perdida**; al soltar en Perdida se pide el motivo. Ganadas y perdidas no ocupan columnas:
  se ven en el "Modo lista" filtrando por resultado.
- Una etapa que "exige tareas completas" no deja entrar a la siguiente con tareas obligatorias
  pendientes: avisa cuáles faltan. Dueño y Administrador pueden pasar igual; queda registrado como
  "avanzó con tareas pendientes".
- "Modo lista": el listado estándar (0.2) de Captación, con filtros por circuito, etapa, resultado,
  responsable y vencidas.

### 3.4 Tareas

- Al **entrar** en una etapa se crean sus tareas modelo como tareas reales: vencimiento = fecha de
  entrada + días de la tarea; responsable = el del registro (si no tiene, sin asignar).
- Se tildan desde la tarjeta, desde la ficha o desde "Mis tareas". Se pueden sumar tareas sueltas.
- Al **salir** de una etapa, sus tareas pendientes quedan como están (no se borran) y siguen
  apareciendo en "Mis tareas" con la etapa de origen.
- **Mis tareas** (inicio del panel): tres grupos — vencidas, hoy, próximos 7 días — con enlace al
  registro.

### 3.5 Vencimientos, proyección e historial

- Vencimiento de la etapa = fecha de entrada + días de la etapa (hora de Buenos Aires; vence al final
  de ese día). Se puede cambiar a mano con nota.
- **Proyección** en la ficha: encadena las etapas que faltan con sus días. Si la etapa actual ya venció,
  calcula desde hoy y lo dice: "Los plazos se calcularon desde hoy porque la etapa está vencida."
- **Historial**: cada movimiento guarda quién, cuándo, de qué etapa a cuál, nota y si fue manual o
  automático. Aparece en la línea de tiempo de la ficha (0.3) como tipo "Etapas".
- **Informe por circuito**: para cada etapa, días promedio de permanencia y cuántos registros salieron
  perdidos/cancelados desde ella, en un período elegible.

### 3.6 Avance automático (mecanismo)

- Un módulo avisa "pasó *evento* sobre este registro" (`notificarEvento`). El motor busca en el
  circuito del registro una regla para ese evento y, si existe, mueve el registro a la etapa de la regla.
- Eventos reconocidos desde esta etapa: `CONSULTA_RECIBIDA` (conectado: pone la consulta nueva en la
  primera etapa), `PRESUPUESTO_ACEPTADO`, `CONTRATO_FIRMADO`, `SENA_COBRADA`, `BACKUP_TERMINADO`,
  `GALERIA_PUBLICADA` (declarados; se conectan en sus etapas).
- **Nunca retrocede**: si el registro ya está en una etapa posterior a la de la regla, no hace nada.
- Queda en el historial como "Sistema" con el nombre del evento.
- Un evento repetido (mismo evento, mismo registro) no mueve dos veces.

### 3.7 Captación con el motor

- Cada consulta nueva entra sola en la primera etapa del circuito de venta **predeterminado** de la
  organización (para DNX: "Embudo de Ventas DNX 2022"). El circuito predeterminado se elige en
  Configuración → Circuitos.
- **Compatibilidad**: el estado de hoy (`ServiceSalesLead.status`) se sigue actualizando. Cada etapa de
  un circuito de venta puede indicar a qué estado equivale; ganar → WON, perder → LOST. Así nada de lo
  que ya lee el estado se rompe.
- Las consultas existentes se enganchan una vez a su circuito: NEW → primera etapa; CONTACTED,
  QUOTED, INTERESTED → la etapa marcada con ese estado (o la primera si ninguna lo está); WON/LOST →
  salida Ganada/Perdida con motivo "Otro".
- Captación pasa a vivir dentro del panel (`app/(shell)`), como el resto de los módulos: ruta
  `/captacion` (tablero) con la ficha de cada consulta en `/captacion/[id]`. La ruta vieja
  `/dashboard/service-leads` redirige.

## 4. Cómo está hecho

**Enfoque (A, elegido):** un motor propio que se engancha a cualquier registro. Se descartaron guardar
la etapa en cada módulo (duplica historial, tareas y vencimientos, y agrega columnas a tablas
existentes) y seguir con pasos fijos en el código.

### 4.1 Modelo

- `FotofficeCircuit`: workspaceId, name, kind (`VENTA` | `TRABAJO`), isActive, isDefault (uno por
  clase y workspace), createdAt.
- `FotofficeStage`: circuitId, name, color, order, days, requireTasks, leadStatus? (sólo venta),
  archivedAt?.
- `FotofficeStageTaskTemplate`: stageId, title, days, required, order.
- `FotofficeStageRule`: stageId, event (texto de la lista de eventos).
- `FotofficeLossReason`: workspaceId, name, order, isActive.
- `FotofficeJourney` (el recorrido): workspaceId, circuitId, subjectType (`CAPTACION` hoy;
  `CONSULTA`, `PROYECTO`, `COBERTURA` después), subjectId, stageId? (null cuando terminó), outcome?
  (`GANADA` | `PERDIDA` | `TERMINADO` | `CANCELADO`), lossReasonId?, enteredStageAt, stageDueAt?,
  ownerUserId?, closedAt?; único activo por (workspace, subjectType, subjectId, clase del circuito).
- `FotofficeJourneyStep` (historial): journeyId, fromStageId?, toStageId?, outcome?, note?, auto
  (bool), event?, forcedWithPendingTasks (bool), actorUserId?, actorLabel, createdAt.
- `FotofficeTask`: workspaceId, journeyId?, stageId?, subjectType, subjectId, title, dueAt?,
  assigneeUserId?, required, doneAt?, doneByUserId?, createdByUserId?, createdAt.
- `FotofficeProcessedEvent`: journeyId, event, sourceRef — único, para no procesar dos veces el mismo
  evento.

Ninguna columna nueva en tablas existentes (tampoco en `ServiceSalesLead`). Migración a mano, **tablas
antes que el código**, con la carga de los circuitos de DNX y el enganche de las consultas existentes
en el mismo SQL, idempotente.

### 4.2 Motor (`lib/circuitos/`)

- `mover(ctx, journeyId, destino, { nota, forzar })` — valida etapa del mismo circuito, tareas
  obligatorias, crea el paso, cierra/crea tareas, recalcula vencimiento, actualiza el estado
  compatible del sujeto (Captación) — todo en una transacción, con control de concurrencia por
  `enteredStageAt` (si alguien movió antes, "Esta consulta cambió mientras tanto").
- `iniciarRecorrido(ctx, sujeto, circuitoId?)`, `cerrar(ctx, journeyId, salida, motivo?)`,
  `notificarEvento(workspaceId, sujeto, evento, sourceRef)`.
- `proyeccion(etapas, recorrido, hoy)` — pura.
- `informeCircuito(workspaceId, circuitId, periodo)`.
- Adaptador por tipo de sujeto (`sujetos/captacion.ts`): cómo se llama, a qué ficha lleva, cómo
  actualizar su estado compatible.

### 4.3 Permisos

| Qué | Capacidad |
|---|---|
| Ver tablero, ficha y "Mis tareas" | guarda del módulo (Captación: la de hoy) |
| Mover, ganar, perder, tildar y crear tareas, cambiar vencimiento | `operar` |
| Pasar con tareas obligatorias pendientes | `configurar` |
| Circuitos, etapas, tareas modelo, reglas, motivos, circuito predeterminado | `configurar` |

## 5. Errores y casos borde

- Dos personas mueven la misma tarjeta a la vez: la segunda recibe "cambió mientras tanto" y el
  tablero se refresca.
- Mover a una etapa de otro circuito o archivada: rechazado.
- Borrar un circuito con recorridos activos: no se puede; se desactiva.
- Evento que llega para un registro sin recorrido o sin regla: se ignora sin error.
- Evento repetido: se ignora (`FotofficeProcessedEvent`).
- Etapa con 0 días: sin vencimiento ni punto rojo.

## 6. Pruebas

- Reordenar etapas no cambia la etapa de ningún recorrido.
- Mover crea el paso, las tareas de la etapa nueva y el vencimiento correcto en hora de Buenos Aires.
- Tareas obligatorias bloquean el avance; `configurar` puede forzarlo y queda registrado.
- Avance automático: mueve hacia adelante, nunca atrás, no repite eventos.
- Proyección: encadena días; si está vencida, calcula desde hoy.
- Compatibilidad: el estado de `ServiceSalesLead` sigue a la etapa; ganar/perder → WON/LOST.
- Aislamiento: ningún recorrido, tarea o circuito se lee o escribe con otro workspace.
- Carga de DNX: 4 embudos y 17 flujos con sus etapas y tareas; el SQL corre dos veces sin duplicar.

## 7. Criterios para el tablero de avance

1. DNX ve sus consultas en el tablero del Embudo de Ventas DNX 2022 y las mueve arrastrando.
2. Al entrar en una etapa se crean sus tareas, que se tildan.
3. Una etapa vencida se ve en rojo y aparece en "Mis tareas".
4. La ficha de una consulta muestra su historial de etapas y la proyección.
5. Se pierde una consulta con motivo y aparece en el informe del circuito.
6. Daniel reordena etapas en Configuración y ninguna consulta cambia de etapa.

## 8. Orden de publicación

1. 0.1, 0.2 y 0.3 fusionadas (PR 277, 281, 286).
2. SQL de las tablas nuevas + carga de DNX + enganche de consultas, en staging y después en FOTOFFICE.
3. Código.
4. Prueba en producción con las consultas reales de DNX Estudio.
