# Andreani API — referencia para cotizar envíos (FOTOFFICE, multi-tenant)

Fecha de investigación: 2026-10-05. Leyenda de confianza:
- **[OFICIAL]** leído de developers.andreani.com (JSON de la página `/document`, que es el catálogo de APIs) o de los xlsx oficiales que esa página enlaza.
- **[LIVE]** probado hoy con curl contra los servidores de Andreani (sin credenciales).
- **[PLUGIN]** leído del código fuente del plugin oficial WooCommerce `andreani-shipping` (zip de wordpress.org).
- **[TERCEROS]** SDKs de GitHub no oficiales (alejoasotelo/andreani-sdk-rest, lpetrora/node-andreani-api, nchsala/andreani).
- **[INFERIDO]** deducción mía; verificar con credenciales QA reales.

Fuentes principales:
- https://developers.andreani.com/ (home, FAQ) y https://developers.andreani.com/document (catálogo; Next.js, el contenido está en `__NEXT_DATA__`)
- xlsx oficiales (Storyblok): cotizador `https://a.storyblok.com/f/63950/x/785cfc88f2/api-cotizador-v2-1.xlsx`, sucursales `.../92b5369487/api-sucursales-v2-0.xlsx`, orden de envío `.../67eaefe2fd/api-orden-envio-3.xlsx`
- Sandbox Docusaurus: https://developers-sandbox.andreani.com/ (sólo Warehouse + orden beta; no tiene cotizador)
- https://wordpress.org/plugins/andreani-shipping/ (zip: https://downloads.wordpress.org/plugin/andreani-shipping.latest-stable.zip)
- https://github.com/alejoasotelo/andreani-sdk-rest , https://github.com/lpetrora/node-andreani-api , https://github.com/nchsala/andreani

---

## 1. Conclusión práctica (leer primero)

1. Hay **dos caminos de integración** muy distintos:
   - **API directa** (`apis.andreani.com`): login Basic → token 24 h → `GET /v1/tarifas`. Requiere **usuario, contraseña, código de cliente y números de contrato**; las credenciales las gestiona el **ejecutivo comercial** (FAQ oficial) — no hay alta self-service documentada para API directa.
   - **Credential ID del portal** (lo usa el plugin oficial WooCommerce): el cliente PyME genera un "Credential ID" en https://pymes.andreani.com/integraciones/ (Corporativo: https://corporativo.andreani.com/woocommerce). El plugin **no** habla con `apis.andreani.com`: habla con un proxy de Andreani, `https://woocommerce-api-acom.andreani.com`, y manda ese hash como `Authorization`. Eso es **self-service para PyMEs** pero la API del proxy **no está documentada oficialmente** (sólo se conoce leyendo el plugin) y puede cambiar sin aviso. [PLUGIN]
2. Para un SaaS multi-tenant la opción más sólida y soportada es la **API directa** con credenciales propias de cada institución, guardadas cifradas por institución. Si la mayoría de las instituciones son PyMEs sin ejecutivo comercial, el camino Credential ID/proxy es el único self-service, con riesgo de no estar soportado para terceros.
3. La **sucursales (listado) es pública, sin token** [LIVE+OFICIAL]. Sólo el listado "por contrato" (`puntos-de-tercero`) y la tarifa requieren token.

---

## 2. Base URLs [OFICIAL salvo indicación]

| Entorno | URL |
|---|---|
| Producción | `https://apis.andreani.com` |
| QA (UAT, "mismas configuraciones que producción") | `https://apisqa.andreani.com` |
| Sandbox (sólo pruebas de estructura, docs Docusaurus) | https://developers-sandbox.andreani.com/ |
| Proxy del plugin WooCommerce [PLUGIN] | `https://woocommerce-api-acom.andreani.com` |

Proceso oficial: mapeo de campos → Sandbox → UAT en QA → "Ciclo 0" en producción. Las credenciales de QA se piden primero; luego te dan las de PRODUCCIÓN.

