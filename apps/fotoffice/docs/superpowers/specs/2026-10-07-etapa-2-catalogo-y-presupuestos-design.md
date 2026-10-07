# Etapa 2 · Catálogo y Presupuestos

> 07/10/2026 · Reemplazo de Alboom (`docs/alboom/00-mapa-general-y-plan.md` §4). Se apoya en la Etapa 0 y en la
> Etapa 1, ya en producción (PR 277, 402, 408, 410).
>
> **Decisiones de Daniel (07/10):**
> - El precio de cada ítem se puede fijar de **las dos formas, en paralelo**: precio de lista del catálogo o
>   cálculo con ¿Cuánto Cobro?. Se elige en el momento de fijar el precio.
> - Al aceptar, el pedido **no** se crea solo: queda "por confirmar".
> - El formulario web puede responder con la **propuesta modelo** de la categoría: opcional y apagado.
> - Costo y margen los ven **sólo el dueño y los administradores**.
>
> Lo demás va marcado **[decisión]**. **Sin staging.** El análisis de brecha está en la conversación del 07/10.
> El spec del 14/09 (rama `feat/fotoffice-presupuestos-crm`) se toma en lo que sigue vigente: versiones
> inmutables, enlace con token, aceptación con evidencia, la vista pública nunca muestra costos. Su modelo de
> consulta queda reemplazado por el de la Etapa 1.

## 1. Qué problema resuelve

DNX presupuesta en Alboom eligiendo productos y servicios del catálogo, manda un enlace y, a los 3 días, sale un
seguimiento automático. Alboom sólo sabe "Enviado" y "Visto": no hay botón de aceptar, un presupuesto visto ya
no se edita y el "Presupuesto Estándar Master" está vacío.

FOTOFFICE tiene la base en producción:

- el catálogo de Ventas (`Product`, servicio o producto, con precio, costo y SKU);
- la numeración `PRESUPUESTO`;
- plantillas con variables;
- Consultas con contacto;
- el motor de etapas, que ya declara el evento `PRESUPUESTO_ACEPTADO`;
- el motor de cálculo `@repo/cuanto-cobro-core`.

Falta el presupuesto como registro, los combos y costos del catálogo, el enlace público con aceptación y el
seguimiento.

## 2. Alcance

Se publica en **dos entregas** **[decisión]**.

### Entrega A · Catálogo y presupuesto

1. **Catálogo ampliado** sobre `Product`. Se suman:
   - **combos** (paquetes con componentes, **precio propio** y la suma de los componentes a la vista como
     "ahorro") **[decisión: Daniel no eligió; es la recomendación]**;
   - **costos-plantilla** por producto: proveedor, concepto, importe fijo o por unidad, días desde el evento;
     sólo se registran, los pagos llegan en la Etapa 3;
   - "en lista de precios";
   - rubro de ingreso en texto **[decisión: la jerarquía de cuentas llega con Caja en la Etapa 3]**.
2. **Presupuesto** de una consulta (y de su contacto):
   - ítems del catálogo o de texto libre, con secciones y opcionales;
   - descuento por ítem y global, en % o en $;
   - validez;
   - condiciones;
   - propuesta de forma de pago en texto.
3. **Dos formas de fijar el precio, en paralelo:** en cada ítem se elige **"Precio de lista"** (el del
   catálogo, editable) o **"Calcular con ¿Cuánto Cobro?"**.
   - El cálculo abre un panel con el motor `cuanto-cobro-core`: horas, costos propios y tercerizados,
     gastos y margen deseado. Devuelve un precio sugerido, que se puede ajustar.
   - El cálculo queda guardado junto al ítem.
   - También se puede armar el presupuesto entero con el asistente de ¿Cuánto Cobro?: el resultado se
     convierte en ítems.
4. **Versiones inmutables** (V1, V2…). Enviar congela la versión. Editar un presupuesto enviado crea la
   versión siguiente; el enlace siempre muestra la vigente.
5. **Estados:** Borrador, Enviado, Visto, Aceptado, Rechazado y Vencido (el vencido se calcula a partir de
   la validez).
6. **Enlace público** con token. Muestra:
   - la marca de la organización;
   - los ítems con precio y sin costos;
   - los totales;
   - las condiciones;
   - el botón **"Acepto"** (nombre + tilde de condiciones; queda la evidencia: fecha, IP con hash y
     navegador);
   - el botón "Tengo dudas", que abre WhatsApp con la organización.

   Cada apertura queda registrada, y la primera avisa al vendedor con una tarea "Presupuesto visto".
7. **PDF:** vista para imprimir o guardar como PDF desde el navegador **[decisión: sin dependencia nueva]**.
8. **Envío:** por correo o WhatsApp con las plantillas (0.6). Variables nuevas: `[presupuesto_numero]`,
   `[presupuesto_enlace]`, `[presupuesto_total]`, `[presupuesto_vence]`.
