# Etapa 4 · Proyectos y Agenda

> 08/10/2026 · Reemplazo de Alboom (`docs/alboom/00-mapa-general-y-plan.md` §4). Se apoya en las Etapas 0 a 3,
> ya en producción. El análisis de brecha está en la conversación del 08/10.
>
> **Decisiones de Daniel (08/10):**
> - El proyecto **nace al confirmar el pedido**, una sola vez y con vista previa.
> - **Un proyecto por cada producto con flujo** configurado. Un combo crea los proyectos de sus componentes.
> - Los plazos se cuentan **desde la fecha del evento**. Si no hay evento, desde la confirmación del pedido.
> - Agenda con **calendario propio en Google** ("DNX Agenda"), sincronizado **de ida y vuelta**. Las
>   reservas de espacios siguen como están.
>
> Lo demás va marcado **[decisión]**. **Sin staging.**

## 1. Qué problema resuelve

DNX trabaja cada encargo en Alboom como un **proyecto** con flujo de etapas y tareas. Tiene 17 flujos
(Cobertura y edición de fotografía, Fotolibro, Video…), un equipo de 7 personas y 16 roles de participante.
Al 29/09 había 56 proyectos vencidos y 494 tareas pendientes: es una herramienta de uso diario.

Los proyectos nacen del producto vendido cuando el pedido pasa a "Venta completada". La agenda muestra
capas (citas, fechas límite de proyectos y tareas) y se publica en Google sólo como suscripción de lectura,
que tarda unas 6 horas en actualizarse.

**Defectos de Alboom que no se copian:**
- etapas guardadas por posición;
- plazos recalculados "desde hoy" en cada cambio, que esconden el atraso;
- recrear un proyecto borra lo hecho;
- Google sólo de lectura y con demora.

**FOTOFFICE ya tiene:**
- el motor de etapas con circuitos de TRABAJO y los 17 flujos de DNX cargados, con tareas modelo, tablero,
  ficha, proyección de plazo y "mis tareas";
- la numeración `PROYECTO`;
- campos personalizados con `PROYECTO` reservado;
- pedidos con fecha de evento y confirmación transaccional;
- la grilla de agenda estilo Google de Reservas;
- la conexión con Google Calendar (OAuth, token cifrado, sincronización cada 10 minutos), hoy atada a las
  reservas de espacios.

## 2. Alcance

Dos entregas **[decisión]**.

### Entrega A · Proyectos

1. **Regla por producto** (Catálogo → ficha del producto → "Proyecto que genera"). Puede haber más de una
   por producto. Cada regla define:
   - el flujo (circuito de TRABAJO);
   - el responsable por omisión: un usuario, o vacío para usar el responsable del pedido;
   - los días desde el evento para la fecha final;
   - una plantilla de nombre, por omisión «{contacto} · {producto}».

   Un combo hereda las reglas de sus componentes, además de las suyas propias.
2. **Creación al confirmar el pedido**, en la misma transacción:
   - un proyecto por regla de cada ítem de catálogo (la cantidad no multiplica);
   - número `PROYECTO`;
   - recorrido del motor en la primera etapa del flujo;
   - tareas modelo con vencimiento relativo al evento.

   La vista previa de "Confirmar pedido" lista los proyectos que se van a crear y se puede destildar
   alguno. Después de confirmar se pueden **agregar** proyectos a mano desde el pedido: "Agregar proyecto",
   con flujo a elección. **Nunca se borra** un proyecto por editar el pedido.
3. **Fechas:**
   - **fecha final** = evento + días de la regla, o la confirmación + días si no hay evento;
   - las etapas reparten su vencimiento **planificado** sumando sus días desde la fecha base;
   - el plan no se mueve aunque alguien se atrase;
   - se muestra el **atraso acumulado**: días entre el vencimiento planificado de la etapa actual y hoy;
   - el vencimiento de las tareas modelo = vencimiento planificado de su etapa + sus días **[decisión]**.
