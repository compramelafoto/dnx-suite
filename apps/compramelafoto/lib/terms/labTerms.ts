export const LAB_TERMS_VERSION = "v2";

export const LAB_TERMS_TEXT = `# TÉRMINOS Y CONDICIONES – LABORATORIOS

## 1. ACEPTACIÓN Y REGISTRO

Al registrarte como laboratorio en ComprameLaFoto, aceptás estos términos y condiciones. El registro implica:

- Completar todos los datos requeridos del laboratorio
- Aceptar estos términos y condiciones de forma obligatoria
- Conectar tu cuenta de Mercado Pago (Marketplace/Split) de forma obligatoria para recibir pagos
- Mantener actualizada la información de contacto y operativa

## 2. ESTADOS DE APROBACIÓN

Tu laboratorio pasará por los siguientes estados:

- **DRAFT**: Perfil incompleto. Podés completar tus datos, pero no podés recibir pedidos.
- **PENDING**: Pendiente de aprobación por el administrador. Podés completar tu catálogo y configuración mientras esperás.
- **APPROVED**: Aprobado y operativo. Podés recibir pedidos y cobrar.
- **REJECTED**: Rechazado con motivo. Podés corregir y reenviar solicitud.
- **SUSPENDED**: Suspendido temporalmente. No podés recibir nuevos pedidos hasta reactivación.

Solo los laboratorios en estado **APPROVED** pueden recibir pedidos y cobrar comisiones.

## 3. CONEXIÓN CON MERCADO PAGO (OBLIGATORIA)

**Es obligatorio** conectar tu cuenta de Mercado Pago en modo Marketplace/Split para:

- Recibir pagos de pedidos procesados
- Liquidar comisiones de forma automática
- Operar en la plataforma

Sin conexión con Mercado Pago:
- **NO podés recibir pedidos**
- **NO podés cobrar comisiones**
- Podés completar tu perfil, configurar catálogo y conectar MP

## 4. PRECIOS Y COMISIONES

### 4.1 Estructura de Precios

Podés configurar dos tipos de precios para cada producto:

- **Precio Minorista (Retail)**: Precio al cliente final
- **Precio Mayorista (Wholesale)**: Precio para fotógrafos que revenden

**Regla general**: La plataforma siempre muestra el **precio más económico disponible** para aumentar el volumen de pedidos.

### 4.2 Precios según Origen del Pedido

**Pedidos desde HOME del Fotógrafo (Reventa)**:
- Por defecto se usa el precio **MAYORISTA** (si existe)
- Si no tenés precio mayorista, se usa el minorista
- Podés configurar: AUTO (mayorista si existe, sino minorista), SIEMPRE MAYORISTA, o SIEMPRE MINORISTA
- Esto permite que el fotógrafo tenga margen por traerte clientes

**Pedidos desde HOME Público (Imprimir Público)**:
- Siempre se usa el **precio más económico** disponible
- Si tenés ambos precios, se muestra el menor
- Si solo tenés uno, se usa ese

### 4.3 Comisiones de la Plataforma

La plataforma aplica comisiones según el tipo de laboratorio y el origen del pedido:

- **Labs Tipo A** (con precio profesional + público): Comisión estándar sobre pedidos públicos
- **Labs Tipo B** (solo precio público): Comisión estándar sobre pedidos públicos
- Los cobros pueden ingresar primero en la cuenta de la plataforma y luego transferirse al laboratorio
- Los tiempos de acreditación y transferencia dependen de Mercado Pago

## 5. CATÁLOGO DE PRODUCTOS

### 5.1 Productos Disponibles

Podés vender:
- Fotografías impresas (con tamaños y terminación mate/brillo)
- Cuadros canvas
- Cuadros sobre madera
- Dípticos / trípticos
- Fototarjeta doble faz
- Cualquier otro producto que cargues

### 5.2 Configuración de Productos

Cada producto/variante debe tener:
- Nombre del producto
- Categoría
- Tamaño (si aplica)
- Acabado (mate/brillo para impresiones)
- Material (canvas/madera para cuadros)
- **SLA de producción en días** (requerido)
- Precio minorista (opcional)
- Precio mayorista (opcional)

### 5.3 Importación/Exportación de Catálogo

- Podés exportar tu catálogo a XLSX
- Podés importar/actualizar desde XLSX
- La importación es **TODO/NADA**: si hay errores, no se aplica ningún cambio
- Los productos se identifican por ID interno para actualización

## 6. PEDIDOS Y PRODUCCIÓN

### 6.1 Recepción de Pedidos

Solo recibís pedidos si:
- Tu estado es **APPROVED**
- Tenés **Mercado Pago conectado**
- Tu catálogo tiene productos activos

### 6.2 Estados de Pedidos

Los pedidos pasan por estos estados:
- **CREATED**: Creado, esperando pago
- **IN_PRODUCTION**: En producción en tu laboratorio
- **READY / READY_TO_PICKUP**: Listo para retirar o enviar
- **SHIPPED**: Enviado (si aplica)
- **DELIVERED**: Entregado
- **CANCELED**: Cancelado

### 6.3 Responsabilidades

- **SLA**: Debes cumplir con el tiempo de producción configurado en cada producto
- **Calidad**: Eres responsable de la calidad de las impresiones/productos entregados
- **Comunicación**: Al marcar un pedido como READY, se genera automáticamente un link de WhatsApp para notificar al cliente

### 6.4 Retiro y Envíos

- **Retiro en laboratorio**: El cliente retira en tu domicilio
- **Envíos**: Si habilitás envíos, el costo lo coordina y paga el comprador directamente contigo
- La plataforma informa antes de comprar si hay envíos disponibles o solo retiro
- Si solo ofrecés retiro, NO se permiten compras desde otras provincias/ciudades (solo locales)

## 7. NO HAY REEMBOLSOS NI CANCELACIONES

**Regla del negocio**: No se permiten reembolsos ni cancelaciones una vez que el pedido está en producción o pagado. Esta regla aplica tanto para clientes como para laboratorios.

## 8. DERECHO DE IMAGEN Y REMOCIÓN

- Si activás "SOY_FOTOGRAFO", podés publicar galerías y álbumes
- En ese caso, existe funcionalidad para remoción de imágenes por solicitud de terceros
- La remoción solo aplica para quienes publican galerías (fotógrafos o labs con "SOY_FOTOGRAFO")

## 9. COMUNICACIÓN CON ADMINISTRACIÓN

- Existe una bandeja de mensajes interna para comunicación Admin ↔ Laboratorio
- Podés crear tickets de soporte al Admin con prioridad (low/med/high)
- El Admin puede responder vía mensajes o dentro del ticket

## 10. REPORTES Y LIQUIDACIONES

- Solo ves el **NETO A COBRAR** (después de comisiones)
- Podés ver reportes por rango de fechas y estado del pedido
- Podés exportar a CSV

## 11. SUSPENSIÓN Y TERMINACIÓN

- El administrador puede suspender tu cuenta con motivo
- En caso de suspensión, no podés recibir nuevos pedidos
- Podés solicitar reactivación corrigiendo los motivos de suspensión

## 12. ACTUALIZACIÓN DE TÉRMINOS

Si cambia la versión activa de estos términos, deberás re-aceptarlos antes de continuar operando en la plataforma.

## 13. ACEPTACIÓN

Al registrarte y aceptar estos términos, declarás haber leído, comprendido y aceptado todas las cláusulas aquí establecidas.

---

**Versión**: ${LAB_TERMS_VERSION}
**Fecha de vigencia**: Desde el registro en la plataforma`;