9. **Al aceptar:**
   - el presupuesto pasa a Aceptado;
   - se avisa al motor el evento `PRESUPUESTO_ACEPTADO`: la consulta avanza o se gana según las reglas del
     circuito, y si se gana, el contacto pasa a Cliente (Etapa 1);
   - queda "Pedido por confirmar", que la Etapa 3 convierte con un clic;
   - se avisa al responsable (tarea + correo interno, con tope).
10. **Numeración:** Presupuestos con la secuencia `PRESUPUESTO`. DNX la configura en 2025262 para seguir la
    de Alboom (Configuración → Numeración, ya existe).
11. **Listados y ficha:**
    - lista de Presupuestos con estado, total, vence y contacto, con filtros y lote "marcar vencidos";
    - tarjeta "Presupuestos" en la ficha de la consulta y del contacto;
    - línea de tiempo con envíos, vistas y aceptación.
12. **Costo y margen** del presupuesto y del catálogo: sólo dueño y administradores. El equipo arma y envía
    con precios.

### Entrega B · Automatismos

13. **Propuesta modelo por categoría:** ítems predefinidos y texto. Si está activada, el formulario web crea el
    presupuesto con esos ítems y lo envía solo, como tercer modo de la respuesta automática, con los mismos
    topes.
14. **Seguimiento automático** a N días (DNX: 3), con la plantilla `PRESUPUESTO_SEGUIMIENTO`. No sale si el
    presupuesto ya fue aceptado, rechazado o vencido. Una tarea programada diaria; queda en el historial.
15. **Lista de precios pública:** variable `[lista_precios]` con los productos "en lista de precios" de la
    categoría.

**No entra:**

- IVA (DNX no factura con IVA; el campo queda en 0 sin calcular).
- Varias listas de precios.
- Alternativas A/B/C dentro del mismo presupuesto.
- Plan de cuotas: Etapa 3.
- Adjuntos en las plantillas.
- Firma de contrato: Etapa 5.

## 3. Cómo lo vive quien usa el sistema

### 3.1 Catálogo (Ventas → Catálogo, ampliado)

- La ficha del producto suma tres secciones:
  - **"Combo"**: componentes con cantidad; muestra la suma de los componentes y el ahorro;
  - **"Costos"**: filas de costo, cada una con un proveedor (un contacto con categoría Proveedor), concepto,
    importe, fijo o por unidad, y días desde el evento (+/-);
  - **"Para presupuestos"**: en lista de precios sí/no y rubro de ingreso.
- Costo y margen se ven con el permiso actual del catálogo (`sales.catalog`), igual que hoy.
- Las 11 categorías de producto de DNX se cargan como categorías del catálogo.

### 3.2 Armar un presupuesto

- **Desde dónde se crea:** desde la ficha de la consulta ("Nuevo presupuesto") o desde Presupuestos → Nuevo,
  eligiendo la consulta o creando una con su contacto.
- **Editor de ítems:**
  - buscador del catálogo, ítem de texto libre, sección y opcional;
  - cantidad, precio, descuento.
- **Precio de cada ítem:** un selector "Lista / ¿Cuánto Cobro?".
  - En "¿Cuánto Cobro?" se abre el panel de cálculo y el precio sugerido se pega en el ítem.
  - El panel muestra costo y margen sólo al dueño y los administradores.
- **"Armar con ¿Cuánto Cobro?":** asistente completo que propone ítems.
- **Totales:** subtotal, descuentos y total; costo y margen para dueño y administradores.
- **Validez, condiciones y propuesta de pago:**
  - la validez viene de Configuración (DNX: 15 días);
  - las condiciones y la propuesta de pago vienen de Configuración y se pueden editar por presupuesto.
- **Enviar:** elige plantilla y canal, congela la versión, asigna el número si no lo tenía y pasa el estado a
  Enviado.

### 3.3 Enlace público

- Dirección `/<slug>/presupuesto/<token>`, sin sesión.
- Muestra la marca, el número, la versión, los ítems por sección y los totales.
  - Los opcionales se muestran marcados **[decisión: el cliente no los tilda en esta etapa]**.
- Muestra la validez, las condiciones y la propuesta de pago.
- **Botones:**
  - "Acepto", con nombre y tilde;
  - "Tengo dudas", que abre WhatsApp;
  - "Descargar PDF".
- **Vencido o reemplazado:**
  - un presupuesto vencido muestra "Este presupuesto venció" y el botón "Pedir uno nuevo", que avisa al
    vendedor;
  - una versión reemplazada muestra la vigente.

### 3.4 Configuración → Presupuestos

- Validez por omisión, condiciones generales, propuesta de pago por omisión y días de seguimiento.
- Propuesta modelo por categoría (Entrega B).
- Permiso: `configurar`.

## 4. Cómo está hecho

### 4.1 Datos (sólo tablas nuevas `Fotoffice*`)

- **`FotofficeProductoCatalogo`** (1:1 con `Product`): workspaceId, productId (único), inPriceList, incomeLabel,
  isCombo.
- **`FotofficeComboItem`:** workspaceId, comboProductId, componentProductId, quantity, order.
- **`FotofficeCostoPlantilla`:** workspaceId, productId, supplierClientId (opcional), concept, amountArs
  (decimal), perUnit (bool), daysFromEvent (int), order.