4. **Estados:** salen del recorrido del motor: en curso, terminado o cancelado (con motivo). Se suma
   "Suspendido" como marca del proyecto, con motivo, que oculta sus vencimientos de "Mis tareas" y de los
   vencidos.
5. **Equipo:**
   - responsable y delegado;
   - **participantes con rol**: usuarios del equipo o contactos (proveedores, salón, DJ). Usa los 16 roles
     de DNX, que se siembran como roles de participante de proyecto;
   - cada tarea puede tener responsable; por omisión, el responsable del proyecto.
6. **Pantallas:**
   - **lista estándar** con número, nombre, contacto, flujo, etapa, fecha final, atraso, responsable y
     estado. Filtros: flujo, etapa, responsable, vencidos, suspendidos y terminados. Acciones en lote:
     responsable, suspender, reanudar;
   - **tablero Kanban** por flujo, con el del motor parametrizado;
   - **ficha**: datos, recorrido con etapas y proyección, tareas, participantes, pedido vinculado, notas,
     adjuntos y campos personalizados `PROYECTO`;
   - **"Mis entregas de la semana"** en el inicio;
   - tarjetas "Proyectos" en el pedido, la consulta y el contacto.
7. **Notas y adjuntos de proyecto** en tablas propias. Los adjuntos van al bucket privado, igual que los de
   la ficha.
8. **Motor:**
   - adaptador `PROYECTO`;
   - tablero, ficha, informe y eventos aceptan el sujeto y la clase por parámetro;
   - `SENA_COBRADA` también se avisa a los proyectos del pedido, si su flujo tiene regla para ese evento.
9. **Módulo `projects`** ("Proyectos"): pasa a disponible, con ruta `/proyectos` y dependencia de
   `orders`.
10. **Semillas de DNX:**
    - roles de participante;
    - numeración `PROYECTO` con año y 4 dígitos (2026-0001), como todas;
    - **sin reglas por producto**: las carga Daniel en el catálogo, porque en Alboom no está relevado qué
      producto crea qué proyecto.

### Entrega B · Agenda

1. **Citas propias:**
   - título, tipo con color, estado, inicio y fin, todo el día, lugar, notas;
   - responsable;
   - participantes: usuarios y contactos;
   - origen opcional: proyecto, pedido, consulta o contacto.

   Estados: Agendada, Confirmada, Realizada y Anulada **[decisión: los 6 de Alboom se reducen; "En curso" y
   "Reprogramado" no aportan]**. Los tipos de cita de DNX se siembran desde `docs/alboom/09`.
2. **Agenda** en `/agenda`:
   - vistas día, semana, mes y lista, reutilizando la grilla de Reservas;
   - **capas** que se encienden y apagan: citas, fechas finales de proyectos, tareas con vencimiento,
     vencimientos de cuotas, próxima acción de consultas, cumpleaños y reservas (sólo lectura);
   - filtro por usuario y por tipo;
   - **arrastrar** para reprogramar una cita.
3. **Citas desde el producto:** una regla por producto (tipo, días desde el evento, hora y duración,
   responsable) crea citas al confirmar el pedido, igual que los proyectos.
4. **Google Calendar de ida y vuelta:**
   - FOTOFFICE crea en la cuenta conectada un calendario "<organización> Agenda";
   - empuja citas y fechas finales de proyectos;
   - trae lo que se crea o mueve en ese calendario desde Google;
   - reutiliza la integración existente, su token y su cron cada 10 minutos, sumando el módulo `agenda`;
   - en un conflicto gana la última modificación.

   Las reservas no cambian.
5. **Recordatorio al cliente** de una cita, con plantilla automática, opcional y apagada por omisión.

**Fuera de alcance:**
- portal del cliente con proyectos (Etapa 7);
- avisos automáticos al cliente por etapa;
- disparadores de DNX FLUX y Galería (Etapa 7);
- recurrencia de citas;
- Gantt;
- calendarios personales de cada usuario;
- migración de Alboom (Etapa 8). Se deja `externalId` previsto.

