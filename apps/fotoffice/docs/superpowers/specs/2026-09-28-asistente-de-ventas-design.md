# Asistente de ventas — Etapa 1

Módulo `sales-assistant` de FOTOFFICE. Diseño del 2026-09-28.

Todos los días lee el embudo de ventas de Alboom, decide qué hacer con cada oportunidad y deja
el mensaje de WhatsApp escrito. El fotógrafo lo revisa desde el teléfono y lo envía con un toque.

---

## 1. Qué se construye y por qué

DNX Fotografía lleva sus ventas en el CRM de Alboom (`dnxfotografia.alboomcrm.com`). Las
consultas entran por el formulario de las landings, Alboom manda un correo automático de
seguimiento y después todo sigue por WhatsApp, a mano. Revisado el 28/09/2026:

- hay **104 oportunidades abiertas** y **494 tareas pendientes**, varias de 2018;
- el embudo principal es "Embudo de Ventas DNX 2022": Recepción → WSP Recepción del presupuesto
  → Coordinar entrevista → Cliente potencial → Cliente dudoso → Confeccionar contrato;
- las conversaciones de WhatsApp **no quedan registradas en Alboom**: sólo los correos y los
  cambios de etapa.

El problema no es la falta de datos, sino que nadie los mira todos los días. El asistente hace
esa pasada diaria y propone una acción concreta por oportunidad.

**Alboom sigue siendo el CRM.** En esta etapa FOTOFFICE sólo lee Alboom: no cambia etapas, no
cierra oportunidades y no escribe notas.

**Como en Coberturas, no se programa para DNX.** El módulo está pensado para cualquier
fotógrafo que venda por un embudo. Alboom es la primera fuente, y el analizador trabaja sobre
un tipo propio (`OportunidadVenta`, §6.1) que no sabe de Alboom. Cuando exista el CRM propio
(etapa 2 del plan de empresa, spec `2026-09-14-estudio-consultas-y-presupuestos`), las consultas
de FOTOFFICE van a ser otra fuente del mismo analizador.

---

## 2. Lo que ya existe y se reutiliza

| Necesidad | Qué se usa |
|---|---|
| Encender el módulo por workspace | `MODULE_REGISTRY` + `WorkspaceFeatureModule` + `isModuleEnabledForWorkspace` |
| Guard de servidor | El patrón de `lib/coverages/access.ts`: primero módulo habilitado, después rol |
| Guardar la contraseña de Alboom cifrada | `lib/integrations/vault.ts` (AES-256-GCM, `DNX_INTEGRATIONS_VAULT_MASTER_KEY`) y la tabla `WorkspaceIntegration` |
| Tarea diaria protegida | `lib/security/cron-auth.ts` y el patrón de `app/api/cron/sorteos/route.ts` |
| Enlace de WhatsApp con texto | `buildWhatsappUrl` de `lib/contact/whatsapp.ts` |
| Menú lateral | `lib/modules/submodules.ts` + `components/shell/shell-nav.tsx` |
| Historial con nombre de época | El `actorLabel` de `lib/coverages/events.ts` |

Lo único nuevo en infraestructura es la llamada a Claude. En el monorepo no hay ningún uso del
SDK de Anthropic, así que este módulo agrega `@anthropic-ai/sdk` **sólo a `apps/fotoffice`**.
Una dependencia nueva mueve el lockfile de todos, así que hay que verificar el build de las
otras apps antes de fusionar.

`apps/dnx-sales-assistant` es otra cosa: un bot conversacional que todavía está en simulación
(Telegram local, sin IA real). No se reutiliza en esta etapa. Su guía de tono
(`docs/dani-conversation-v1.md`) sirve como referencia para el prompt (§7.2).

---

## 3. Decisiones tomadas

### 3.1 Se lee Alboom desde el servidor, con el usuario de Daniel

