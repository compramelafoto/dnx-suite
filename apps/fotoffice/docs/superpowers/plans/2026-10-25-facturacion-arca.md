# Plan: facturación electrónica con ARCA (Factura C y Nota de crédito C)

**Fecha:** 2026-10-25
**Diseño:** `docs/superpowers/specs/2026-09-13-negocio-caja-ventas-servicio-tecnico-y-club-design.md`, §11.
**Alcance:** etapa A (conexión) y etapa B (emitir), en un solo PR. Fuera: cuotas de SFPR (§11.8),
clases A y B, CAEA.

## Reglas que no se negocian

- Ninguna dependencia nueva. La firma CMS del pedido de acceso (WSAA) y el pedido de certificado
  (CSR) se arman con `node:crypto` y un codificador DER propio (`lib/invoicing/der.ts`).
- El comprobante se guarda `PENDIENTE` con su número **antes** de llamar a ARCA. Sin respuesta,
  nadie emite el siguiente de ese punto de venta y tipo hasta conciliar
  (`FECompUltimoAutorizado` + `FECompConsultar`).
- Una factura autorizada no se edita ni se borra: se anula con una Nota de crédito C que la
  referencia.
- Las tablas nuevas no se consultan si el módulo está apagado (la migración no se aplica en este
  PR y una tabla que falta rompería Ventas o Pedidos).

## Pasos

1. **Núcleo puro, con pruebas** (`lib/invoicing/`):
   - `der.ts`: codificar y leer DER (lo justo: INTEGER, OCTET STRING, OID, UTF8String,
     PrintableString, UTCTime, SEQUENCE, SET ordenado, etiquetas de contexto).
   - `csr.ts`: clave RSA 2048 + PKCS#10 firmado con SHA-256. Asunto: `C=AR, O=razón social,
     CN=alias, serialNumber=CUIT n`.
   - `cms.ts`: CMS SignedData (PKCS#7) con el TRA adentro, el certificado y los atributos firmados
     (contentType, signingTime, messageDigest).
   - `xml.ts`, `wsaa.ts`, `wsfe.ts`: sobres SOAP armados a mano y lectura mínima de respuestas.
   - `pedido.ts`: arma `FECAESolicitar` para comprobantes C (con `CondicionIVAReceptorId`,
     fechas de servicio y comprobante asociado en la nota de crédito).
   - `qr.ts`: la carga útil de la RG 4892.
   - `emision.ts`: la máquina de numeración y conciliación, con puertos inyectados (base y ARCA).
   - Pruebas con vitest, y verificación con `openssl` (CSR con `openssl req -verify`, CMS con
     `openssl cms -verify -noverify -inform DER`) cuando está instalado.
2. **Datos:** modelos nuevos en `schema.prisma` (perfil fiscal, credencial, ticket, comprobante,
   renglón, evento), migración idempotente sólo con tablas nuevas, `prisma generate`.
3. **Servidor:** repositorio Prisma de los puertos, ticket de 12 h en la base, credenciales con el
   cofre, PDF con `pdf-lib` + `qrcode`.
4. **Pantallas:**
   - Configuración → Facturación electrónica (dueño/admin): perfil fiscal, credencial por
     ambiente (generar CSR, descargarlo, subir el certificado), ambiente activo, pasos de puesta
     en marcha y «Probar conexión».
   - Facturación (`/facturacion`): comprobantes, PDF, conciliar, anular.
   - «Facturar» en Ventas hechas y en la ficha del pedido, sólo con el módulo encendido.
5. **Módulo** `invoicing` en el registro, disponible y apagado por defecto.
6. **Verificación:** `tsc`, vitest, `pnpm build`. Commit, push, PR. Sin fusionar, sin aplicar la
   migración, sin encender el módulo, sin llamar a ARCA.

## Estado al abrir el PR

Hecho: todo lo de arriba. Verificado con vitest (incluye `openssl req -verify` del CSR y
`openssl cms -verify` de la firma, con y sin cadena), `tsc`, `next build`, y una corrida de la
emisión real (repositorio Prisma) contra un Postgres local descartable con la migración aplicada.

No hecho (a propósito): aplicar la migración, encender el módulo, llamar a ARCA de verdad, la
facturación masiva de cuotas (§11.8), clases A y B, CAEA, la tabla de puntos de venta (por ahora
un punto de venta por omisión en el perfil fiscal), el aviso por correo del vencimiento del
certificado (se ve en la pantalla, en rojo con menos de 30 días).

## Antes de encender el módulo

1. Aplicar `packages/db/prisma/migrations/20261214120000_fotoffice_facturacion_arca/migration.sql`
   en la base de FOTOFFICE y registrarla.
2. Confirmar que `DNX_INTEGRATIONS_VAULT_MASTER_KEY` está en Vercel (ya la usa Google Calendar).
3. Encender `invoicing` para el workspace y seguir los pasos de Configuración → Facturación
   electrónica (homologación primero; producción sólo después de una factura de prueba autorizada).