## 3. Cómo está hecho

### 3.1 Datos (sólo tablas `Fotoffice*` nuevas)

**Entrega A**
- `FotofficeProyecto`:
  - workspaceId, number;
  - name, clientId, pedidoId?, pedidoItemIndex?, productId?, circuitId;
  - eventDate?, baseDate, finalDueDate?;
  - ownerUserId?, delegateUserId?;
  - suspendedAt?, suspendReason?;
  - externalId?, createdByUserId?, fechas.

  Únicos: (workspaceId, number) y (pedidoId, pedidoItemIndex, circuitId) para no duplicar al reintentar.
- `FotofficeProductoProyecto`: regla por producto.
- `FotofficeProyectoParticipante`: userId o clientId (exactamente uno, con CHECK), roleId y nota.
- `FotofficeProyectoRol`: roles de participante de proyecto por workspace.
- `FotofficeProyectoNota` y `FotofficeProyectoAdjunto`.
- La tarea del motor (`FotofficeTask`) ya tiene responsable y vencimiento. El vencimiento planificado de
  cada etapa se guarda en `FotofficeProyectoEtapaPlan` (proyectoId, stageId, plannedDueDate).
- El CHECK de `FotofficeMessageTemplate.entityType` y el de `FotofficeCustomField` se amplían con
  `PROYECTO`, si corresponde.

**Entrega B**
- `FotofficeCitaTipo`, `FotofficeCita`, `FotofficeCitaParticipante`, `FotofficeProductoCita`.
- `FotofficeAgendaAjustes`: calendario de Google, cursor de sincronización y capas por omisión.

### 3.2 Código

- `lib/proyectos/*`:
  - reglas, creación, fechas puras, participantes, notas y adjuntos;
  - acceso al módulo `projects`: Ver para leer y Gestionar para editar;
  - "sólo lo propio" según el sistema de roles.
- Motor: `lib/circuitos/sujetos/proyecto.ts`, y tablero, ficha e informe parametrizados.
- Pantallas en `app/(shell)/proyectos`, con el listado 0.2 y la ficha 0.3.
- Entrega B:
  - `lib/agenda/*`;
  - componentes de grilla compartidos con Reservas;
  - `lib/agenda/google/*` sobre el cliente de Google de Reservas, generalizado sin cambiar su
    comportamiento.

## 4. Errores y casos borde

- **Confirmar dos veces o reintentar:** el único (pedidoId, pedidoItemIndex, circuitId) evita duplicados.
- **Producto sin regla:** no crea proyecto.
- **Pedido sin evento:** la base es la confirmación.
- **Flujo archivado o sin etapas:** no se crea ese proyecto y la vista previa lo avisa.
- **Pedido cancelado:** sus proyectos no se cancelan solos. Se avisa en la ficha **[decisión]**.
- **Usuario dado de baja:** sus tareas quedan sin responsable visible y se pueden reasignar en lote.
- **Google sin conectar:** la agenda funciona igual, sin sincronizar.
- **Google revocado:** aviso en Configuración → Integraciones, igual que Reservas.

## 5. Pruebas

- **Puras:**
  - fechas planificadas;
  - atraso;
  - reglas con combos;
  - plantilla de nombre.
- **Base en memoria:**
  - creación al confirmar: uno por regla, sin duplicar, combos, destildados;
  - adaptador del motor;
  - suspender;
  - permisos y aislamiento.
- **Fuente:**
  - las pantallas no leen tablas de otras organizaciones;
  - tablero y ficha parametrizados sin romper Consultas.
- **Entrega B:**
  - capas;
  - reglas de cita;
  - decisiones de sincronización (quién gana);
  - el cron no toca reservas.

## 6. Publicación

Igual que la Etapa 3:
1. SQL a mano en la base de FOTOFFICE, registrado con checksum;
2. PR, chequeos y fusión;
3. verificación sin errores 5xx;
4. encender el módulo en DNX;
5. prueba en producción con un pedido de prueba.
