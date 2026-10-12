# Etapa 8 · Migración del CRM de Alboom a FOTOFFICE

> 12/10/2026 · Mapa general §5. Se apoya en las Etapas 0–7 (en producción).
>
> **Decisiones de Daniel (12/10):**
> - **Extracción del lado del servidor:** FOTOFFICE lee la API interna del panel de Alboom con la credencial de
>   Alboom de DNX guardada **cifrada** en FOTOFFICE (la carga Daniel una vez en una pantalla; Claude nunca la
>   escribe). **Sólo lectura: nunca se escribe en Alboom.**
> - **Todo el historial** (los ~500 pedidos desde el principio, contactos, consultas, etc.), con limpieza.
> - **Proof no se migra** (10/10): como mucho, cada contacto queda vinculado con el enlace de su galería de Proof.
>
> Lo demás va marcado **[decisión]**. **Sin staging:** cada carga tiene **simulación** (cuenta qué crearía y qué
> cambiaría, sin escribir) antes de la carga real, y toda carga es **idempotente** (cada registro guarda su
> identificador de Alboom: repetirla no duplica).

## Entregas

- **8A · Conectar y extraer:** Configuración → Migración desde Alboom (sólo dueño/administrador): conectar
  (subdominio, usuario, contraseña; se valida el inicio de sesión y se guarda cifrado en `WorkspaceIntegration`,
  igual que Google), "Extraer todo" en segundo plano por entidad con ritmo prudente (1 pedido por segundo, en
  tandas por el cron), guardando la **respuesta cruda** de cada registro en una tabla propia (JSON por entidad e
  identificador de Alboom, con huella para saber si cambió); pantalla con el avance por entidad, cantidades y
  errores; "Volver a extraer" (incremental). Entidades: configuración y catálogos (usuarios, embudos y etapas,
  flujos de proyecto, categorías, orígenes, etiquetas, tipos de cita, métodos de pago, plan de cuentas, bancos,
  productos y combos, plantillas de mensajes y de contrato), contactos, oportunidades (con historial de etapas,
  notas, actividades y correos), presupuestos, pedidos (con ítems, plan de pagos y costos), contratos (texto y
  firma), proyectos (con historial y participantes), tareas, citas, cuentas a cobrar y a pagar (con cobros) y
  movimientos de bancos. Los endpoints están en los documentos `docs/alboom/01`–`05` (tablas "qué extraer").
- **8B · Traducir y cargar (simulación y carga):** por entidad y en orden de dependencias, con tablas de
  equivalencia (estados 421–426 y 471–476, etapas por posición, categorías de asiento 71–84, fechas en hora
  argentina), limpieza (datos de prueba, duplicados), `externalId` de Alboom en cada registro, simulación con
  informe y carga real; enlace de Proof por contacto (campo personalizado) cuando se tenga la lista.
- **8C · Verificar y cortar:** conciliaciones automáticas (cantidades por entidad, vendido por mes, saldo por
  banco, total a cobrar y a pagar contra Alboom), informe; corte: última extracción incremental, Alboom queda en
  sólo lectura como respaldo.

## Datos (8A)

- `FotofficeAlboomCrudo`: workspaceId (CASCADE), entity TEXT, alboomId TEXT, payload JSONB, hash TEXT (sha256 del
  JSON canónico), fetchedAt, firstSeenAt; único `(workspaceId, entity, alboomId)`; índice `(workspaceId, entity)`.
- `FotofficeAlboomExtraccion`: workspaceId (CASCADE), status (CHECK `PENDIENTE|CORRIENDO|LISTA|ERROR|CANCELADA`),
  progress JSONB (por entidad: página, cantidad, errores), startedByUserId?, startedAt, finishedAt?, errorReason?,
  updatedAt; una activa por workspace.

## Reglas

- La contraseña nunca va a registros, eventos ni respuestas; la pantalla muestra sólo usuario y subdominio.
- La extracción respeta el tiempo de la función (≤ 270 s por corrida) y retoma donde quedó.
- Un 401 de Alboom marca la conexión como "hay que volver a conectar" y frena; un 429/5xx espera y reintenta.
- Los datos crudos son datos personales de clientes de DNX: sólo los ve el dueño/administrador; se borran a
  pedido ("Borrar lo extraído") y a los 180 días del corte.
