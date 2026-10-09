# Etapa 5 · Contratos

> 09/10/2026 · Reemplazo de Alboom (`docs/alboom/00-mapa-general-y-plan.md` §4). Se apoya en las Etapas 0 a 4,
> ya en producción. El análisis de brecha está en la conversación del 09/10.
>
> **Decisiones de Daniel (09/10):**
> - **Firma:** el firmante acepta con su nombre, confirma un **código enviado a su correo** y **dibuja su firma**.
>   Queda evidencia: fecha, IP (con hash), navegador y huella SHA-256 del documento.
>   Es **firma electrónica** (Ley 25.506, art. 5), no firma digital con certificado.
> - **Firmantes:** **Contratante 1** (obligatorio) y **Contratante 2** (opcional), cada uno con su propio
>   enlace. La firma de la empresa es una **imagen** cargada una vez y se inserta al emitir.
> - **Creación:** el contrato se arma **a mano desde el pedido** ("Generar contrato" con una plantilla).
>   Es editable mientras es borrador y se **congela al enviar**.
> - **PDF:** cuando están todas las firmas se genera un **PDF sellado** con hoja de constancia, que se manda
>   por correo a todas las partes y se guarda en privado.
>
> Lo demás va marcado **[decisión]**. **Sin staging.**

## 1. Qué problema resuelve

DNX tiene 5 plantillas de contrato en Alboom (la principal es CONTRATO EVENTOS 2024), con unas 110
variables. Los contratos se crean desde el pedido, se mandan por correo y el cliente los acepta con su
nombre y un trazo dibujado.

**Defectos de Alboom que no se copian:**
- congela el texto al crear;
- no tiene estados explícitos, versiones ni huella del documento;
- guarda la firma en base64 dentro de un JSON;
- no genera PDF ni manda copia a las partes;
- no tiene recordatorios;
- deja variables sin reemplazar en el texto.

**FOTOFFICE ya tiene:**
- el motor de plantillas `[variable]` y `[si:x]…[/si]` (`lib/plantillas/motor.ts`);
- el enlace público con token HMAC y la aceptación con evidencia del presupuesto
  (`lib/presupuestos/{enlace,aceptacion}.ts`);
- la numeración `CONTRATO`;
- el pedido con sus ítems y su plan de cuotas;
- adjuntos privados en R2;
- correos con topes;
- crons;
- `pdf-lib` en el monorepo (CompraMeLaFoto).

## 2. Alcance

Dos entregas **[decisión]**.

### Entrega A · Plantillas, contrato y firma en línea

1. **Plantillas de contrato** (Configuración → Contratos → Plantillas):
   - nombre, texto, activa u archivada, orden;
   - el texto es plano con formato liviano **[decisión: sin editor rico]**:
     - un renglón que empieza con `# ` es un título;
     - un renglón en blanco separa párrafos;
     - `**negrita**`;
     - `[salto_de_pagina]`;
   - variables con el motor existente, y estas nuevas:
     - `[contratante1_*]` y `[contratante2_*]`: nombre, documento, domicilio, correo y teléfono;
     - `[pedido_numero]`, `[pedido_total]`, `[pedido_items]` (tabla), `[pedido_cuotas]` (tabla de vencimientos);
     - `[evento_fecha]`, `[evento]`;
     - `[empresa_*]`: nombre, CUIT, domicilio;
     - `[fecha_hoy]` y `[contrato_numero]`;
   - vista previa con un pedido de ejemplo;
   - aviso de variables desconocidas.
2. **Contratantes en el pedido:**
   - Contratante 1 (por omisión, el contacto del pedido) y Contratante 2 (opcional);
   - se eligen entre los contactos de la organización;
   - el correo es obligatorio para firmar en línea.
3. **Contrato:**
   - "Generar contrato" en la ficha del pedido: elige la plantilla y crea un borrador;
   - se puede editar el texto, y "Actualizar datos" vuelve a completar las variables;
   - número `CONTRATO`;
   - estados: `BORRADOR → ENVIADO → FIRMADO_PARCIAL → FIRMADO`, más `RECHAZADO` y `ANULADO`;
   - **enviar:**
     - congela una **versión** con el texto final y su huella SHA-256;
     - crea un firmante por contratante, cada uno con su enlace (token con hash);
     - manda el correo con la plantilla automática "Contrato para firmar";
   - **corregir un contrato enviado** crea una versión nueva y anula los enlaces anteriores;
   - **anular** exige motivo.
