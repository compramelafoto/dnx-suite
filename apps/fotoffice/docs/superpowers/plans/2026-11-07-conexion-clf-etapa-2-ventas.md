# Conexión FOTOFFICE ↔ CLF · Etapa 2: ventas CLF del fotógrafo — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un fotógrafo conecte su cuenta de CLF con su espacio de FOTOFFICE dando su consentimiento explícito. A partir de ahí ve en «Ventas CLF» cada venta, validada contra su Mercado Pago, sin tocar la Caja.

**Architecture:**
- **CLF** suma:
  - una pantalla de autorización con su propia sesión;
  - un código de un solo uso que se canjea de servidor a servidor por una llave (CLF guarda sólo su hash);
  - una API de ventas con lista blanca de campos;
  - la lista «Apps conectadas» para revocar.
- **FOTOFFICE**:
  - guarda la llave cifrada en `WorkspaceIntegration` (`compramelafoto`);
  - trae las ventas con un cron cada 15 minutos a `FotofficeClfVenta`;
  - valida cada una leyendo el pago en Mercado Pago con la credencial de Cobros (`resolveWorkspaceCollector` + `fetchMpPayment`);
  - las muestra en `/ventas-clf`, un módulo `clf-sales` nuevo.

**Tech Stack:** Next.js (leer `node_modules/next/dist/docs/` antes de tocar rutas o server actions), Prisma 6 (`@repo/db`), vitest (FOTOFFICE), `node:test` vía tsx (CLF).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-11-07-conexion-fotoffice-clf-design.md` §5 y §7.

## Global Constraints

- Nunca cruzan a FOTOFFICE: nombre, correo o teléfono del comprador, `buyerUserId`, datos de alumnos (nombre, curso, división, notas), selfies, fotos, direcciones, tokens de Mercado Pago ni `PreCompraOrder`.
- Sólo cuentan pedidos `Order` con `isTest=false` y `checkoutPaymentSource=MERCADO_PAGO` que tengan un `OrderAuditLog` `PAYMENT_APPROVED` (`targetOrderType="ALBUM_ORDER"`), de álbumes con `Album.userId` igual al usuario de la llave. Se descartan las copias `PrintOrder`.
- `Order.totalCents`, `platformCommissionCents` y `referralFeeDiscountCents` están **en pesos**.
  - `retenidoEsperadoArs = comisionPlataforma − descuentoReferidos + comisionOrganizador`. Si cobra el organizador (cobrador `ORGANIZER`), no se suma la retención del organizador.
  - `netoFotografoArs = photographerNetAmount` si existe `EventOrganizerCommission`; si no, `total − retenidoEsperado`.
- **Validación:** tolerancia de $1.
  - `VALIDADA`: el pago existe en la cuenta del espacio, `external_reference` es igual al id del pedido, el bruto coincide y `platformFeeMinor` coincide con el retenido esperado.
  - `VALIDADA_CUENTA_PROPIA`: igual, pero Mercado Pago no informa comisión de plataforma (`platformFeeMinor = 0`) y la cuenta del espacio es la misma `mpUserId` del cobrador.
  - `CON_DIFERENCIA`: el pago existe y algún monto no coincide.
  - `NO_EN_TU_MP`: Mercado Pago responde 401/403/404, o el espacio no tiene Cobros conectado.
  - `REINTEGRADA` / `REINTEGRO_PARCIAL`: hay `refundedMinor > 0` (o el estado en CLF es `REFUNDED`).
  - `PENDIENTE`: todavía no se consultó.
- **«Acreditado» = bruto − comisión de Mercado Pago − comisión de plataforma**, en pesos. Es la cifra principal. «Tu precio» = `netoFotografoArs`.
- **Reintegros:** en el mes del reintegro restan `mpReintegradoArs` (fecha `reintegradoEl`); la venta original queda en su mes. No se borra nada.
- **Caja:** ninguna escritura en `CashMovement`, `CashAccount` ni Informes.
- **Permisos:**
  - Pantalla de ventas: «ver dinero» en el módulo `clf-sales`. `LEGACY_STAFF_LEVELS` no lo incluye, así que el rol Equipo no lo ve.
  - Conectar y desconectar: sólo dueño o admin (`puede(role, "configurar")`).
- **Variables de entorno nuevas** (Daniel las carga en Vercel; sin ellas, la conexión responde «no configurada» y no rompe nada):
  - `DNX_CLF_FOTOFFICE_CLIENT_SECRET`, en los dos proyectos, mismo valor.
  - `CLF_PUBLIC_BASE_URL` (opcional) en FOTOFFICE.
  - `FOTOFFICE_PUBLIC_BASE_URL` (por omisión `https://fotoffice.com`) en FOTOFFICE.
  - `FOTOFFICE_CONNECT_RETURN_URLS` en CLF, una lista separada por comas. Por omisión vale `https://fotoffice.com/api/integraciones/clf/callback`.
