# Etapa 0.3 · La ficha estándar

> 30/09/2026 · Diseño aprobado por Daniel en la conversación del 30/09. Parte de la Etapa 0 (Cimientos)
> del reemplazo de Alboom (`docs/alboom/00-mapa-general-y-plan.md` §3.3 y §4). Se apoya en la 0.1
> (`puede(rol, capacidad)`, PR 277) y en la 0.2 (listado estándar, PR 281: filtros y acciones en lote).

## 1. Qué problema resuelve

En Alboom todas las fichas (Contacto, Oportunidad, Pedido, Proyecto) tienen las mismas piezas:
Etiquetas, Notas con categoría, Mensajes, Actividad, Relacionados y Adjuntos
(`docs/alboom/05-configuracion-y-transversales.md` §7). Cada una es una pestaña aparte; el propio
relevamiento proponía como mejora **una sola línea de tiempo por persona**
(`docs/alboom/01-oportunidades-y-contactos.md` §10).

En FOTOFFICE (relevamiento del 30/09 sobre la rama de la 0.2):

- **Cliente no guarda historia de nada**: `saveClientAction` hace un `update` sin rastro.
- **Socio** tiene un historial rico (`MemberAudit`: acción, actor, antes → después), pero sólo en su ficha.
- **Notas**: un único campo de texto (`Client.notes`, `Member.notes`) que se pisa, sin autor ni fecha.
- **Etiquetas**: no existen.
- **Adjuntos**: no hay forma de adjuntar un PDF o un DNI; las imágenes que se suben quedan en un
  almacenamiento público.
- **Relacionados**: el vínculo Cliente ↔ Socio existe (`Client.memberId`) pero la ficha del socio no
  lo muestra.
- Cada ficha está armada a mano: no hay componentes compartidos de ficha ni de historia.

## 2. Alcance

**Entra:**

1. La ficha estándar (encabezado, línea de tiempo, columna de datos) como pieza reutilizable.
2. Dos fichas la usan: **Cliente** y **Socio**, unidas cuando un cliente es socio.
3. Piezas: **línea de tiempo + notas**, **etiquetas**, **adjuntos privados**, **personas relacionadas**.
4. Historial de cambios de Cliente (hoy inexistente).
5. En los listados de Clientes y Socios (0.2): filtro por etiqueta y acción en lote "Agregar o quitar
   etiqueta".

**No entra (queda anotado):**

- **Mensajes** (correos y WhatsApp enviados desde la ficha): llegan con la etapa 0.6 (Plantillas),
  cuando se empiece a enviar desde la ficha; ahí cada envío aparece en la línea de tiempo. Hoy
  `SentEmailLog` es una tabla compartida sin `workspaceId` ni persona.
- Pasar las demás fichas (Cobertura, Sorteo, Curso, Reserva): cada una cuando se toque su módulo.
- Recortar fotos de perfil, tareas y recordatorios (llegan con el motor de etapas, 0.4).

## 3. Cómo lo vive quien usa el sistema

### 3.1 La ficha

- **Encabezado**: nombre, tipo (persona/empresa o socio N°), etiquetas, teléfono y correo con acceso
  directo (llamar, WhatsApp, correo), y los botones de acción de cada módulo (Editar, Cambiar estado…).
- **Dos columnas en la computadora** (una sola en el celular):
  - **Izquierda — Línea de tiempo**: arriba, la caja para escribir una nota; filtros por tipo
    (Todo · Notas · Cambios · Plata · Portal · Carnets · Adjuntos); las notas fijadas arriba de todo;
    30 eventos por vez con "Ver más".
  - **Derecha — Datos**: los datos de la persona (los de hoy), **Personas relacionadas** y **Adjuntos**.
- **Cliente y Socio unidos**: si un cliente es socio, cada ficha muestra el vínculo con enlace a la
  otra, y la línea de tiempo junta la historia de los dos lados. Etiquetas, notas, adjuntos y
  relaciones se guardan sobre **la persona**: se ven igual desde la ficha de cliente o de socio.

### 3.2 Notas

