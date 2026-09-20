# Avance de SubiLaFoto

*Las tablas de este documento las lee `scripts/avance.mjs`. La convención está en
[`docs/00-convencion-de-avance.md`](../00-convencion-de-avance.md).*

**Código** es lo escrito, probado y mergeado. **Producción** es lo que corrió de verdad
contra la base y los servicios reales, y alguien miró el resultado.

<!-- avance: SubiLaFoto — Etapa 1: base funcional -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| 1.1 | La aplicación, el layout y la estética | ✅ | ✅ | Sirviendo en `subilafoto.com` |
| 1.2 | Migración de las 19 tablas | ✅ | ✅ | Aplicada y registrada en la rama `production` |
| 1.3 | Login del profesional con `@repo/auth` | ✅ | 🟡 | Nunca lo usó un fotógrafo que no seamos nosotros |
| 1.4 | Ficha de venta y `/v/[slug]` | ✅ | ✅ | Verificado el 15/9: con ficha completa devuelve 200 |
| 1.5 | Creación manual de evento | ✅ | ✅ | |
| 1.6 | Ventana de 12 horas con zona horaria | ✅ | ✅ | |
| 1.7 | Seis plantillas y portada | ✅ | 🟡 | Probadas por contraste, nunca vistas en un televisor |
| 1.8 | QR y enlaces revocables | ✅ | ✅ | |
| 1.9 | Subida a R2 con URL prefirmada | ✅ | ✅ | 100 fotos de 3000×4000, cero fallas |

<!-- avance: SubiLaFoto — Etapa 2: núcleo en vivo -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| 2.1 | Carga múltiple con reintentos | ✅ | 🟡 | Probada con buena conexión; falta el modo avión en un celular |
| 2.2 | Consentimiento y su versión | ✅ | ✅ | |
| 2.3 | Adaptador con interfaz de proveedor | ✅ | ✅ | |
| 2.4 | Análisis asíncrono e idempotente | ✅ | ✅ | 100 decisiones, 308 ms de media |
| 2.5 | Motor de reglas con perfiles | ✅ | 🟡 | **Falta la parte 2**: 20 fotos reales para medir falsos positivos |
| 2.6 | Falla cerrada | ✅ | ⬜ | **Parte 3**: exige romper la credencial de AWS y no se puede restaurar |
| 2.7 | Panel de revisión con auditoría | ✅ | ⬜ | Nunca se aprobó un falso positivo de verdad |
| 2.8 | Galería de aprobadas | ✅ | ✅ | 100 fotos, sin originales en el HTML |
| 2.9 | SSE con reconexión | ✅ | ✅ | Sin repetir ni perder |
| 2.10 | Pantalla 16:9 con precarga | ✅ | 🟡 | Responde en 0,47 s; falta la hora de proyección real |
| 2.11 | Control remoto | ✅ | ⬜ | Nunca se ocultó una foto en vivo |
| 2.12 | Cierre automático | ✅ | ✅ | |
| 2.13 | Materiales impresos con QR | ✅ | 🟡 | El QR se valida al generar; nunca se imprimió en papel |

<!-- avance: SubiLaFoto — Etapa 3: comercial y proveedores -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| 3.1 | Conectar Mercado Pago por OAuth | ✅ | ⬜ | **Nadie conectó nunca una cuenta.** Es lo que confirma la URL de retorno |
| 3.2 | Checkout con `marketplace_fee` | ✅ | ⬜ | Ninguna compra real. Exige tarjeta |
| 3.3 | Webhook idempotente | ✅ | ⬜ | Nunca recibió un aviso real de Mercado Pago |
| 3.4 | Adicional de descarga | ✅ | ⬜ | Depende de 3.2 |
| 3.5 | ZIP con manifiesto | ✅ | 🟡 | En curso: hay 6 fotos sembradas esperando al cron de paquetes |
| 3.6 | Enlace firmado, con vencimiento y revocable | ✅ | ⬜ | Depende de 3.5 |
| 3.7 | Los cinco correos | ✅ | ✅ | `dia-1` y `dia-3` salieron `SENT` el 17/9 |
| 3.8 | Retención de 30 días con candado | ✅ | ✅ | 300 archivos borrados de R2, con auditoría |
| 3.9 | Proveedores contra `DnxPartner` | ✅ | ✅ | Dos envíos, mismo CUIT, una sola empresa |
| 3.10 | Panel del cliente | ✅ | 🟡 | Se ve; nunca con una orden pagada de verdad |

<!-- avance: SubiLaFoto — Etapa 4: estabilización -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| 4.1 | Recorrido de aceptación mapeado | ✅ | ✅ | Los 31 pasos, con responsable |
| 4.2 | 100 fotos de 10 dispositivos | ✅ | ✅ | Cero fallas, p90 de 4,1 s |
| 4.3 | Repaso de permisos y anti-bypass | ✅ | ✅ | Tres arreglos; el original no sale de ningún lado |
| 4.4 | Accesibilidad | ✅ | 🟡 | Contraste y toque medidos; faltan VoiceOver y TalkBack |
| 4.5 | Documentación operativa | ✅ | 🚫 | Se valida usándola el día del evento |
| 4.6 | Ensayo de rollback | ✅ | 🟡 | Escrito y probado en parte; falta promover una versión vieja de verdad |
| 4.7 | Aparatos reales | ⬜ | ⬜ | iPhone, Android, televisor y proyector |
| 4.8 | Recuperación de conexión | ⬜ | ⬜ | Modo avión a mitad de carga y de proyección |

<!-- avance: SubiLaFoto — Etapa 5: ensayo y lanzamiento -->

| # | Tarea | Código | Producción | Nota |
|---|---|---|---|---|
| 5.1 | Monitoreo activo | ✅ | ✅ | Panel, alertas con instrucción y latido de los cinco cron |
| 5.2 | Guion del ensayo | ✅ | ⬜ | Escrito; el ensayo es el 8 de octubre |
| 5.3 | Criterio de congelamiento | ✅ | 🚫 | Se aplica el 9 de octubre |
| 5.4 | Las doce variables | ✅ | ✅ | `completa: true`; el token apunta a la cuenta real |
| 5.5 | Obligaciones legales | ✅ | ✅ | Arrepentimiento con constancia por correo, Libro de Quejas y datos del responsable |
| 5.6 | Lanzamiento controlado | ⬜ | ⬜ | 10 de octubre |