- **Migraciones a mano:**
  - `20270129090000_clf_conexion_apps`: sólo en la base de CLF (`production`).
  - `20270129091000_fotoffice_ventas_clf`: sólo en la base de FOTOFFICE (`development`).
  - Se aplican y se registran antes de fusionar.
- Textos en español rioplatense; decir «dinero».

## Review Focus

1. Un código canjeado dos veces, vencido o con un secreto incorrecto → 400/401, sin llave.
2. Una llave revocada o de otro usuario → 401; nunca devuelve ventas de otro fotógrafo.
3. `vuelta` (URL de retorno) que no está en la lista blanca → CLF no redirige ahí (muestra un error).
4. Mercado Pago caído (5xx o tiempo agotado) → la venta queda `PENDIENTE` y se reintenta; no pasa a `NO_EN_TU_MP`.
5. Una venta reintegrada después de validada → vuelve a aparecer por cursor (cambia `updatedAt`) o en la revalidación diaria, y resta en el mes del reintegro.

---

### Task 1: Esquema y migraciones (lo hace el controlador antes de repartir)

**Files:** `packages/db/prisma/schema.prisma` y las dos carpetas de migración.

**Produces (modelos):**
- **CLF:**
  - `ClfAppConnection { id String @id @default(cuid()); userId Int; appKey String; externalLabel String; keyHash String @unique; keyPrefix String; createdAt DateTime @default(now()); lastUsedAt DateTime?; revokedAt DateTime? }`, con relación a `User` en cascada y `@@index([userId, revokedAt])`.
  - `ClfAppConnectCode { id String @id @default(cuid()); codeHash String @unique; userId Int; appKey String; externalLabel String; returnUrl String; expiresAt DateTime; usedAt DateTime?; createdAt DateTime @default(now()) }`, con relación a `User` en cascada.
- **FOTOFFICE:**
  - `FotofficeClfConexion { id; workspaceId String @unique; clfUserId Int; clfCuentaNombre String; clfMpUserId String?; cursor String?; ultimaSincronizacionEl DateTime?; ultimoError String?; cerradaEl DateTime?; createdAt; updatedAt }`, con relación a `Workspace`.
  - `FotofficeClfVenta`, con `@@unique([workspaceId, clfOrderId])`, `@@index([workspaceId, pagadoEl])` y `@@index([workspaceId, validacion])`. Columnas:
    - identificación: `id`, `workspaceId`, `clfOrderId Int`, `mpPaymentId String?`;
    - álbum y detalle: `albumId Int`, `albumTitulo String`, `detalle String`;
    - estado en CLF: `pagadoEl DateTime`, `estadoClf String`, `motivo String?`;
    - montos de CLF (`Decimal(14,2)`): `pagoFamiliaArs`, `comisionPlataformaArs`, `descuentoReferidosArs`, `comisionOrganizadorArs`, `retenidoEsperadoArs`, `netoFotografoArs`;
    - cobrador: `cobrador String`, `cobradorMpUserId String?`;
    - validación: `validacion String @default("PENDIENTE")`;
    - lo leído de Mercado Pago (`Decimal(14,2)?`): `mpBrutoArs`, `mpComisionPlataformaArs`, `mpComisionMpArs`, `mpAcreditadoArs`, `mpReintegradoArs`; además `reintegradoEl DateTime?`, `mpRevisadoEl DateTime?`, `conexionCerrada Boolean @default(false)`;
    - `createdAt`, `updatedAt`.

### Task 2: CLF — autorización, canje, revocación y «Apps conectadas»