## 3. Autenticación [OFICIAL + TERCEROS]

Texto oficial: "Utiliza el servicio de login para generar el access token. El tipo de autorización es **Basic Auth (usuario / contraseña)**. Obtendrás un token (tienen una vigencia de **24 hs**). Utiliza ese token en el header de la API a invocar, con la etiqueta **x-authorization-token**."

```
GET https://apis.andreani.com/login        (QA: https://apisqa.andreani.com/login)
Authorization: Basic base64(usuario:contraseña)
→ 200, el token viene en el HEADER de respuesta  x-authorization-token   [TERCEROS: lo leen de headers]
```
- Cuerpo de respuesta del login: no documentado; los SDKs leen sólo el header. [TERCEROS]
- Login inválido [LIVE, QA]: `HTTP 401` `{"message":"Credenciales incorrectas"}`.
- Usar luego `x-authorization-token: <token>` en cada llamada. Cachear el token por institución (válido 24 h; renovar a las ~23 h o ante 401).
- Endpoints que NO requieren token (oficial): `/v1/localidades`, `/v2/sucursales`, códigos de barras/QR.

**Plugin oficial (proxy)** [PLUGIN]: `POST https://woocommerce-api-acom.andreani.com/api/v1/Login` con header `Authorization: <Credential ID>`. Respuesta `{"response": {..., "accessToken": "...", "contratos":[{id, modoDeEntregaNombre,...}], ...}}`; luego usa header **`X-Auth-Token: <accessToken>`**.

## 4. Qué credenciales/datos tiene un cliente

Oficial: "credenciales... que podrás gestionar con tu ejecutivo comercial... 011-4468-6666"; "las credenciales son gestionadas a través del Ejecutivo Comercial y te las enviaremos por e-mail dentro de las 24 hrs"; también "Generar las credenciales y el token por medio de Andreani.com > Integraciones (https://www.andreani.com/integraciones)" y "Si aún no sos cliente, podes registrarte por Andreani.com como usuario PyME". Guía oficial WooCommerce pide: "código de cliente, usuario API, contratos de servicio".

Por institución hay que guardar [OFICIAL+TERCEROS]:
- `usuario` y `contraseña` (para `/login`)
- `cliente` (código, ej. `CL0003750` en el ejemplo oficial)
- `contrato` **por servicio/modalidad**: uno para entrega a domicilio, otro para entrega en sucursal (el SDK de lpetrora usa `CONTRATO_DOMICILIO` y `CONTRATO_SUCURSAL`; ej. oficial `300006611`). Si hay estándar/urgente son contratos distintos. [TERCEROS/INFERIDO: la separación por modalidad y la existencia de urgente]
- (opcional) sucursal de origen / CP de origen donde se impone el paquete.

## 5. Cotizador / tarifas [OFICIAL — xlsx "api-cotizador-v2-1"]

```
GET https://apis.andreani.com/v1/tarifas     (QA: https://apisqa.andreani.com/v1/tarifas)
Header: x-authorization-token
```
Query params (los bultos van como arrays con corchetes):

| Param | Descripción oficial | Tipo | Condición |
|---|---|---|---|
| `cpDestino` | CP destino | string | obligatorio |
| `contrato` | Código de contrato con Andreani | string | obligatorio |
| `cliente` | Código de cliente en Andreani (lo da el comercial al alta) | string | obligatorio |
| `sucursalOrigen` | Sucursal origen, donde se impone el paquete | string | opcional |
| `bultos[0][volumen]` | Volumen del bulto en **cm3** | string | obligatorio |
| `bultos[0][kilos]` | Peso en kg | string | opcional |
| `bultos[0][valorDeclarado]` | Valor sin impuestos, para el seguro de distribución | string | opcional |
| `bultos[0][altoCm]`, `[largoCm]`, `[anchoCm]` | dimensiones cm | string | opcional |
| `pais` | usado por el SDK de alejoasotelo | — | [TERCEROS] |

