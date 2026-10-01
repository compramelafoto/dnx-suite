# Solicitudes y Coberturas

Módulo `coverages` de FotoOffice. Diseño acordado el 2026-09-14.

Entra un pedido de cobertura fotográfica por un lado y sale un equipo asignado, el trabajo
hecho y las fotos entregadas por el otro, con todo anotado en el camino.

---

## 1. Qué se construye y por qué

FOTOPOSITIVA es una organización solidaria que conecta fotógrafos voluntarios con ONG que
necesitan una cobertura gratuita. Hoy todo ese circuito —recibir el pedido, evaluar si la
actividad es solidaria, buscar voluntarios, coordinar, controlar que las fotos se entreguen—
ocurre por mensajes sueltos y seguimiento personal.

El módulo lo centraliza. Pero **no se programa para FOTOPOSITIVA**: se programa como una
capacidad de FotoOffice que FOTOPOSITIVA estrena. Un estudio lo usaría para repartir trabajos
pagos entre fotógrafos; una agencia, para coberturas de eventos; una cooperativa, para
distribuir pedidos entre socios. Lo que cambia entre esos casos es la terminología, la
modalidad de asignación y unos umbrales — todo configurable por workspace.

La prueba de que el módulo es genérico no es una declaración en este documento: es que
ninguna regla de FOTOPOSITIVA esté escrita en el código. El umbral de 3 horas, la palabra
"voluntario" y la confirmación obligatoria del coordinador viven en la configuración del
workspace, no en un `if`.

---

## 2. Lo que ya existe y se reutiliza

Este módulo casi no inventa infraestructura. Lo que necesita, FotoOffice ya lo tiene:

| Necesidad | Qué se usa |
|---|---|
| Encender/apagar el módulo por workspace | `MODULE_REGISTRY` + `WorkspaceFeatureModule` + `isModuleEnabledForWorkspace` |
| Guard de servidor por módulo y rol | El patrón de `lib/clients/access.ts`: módulo habilitado, después rol |
| Formulario público sin cuenta | `/w/[slug]/asociarse` y `submitApplicationAction` como modelo |
| Solicitud que se evalúa aparte del padrón | `MembershipApplication` como modelo conceptual |
| Enlaces con token | `lib/members/invitation-tokens.ts`: 32 bytes, SHA-256 en base, crudo una sola vez |
| Historial auditable | `MemberAudit` (actor + `actorLabel` congelado + motivo) y `RaffleEvent` |
| Correos con firma institucional | `sendAndLogEmail` + `loadWorkspaceEmailContext` + `SentEmailLog` |
| Archivos | `POST /api/uploads/image`, que resuelve el workspace del servidor |
| La organización solicitante | `Client` (`kind: "EMPRESA"`) y `findOrCreateClient` |
| El colaborador | `Member` |
| Fechas locales sin líos de zona | `lib/bookings/local-datetime.ts` |

**Lo que no existe y hay que construir:**

- **Rate limiting para formularios públicos.** No hay ninguno en FotoOffice; el formulario de
  asociarse tampoco lo tiene. Se construye acá, contando sobre la propia tabla.
- **Registro de consentimientos con versión.** Hoy son booleanos sueltos (`directoryOptIn`).
- **Portal del cliente.** `Client.userId` existe y está documentado como "etapa 5", sin
  pantallas todavía.
- **Disponibilidad declarada por persona.** Reservas gestiona espacios, no personas. Queda
  para una etapa posterior.

---

## 3. Decisiones tomadas

Cinco decisiones que conviene leer antes del mapa, porque explican por qué el modelo tiene la
forma que tiene. Dos de ellas van contra lo que este documento proponía en su primera versión.

### 3.1 El colaborador es un `Member`

**No se crea una entidad nueva de colaborador.** Se reutiliza el padrón.