**Files:**
- Create: `apps/compramelafoto/lib/fotoffice-conexion/llaves.ts` (puro: `generarSecreto()`, `hashSecreto()`, `retornoPermitido(url, env)`)
- Create: `apps/compramelafoto/lib/fotoffice-conexion/llaves.test.ts`
- Create: `apps/compramelafoto/lib/fotoffice-conexion/servicio.ts` (`crearCodigo`, `canjearCodigo`, `usuarioDeLlave`, `revocarLlave`, `listarConexiones`, `revocarConexionDelUsuario`)
- Create: `apps/compramelafoto/app/conectar/fotoffice/page.tsx` y `actions.ts`
- Create: `apps/compramelafoto/app/api/integraciones/fotoffice/v1/canjear/route.ts` y `revocar/route.ts`
- Create: `apps/compramelafoto/app/fotografo/configuracion/apps-conectadas/page.tsx` y `actions.ts`
- Modify: `apps/compramelafoto/package.json` (sumar a `test:fotoffice-vinculo` los archivos de prueba nuevos)

**Interfaces:**
- `GET /conectar/fotoffice?state&espacio&vuelta`:
  - Exige sesión de fotógrafo; si no hay, `redirect("/login?redirect=" + encodeURIComponent(rutaActual))`.
  - Si `vuelta` no está en la lista blanca, muestra «Este enlace de conexión no es válido».
  - Muestra el texto del diseño §5.1 paso 3 con el nombre del espacio (recortado a 80 caracteres), y los botones «Autorizar» y «Cancelar».
  - **Autorizar** crea un código (`randomBytes(32)` en base64url, guarda el hash y vence a los 2 minutos) y redirige a `vuelta?code=…&state=…`. **Cancelar** redirige a `vuelta?error=cancelado&state=…`.
- `POST /api/integraciones/fotoffice/v1/canjear`:
  - Recibe `Authorization: Bearer <DNX_CLF_FOTOFFICE_CLIENT_SECRET>` y el cuerpo `{ code }`. Compara el secreto en tiempo constante.
  - Responde 200 `{ llave, cuenta: { id, nombre, mpUserId } }`. Con el código usado o vencido responde 400; con el secreto malo, 401; si falta la variable, 503.
  - La llave tiene la forma `clf_fo_` + `randomBytes(32)` en base64url. Se marca `usedAt` en una transacción.
- `POST /api/integraciones/fotoffice/v1/revocar`: recibe `Bearer <llave>`, pone `revokedAt` y responde 200 aunque ya estuviera revocada.
- `usuarioDeLlave(llave): Promise<{ userId: number } | null>`: busca por hash, sólo llaves no revocadas, y actualiza `lastUsedAt`.
- **«Apps conectadas»:** lista las conexiones activas (nombre del espacio, fecha y último uso) con el botón «Revocar». La acción revoca sólo si la conexión es del usuario de la sesión.

- [ ] Tests (`llaves.test.ts`):
  - `hashSecreto` es determinista y en hex de 64 caracteres.
  - `retornoPermitido` acepta exactamente las URL de la lista y rechaza variantes: otro host, `http`, una ruta extra y `?` agregado.
  - Con `env` vacío acepta sólo `https://fotoffice.com/api/integraciones/clf/callback`; en desarrollo (`NODE_ENV!=="production"`) acepta además `http://localhost:<puerto>/api/integraciones/clf/callback`.
- [ ] Implementar, correr `pnpm --filter compramelafoto test:fotoffice-vinculo` y hacer commit «CLF: autorizar a FOTOFFICE a leer las ventas».

### Task 3: CLF — API de ventas

**Files:**
- Create: `apps/compramelafoto/lib/fotoffice-conexion/ventas.ts` (puro: `ventaParaFotoffice`, `codificarCursor`, `decodificarCursor`)
- Create: `apps/compramelafoto/lib/fotoffice-conexion/ventas.test.ts`
- Create: `apps/compramelafoto/lib/fotoffice-conexion/ventas-servidor.ts` (`leerVentas(userId, cursor, limite)`)
- Create: `apps/compramelafoto/app/api/integraciones/fotoffice/v1/ventas/route.ts`

**Interfaces:**
- `GET /api/integraciones/fotoffice/v1/ventas?cursor=` con `Bearer <llave>`.
  - Responde 200 `{ ventas: VentaFotoffice[], siguiente: string | null }`; sin llave válida, 401.
  - Trae 200 por página, ordenadas por `(updatedAt, id)` y estrictamente después del cursor. El cursor es `base64url("<updatedAt ISO>|<id>")`.