Ejemplo (SDK alejoasotelo, valores oficiales de ejemplo): `cpDestino=1832&contrato=300006611&cliente=CL0003750&bultos[0][volumen]=200&bultos[0][kilos]=1.3&bultos[0][pesoAforado]=5&bultos[0][valorDeclarado]=1200`. (`pesoAforado` en el request aparece sólo en el SDK, no en la tabla oficial.)

Respuesta oficial (200):
```json
{ "pesoAforado":"70.00",
  "tarifaSinIva":{ "seguroDistribucion":"12.21", "distribucion":"5806.97", "total":"5819.18" },
  "tarifaConIva":{ "seguroDistribucion":"14.77", "distribucion":"7026.43", "total":"7041.21" } }
```
Todo viene como **string**; el costo a cobrar es `tarifaConIva.total` (o sin IVA según facturación de la institución). La doc dice: "Se debe tener en cuenta como fueron acordadas las tarifas según el contrato para completar los campos de manera correcta" → la tarifa depende del contrato (algunos contratos tarifican por peso aforado/volumen, otros por kilos).

Error [LIVE, QA, con token inválido y datos falsos]: `HTTP 400`
`{"type":"about:blank","title":"Error en la validacion de su pedido","detail":"No se pudo obtener la tarifa","status":400,"errors":null}` (formato ProblemDetails). Sin token tampoco devolvió 401 sino este 400 — no se puede distinguir "token malo" de "contrato malo" por el status; validar el token con `/login` primero.

Aforo [PLUGIN, constantes del plugin]: `AFORO_KG_M3 = 350`; Bigger/B2B si peso > 50 kg, suma de lados > 300 cm o lado máx > 165 cm. Es decir, peso volumétrico ≈ volumen_m3 × 350 kg. [INFERIDO como regla de Andreani]. Orden de envío oficial: B2C = 1 bulto hasta 50 kg; B2B/Bigger = >50 kg o varios bultos consolidados.

**Cotización a sucursal vs domicilio** [TERCEROS]: se cotiza con el mismo endpoint cambiando `contrato`: `cotizarEnvioSucursal` usa `CONTRATO_SUCURSAL`, `cotizarEnvioDomicilio` usa `CONTRATO_DOMICILIO` (lpetrora/node-andreani-api `src/index.ts`). El cotizador **no recibe sucursal de destino**: sólo `cpDestino`. [OFICIAL: la tabla no tiene param de sucursal destino]. Conclusión: precio de sucursal = f(cpDestino, contrato sucursal); la sucursal concreta se elige aparte (sección 6) y sólo importa al crear la orden.

Plugin/proxy (alternativa) [PLUGIN]: `POST /api/v1/Pyme/rates` (Corporativo: `/api/v1/Corporative/rates`), headers `X-Auth-Token`, body:
```json
{ "postal_code_origin":"1832", "postal_code_destination":"3000", "branch_code_origin":"<opcional>",
  "products":[{"quantity":1,"price":1200,"dimensions":{"width":10,"height":10,"depth":10,"grams":500}}] }
```
Respuesta `{"response":{"rates":[{"code":"<modo de entrega>","total":<num>}, ...]}}`: devuelve **una tarifa por modo de entrega habilitado en los contratos del cliente** (el plugin muestra "Andreani (code)"; el `code` equivale a `modoDeEntregaNombre`, p.ej. domicilio / sucursal / urgente). Ahí el contrato lo resuelve el proxy.

## 6. Sucursales [OFICIAL + LIVE]

**Listado público (sin token)** — verificado con curl en prod y QA:
```
GET https://apis.andreani.com/v2/sucursales?codigoPostal=3000&canal=B2C
```
Filtros: `codigo`, `sucursal`, `region`, `localidad`, `codigoPostal` (CP atendido por la sucursal), `canal` (B2C/B2B), `seHaceAtencionAlCliente`, `conBuzonInteligente`, `numero`. Uso oficial: servicio B2B, envíos con origen/destino a sucursales Andreani, e-commerce.