- **`FotofficePresupuesto`:**
  - workspaceId, consultaLeadId (FK a `ServiceSalesLead`), clientId;
  - status (texto con CHECK);
  - currentVersionId, acceptedVersionId;
  - ownerUserId;
  - validUntil;
  - pedidoPorConfirmar (bool);
  - createdAt, updatedAt.
- **`FotofficePresupuestoVersion`** (inmutable una vez enviada):
  - presupuestoId, number (1, 2…);
  - items (JSON con instantáneas: nombre, descripción, cantidad, precio, descuento, modo de precio
    `LISTA | CALCULO`, instantánea del cálculo, sección, opcional, productId);
  - totals (JSON);
  - terms, paymentProposal;
  - costSnapshot (JSON, nunca se envía al público);
  - sentAt;
  - tokenHash (único), tokenExpiresAt, revokedAt;
  - acceptedAt, acceptedName, acceptedIpHash, acceptedUserAgent.
- **`FotofficePresupuestoVista`:** versionId, viewedAt, ipHash, userAgent.
- **`FotofficePresupuestoAjustes`:** workspaceId (único), validityDays, terms, paymentProposal, followUpDays,
  followUpEnabled.
- **`FotofficePropuestaModelo`** (Entrega B): workspaceId, categoryId (único), items (JSON), autoSendOnWeb,
  templateId.
- **Número:** `FotofficeRecordNumber`, con entityType `PRESUPUESTO` y la secuencia existente.
- **Estados y evidencia:** los estados son texto con CHECK. El token se guarda como hash (SHA-256), igual que en
  la Tienda.

### 4.2 Código

- **`lib/presupuestos/`:**
  - cálculo de totales (puro);
  - versiones;
  - envío;
  - enlace y token;
  - aceptación;
  - vistas;
  - permisos;
  - semillas;
  - listado;
  - cálculo con `cuanto-cobro-core`, con un adaptador puro que lleva el resultado del motor a un ítem.
- **`lib/catalogo/`:** combos, costos, perfil 1:1.
- **Pantallas:**
  - `app/(shell)/presupuestos/*` (lista, nuevo, editor, vista de impresión);
  - página pública `app/[slug]/presupuesto/[token]` (seguir el patrón de rutas públicas del sitio y de la
    Tienda);
  - `app/workspace/configuracion/presupuestos`;
  - tarjetas en la ficha de la consulta y del contacto.
- **Módulo:** `quotes` pasa de PLANNED a disponible; se enciende junto con `service-leads`. Permisos por el
  adaptador:
  - Ver para leer, Gestionar para armar y enviar;
  - `verDinero` o `configurar` para costo y margen;
  - `quotes` se suma a `MODULOS_DE_PLATA` sólo para costo y margen **[decisión]**.
- **Motor de etapas:**
  - `PRESUPUESTO_ACEPTADO` entra en `EVENTOS_CONECTADOS`;
  - evento nuevo `PRESUPUESTO_ENVIADO`, para que una etapa avance sola al enviar.

## 5. Errores y casos borde

- **Doble aceptación o carrera:** una sola aceptación por versión (`UPDATE … WHERE acceptedAt IS NULL`). La
  segunda ve "Ya fue aceptado".
- **Aceptar una versión vieja o vencida:** se rechaza con un mensaje claro.
- **Token:** inválido o revocado da 404 genérico. Hay freno por IP para ver y para aceptar.
- **Costos:** nunca viajan a la página pública ni al navegador de quien no tiene permiso (prueba de fuente y de
  datos).
- **Producto archivado o con otro precio después:** el presupuesto usa su instantánea, así que no cambia.
- **Consulta perdida:** el presupuesto queda; aceptarlo reabre la consulta como ganada **[decisión]**.

## 6. Pruebas

- Totales con descuentos, opcionales y secciones.
- Modo Lista contra modo Cálculo, con el resultado del motor convertido en ítem.
- Versiones inmutables.
- Enlace: vista registrada, aceptación con evidencia, carrera, vencido, revocado.
- Costos ocultos para el público y para el equipo.
- Evento al motor de etapas.
- Aislamiento por workspace.
- Combos y costos-plantilla en el catálogo.
- Plantillas con las variables nuevas.

## 7. Criterios para el tablero de avance

1. Daniel arma un presupuesto con dos ítems de lista y uno calculado con ¿Cuánto Cobro?, y lo envía por correo.
2. El cliente abre el enlace (queda registrado) y acepta; la consulta pasa a Ganada y queda "Pedido por
   confirmar".
3. Una edición después de enviado crea la V2, y el enlace muestra la V2.
4. Sabi ve y envía presupuestos sin ver costos.
5. (B) Una consulta web de una categoría con propuesta modelo recibe su presupuesto sola; a los 3 días sale el
   seguimiento.

## 8. Publicación (sin staging)

Cada entrega va así:

1. SQL de sus tablas en producción.
2. Código.
3. Prueba en DNX Estudio.