- `type VentaFotoffice = { orderId: number; mpPaymentId: string | null; estado: "PAID" | "REFUNDED" | "FAILED"; motivo: "reintegro" | "contracargo" | "rechazo" | null; pagadoEl: string; actualizadoEl: string; album: { id: number; titulo: string }; detalle: string; pagoFamilia: number; comisionPlataforma: number; descuentoReferidos: number; comisionOrganizador: number; retenidoEsperadoMp: number; netoFotografo: number; cobrador: "PHOTOGRAPHER" | "ORGANIZER"; cobradorMpUserId: string | null }`.
- **De dónde sale cada dato:**
  - `motivo`: el último log `PAYMENT_CHARGED_BACK` → «contracargo»; `PAYMENT_REFUNDED` → «reintegro»; un estado `FAILED` después de aprobado → «rechazo».
  - `detalle`: `packName` del `preventaPackSnapshotJson` («Pack: <nombre>»). Si no hay snapshot, un resumen por tipo: «3 digitales», «2 impresas 15×21» (`productType` + `size`), unido con « · ».
  - `cobrador`: `ORGANIZER` si `EventOrganizerCommission.payoutMode`/collector lo indica según `resolve-event-payment-collector`. En la duda, `PHOTOGRAPHER`, y `cobradorMpUserId` = `User.mpUserId` del dueño del álbum.

- [ ] Tests (`ventas.test.ts`):
  - **Lista blanca:** `Object.keys(ventaParaFotoffice(…)).sort()` es exactamente la lista de `VentaFotoffice`, aunque la entrada traiga `buyerEmail`, `buyerName`, `buyerPhone` y `studentFirstName`.
  - **Con descuento de referidos:** `totalCents 20000`, `platformCommissionCents 2609` y `referralFeeDiscountCents 500` → `retenidoEsperadoMp 2109` y `netoFotografo 17891`.
  - **Con organizador:** `photographerNetAmount 15000` y `organizerCommissionAmount 2391` → `netoFotografo 15000` y `retenidoEsperadoMp = 2609 + 2391`.
  - **Cursor:** ida y vuelta entre codificar y decodificar; uno inválido da `null`.
- [ ] Implementar, correr las pruebas y hacer commit «CLF: API de ventas para FOTOFFICE».

### Task 4: FOTOFFICE — conexión (pantalla, callback, desconectar)

**Files:**
- Modify: `apps/fotoffice/lib/integrations/registry.ts` (proveedor `"CLF"`, clave `compramelafoto`, estado `AVAILABLE`)
- Create: `apps/fotoffice/lib/clf/conexion.ts` (`urlDeAutorizacion`, `canjearCodigo`, `guardarConexion`, `desconectar`, `leerLlave`)
- Create: `apps/fotoffice/lib/clf/conexion.test.ts`
- Create: `apps/fotoffice/app/api/integraciones/clf/conectar/route.ts` (GET; dueño o admin): arma el `state` (32 bytes aleatorios), lo guarda en la cookie httpOnly `fo_clf_state` (`<state>.<workspaceId>`, 10 minutos, SameSite=Lax, `path=/api/integraciones/clf`) y redirige a CLF.
- Create: `apps/fotoffice/app/api/integraciones/clf/callback/route.ts`: valida `state` contra la cookie y el workspace de la sesión, canjea el código y guarda la conexión. Termina en `redirect("/workspace/configuracion/compramelafoto?r=ok|cancelado|error")`.
- Create: `apps/fotoffice/app/workspace/configuracion/compramelafoto/page.tsx` y `actions.ts` (`desconectarClfAction`, `sincronizarAhoraAction`)
- Modify: `apps/fotoffice/app/workspace/configuracion/page.tsx` (tarjeta-enlace como la de Alboom)

**Interfaces:**
- `guardarConexion(workspaceId, userId, { llave, cuenta })` hace dos cosas: `saveIntegration({ integrationKey: "compramelafoto", provider: "CLF", accountEmail: null, accountExternalId: String(cuenta.id), grantedScopes: ["ventas:leer"], refreshToken: llave, connectedByUserId })` y un upsert de `FotofficeClfConexion` (reabre si estaba cerrada).
- `estadoDeCuentas(clfMpUserId, providerUserId)` (puro) → `"VERIFICADA" | "DISTINTAS" | "SIN_COBROS"`.
- `desconectar(workspaceId)`:
  - avisa a CLF (`revocar`, sin frenar si falla);
  - borra la integración;
  - pone `cerradaEl`;
  - marca las ventas con `conexionCerrada=true`.
