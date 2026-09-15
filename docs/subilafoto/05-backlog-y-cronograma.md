# Backlog y cronograma

Responde a los capítulos 26, 27 y 28. Quedan **29 días** desde hoy, 11 de septiembre de 2026.

## Lo primero: una advertencia sobre la fecha

El alcance del capítulo 26.1 son 45 requisitos obligatorios. Construir eso de cero en 29
días es posible **sólo** porque más de la mitad ya existe en el monorepo y se reutiliza. Lo
que no está y hay que escribir entero es:

1. La pantalla en vivo con SSE (no hay nada de tiempo real en la suite).
2. El flujo del invitado (carga sin cuenta, tolerante a mal wifi).
3. La moderación con `DetectModerationLabels` y su motor de reglas.
4. Las plantillas visuales de pantalla.
5. El enlace permanente de venta.

Son cinco piezas grandes en cuatro semanas y media. Es alcanzable si no se agrega nada más
en el camino. Cada función que se sume después del 20 de septiembre sale de esta lista, no
se apila encima.

**Recorte que recomiendo desde ya**, contra el capítulo 26.1:

| Requisito del capítulo 26.1 | Recomendación |
|---|---|
| "Biblioteca inicial de plantillas de buena calidad" | **6 plantillas**, no una biblioteca. Seis excelentes valen más que veinte mediocres |
| "Versiones para pantalla, mesa, cartel, historia" | Las cinco piezas del documento 04. Se generan con `@repo/design-studio`, que ya existe |
| "Métricas operativas básicas" | Sólo contadores en el panel del evento. Sin panel de analítica |
| "Detección básica de duplicados" | El `@unique` por checksum. Nada de similitud perceptual |
| "Panel del cliente" | Ver el álbum, comprar la descarga, bajar el paquete. Nada más |
| Videos | Fuera, como ya prevé el capítulo 26.2 |

## Etapa 0 — Definición: 11 al 13 de septiembre

- [x] Auditar el monorepo y verificar qué se reutiliza
- [x] Resolver base de datos y estrategia de tiempo real
- [x] Modelo de datos, mapa de pantallas, roles
- [x] Backlog y cronograma
- [x] Resolver las decisiones bloqueantes (3 de 4; ver doc 07)
- [x] Crear el proyecto en Vercel y apuntar `subilafoto.com` (ver doc 09)
- [x] Verificar `DetectModerationLabels`: responde en `us-east-1`, modelo 7.0
- [x] Bucket R2 `subilafoto-media` con borrado a 30 días
- [ ] Usuario IAM propio para Rekognition — lo hace el titular (doc 09)
- [ ] Mergear el PR #41 para que `main` tenga la app

**Salida:** plan aprobado. Sin esto no arranca la Etapa 1.

## Etapa 1 — Base funcional: 14 al 20 de septiembre

| # | Tarea | Criterio de aceptación |
|---|---|---|
| 1.1 | `apps/subilafoto` con Next 16.2.1, layout y estética propia | `pnpm build` en verde; deploy en Vercel accesible |
| 1.2 | Migración con las 19 tablas + `SUBILAFOTO` en `SuiteApp` | Aplicada en las 5 bases y registrada en `_prisma_migrations` |
| 1.3 | Login del profesional reutilizando `@repo/auth` | Un usuario existente de la suite entra sin registrarse de nuevo |
| 1.4 | Perfil de venta y `/v/[slug]` | El enlace muestra nombre, precio y descripción; el slug es único |
| 1.5 | Creación manual de evento (sin pago todavía) | Un evento queda en `CONFIGURING` con su código |
| 1.6 | Ventana de 12 horas con zona horaria | Configurar 20:00 muestra "cierra mañana a las 08:00" antes de confirmar |
| 1.7 | Seis plantillas y portada | Cambiar de plantilla cambia `/e/[codigo]` sin recargar el evento |
| 1.8 | QR y enlaces (`SubilafotoAccessLink`) | Los códigos de invitado y de pantalla son distintos y revocables |
| 1.9 | Subida a R2 con URL prefirmada | Una foto de 8 MB sube desde un celular real |

**Salida:** se crea un evento y se abre su experiencia pública desde un celular.

## Estado al 2026-09-13 — ETAPA 2 COMPLETA

La Etapa 1 cerró el 12/9 y la Etapa 2 el 13/9, **catorce días antes de lo
previsto** (estaba planificada del 21 al 27 de septiembre).