Consecuencia asumida: FOTOPOSITIVA necesita el módulo Socios encendido, y cada voluntario
lleva un número de socio que se genera solo y que nadie va a mirar. A cambio, se reutilizan
ficha, portal, invitaciones, historial y el vínculo con `User` que ya funcionan.

Lo propio del módulo —zonas donde trabaja, radio de traslado, movilidad, equipo, especialidades
de cobertura— **no se mete dentro de `Member`**. Va en `CoverageCollaboratorProfile`, una tabla
1:1 con `Member`. Así el padrón no se ensucia con campos que solo le sirven a un módulo, y una
institución que no use coberturas no ve nada de esto.

En las pantallas del módulo se lee "Voluntario/a", no "Socio": la terminología es
configuración, no código.

### 3.2 La organización solicitante es un `Client`

La ONG que pide una cobertura es exactamente "quien consume nuestro servicio". Guardar sus
datos sueltos dentro de cada solicitud significaría que la misma organización que pide tres
coberturas en el año quede escrita tres veces, cada vez un poco distinta.

Se usa `Client` con `kind: "EMPRESA"`, por la **puerta única** que ya existe:
`findOrCreateClient` busca por documento, correo o teléfono y crea si no aparece. Estaba
pensada para reservas y ventas; le sirve igual a las coberturas.

Desde el día uno, entonces, la institución tiene el padrón de organizaciones con su historial,
sin que ninguna se registre.

### 3.3 La organización puede tener cuenta, pero nunca un workspace

Registrarse **no es obligatorio**: quien solo quiere pedir una cobertura pide y sigue su
solicitud por enlace.

Quien quiera, puede crear su cuenta desde el correo de seguimiento. Ese enlace ya demuestra que
controla esa dirección —le llegó ahí—, que es el mismo estándar que exige una invitación de
socio. No hace falta un segundo circuito de invitaciones ni una tabla nueva.

**Un cliente nunca puede crear un workspace.** Si ese camino queda abierto, cada ONG que se
registre se convierte en una institución fantasma, que es el defecto que se arregló el
2026-09-14 (ver `lib/entrada/`). Por eso `resolveFotofficeUserKind` suma el caso `CLIENT`, con
sus pruebas, y el destino de un cliente es siempre el portal de su organización.

### 3.4 La ubicación se muestra completa

La primera versión de este diseño ocultaba la dirección exacta hasta que la persona quedara
seleccionada. **Se descartó.**

Quienes ven una convocatoria son colaboradores del workspace, con sesión iniciada — gente que
ya es parte de la organización. Y sin la dirección no pueden decidir lo más básico: si les
queda cerca. Alguien de Rosario centro no se anota a una actividad en Pérez si no sabe que es
en Pérez.

La convocatoria **no es una página pública de internet**: se ve desde el portal, con sesión.
Eso es el control; esconder la dirección no agregaba seguridad, solo fricción.

### 3.5 Ninguna base se toca en esta etapa

`schema.prisma` lo comparten cinco bases Neon y el deploy de FOTOFFICE nunca corre
`prisma migrate deploy`. La migración se escribe y se deja lista, con el SQL y el registro en
`_prisma_migrations`. Aplicarla es una decisión de quien opera, no del código.

---

## 4. Nombre y encaje

| | |
|---|---|
| Key técnica | `coverages` |
| Etiqueta por defecto | Solicitudes y Coberturas (renombrable por workspace) |
| Categoría | `GENERAL` |
| Ruta | `/coberturas` |
| Depende de | `members` encendido |

`coverages` y no `jobs` ni `requests` para no confundirlo con dos vecinos: `work-orders`
—que custodia un objeto ajeno y cobra— y `events` —reservado para eventos con inscripción—.
Son tres cosas distintas y el nombre tiene que decirlo.

---

## 5. Las seis máquinas de estado

Cada cosa tiene su propio estado. Un enum único para todo obligaría a inventar combinaciones
imposibles ("aprobada pero entrega observada") y a mirar una solicitud para saber si una
persona confirmó.