- **La página muestra:**
  - sin conexión: «Conectar con CompraMeLaFoto»;
  - con conexión: la cuenta de CLF, el estado de cuentas («Verificada» o el aviso de «Cuentas de Mercado Pago distintas» con la explicación), la última sincronización y el último error, y los botones «Actualizar ahora» y «Desconectar» (con confirmación);
  - sin la variable de entorno: «La conexión con CompraMeLaFoto todavía no está habilitada».

- [ ] Tests:
  - `urlDeAutorizacion` codifica `espacio` y `vuelta`.
  - `canjearCodigo` con un fetch falso: 200 → llave y cuenta; 400 → `CODIGO_INVALIDO`; red caída → `SIN_CONEXION`.
  - Estados de `estadoDeCuentas`.
  - El callback con un `state` distinto al de la cookie → `?r=error` y no canjea.
- [ ] Implementar y hacer commit «FOTOFFICE: conectar la cuenta de CLF».

### Task 5: FOTOFFICE — sincronizar y validar

**Files:**
- Create: `apps/fotoffice/lib/clf/validacion.ts` (puro: `validarVenta`)
- Create: `apps/fotoffice/lib/clf/validacion.test.ts`
- Create: `apps/fotoffice/lib/clf/sincronizar.ts` (`sincronizarEspacio(workspaceId, deps)`, `sincronizarTodos(deps)`)
- Create: `apps/fotoffice/lib/clf/sincronizar.test.ts`
- Create: `apps/fotoffice/app/api/cron/ventas-clf/route.ts`
- Modify: `apps/fotoffice/vercel.json` (`{ "path": "/api/cron/ventas-clf", "schedule": "*/15 * * * *" }`)
- Modify: `apps/fotoffice/lib/circuitos/base-en-memoria.ts` (los dos modelos FOTOFFICE)

**Interfaces:**
- `validarVenta(v: { clfOrderId; pagoFamiliaArs; retenidoEsperadoArs; estadoClf; cobradorMpUserId }, mp: { ok: true; facts: MpPaymentFacts } | { ok: false; tipo: "NO_ACCESO" | "TEMPORAL" | "SIN_COBROS" }, cuentaDelEspacio: string | null)`
  → `{ validacion, mpBrutoArs, mpComisionPlataformaArs, mpComisionMpArs, mpAcreditadoArs, mpReintegradoArs, reintegradoEl } | { validacion: "PENDIENTE" }`. Con `TEMPORAL` devuelve `PENDIENTE`.
- **`sincronizarEspacio`:**
  - pide páginas a CLF desde `cursor` (hasta 5 por corrida) y hace upsert por `(workspaceId, clfOrderId)`;
  - si cambió el estado en CLF, vuelve la venta a `PENDIENTE`;
  - valida hasta 100 ventas `PENDIENTE` por corrida;
  - revalida hasta 300 ventas con `mpRevisadoEl` de hace más de 24 h y `pagadoEl` de los últimos 180 días;
  - guarda `cursor`, `ultimaSincronizacionEl` y `ultimoError`;
  - un 401 de CLF marca `ultimoError = "CompraMeLaFoto rechazó la conexión: volvé a conectarla."` y no borra nada.
- **Lectura del pago:** `fetchMpPayment(token, mpPaymentId)` con el token de `resolveWorkspaceCollector`. Un `MpReadError` con 401/403/404 → `NO_ACCESO`; cualquier otro error → `TEMPORAL`.
- **Cron:** recorre las `FotofficeClfConexion` con `cerradaEl = null`, de a una; `maxDuration = 300`; la autenticación es la de `alboom-extraccion`.

- [ ] Tests de `validarVenta`, con montos en pesos:
  - bruto 20000, comisión de plataforma 2609 y comisión de MP 1200, sin reintegro → `VALIDADA`, acreditado 16191;
  - comisión de plataforma 0 con la cuenta del espacio igual a la del cobrador → `VALIDADA_CUENTA_PROPIA`;
  - comisión de plataforma 2000 contra 2609 esperado → `CON_DIFERENCIA`;
  - reintegrado 20000 → `REINTEGRADA` con `reintegradoEl` = `lastUpdatedAt`; reintegrado 5000 → `REINTEGRO_PARCIAL`;
  - `NO_ACCESO` → `NO_EN_TU_MP`; `TEMPORAL` → `PENDIENTE`;
  - `externalReference` distinto del id del pedido → `CON_DIFERENCIA`.
