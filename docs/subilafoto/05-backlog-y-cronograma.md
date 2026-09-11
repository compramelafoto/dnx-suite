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
| "Métricas operativas básicas" | Sólo contadores en el panel del evento. Sin panel de analítica |
| "Detección básica de duplicados" | El `@unique` por checksum. Nada de similitud perceptual |
| "Panel del cliente" | Ver el álbum, comprar la descarga, bajar el paquete. Nada más |
| Videos | Fuera, como ya prevé el capítulo 26.2 |

## Etapa 0 — Definición: 11 al 13 de septiembre

- [x] Auditar el monorepo y verificar qué se reutiliza
- [x] Resolver base de datos y estrategia de tiempo real
- [x] Modelo de datos, mapa de pantallas, roles
- [x] Backlog y cronograma
- [ ] **Resolver las decisiones abiertas bloqueantes** (ver doc 07)
- [ ] Crear el proyecto en Vercel y apuntar `subilafoto.com`
- [ ] Verificar que la cuenta AWS de Rekognition admite `DetectModerationLabels` en la región en uso

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

## Etapa 5 — Ensayo y lanzamiento: 8 al 10 de octubre

- 8/10: ensayo general con un evento real o simulado, de principio a fin.
- 9/10: congelamiento. Sólo se corrigen bloqueantes.
- 10/10: lanzamiento controlado y monitoreo activo.

## El camino crítico

Si algo de esto se atrasa, se atrasa el lanzamiento:

```
migración en las 5 bases → carga del invitado → moderación → SSE → pantalla
                                                                      ↓
                        OAuth de Mercado Pago → webhook → creación del evento
```

Todo lo demás (proveedores, plantillas más allá de seis, panel del cliente, landing) puede
recortarse sin mover la fecha. **Estas ocho piezas, no.**