```
Solicitud     RECIBIDA → EN_EVALUACION → APROBADA → CERRADA
              ↘ REQUIERE_INFO ↗     ↘ RECHAZADA
              ↘ CANCELADA_SOLICITANTE   ↘ CANCELADA_ORGANIZACION

Cobertura     PLANIFICADA → BUSCANDO_EQUIPO → EQUIPO_CONFIRMADO → REALIZADA
              → ENTREGADA → CERRADA      ↘ SIN_EQUIPO    ↘ CANCELADA

Convocatoria  BORRADOR → PUBLICADA → COMPLETA → CERRADA   ↘ VENCIDA  ↘ CANCELADA

Postulación   RECIBIDA → EN_REVISION → PRESELECCIONADA → SELECCIONADA
                                                       ↘ NO_SELECCIONADA
              ↘ RETIRADA   ↘ VENCIDA

Asignación    PROPUESTA → INVITADA → ACEPTADA → CONFIRMADA → CUMPLIDA
                                   ↘ RECHAZADA ↘ CANCELADA ↘ REEMPLAZADA ↘ AUSENTE

Entregable    PENDIENTE → EN_PREPARACION → ENTREGADO → APROBADO → CERRADO
                                                     ↘ OBSERVADO ↗
```

**"Reprogramado" no es un estado.** Es mover las fechas y dejar un evento en el historial: la
cobertura sigue exactamente donde estaba en el circuito. Un estado para eso obligaría a
recordar de dónde volver.

Cada transición pasa por una función pura en `lib/coverages/transitions.ts` que dice si es
válida y qué exige. **Motivo obligatorio** al rechazar, cancelar y marcar ausente — se valida
en la capa de dominio, no en el enum, porque el enum solo no distingue qué transición lo pide.
Toda transición escribe una fila en el historial.

Los valores son texto y no enums de Prisma, por la misma razón que en Clientes: el esquema lo
comparten cinco aplicaciones y agregar un valor a un enum compartido es una migración en cinco
bases. Se validan en el dominio, con tests.

---

## 6. El mapa de entidades

Once tablas. Todas con `workspaceId` y `onDelete: Cascade` desde `Workspace`, salvo donde se
indica lo contrario.

### `CoverageSettings` — 1:1 con workspace

Terminología (cómo se llama la solicitud, el colaborador, el solicitante, la convocatoria),
modalidad de asignación (`DIRECTA | ABIERTA | AUTOMATICA | MIXTA`), si la aprobación es
obligatoria, si el coordinador debe confirmar, umbral de duración para recomendar refuerzo
(por omisión 180 minutos) y cuántos colaboradores recomendar, roles y zonas sugeridos,
especialidades, si el formulario público está abierto, versión vigente del texto de
consentimientos, días de vida del enlace de seguimiento, correos a avisar.

Para FOTOPOSITIVA: participante "Voluntario/a", solicitante "Organización", modalidad `MIXTA`,
confirmación del coordinador obligatoria, umbral 180 minutos, refuerzo 2.

### `CoverageRequest` — la solicitud

`publicCode` correlativo por workspace (`SC-2026-0042`), `clientId` → la organización,
`tokenHash` + `tokenExpiresAt` para el seguimiento, `status`, `priority`, `complexity`,
`coordinatorUserId`, `rejectionReason`, `resolvedByUserId`, `resolvedAt`.

Datos del evento: título, descripción, `startsAt`, `endsAt`, dirección, localidad, tipo de
actividad, asistentes estimados, cubierto o al aire libre, responsable presente ese día y su
teléfono.

Necesidad fotográfica: tipo de cobertura, objetivo, momentos importantes, cantidad estimada de
fotógrafos, equipo especial, si necesita iluminación, foto/video/ambos, fecha esperada de
entrega, medio de entrega, observaciones, enlaces de documentación.

Los datos de la organización **no se duplican acá**: viven en `Client`.

### `CoverageConsent` — un permiso por fila