- **Categoría + texto** (hasta 4.000 caracteres), con autor y fecha en hora de Buenos Aires.
- Categorías: catálogo propio de cada organización, editable en Configuración (capacidad
  `configurar`). DNX Estudio arranca con las 13 de Alboom: URGENTE, Coordinación, Correcciones, Hacer
  contrato, Contacto por Teléfono, Correo, Presupuesto, Visita, Recordatorio, Envío de Material,
  Revisión, Selección de Pruebas, Otro. Las demás organizaciones arrancan con "General".
- **Fijar**: una nota fijada queda arriba de todo en la línea de tiempo (máximo 3 fijadas por persona).
- **Editar y borrar**: cada uno las suyas; Dueño y Administrador cualquiera. Una nota editada muestra
  "editada"; una borrada desaparece y deja en la historia "X borró una nota" (sin el texto).
- **Las "Observaciones" de hoy** (`Client.notes`, `Member.notes`) se convierten, una sola vez, en una
  primera nota fijada de categoría "Otro" (o "General"), con autor "Importado" y el texto intacto. Los
  formularios dejan de mostrar ese campo; la columna queda en la base sin tocar.

### 3.3 Etiquetas

- Catálogo por organización (nombre único sin distinguir mayúsculas, color de una paleta fija de 8),
  compartido por clientes y socios.
- En la ficha: campo con autocompletado; si la etiqueta no existe, se crea (capacidad `operar`).
- Renombrar, unir dos etiquetas y borrar: Configuración → Etiquetas (capacidad `configurar`). Borrar una
  etiqueta la saca de todas las personas y deja el evento en cada historia.
- Listados de Clientes y Socios: filtro "Etiqueta" (relación con buscador) y acción en lote "Agregar o
  quitar etiqueta" (parámetro: etiqueta + agregar/quitar), con la confirmación y el registro de la 0.2.

### 3.4 Adjuntos privados

- Tipos: PDF, JPG, PNG, WEBP, HEIC, DOC/DOCX, XLS/XLSX. Hasta **10 MB por archivo**; varios a la vez,
  arrastrando o eligiendo.
- **Privados de verdad**: van a un bucket R2 **separado y sin dominio público**
  (`fotoffice-private-prod`, y `fotoffice-private-staging` para staging). No se usa el bucket de
  imágenes actual, que se sirve por una URL pública.
- **Subida directa** del navegador al bucket con URL firmada (PUT), como ya funciona en FotoRank
  (`fotorank-private-prod`): Vercel corta cualquier pedido de más de 4,5 MB. Flujo: pedir permiso de
  subida (el servidor valida tipo, tamaño, persona y workspace, y reserva el registro) → PUT directo →
  confirmar (el servidor verifica que el objeto existe y su tamaño real).
- **Descarga**: enlace firmado que vence a los 5 minutos, generado en el momento para quien tiene
  `operar`. Nunca se guarda una URL en la base: sólo la clave del objeto.
- Clave del objeto: `adjuntos/<workspaceId>/<uuid>` (el nombre original se guarda aparte, no en la
  clave).
- **Borrar**: desaparece de la ficha y deja el evento en la historia; el objeto se elimina del bucket
  a los 30 días (tarea programada), por si fue un error. Dueño y Administrador pueden restaurarlo
  dentro de ese plazo.
- La columna de adjuntos muestra el total usado por la persona.

### 3.5 Personas relacionadas

- Vínculo entre dos personas (cliente o socio) de la misma organización, con un tipo que se lee bien
  desde los dos lados:

  | Desde A | Desde B |
  |---|---|
  | madre / padre | hijo / hija |
  | pareja | pareja |
  | hermano / hermana | hermano / hermana |
  | abuelo / abuela | nieto / nieta |
  | tío / tía | sobrino / sobrina |
  | proveedor | cliente |
  | empleado | empleador |
  | amigo / amiga | amigo / amiga |
  | otro (texto libre) | el mismo texto |

- Nota opcional por vínculo ("paga el álbum").
- Si la otra persona no existe, se la crea como cliente con nombre y teléfono sin salir de la ficha.
- Un vínculo repetido entre las mismas dos personas no se permite; borrar un vínculo deja el evento.

### 3.6 Línea de tiempo: qué aparece