- [ ] Tests de `sincronizarEspacio` (base en memoria, CLF y Mercado Pago falsos):
  - dos páginas → guarda las ventas y el cursor final;
  - una venta que vuelve con `REFUNDED` → `PENDIENTE` y, al validarla, `REINTEGRADA`;
  - 401 de CLF → `ultimoError` y las ventas intactas;
  - **ninguna escritura en `cashMovement`** (se verifica que la tabla en memoria sigue vacía).
- [ ] Implementar y hacer commit «FOTOFFICE: traer y validar las ventas de CLF».

### Task 6: FOTOFFICE — módulo y pantalla «Ventas CLF»

**Files:**
- Modify: `apps/fotoffice/lib/modules/registry.ts`. Entrada nueva: `{ key: "clf-sales", label: "Ventas CLF", description: "Lo que cobrás por CompraMeLaFoto, venta por venta, validado contra tu Mercado Pago. No toca la Caja.", category: "GENERAL", route: "/ventas-clf", status: "AVAILABLE", family: "negocio" }`.
- Modify: `apps/fotoffice/lib/modules/submodules.ts` y `components/shell/shell-nav.tsx` (una pantalla, con `levelModuleKey "clf-sales"`).
- Create: `apps/fotoffice/lib/clf/ventas-vista.ts` (puro: `totalesDelMes(ventas, mes)`, `filaDeVenta(v)`)
- Create: `apps/fotoffice/lib/clf/ventas-vista.test.ts`
- Create: `apps/fotoffice/app/(shell)/ventas-clf/page.tsx` y `csv/route.ts`
- Modify: `apps/fotoffice/components/clf/tarjeta-clf.tsx` y `app/(shell)/pedidos/[id]/page.tsx` (la línea «Vendido por este álbum…»)

**Interfaces:**
- `totalesDelMes(ventas, "AAAA-MM")` → `{ cantidad, pagoFamilia, comisionPlataforma, comisionMp, acreditado, reintegros, cobradoNeto }`.
  - Una venta suma en el mes de `pagadoEl` (hora de Buenos Aires) si su validación no es `NO_EN_TU_MP`.
  - Los reintegros restan en el mes de `reintegradoEl`.
  - `cobradoNeto = acreditado − reintegros`.
- **Pantalla:**
  - navegación por mes (`?mes=`) y filtro por álbum (`?album=`);
  - tarjetas con los totales;
  - tabla con fecha, álbum, detalle, pagó la familia, tu precio, acreditado, id de pago de Mercado Pago y estado (etiqueta en español por cada `validacion`);
  - aviso si la conexión está cerrada o con error, y enlace a Configuración.
  - Las cifras se cargan sólo con «ver dinero» en `clf-sales`; sin ese permiso, `notFound()`.
- **CSV:** mismas columnas, con el mismo permiso.
- **Tarjeta del pedido:** si hay vínculo con `albumId` y la persona puede ver dinero en `clf-sales`, agrega «Vendido por este álbum: N ventas · $X acreditado», con un enlace a `/ventas-clf?album=<id>`.

- [ ] Tests de `totalesDelMes`:
  - venta de octubre y reintegro de noviembre → octubre suma la venta y noviembre resta el reintegro;
  - `NO_EN_TU_MP` no suma;
  - el borde de mes en hora argentina: `2026-11-01T02:00Z` cae en octubre.
- [ ] Implementar, correr `pnpm --filter fotoffice test` y hacer commit «FOTOFFICE: pantalla Ventas CLF».

### Task 7: Producción

- [ ] Aplicar cada migración en su base y registrarla; verificar en `_prisma_migrations`.
- [ ] PR con los controles en verde, fusionar y esperar que los dos deploys queden Ready.
- [ ] Pedirle a Daniel que cargue `DNX_CLF_FOTOFFICE_CLIENT_SECRET` en los dos proyectos de Vercel (la sesión no puede cargar secretos) y que encienda `clf-sales` en DNX Estudio, o encenderlo como admin de plataforma si se puede.
- [ ] Con eso, conectar DNX Estudio con la cuenta 79 y comprobar:
  - estado de cuentas «Verificada» (97484805 en las dos);
  - las ventas del álbum 1283 aparecen;
  - qué validación sale en la primera venta real. Es la prueba de factibilidad del diseño §5.3: si sale `VALIDADA_CUENTA_PROPIA`, confirma que Mercado Pago no informa la comisión cuando la cuenta se cobra a sí misma.