Alboom no tiene API pública, webhooks ni integraciones. Su panel, en cambio, pide todo en JSON a
`/api/...` con la sesión iniciada: `POST /api/users/login`, `POST /api/leads/paginate`,
`GET /api/leads/{id}`, `POST /api/activities/paginate`, `GET /api/mails/leads/{id}/0/50`,
`POST /api/notes/paginate` y `GET /api/stages/list?type=lead_stage`.

FOTOFFICE entra con el usuario y la contraseña de Daniel, guardados cifrados, y usa esos mismos
pedidos. Daniel lo autorizó el 28/09/2026. Así la computadora de Daniel no tiene que estar
prendida.

Riesgos aceptados:

- es una API interna y Alboom puede cambiarla sin avisar. Si pasa, la sincronización falla y
  **lo dice en pantalla** (§9); no se pierde nada, porque sólo se lee;
- la contraseña queda en el servidor. Mitigación: se usa el cofre existente, nunca se muestra
  después de guardarla y se puede borrar con un botón.

**Primer paso de la implementación (spike):** confirmar cómo mantiene la sesión Alboom (cookie
o token) y qué pide `login`, probándolo con la cuenta real desde un script local. El resto del
diseño no depende de la respuesta; sólo cambia el adaptador (§6.2).

### 3.2 Nada se envía solo

El asistente redacta y el fotógrafo envía. El botón "Abrir WhatsApp" abre un enlace `wa.me` con
el texto cargado: en el teléfono abre la app y en la computadora, WhatsApp Web. No se usa
ningún robot de WhatsApp, porque la cuenta del fotógrafo podría quedar bloqueada.

La API oficial de WhatsApp (envío automático) queda para una etapa posterior (§12).

### 3.3 El hueco de WhatsApp lo cierra el fotógrafo con un toque

Como las respuestas del cliente no están en Alboom, cada tarjeta enviada ofrece después botones
rápidos: **No contestó · Le interesa · Pidió descuento · Lo está pensando · No va**. También hay
un campo opcional para pegar lo que respondió el cliente. Eso queda en la bitácora
(`FotofficeSalesFollowUp`) y el analizador lo lee al día siguiente. Sin este dato, el asistente
decide sólo con lo que tiene Alboom, y la pantalla lo avisa.

### 3.4 Claude sólo analiza lo que cambió

Mandar las 104 oportunidades a Claude todos los días es caro e innecesario. Una función pura
(`necesitaAnalisis`, §6.3) decide qué oportunidades se analizan hoy:

- la oportunidad es nueva o cambió en Alboom desde el último análisis;
- se registró un seguimiento nuevo;
- vence un plazo: pasaron los días de espera de la sugerencia anterior, o el evento cruzó un
  umbral (60, 30 o 14 días);
- el fotógrafo tocó "Volver a analizar".

Las demás conservan su sugerencia vigente. Se estiman entre 10 y 25 análisis por día.

### 3.5 La limpieza inicial no usa Claude

En la primera sincronización, las oportunidades con **fecha de evento vencida** o **más de 120
días sin movimiento** van a una lista aparte, **"Para cerrar"**, armada por regla. Desde ahí el
fotógrafo puede:

- **archivarlas en el asistente**: dejan de aparecer, pero en Alboom siguen como están;
- **abrirlas en Alboom** para cerrarlas allá.

Cerrar oportunidades en Alboom desde FOTOFFICE queda para la etapa 2.

### 3.6 A Claude no se le mandan datos de contacto

Al modelo le llegan el nombre de pila, el tipo y la fecha del evento, el lugar, la cantidad de
invitados, el origen, la etapa, las fechas del embudo, lo que escribió el cliente, los asuntos y
extractos de los correos, y la bitácora. **No le llegan el teléfono, el email ni el apellido**:
no hacen falta para decidir, y el teléfono se agrega recién al armar el enlace de WhatsApp.

### 3.7 Modelo