4. **Página pública de firma** (`/w/<slug>/contrato/<token>`):
   - muestra el contrato, con la firma de la empresa;
   - el firmante escribe su nombre y tilda "Leí y acepto";
   - pide el **código de 6 dígitos** que llega a su correo: vale 15 minutos, con 5 intentos y freno por IP;
   - el firmante **dibuja su firma** en un recuadro (con el dedo o el mouse);
   - también tiene "No estoy de acuerdo", con motivo obligatorio;
   - la firma se guarda como PNG en R2 privado;
   - la evidencia de cada firmante: fecha, IP con hash y sal, navegador, correo verificado, huella del documento;
   - se puede firmar una sola vez por firmante;
   - leyenda fija: "Firma electrónica conforme a la Ley 25.506. Este documento no tiene firma digital con
     certificado".
5. **Ficha del contrato:**
   - estado de cada firmante (enviado, visto, verificado, firmado, rechazado);
   - historial (`FotofficeContratoEvento`);
   - copiar el enlace de cada firmante y reenviarlo;
   - anular;
   - "Marcar firmado en papel" con un adjunto escaneado.
6. **Pantallas:**
   - listado estándar de contratos;
   - tarjeta "Contratos" en el pedido y en el contacto;
   - módulo `contracts` ("Contratos"), que depende de `orders`.
7. **Al firmar todos:**
   - estado `FIRMADO`;
   - se tilda sola la tarea "Recoger firma del contrato" del checklist del pedido, si existe;
   - aviso al responsable.

### Entrega B · PDF sellado y recordatorios

1. **PDF sellado** con `pdf-lib`:
   - contiene el texto de la versión firmada, las firmas dibujadas y la de la empresa;
   - termina en una **hoja de constancia**: firmantes, correos verificados, fecha y hora, IP con hash,
     huella SHA-256 de la versión;
   - se guarda en R2 privado con su propia huella;
   - se manda por correo a todas las partes y a la organización;
   - se descarga desde la ficha y desde la página pública ya firmada.
2. **Recordatorios:** a los firmantes pendientes, cada N días (configurable, apagado por omisión), con tope y
   una vez por día por firmante.
3. **Ajustes de Contratos:**
   - imagen de la firma de la empresa;
   - datos de la empresa para las variables;
   - días de los recordatorios;
   - texto de la cláusula de aceptación electrónica.

**Fuera de alcance:**
- firma digital con certificado;
- verificación por WhatsApp;
- más de 2 contratantes en la pantalla (el modelo admite N);
- migración de las plantillas de Alboom (Etapa 8). Daniel puede pegar el texto en las plantillas nuevas.

## 3. Datos (sólo tablas `Fotoffice*` nuevas)

- `FotofficeContratoPlantilla`.
- `FotofficePedidoContratante`: pedidoId, orden (1 o 2), clientId; único (pedidoId, orden).
- `FotofficeContrato`:
  - workspaceId, pedidoId, clientId, templateId?, number, name;
  - status, bodyText (borrador), currentVersionId?;
  - fechas de envío, firma, rechazo y anulación; motivo;
  - ownerUserId.
- `FotofficeContratoVersion`: contratoId, number, bodyText, contentHash, sentAt, revokedAt.
- `FotofficeContratoFirmante`:
  - versionId, orden, clientId, nombre, documento y correo congelados;
  - tokenHash único, tokenExpiresAt;
  - viewedAt;
  - verificación: codeHash, codeExpiresAt, codeAttempts, verifiedAt;
  - firma: signedAt, typedName, signatureKey (R2);
  - evidencia: ipHash, userAgent;
  - rechazo: rejectedAt, rejectReason.
- `FotofficeContratoEvento`: auditoría.
- `FotofficeContratoAjustes`: firma de la empresa, datos de la empresa, recordatorios, cláusula.
- **Entrega B:** columnas del PDF en tablas nuevas o en la versión. **[decisión: se agregan en la migración de
  la Entrega A, para no tocar dos veces]**

## 4. Errores y casos borde

- **Contratante sin correo:** no se puede enviar. Se avisa en el pedido.
- **Correo que no llega:** el firmante puede pedir otro código, como máximo 3 por hora.
- **Token vencido o versión revocada:** "Este enlace ya no es válido".
- **Firma dibujada vacía:** se rechaza.
- **Dos personas firmando a la vez:** la escritura condicional permite una sola firma por firmante.
- **Variables sin reemplazar:** no se puede enviar y se avisa cuáles faltan.
- **Datos personales:** nunca van al registro. La IP sólo se guarda con hash.

## 5. Publicación

Igual que las etapas anteriores:
1. SQL a mano, antes del código;
2. PR, chequeos y fusión;
3. verificación;
4. encender el módulo en DNX;
5. prueba con un contrato de prueba firmado desde otro dispositivo.