`requestId`, `kind` (autoriza la cobertura / hay menores / existen consentimientos de imagen /
restricciones de publicación / uso institucional de las fotos / términos / privacidad),
`granted`, `textVersion`, `textHash`, `acceptedAt`, `sourceHash`, `userAgent`.

**No un checkbox genérico.** Si el texto cambia el año que viene, se sabe cuál firmó cada uno.
No se guarda la IP cruda: se guarda su hash, que alcanza para el rate limit y para demostrar
origen sin acumular un dato personal que nadie va a necesitar leer.

### `Coverage` — la cobertura operativa

`requestId`, título, `startsAt`, `endsAt`, dirección, localidad, instrucciones, `status`.
Una solicitud aprobada genera 1..N: una jornada de dos turnos son dos coberturas.

### `CoverageRole` — rol y cupo

`coverageId`, nombre, `vacancies`, requisitos, experiencia mínima, equipo requerido, horario
propio, `status` (`ABIERTO | COMPLETO | CERRADO`).

No se asume que todo trabajo necesita un solo fotógrafo.

### `CoverageCall` — la convocatoria

1:1 opcional con `Coverage`. Título, resumen, información reservada para seleccionados,
`visibility`, cierre de postulaciones, urgencia, `status`, `publishedAt`.

`visibility` decide **a cuáles colaboradores del workspace** se les muestra —a todos, o a un
segmento por zona o especialidad—, no si la convocatoria sale a internet. Ninguna convocatoria
es pública: todas se ven desde el portal, con sesión iniciada (ver §3.4).

La "información reservada para seleccionados" tampoco es la dirección, que se muestra siempre.
Es lo que solo le sirve a quien va: el teléfono de emergencia, el nombre del contacto del día,
instrucciones internas.

### `CoverageApplication` — la postulación

`callId`, `roleId`, `memberId`, mensaje, nota de disponibilidad, equipo que puede llevar,
`status`, `withdrawnAt`. Único por (rol, persona).

### `CoverageAssignment` — la invitación o asignación

`coverageId`, `roleId`, `memberId`, `origin` (`POSTULACION | INVITACION_DIRECTA`),
`assignedByUserId`, criterio, `respondBy`, `status`, `respondedAt`, `confirmedAt`,
`replacedAssignmentId`, `hoursReported`, observaciones. Único por (cobertura, persona).

### `CoverageDeliverable` — el entregable

`coverageId`, `kind`, `responsibleMemberId`, `dueAt`, `deliveredAt`, `status`, `url`,
observaciones, `reviewNotes`, `approvedByUserId`, `approvedAt`.

En esta etapa el entregable es **un enlace**, no subida masiva de archivos pesados. Antes de
almacenar fotografías hay que mirar la infraestructura de archivos y su costo, y eso es una
decisión aparte.

### `CoverageCollaboratorProfile` — 1:1 con `Member`

`memberId` único, localidad, zonas, radio máximo, movilidad, equipo, especialidades de
cobertura, nivel de experiencia, si acepta urgencias, activo, notas.

### `CoverageEvent` — el historial

`entityType`, `entityId`, `type`, `fromStatus`, `toStatus`, `actorUserId`, `actorLabel`
congelado, nota. Índices por entidad y por workspace + fecha.

`actorLabel` se guarda aparte de la FK a propósito, igual que en `MemberAudit`: el historial
tiene que seguir entendiéndose aunque la persona cambie de nombre o su usuario se elimine.

---

## 7. Rutas

**Público** (sin cuenta)

- `/w/[slug]/coberturas/solicitar` — el formulario
- `/w/[slug]/coberturas/solicitar/gracias` — código público y aviso de que el enlace va por correo
- `/sc/[token]` — seguimiento, respuesta a pedidos de información, y el botón de crear cuenta

**Panel** (coordinación)

- `/coberturas` — la bandeja, con filtros: nuevas, incompletas, próximas, urgentes, sin equipo,
  entrega pendiente, cerradas, canceladas