Respuesta real [LIVE] (array):
```json
[{"id":10055,"codigo":"SFN","numero":"55","descripcion":"SANTA FE (CENTRO)","canal":"B2C",
  "direccion":{"calle":"25 de Mayo","numero":"3340","provincia":"Santa Fe","localidad":"Santa Fe","region":"Litoral","pais":"Argentina","codigoPostal":"3000"},
  "coordenadas":{"latitud":"-31.63765","longitud":"-60.703"},
  "horarioDeAtencion":"Lunes a Viernes de 08:00 a 18:00 - Sábados de 08:00 a 13:00",
  "datosAdicionales":{"seHaceAtencionAlCliente":true,"tipo":"SUCURSAL","admiteEnvios":true,"entregaEnvios":true,"conBuzonInteligente":false},
  "telefonos":[""],"codigosPostalesAtendidos":["1773","1821", "..."]}]
```
(En el live aparecen además `idgla_integra`, `idgla_alertran`, no documentados.) El identificador para crear órdenes es `id` (numérico) / `codigo` (ej. SFN).

**Listado por contrato (requiere token)**: `GET https://apis.andreani.com/v2/puntos-de-tercero?contrato=<n>` + filtros `admiteEnvios`, `entregaEnvios`, `codigoPostal`, `atencionPorCodigoPostal`, `localidad`, `canal=B2C`, etc. "Lista todas las sucursales de Andreani o PD3 (puntos de terceros) asignadas al servicio que tienen con nosotros"; PD3 sólo B2C. Es la forma correcta de ofrecer sólo las sucursales habilitadas para el contrato de sucursal de la institución. [OFICIAL]

Otros datos maestros [OFICIAL]: `GET /v1/localidades` (sin auth; localidades+CP normalizados; verificado live), `GET /v1/regiones` [TERCEROS], `GET /v1/direcciones` geolocaliza [TERCEROS].

Proxy del plugin [PLUGIN]: `GET /api/v1/Branch?postalCode=XXXX` (header `X-Auth-Token`) → `{"response":{"data":[{Codigo, Descripcion, Direccion:{Calle,Numero,Localidad,Provincia,CodigoPostal}, idApi, tipo, horarioDeAtencion, coordenadas}]}}`; `/Branch/origin` y `/Branch/default-origin` para origen. Settings: `/api/v1/Settings`.

## 7. Orden de envío, etiquetas, tracking (resumen) [OFICIAL]

- **Crear orden**: `POST /v2/ordenes-de-envio` (token). Body: `contrato`, `tipoDeServicio`, `origen` (`postal` o `sucursal.id`), `destino` (`postal` {codigoPostal, calle, numero, localidad...} **o** `destino.sucursal.id` para entrega en sucursal), `remitente`, `destinatario`, `bultos[]` (kilos, volumenCm, largoCm/altoCm/anchoCm, valorDeclarado...). Max 300 bultos. Respuesta 202: `bultos[].numeroDeEnvio`, `agrupadorDeBultos`, `estado`, `sucursalDeDistribucion`, `etiquetaRemito`, etc. Pre-envío vigente **30 días**. Estados: Pendiente, Solicitado, Creado, Rechazado. Confirma el modo sucursal: el contrato elegido define domicilio vs sucursal, y `destino.sucursal.id` fija la sucursal. (la unión contrato-sucursal es [INFERIDO] de la tabla de campos).
- **Estado de orden**: `GET /v2/ordenes-de-envio/{numeroAndreani}`.
- **Etiquetas**: `GET /v2/ordenes-de-envio/{numeroAndreani|agrupador}/etiquetas` → PDF (`?tipo=documentoDeCambio` para cambios [TERCEROS]).
- **Tracking**: `GET /v2/envios/{numeroAndreani}` (estado), `GET /v2/envios` (buscar), `GET /v1|v3/envios/{n}/trazas` (trazas; la v1 figura "A Deprecar"; v3 documentada como contingencia), y **Novedades PUSH** (webhook JSON desde Andreani, doc PDF "requerimientos novedades push"). Otros: `/v1/codigos-qr/{info}`, `/v1/codigos-de-barras/{info}`, `POST /v2/AltaRetiro`, `/v2/nueva-accion` (cancelar, cambio domicilio, etc.).
- Proxy plugin [PLUGIN]: `POST /api/v1/Pyme/ShippingRegistration` (orden), `/api/v1/Pyme/ticket` (etiqueta); pago de envíos en el portal Andreani Pymes.