Por defecto se usa `claude-opus-5`, configurable con `FOTOFFICE_SALES_AI_MODEL`, con salida
estructurada (`output_config.format`) y `fallbacks: "default"` ante rechazos. Si falta
`ANTHROPIC_API_KEY`, el módulo funciona igual, pero sin sugerencias (sólo sincroniza y muestra),
y lo avisa. Se registran los tokens de cada análisis para conocer el costo real.

---

## 4. Nombre y encaje

- Módulo: `sales-assistant`, etiqueta **"Asistente de ventas"**, ruta `/ventas`.
- Se enciende a mano, sólo en el workspace de DNX, desde `/admin/workspaces/[id]`.
- Sólo lo ven el dueño y los administradores del workspace (`canManageWorkspaceSettings`). El
  personal (`STAFF`) no, porque maneja precios y datos de clientes.

---

## 5. Pantallas

### `/ventas` — la bandeja del día

Pensada primero para el teléfono. Arriba, un resumen: **N para escribir hoy · N esperando ·
N para cerrar**, con la hora de la última sincronización y el botón **Actualizar ahora**.

Cada oportunidad es una tarjeta, ordenada por urgencia (§6.4), con:

- nombre, tipo de evento, fecha del evento, en cuántos días es, y etapa de Alboom;
- **la acción sugerida** (Escribir · Pedir seña · Coordinar entrevista · Esperar · Cerrar como
  perdida · Revisar a mano) y el **motivo** en una línea: "Presupuesto enviado hace 6 días, no
  hubo respuesta y el evento es en 61 días";
- **el mensaje propuesto**, editable antes de enviar;
- botones: **Abrir WhatsApp** · **Posponer** (1, 3 o 7 días) · **Descartar sugerencia** ·
  **Ver en Alboom**;
- después de "Abrir WhatsApp", los botones de resultado (§3.3).

Si el teléfono no se puede normalizar (por ejemplo, `341322858`, que tiene 9 dígitos), la
tarjeta dice "Número inválido en Alboom" y no muestra el botón de WhatsApp.

Filtros: Hoy · Esperando · Para cerrar · Archivadas.

### `/ventas/[id]` — el detalle

Los datos de la oportunidad, la línea de tiempo (etapas y correos traídos de Alboom, más la
bitácora propia), las sugerencias anteriores con lo que se hizo con cada una, y los botones
**Volver a analizar** y **Archivar en el asistente**.

### `/ventas/configuracion` — la conexión y el tono

- **Conexión con Alboom:** subdominio (`dnxfotografia`), usuario y contraseña, con botones
  **Probar conexión** y **Desconectar**. Después de guardarla, la contraseña no se vuelve a
  mostrar.
- **Embudos incluidos:** casillas con los embudos que devuelve Alboom. Por defecto se marca
  sólo "Embudo de Ventas DNX 2022"; Colaboradores, Plataforma 360 y Workshops quedan afuera
  hasta que se marquen.