| Tipo | Fuente | Qué se ve |
|---|---|---|
| Cambios | `MemberAudit` (socio) y el nuevo historial de Cliente | datos editados (antes → después), estado, vínculo cliente-socio, etiquetas puestas/quitadas, relaciones |
| Notas | notas | la nota con su categoría; las fijadas arriba |
| Plata | `CashMovement` del cliente; `MembershipCharge` y `MembershipPayment` del socio | cobros, cuotas generadas y pagadas, anulaciones — **sólo con `verDinero`** |
| Portal | `MemberAudit` (invitaciones) y los datos corregidos por la persona | invitación enviada/aceptada/fallida, datos cambiados desde el portal |
| Carnets | `MemberCardEvent` | pedido, impreso, entregado, revocado |
| Adjuntos | adjuntos | subido, borrado, restaurado |

Cada evento dice quién, cuándo (hora de Buenos Aires), qué, y trae un enlace a lo que corresponda.

## 4. Cómo está hecho

**Enfoque (A, elegido):** la línea de tiempo se arma **al leerla**, juntando lo que ya existe. Cada
fuente es un "proveedor" que, dada la persona y un rango, devuelve eventos en un formato común; el
motor los ordena por fecha y pagina. No se copia nada dos veces: cuando llegue Presupuestos o Pedidos,
suma su proveedor. Se descartaron una tabla central de eventos (hay que tocar cada lugar que escribe y
duplica `MemberAudit`) y las pestañas separadas de Alboom.

### 4.1 La persona

La ficha trabaja sobre una **referencia de persona** `{ tipo: "CLIENTE" | "SOCIO", id }`, resuelta
siempre dentro del workspace de la sesión. Si el cliente está vinculado a un socio (`Client.memberId`),
la persona es el par, y notas, etiquetas, adjuntos y relaciones se guardan **sobre el cliente** cuando
existe (el socio sin cliente los guarda sobre sí mismo). Al vincular más tarde un socio con un cliente,
lo del socio se muda al cliente en la misma transacción.

### 4.2 Línea de tiempo (`lib/ficha/`)

- `EventoFicha`: `{ id, tipo, fecha, actor, titulo, detalle?, enlace?, cambios?, capacidad? }`.
- Proveedores: `notas`, `adjuntos`, `etiquetas-y-relaciones` (del nuevo historial),
  `historial-cliente`, `historial-socio` (`MemberAudit`), `caja` (`CashMovement`),
  `cuotas` (`MembershipCharge`/`MembershipPayment`), `carnets` (`MemberCardEvent`).
- Paginación por cursor de fecha: cada proveedor trae los 30 anteriores al cursor, el motor mezcla y
  corta en 30. Un proveedor que falla no rompe la ficha: se omite y se avisa en una línea.
- Los eventos de plata se filtran por `verDinero` en el servidor, no en la pantalla.

### 4.3 Componentes (`components/ficha/`)

`EncabezadoFicha`, `LineaDeTiempo` (filtros, "Ver más"), `CajaDeNota`, `Nota`, `Etiquetas`,
`Adjuntos` (subida directa con progreso), `PersonasRelacionadas`, `DatosFicha` (definición de datos
compartida en vez de los `Dato` locales de cada página). Clases `fo-*` existentes, sin librerías nuevas.

### 4.4 Datos nuevos (tablas propias de FOTOFFICE)

- `FotofficeNoteCategory` (workspaceId, name, order, isActive).
- `FotofficeNote` (workspaceId, clientId?, memberId?, categoryId, body, pinned, authorUserId,
  authorLabel, editedAt?, deletedAt?, createdAt).
- `FotofficeTag` (workspaceId, name, nameKey único por workspace, color).
- `FotofficeTagAssignment` (workspaceId, tagId, clientId?, memberId?, createdByUserId, createdAt; única
  por etiqueta + persona).
- `FotofficeAttachment` (workspaceId, clientId?, memberId?, storageKey, fileName, contentType,
  sizeBytes, status `PENDIENTE|LISTO|BORRADO`, uploadedByUserId, uploadedByLabel, deletedAt?,
  purgeAfter?, createdAt).