## 8. Errores [OFICIAL + LIVE + PLUGIN]

- Login: 401 `{"message":"Credenciales incorrectas"}` [LIVE].
- Tarifa: 400 ProblemDetails `{type,title,detail,status,errors}` [LIVE].
- Orden de envío (oficial, hoja "Mensajes de error"): 400 (parámetro mal tipado, JSON incorrecto, "El contrato es incorrecto", "El código postal es incorrecto", "No existe localidad o código postal destino"…), 401 (usuario sin acceso al preenvío), 404 ("No se encuentran sucursales para los filtros ingresados"; orden inexistente), 500 ("Error en la API de sucursales"). Sin sucursales para filtro → 404 [OFICIAL].
- El plugin parsea errores en `message`, `error.message`, `response.message`, `errors[]`, `title` — el proxy mezcla formatos. [PLUGIN]

## 9. Rate limits / disponibilidad

- **No encontré rate limits documentados** (ni en la doc oficial, ni los xlsx, ni los SDKs). El gateway es AWS API Gateway detrás de Cloudflare [LIVE: headers `x-amzn-requestid`, `x-amz-apigw-id`, `server: cloudflare`, `cf-ray`]; es razonable esperar throttling 429, pero **no verificado**. Recomendación [INFERIDO]: cachear token 24 h, cachear cotización por (cp, contrato, bultos) unos minutos y sucursales por CP horas/días, timeout 15–30 s (el plugin usa 30 s en general y 15 s en sucursales), reintentos con backoff.
- Cloudflare setea cookie `__cf_bm` en la respuesta; no se necesita enviarla de vuelta.

## 10. Cómo obtiene el cliente las credenciales

- API directa: contactar a Andreani / ejecutivo comercial (tel. 011-4468-6666 según FAQ); credenciales de QA primero, luego producción, por email en ~24 h. Hay que ser cliente (con contrato). Ingresar en https://www.andreani.com/integraciones se menciona como vía para "generar las credenciales y el token" (PyME se registra en andreani.com). [OFICIAL] — el flujo exacto de self-service para obtener usuario/contraseña de API directa **no está descrito**; probablemente sólo da el Credential ID de plataformas e-commerce.
- Credential ID (Woo/VTEX/Tiendanube): self-service en https://pymes.andreani.com/integraciones/ "seleccioná la opción WooCommerce" / corporativo `https://corporativo.andreani.com/woocommerce`. [PLUGIN/readme]
- Los **contratos** (domicilio, sucursal, urgente) los asigna Andreani comercialmente; el cliente PyME los ve vía el proxy (`contratos[]` en el login, con `modoDeEntregaNombre`). [PLUGIN]

## 11. Pendientes de verificar con credenciales QA reales

1. Formato exacto de `GET /v1/tarifas` con credenciales válidas (¿`pesoAforado` y `tarifaConIva` como en el xlsx? ¿devuelve array si hay varios bultos?).
2. Que cambiar sólo `contrato` entre domicilio/sucursal alcance, y qué pasa con envío urgente (contrato propio).
3. Si un PyME con Credential ID puede obtener usuario/contraseña de API directa o si hay que usar el proxy.
4. Estabilidad/permiso de uso de `woocommerce-api-acom.andreani.com` por un tercero (SaaS).
5. Límites de tasa y política de uso.