- **Tu voz:** firma ("Dani de DNX"), tuteo o voseo, e indicaciones libres ("nunca ofrezcas
  descuento de entrada", "la seña es del 30 %"), que se suman al prompt.
- **Plazos:** días de espera antes de volver a escribir (por defecto 3) y días sin movimiento
  para mandar a "Para cerrar" (por defecto 120).

---

## 6. Diseño del código

Sigue el patrón de `lib/coverages`: lógica pura con tests, un repositorio como única puerta a
Prisma y acciones de servidor finitas.

```
lib/sales-assistant/
  constants.ts            clave del módulo, acciones, estados, resultados
  access.ts               requireSalesAssistantManager (módulo + rol)
  opportunity.ts          tipo OportunidadVenta (independiente de la fuente)
  needs-analysis.ts       necesitaAnalisis()                         (puro, con tests)
  cleanup.ts              esCandidataACerrar()                       (puro, con tests)
  priority.ts             ordenarBandeja()                           (puro, con tests)
  phone.ts                normalizarTelefonoArgentino()              (puro, con tests)
  prompt.ts               armarContexto() — arma la entrada, sin datos de contacto (puro, con tests)
  analyzer.ts             analizarOportunidad() — la única llamada a Claude
  sync.ts                 sincronizarWorkspace() — orquesta: leer → guardar → decidir → analizar
  repository.ts           acceso a Prisma; toda consulta lleva workspaceId
  alboom/
    client.ts             login y pedidos HTTP a /api/...
    mapper.ts             JSON de Alboom → OportunidadVenta          (puro, con tests con JSON real)
    credentials.ts        guardar, leer y borrar la credencial en el cofre
app/(shell)/ventas/       page.tsx, [id]/page.tsx, configuracion/page.tsx, actions.ts
app/api/cron/ventas/route.ts
```

### 6.1 `OportunidadVenta`

Es el tipo que entiende el analizador. Campos:

- `fuente` (`"ALBOOM"`) e `idExterno`;
- `titulo`, `tipoEvento`, `nombreCliente`, `telefono`, `email`;
- `fechaEvento`, `lugar`, `ciudad`, `invitados`, `origen`, `descripcionCliente`;
- `embudo`, `etapa`, `etapaOrden`, `etapasTotal`;
- `creadaEn`, `presupuestoEnviadoEn`, `modificadaEn`;
- `movimientos`: lista de `{fecha, tipo: "ETAPA" | "CORREO" | "NOTA", texto}`.

### 6.2 El adaptador de Alboom

`client.ts` se ocupa del login, de reintentar una vez si la sesión vence y de la paginación
(`leads/paginate` devuelve 10 por página por defecto; se piden 100). Sólo trae el detalle
(actividades, correos y notas) de las oportunidades con `modified` posterior a la última
sincronización. `mapper.ts` se prueba con JSON reales de Alboom, anonimizados y guardados como
fixtures.

### 6.3 `necesitaAnalisis`

Función pura que recibe la oportunidad, la última sugerencia, los seguimientos y la fecha de
hoy, y devuelve `{ analizar: boolean, motivo }`. Es la que controla el costo, así que tiene la
mayor cobertura de tests.

### 6.4 Orden de la bandeja

1. primero lo que tiene acción hoy;
2. dentro de eso, por prioridad (alta, media, baja), según la sugerencia;
3. a igual prioridad, el evento más cercano primero.

---

## 7. El análisis

### 7.1 Qué devuelve Claude

Una salida estructurada, validada con zod:

```ts
{
  accion: "ESCRIBIR" | "PEDIR_SENA" | "COORDINAR_ENTREVISTA" | "ESPERAR"
        | "CERRAR_PERDIDA" | "REVISAR_A_MANO",
  prioridad: "ALTA" | "MEDIA" | "BAJA",
  motivo: string,            // una línea para la tarjeta
  mensaje: string | null,    // null si la acción es ESPERAR o CERRAR_PERDIDA
  esperarDias: number | null // si ESPERAR, cuándo mirarla de nuevo
}
```

Si la respuesta no valida o Claude la rechaza, la oportunidad queda como **REVISAR_A_MANO**, con
el motivo "No se pudo analizar". El lote nunca se corta por una oportunidad.

### 7.2 El prompt

- Una parte fija: quién es el fotógrafo, cómo es un embudo de fotografía social (XV, bodas,
  eventos), las reglas de negocio (no insistir más de 3 veces sin respuesta, cuándo pedir seña,
  que un evento a menos de 30 días pide urgencia) y el estilo del mensaje (corto, cálido,
  rioplatense, sin emojis de más, una sola pregunta por mensaje). Esta parte va con
  `cache_control`.
- Después, las indicaciones de "Tu voz" (§5).
- Por último, el contexto de la oportunidad que arma `armarContexto`, con la fecha de hoy.

### 7.3 Cuándo corre

- **Cron diario** `/api/cron/ventas` a las 10:00 UTC (7:00 de Argentina), con `maxDuration =
  300`. Recorre los workspaces con el módulo encendido y la conexión activa.
- **Actualizar ahora**, desde la bandeja. Tiene un límite de una corrida cada 10 minutos por
  workspace.
- Los análisis corren de a 4 en paralelo. Si una corrida se acerca a los 300 s, guarda lo hecho
  y lo que falta queda para la próxima; como cada paso es idempotente, repetirlo no duplica
  nada.

---

## 8. Datos

Cuatro tablas nuevas, con prefijo `Fotoffice` porque el schema lo comparten cinco bases, y los
estados guardados como texto, no como enum. Cada tabla lleva `workspaceId`.

### `FotofficeSalesSettings` — 1:1 con el workspace

`pipelinesIncluded String[]`, `signature`, `voiceNotes`, `waitDays` (3), `staleDays` (120),
`lastSyncAt`, `lastSyncStatus` (`OK | ERROR_LOGIN | ERROR_ALBOOM | PARCIAL`) y
`lastSyncMessage`.

### `FotofficeSalesOpportunity` — el espejo de cada oportunidad

`source` (`ALBOOM`), `externalId`, las columnas de `OportunidadVenta` que se usan para filtrar y
ordenar (`customerName`, `phone`, `eventType`, `eventDate`, `pipelineName`, `stageName`,
`stageOrder`, `quoteSentAt`, `externalCreatedAt`, `externalModifiedAt`), `externalStatus`,
`snapshot Json` (la `OportunidadVenta` completa), `archivedAt`, `syncedAt`.
`@@unique([workspaceId, source, externalId])`.

Si una oportunidad deja de estar abierta en Alboom (ganada o perdida), se marca con su estado y
sale de la bandeja; no se borra.

### `FotofficeSalesSuggestion` — una por oportunidad y por análisis

`opportunityId`, `action`, `priority`, `reason`, `message`, `editedMessage`, `waitUntil`,
`status` (`PENDIENTE | ENVIADA | POSPUESTA | DESCARTADA | REEMPLAZADA`), `model`,
`inputTokens`, `outputTokens`, `createdAt` y `resolvedAt`. Cuando se genera una nueva, la
anterior pendiente pasa a `REEMPLAZADA`: hay una sola vigente por oportunidad.

### `FotofficeSalesFollowUp` — la bitácora

`opportunityId`, `suggestionId?`, `kind` (`MENSAJE_ENVIADO | RESULTADO | NOTA`), `outcome`
(`NO_CONTESTO | INTERESADO | PIDIO_DESCUENTO | LO_PIENSA | NO_VA`), `text`, `actorUserId`,
`actorLabel` y `createdAt`.

### La credencial

Va en `WorkspaceIntegration` con `provider: "ALBOOM"` e `integrationKey: "alboom-crm"`. En
`accountEmail` se guarda el usuario de Alboom. El secreto cifrado es un JSON
`{subdomain, username, password}`.

`lib/integrations/store.ts` hoy está pensado para OAuth (`refreshToken`). Se le agregan dos
funciones genéricas, `saveSecretIntegration` y `readIntegrationSecret`, sin tocar las de Google.

---

## 9. Errores y avisos

| Qué pasa | Qué ve el fotógrafo |
|---|---|
| Usuario o contraseña rechazados | Cartel rojo en la bandeja: "Alboom rechazó el usuario. Revisá la conexión", con el enlace a configuración. La integración pasa a `NEEDS_RECONSENT`. |
| Alboom cambió su API o no responde | Cartel amarillo: "No se pudo leer Alboom hoy; lo que ves es de la sincronización anterior (fecha)". |
| Falta `ANTHROPIC_API_KEY` o falló Claude | Las tarjetas se ven igual, pero sin mensaje propuesto y con el aviso "Sin sugerencia hoy". |
| Teléfono inválido | "Número inválido en Alboom", sin botón de WhatsApp. |

Los errores se registran con `sanitizeError`. Nunca se registran la contraseña, la cookie de
Alboom ni el contenido de los mensajes.

---

## 10. Seguridad y privacidad

- La contraseña se cifra con el cofre y sólo `alboom/credentials.ts` la descifra.
- Todas las consultas filtran por `workspaceId`, y un test sobre el código fuente lo verifica,
  como `lib/coverages/aislamiento.test.ts`.
- Claude no recibe teléfonos, emails ni apellidos (§3.6).
- Las acciones verifican el módulo y el rol en el servidor, no sólo en la pantalla.
- El enlace `wa.me` se arma en el servidor, con el teléfono normalizado. El texto va codificado
  con `encodeURIComponent`.

---

## 11. Migración y pruebas

**Migración.** El SQL va en
`packages/db/prisma/migrations/20260928120000_fotoffice_sales_assistant/migration.sql`. Es
aditivo: crea las cuatro tablas, sin enums ni cambios en tablas existentes. Se aplica a mano en
las cinco bases y se registra con `migrate resolve --applied`, **antes** del deploy.

**Variables en Vercel** (proyecto `fotoffice-dnxsuite`): `ANTHROPIC_API_KEY`, opcionalmente
`FOTOFFICE_SALES_AI_MODEL`, y verificar que ya estén `DNX_INTEGRATIONS_VAULT_MASTER_KEY` y
`CRON_SECRET`.

**Pruebas (Vitest, al lado de cada archivo):**

- `necesitaAnalisis`: nueva, sin cambios, cambió la etapa, seguimiento nuevo, venció la espera,
  cruzó un umbral de días al evento, archivada, cerrada en Alboom.
- `esCandidataACerrar`: evento vencido, sin movimiento, límites exactos.
- `normalizarTelefonoArgentino`: `3412717813`, `+54 9 3416 91-0072`, `341322858` (inválido),
  vacío, y un número con 0 y 15.
- `mapper`: fixtures con JSON real de `leads/paginate`, `activities` y `mails`, anonimizados.
- `armarContexto`: que la salida **no contenga** el teléfono, el email ni el apellido.
- `ordenarBandeja`: el orden del §6.4.
- El analizador se prueba con un cliente de Claude falso: respuesta válida, respuesta inválida
  y rechazo.
- Aislamiento por `workspaceId`.

**Prueba real antes de dar por terminado:** una sincronización contra el Alboom de DNX y la
revisión de las primeras 10 sugerencias con Daniel.

---

## 12. Qué queda para etapas siguientes

- **Etapa 2:** escribir en Alboom (mover de etapa, cerrar como perdida, anotar "WhatsApp
  enviado") desde la tarjeta.
- **Etapa 3:** API oficial de WhatsApp Business (Meta), con plantillas aprobadas, envío
  automático de los mensajes seguros y recepción de las respuestas, que cierra el hueco del
  §3.3 sin toques manuales.
- **Etapa 4:** cuando exista el CRM propio de FOTOFFICE, las consultas de FOTOFFICE pasan a ser
  otra fuente del mismo analizador, y el espejo de Alboom puede migrar a `FotofficeConsulta`
  con `source: "ALBOOM"`.
- Aviso diario al teléfono con el resumen de la bandeja.

---

## 13. Criterios de aceptación

1. Con la conexión guardada, **Probar conexión** muestra los embudos de Alboom y la cantidad de
   oportunidades abiertas.
2. Después de la primera sincronización, la bandeja muestra las oportunidades abiertas de los
   embudos marcados, y la lista "Para cerrar" junta las vencidas y las quietas.
3. Cada oportunidad analizada tiene acción, motivo y, si corresponde, un mensaje en la voz
   configurada.
4. "Abrir WhatsApp" abre el chat correcto con el mensaje (editado, si se editó) y deja
   registrado el envío.
5. Los botones de resultado quedan en la bitácora, y el análisis del día siguiente los tiene en
   cuenta.
6. Una segunda corrida el mismo día, sin cambios en Alboom, no llama a Claude.
7. Con una contraseña equivocada, la bandeja lo avisa y no se rompe.
8. Ningún dato de contacto sale hacia Claude (lo verifica un test).
9. Nada se escribe en Alboom.