- `FotofficePersonRelation` (workspaceId, fromClientId?/fromMemberId?, toClientId?/toMemberId?, kind,
  customLabel?, note?, createdByUserId, createdAt; única por par).
- `ClientAudit` (workspaceId, clientId, action, actorUserId, actorLabel, changesJson, createdAt) —
  mismo formato que `MemberAudit`, escrito en la misma transacción que el cambio.

En cada tabla con persona: exactamente uno de `clientId`/`memberId` (restricción `CHECK` en el SQL).
Ninguna columna nueva en tablas que lean otras apps. Migración escrita a mano, **las tablas antes que el
código**, como en 0.1 y 0.2; incluye la conversión de "Observaciones" a notas y las 13 categorías de DNX.

### 4.5 Permisos

| Qué | Capacidad |
|---|---|
| Ver la ficha | el guarda de cada módulo, sin cambios |
| Escribir notas, poner etiquetas, subir y bajar adjuntos, vincular personas | `operar` |
| Editar o borrar notas ajenas, restaurar adjuntos | `configurar` |
| Catálogos (categorías de notas, etiquetas: renombrar, unir, borrar) | `configurar` |
| Ver eventos de plata | `verDinero` |

## 5. Infraestructura

- Buckets R2 privados `fotoffice-private-prod` y `fotoffice-private-staging`, sin dominio público, con
  CORS para PUT desde los dominios de FOTOFFICE (producción y staging), método `PUT`, cabecera
  `content-type`. **Crear los buckets y el CORS requiere el permiso de Daniel** (es infraestructura
  compartida; el MCP de R2 bloquea mutaciones sobre buckets de producción).
- Variables de entorno nuevas en Vercel: `R2_PRIVATE_BUCKET` (o el nombre que use el código).
- Tarea programada diaria que elimina del bucket los adjuntos con `purgeAfter` vencido.

## 6. Errores y casos borde

- Archivo de más de 10 MB o de tipo no permitido: se rechaza antes de subir, con el motivo.
- Subida cortada a mitad: el registro queda `PENDIENTE` y no se muestra; una tarea limpia los
  `PENDIENTE` de más de 24 horas.
- Enlace de descarga vencido: se pide uno nuevo con un clic.
- Persona de otra organización (por id en la dirección): "no encontrado", sin distinguir.
- Vincular socio con cliente cuando los dos ya tienen notas o etiquetas: se juntan sin duplicar
  etiquetas.
- Una fuente de la línea de tiempo falla: la ficha se ve igual, sin esa fuente, con un aviso.

## 7. Pruebas

- Aislamiento: notas, etiquetas, adjuntos y relaciones nunca se leen ni escriben con otro workspace.
- Adjuntos: no se puede pedir un enlace sin `operar`; la clave nunca sale al navegador; el tamaño real
  se verifica al confirmar; los `BORRADO` se purgan después de 30 días y no antes.
- Línea de tiempo: orden correcto al mezclar fuentes, paginación sin repetidos ni huecos, eventos de
  plata ocultos sin `verDinero`.
- Conversión de "Observaciones": todas pasan completas, una sola vez (idempotente).
- Vincular socio y cliente: lo del socio se muda al cliente sin duplicados.
- Historial de Cliente: cada guardado deja sólo los campos que cambiaron.

## 8. Criterios para el tablero de avance

1. La ficha de un cliente muestra su historia completa en una sola línea de tiempo.
2. Se escribe una nota con categoría y se fija arriba.
3. Se pone una etiqueta en la ficha y se filtra por ella en el listado.
4. Se sube un PDF a la ficha y sólo alguien del equipo lo puede bajar.
5. Se vincula a una quinceañera con su mamá y las dos fichas lo muestran.
6. Las "Observaciones" viejas aparecen como primera nota.

## 9. Orden de publicación

1. 0.1 (PR 277) y 0.2 (PR 281) fusionadas.
2. Buckets privados y CORS creados (con permiso de Daniel); variables en Vercel.
3. SQL de las tablas nuevas y la conversión, en staging y después en FOTOFFICE.
4. Código.
5. Prueba en producción con DNX Estudio (fichas de clientes) y SFPR (fichas de socios).