| # | Tarea | Verificación |
|---|---|---|
| 2.2 | Consentimiento y `SubilafotoConsent` | Sin aceptar, la API de subida devuelve 403. Se guarda la versión del texto |
| 2.3 | Adaptador con interfaz de proveedor | Cambiar de proveedor es escribir un archivo |
| 2.4 | Análisis asíncrono e idempotente | Dos procesos a la vez guardan una sola decisión |
| 2.5 | Motor de reglas con perfiles y versión | Las cinco categorías de riesgo alto no se aprueban en ningún perfil |
| 2.6 | Falla cerrada | Todo error termina en `REVIEW_REQUIRED` |
| 2.7 | Panel de revisión | Todo override queda en `SubilafotoAudit` con usuario y motivo |
| 2.8 | Galería | Sólo lo que tiene `publishedAt`, con test del `where` |
| 2.9 | SSE con reconexión | Verificado en producción: no repite ni pierde |
| 2.10 | Pantalla 16:9 con precarga | Con placa de cierre |
| 2.11 | Control remoto | Aviso inmediato + reconciliación cada 30 s |
| 2.12 | Cierre automático | Cron cada 5 minutos, sin interrumpir nada en curso |
| 2.13 | Materiales impresos | El QR se decodifica con otra librería antes de entregar el PDF |

Verificado de punta a punta en producción el 13/9 con dos fotos reales: subida,
moderación con Rekognition (**243 y 219 ms**), publicación, álbum, canal en vivo
y reconexión con cursor.

**204 tests. Lint en cero.**

### Lo que falta antes de poder vender

Nada de esto es de la Etapa 2, pero conviene tenerlo junto:

- **Parte 2 de la prueba de moderación**: veinte fotos reales en los tres
  perfiles, para medir cuántas buenas retiene por error. Procedimiento en el
  documento 06. Es lo más importante que queda.
- **Aprobación legal** de `/terminos` y `/privacidad`.
- **Botón de arrepentimiento** y **Libro de Quejas Online** (Resolución
  424/2020). Son dos enlaces, pero los controla Defensa del Consumidor.
- Borrar `/api/diagnostico`.
- Toda la Etapa 3: Mercado Pago, adicional de descarga, ZIP, emails, panel del
  cliente y proveedores.

## Etapa 2 — Núcleo en vivo: 21 al 27 de septiembre

| # | Tarea | Criterio de aceptación |
|---|---|---|
| 2.1 | Carga múltiple del invitado con reintentos | Cortar el wifi a mitad de la subida no pierde ni duplica la foto |
| 2.2 | Aceptación de términos y `SubilafotoConsent` | Queda registrada la versión del documento aceptado |
| 2.3 | Adaptador de moderación con interfaz de proveedor | Cambiar de Rekognition a otro servicio no toca el flujo |
| 2.4 | `DetectModerationLabels` asíncrono e idempotente | Reprocesar la misma foto no crea dos decisiones ni la publica dos veces |
| 2.5 | Motor de reglas con perfiles y versión de política | Una foto de riesgo alto nunca llega a `APPROVED` en ningún perfil |
| 2.6 | **Falla cerrada** | Con las credenciales de AWS rotas, ninguna foto se publica; todas quedan retenidas |
| 2.7 | Panel de revisión excepcional | Aprobar un falso positivo escribe en `SubilafotoAudit` con usuario y motivo |
| 2.8 | Galería de aprobadas | Sólo aparecen fotos con `publishedAt` no nulo |
| 2.9 | SSE con reconexión y `Last-Event-ID` | Matar el proceso y reconectar recupera las fotos perdidas |
| 2.10 | Pantalla 16:9 con precarga | 30 minutos proyectando sin fugas de memoria ni parpadeos |
| 2.11 | Control remoto | Ocultar una foto la saca de la pantalla en menos de 2 segundos |
| 2.12 | Cierre automático a las 12 horas | Un cron cierra el evento y la pantalla pasa a la placa de cierre |
| 2.13 | Materiales impresos con QR y logo del vendedor | El PDF del centro de mesa sale con sangrado y su propio QR se decodifica y valida antes de permitir la descarga |

**Salida:** el recorrido completo QR → carga → moderación → pantalla, probado en un celular
y un televisor reales.

## Etapa 3 — Comercial y proveedores: 28 de septiembre al 2 de octubre

| # | Tarea | Criterio de aceptación |
|---|---|---|
| 3.1 | Conectar Mercado Pago por OAuth (portado de CLF) | El fotógrafo conecta su cuenta y el token se refresca solo |
| 3.2 | Checkout con `marketplace_fee` configurable | Una compra de prueba deja la comisión en la cuenta de DNX |
| 3.3 | Webhook idempotente que crea el evento | Reenviar el mismo aviso tres veces crea **un** evento |
| 3.4 | Adicional de descarga como orden separada | El 100% del adicional entra en la cuenta de DNX, no del fotógrafo |
| 3.5 | Generación asíncrona del ZIP con manifiesto | Un evento de 300 fotos produce un paquete verificable |
| 3.6 | Enlace de descarga firmado, con vencimiento y revocable | El enlace vencido muestra un mensaje claro, no un error |
| 3.7 | Emails días 1, 3, 7, 15 y 30 sin duplicados | Un reintento del worker no manda el mismo email dos veces |
| 3.8 | Retención de 30 días y borrado con candado | Un pago en curso frena el borrado |
| 3.9 | Invitación y ficha de proveedor contra `DnxPartner` | Un salón ya existente se vincula sin crear un duplicado |
| 3.10 | Panel del cliente | Ve el álbum, compra el adicional y baja el paquete |