- `/coberturas/[id]` — evaluación: notas internas, pedir información, aprobar, rechazar, generar coberturas
- `/coberturas/c/[coverageId]` — ficha operativa: roles, convocatoria, postulaciones, asignaciones, entregables, historial
- `/coberturas/colaboradores` — quiénes pueden participar y su perfil de cobertura
- `/coberturas/configuracion` — terminología, modalidad, umbrales

**Portal del colaborador**

- `/portal/coberturas` — convocatorias abiertas, invitaciones pendientes, mis asignaciones
- `/portal/coberturas/[callId]` — ver y postularse
- `/portal/coberturas/asignacion/[id]` — confirmar, registrar horas, entregar

**Portal de la organización**

- `/cliente` — sus pedidos, en qué anda cada uno, enlaces a lo entregado

`sc` y `cliente` se suman a los nombres reservados de `lib/entrada/institution-shortcut.ts`.
El test que contrasta esa lista contra las carpetas de `app/` lo va a exigir solo.

---

## 8. Permisos

Dos niveles, siguiendo el patrón de `lib/clients/access.ts`: primero el módulo habilitado para
ese workspace, después el rol. Ambos en el servidor, en cada página y en cada acción.

| Quién | Puede |
|---|---|
| **Coordinador** (`WORKSPACE_OWNER`, `WORKSPACE_ADMIN`) | Configurar, evaluar, aprobar, rechazar, crear convocatorias, asignar, cerrar |
| **Evaluador** (`STAFF`) | Ver la bandeja, registrar notas, pedir información. No aprueba ni asigna |
| **Colaborador** (tiene `Member` con perfil activo) | Ver convocatorias, postularse, responder invitaciones, registrar participación, entregar |
| **Organización** (por token, o por cuenta vinculada a su `Client`) | Ver y seguir **sus** solicitudes, responder pedidos de información |

Roles granulares por función (secretario, tesorero) no existen todavía en FotoOffice y no se
inventan acá: el módulo Socios tomó la misma decisión y está documentada.

---

## 9. El formulario público y el seguimiento sin cuenta

Al enviarse, la solicitud:

1. Resuelve o crea el `Client` por la puerta única, dentro de la misma transacción. Un cliente
   creado con una solicitud que falló deja basura en el padrón.
2. Toma un `publicCode` correlativo del workspace.
3. Genera un token de 32 bytes; en la base queda solo su SHA-256.
4. Registra cada consentimiento como una fila, con la versión del texto vigente.
5. Manda el correo de recepción con el código y el enlace.

**El código público no abre nada.** `SC-2026-0042` sirve para hablar por teléfono. Lo que abre
la ventana de seguimiento es el token, que va en el enlace, vence y se puede revocar. Así no
hay forma de probar números uno atrás del otro para espiar pedidos ajenos.

**Rate limiting**, que hoy no existe en ningún formulario público de FotoOffice: por correo y
por hash de origen, contando sobre `CoverageRequest` en una ventana de tiempo. Sin tabla nueva.
Además, una solicitud pendiente del mismo correo no se duplica: se responde que ya está en
curso, igual que hace el alta de socios.

**Fechas en pantalla en formato argentino** (`26.09.2026`). Almacenamiento en UTC, entrada y
salida por la zona `America/Argentina/Buenos_Aires` reutilizando el helper de Reservas.

---

## 10. La regla del refuerzo

Función pura, configurable, que **no bloquea**:

```
recomendarRefuerzo({ duracionMinutos, asignados, settings })
  → { recomendados: 2, motivo: "La cobertura dura 4 h 30 y supera el umbral de 3 h." }
```

Aparece al crear los roles y en la ficha operativa. El coordinador puede seguir con menos
gente; si lo hace, se le pide una observación que queda en el historial. Umbral y cantidad
recomendada se configuran por workspace: para FOTOPOSITIVA son 180 minutos y 2 personas.

---

## 11. Comunicaciones