**Salida:** el evento es vendible de punta a punta y los proveedores se captan sin ensuciar
la base de empresas.

**Estado al 2026-09-15: las diez tareas están en `main`.** Lo que falta para que la etapa
funcione de verdad no es código sino configuración y pruebas:

| Falta | De quién depende |
|---|---|
| `SUBILAFOTO_MP_CLIENT_ID`, `_CLIENT_SECRET`, `_REDIRECT_URI`, `_ACCESS_TOKEN` en Vercel | Titular |
| `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY` en Vercel | Titular |
| Declarar la URL de retorno en la app "DNX Suite" de Mercado Pago (**no crear una app nueva**) | Titular |
| `RESEND_API_KEY` y el remitente, para que los correos dejen de salir en seco | Titular |
| Compra de prueba de punta a punta | Después de lo anterior |
| Parte 2 y 3 de la prueba de moderación (capítulo 06) | Fotos reales |
| Probar el ZIP con un evento grande de verdad | Fotos reales |

## Etapa 4 — Estabilización: 3 al 7 de octubre

- Recorrido de aceptación completo (los 31 pasos del capítulo 28), ejecutado entero.
- Prueba con 100 fotos simultáneas de 10 dispositivos.
- iPhone Safari, Android Chrome, un televisor y un proyector reales.
- Recuperación de conexión: modo avión a mitad de carga y a mitad de proyección.
- Repaso de permisos y de la regla anti-bypass.
- Accesibilidad: contraste, tamaños de toque, lectores de pantalla en el flujo del invitado.
- Documentación operativa para vos y para soporte.
- Ensayo de rollback.

**Salida:** candidato de lanzamiento, sin fallos críticos ni altos conocidos.

**Estado al 2026-09-15.** Se adelantó casi toda la etapa:

| Punto | Estado | Dónde |
|---|---|---|
| Recorrido de aceptación (31 pasos) | Mapeado con estado y responsable | [20](20-recorrido-de-aceptacion.md) |
| 100 fotos de 10 dispositivos | **Corrido. 0 fallas** | [19](19-prueba-de-carga.md) |
| Repaso de permisos y anti-bypass | **Hecho. Tres arreglos** | [15](15-repaso-de-permisos.md) |
| Accesibilidad | **Hecha. Un arreglo real** | [16](16-accesibilidad.md) |
| Documentación operativa | **Escrita** | [17](17-manual-de-operacion.md) |
| Ensayo de rollback | Procedimiento escrito y probado en parte | [18](18-rollback.md) |
| iPhone, Android, televisor y proyector reales | **Falta** | Necesita los aparatos |
| Recuperación de conexión (modo avión) | **Falta** | Necesita un teléfono |

Lo que queda de la etapa 4 **no se puede hacer sin aparatos y sin las variables de
entorno**. No es trabajo de código pendiente.

## Etapa 5 — Ensayo y lanzamiento: 8 al 10 de octubre

- 8/10: ensayo general con un evento real o simulado, de principio a fin.
- 9/10: congelamiento. Sólo se corrigen bloqueantes.
- 10/10: lanzamiento controlado y monitoreo activo.

**Estado al 2026-09-15.** Lo construible de la etapa está hecho:

| Punto | Estado | Dónde |
|---|---|---|
| Monitoreo activo | **Construido**: panel, alertas con instrucción y latido de los cron | [21](21-como-va-la-noche.md) |
| Guion del ensayo del 8 | **Escrito**, 13 pasos | [22](22-ensayo-y-lanzamiento.md) |
| Criterio de congelamiento del 9 | **Escrito**: una sola pregunta | [22](22-ensayo-y-lanzamiento.md) |
| Recorrido del 10 y qué mirar | **Escrito** | [22](22-ensayo-y-lanzamiento.md) |
| Lista de lo que tiene que estar antes del 8 | **Escrita** | [22](22-ensayo-y-lanzamiento.md) |
| El ensayo en sí | **Falta**: es el 8 de octubre y necesita plata y aparatos | — |

## El camino crítico

Si algo de esto se atrasa, se atrasa el lanzamiento:

```
migración en las 5 bases → carga del invitado → moderación → SSE → pantalla
                                                                      ↓
                        OAuth de Mercado Pago → webhook → creación del evento
```

Todo lo demás (proveedores, plantillas más allá de seis, panel del cliente, landing) puede
recortarse sin mover la fecha. **Estas ocho piezas, no.**