Con `sendAndLogEmail` y la firma del workspace. Claves `fotoffice.coverages.*`, registradas
también cuando fallan — la pregunta "¿le avisamos o no?" aparece siempre.

Etapa 1: recepción, pedido de información, aprobación, rechazo, invitación a participar,
equipo completo, confirmación de entrega.

Etapa siguiente: recordatorios programados, reprogramación, agradecimiento, cierre.

No se integra WhatsApp. Se ofrecen resúmenes para copiar y enlaces para compartir, que es lo
que se usa hoy sin depender de un servicio externo ni de una autorización que nadie dio.

---

## 12. Seguridad y privacidad

- Aislamiento por workspace en **cada** consulta del repositorio, con tests que lo verifican.
- Autorización en servidor, en páginas y acciones. Esconder un botón no es un control.
- Tokens: 32 bytes, SHA-256 en base, crudo una sola vez, con vencimiento y revocación.
- Sin identificadores secuenciales en las URLs privadas.
- Rate limiting y antiduplicado en el formulario público.
- Consentimientos versionados; origen guardado como hash, no como IP.
- Los datos privados de un colaborador nunca aparecen en una convocatoria.
- Minimización: no se guarda lo que no se va a usar.

---

## 13. Migración

Una migración **aditiva**: once tablas nuevas más las relaciones en `Workspace`, `Member` y
`Client`. **Ninguna tabla existente cambia de forma.**

Se deja escrita con su SQL y su registro en `_prisma_migrations` con el checksum, siguiendo el
procedimiento ya documentado para replicarla en las otras bases. **No se ejecuta contra
ninguna base en esta etapa.**

---

## 14. Pruebas

Vitest sobre lógica pura, como todo el repositorio:

- Transiciones válidas e inválidas de las seis máquinas, y motivo obligatorio donde lo exige.
- Umbral de refuerzo, incluso en el borde exacto.
- Parseo y validación del formulario, con sus campos obligatorios.
- Cupos: que una vacante no se asigne dos veces y que el rol se cierre al llenarse.
- Terminología: que la etiqueta configurada reemplace a la de por omisión.
- Token: hash, vencimiento, revocación, y que un token ajeno no abra nada.
- Qué campos ve una convocatoria y qué campos no.
- Política de permisos por rol.
- Aislamiento por workspace en los filtros del repositorio.
- Rate limiting: que el cuarto envío en la ventana se rechace.

---

## 15. Qué queda para etapas siguientes

Con puntos de extensión dejados, sin código:

- Verificación documentada de la organización solicitante, con estado y vencimiento.
- Disponibilidad declarada y detección de conflictos de agenda.
- Motor de recomendaciones explicables, que muestre el motivo de cada sugerencia.
- Paneles e indicadores; reportes de impacto.
- Preferencias de notificación por canal.
- Integraciones con InfoSpot (borrador editorial) y CompraMeLaFoto (galería), siempre con
  revisión humana antes de publicar.

---

## 16. Criterios de aceptación

1. Un workspace puede encender el módulo; otro que no lo encienda no lo ve.
2. Una organización envía una solicitud sin registrarse y recibe código y enlace seguro.
3. Un coordinador la evalúa, pide información, aprueba o rechaza — con motivo al rechazar.
4. Una solicitud aprobada genera una o más coberturas, con uno o más roles y cupos.
5. Los colaboradores autorizados ven la convocatoria, con la ubicación, y se postulan.
6. Postularse no asigna a nadie: el coordinador selecciona y la persona confirma.
7. Una cobertura se marca como realizada y se registra una entrega.
8. Si la duración supera el umbral configurado, aparece la recomendación de sumar personas y
   no bloquea.
9. Cada cambio queda en el historial con quién, cuándo y de qué estado a cuál.
10. La organización accede solamente a su información.
11. Los datos de distintos workspaces quedan aislados y los permisos se validan en servidor.
12. Nada del módulo contiene lógica rígida exclusiva de FOTOPOSITIVA.
