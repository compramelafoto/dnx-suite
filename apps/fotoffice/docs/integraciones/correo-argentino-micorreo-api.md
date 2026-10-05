# Referencia de la API MiCorreo (Correo Argentino) — para desarrollo

Fuente: https://www.correoargentino.com.ar/MiCorreo/public/img/pag/apiMiCorreo.pdf
Versión del documento: PDF "Correo Argentino - API MiCorreo.md", fechado **8/8/2022** (16 págs.; generado con Chromium). No indica número de versión de la API; la ruta base es `/micorreo/v1`. **El documento tiene más de 4 años: verificar contra el ambiente QA antes de confiar en detalles.**
Fuente 2: https://www.correoargentino.com.ar/MiCorreo/public/primeros-pasos

## 1. Alcance
"La API de MiCorreo se utiliza principalmente para cotizar envíos, e importarlos en la plataforma de MiCorreo." REST, acepta 'form-encoded' (pero los ejemplos usan JSON con `Content-Type: application/json`), responde JSON. Sólo HTTPS.

Endpoints: `/token` [POST], `/register` [POST], `/users/validate` [POST], `/agencies` [GET], `/rates` [POST], `/shipping/import` [POST].

## 2. URLs base
- QA (testing): `https://apitest.correoargentino.com.ar/micorreo/v1`
- Producción: `https://api.correoargentino.com.ar/micorreo/v1`

"Las credenciales de acceso deberán ser solicitadas a Correo para cada uno de los ambientes" (QA y producción son credenciales distintas).

## 3. Cómo se piden las credenciales (página "primeros-pasos")
- Hay que **registrarse previamente** ("Sí. Nuestros ambientes requieren que cuentes con credenciales para conectar con las API's que podrás gestionar con un ejecutivo comercial"). Mientras tanto se pueden bajar los manuales y empezar a desarrollar.
- Pasos: (1) crear la cuenta MiCorreo (formulario de registro en el sitio; CUIT sólo para empresas; en el paso 2 se confirman datos de ARCA); (2) completar el **Formulario de contacto** de la página (razón social, nombre, CUIT/CUIL, correo, celular, sitio web; motivo: "Asesoramiento sobre integración por app." / "Requiero abrir cuenta MiCorreo." / "Otros"; si es cliente MiCorreo, el N° de cliente; si es agencia; qué plugin usa) y "nos comunicaremos con vos". Para Shopify/VTEX piden cuenta corriente.
- La integración "es gratuita y sólo pagás por cada envío que realices".
- Ambiguo: la página no publica plazos ni un trámite automático; las credenciales (usuario/clave Basic Auth) las entrega un ejecutivo comercial.

## 4. Autenticación
Flujo en dos pasos: Basic Auth -> JWT -> Bearer.

Request:
```
curl -X POST ${BASE_URL}/token -u ${user}:${password}
```
(POST a `/token`, header `Authorization: Basic base64(user:password)`, sin body.)

Response 200:
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9....",
  "expires": "2022-04-26 21:16:20"
}
```
Response 401: `{"code": "401", "message": "Unauthorized"}`

Uso del token en el resto de endpoints:
```
-H "Authorization: Bearer eyJ0eXAi..."
-H 'Content-Type: application/json'
```
Notas / ambiguo:
- El ejemplo de `expires` muestra ~9000 s de vida (el JWT del ejemplo: `iat` 1651009580, `exp` 1651018580 = 2,5 h), pero el doc no declara la duración ni la zona horaria de `expires` (formato `YYYY-MM-DD HH:mm:ss`, sin zona; probablemente hora Argentina). Recomendación: cachear el token y renovar antes de `expires` o ante un 401.
- No hay refresh token.
- Advertencia del doc: no exponer claves en GitHub ni en código del lado del cliente (llamar siempre desde el servidor).

## 5. Obtener `customerId`
Dos formas:

### 5.1 `/users/validate` [POST] — devuelve el ID de un usuario MiCorreo existente
Body (ambos requeridos): `email` (registrado), `password` (válida).
```
curl -X POST ${BASE_URL}/users/validate -H "Authorization: Bearer ..." -H 'Content-Type: application/json' \
  -d '{"email":"email2@mail.com","password":"secret"}'
```
200:
```json
{ "customerId": "0090000025", "createdAt": "2021-03-10" }
```
404: `{"code":"404","message":"Usuario no valido o inexistente"}`
Implicancia: se necesita el **email y la contraseña de MiCorreo del cliente** (el fotógrafo/institución), no sólo el token API.

### 5.2 `/register` [POST] — da de alta un usuario nuevo en MiCorreo
Campos: `firstName` (req.), `lastName` (req. para DNI), `email` (req.; no debe existir; no se valida), `password` (aparece en los ejemplos pero **no figura en la tabla de campos**), `documentType` (req.: "DNI" o "CUIT"), `documentId` (req.), `phone`, `cellPhone`, `address.streetName`, `address.streetNumber`, `address.floor`, `address.apartment`, `address.city`, `address.provinceCode`, `address.postalCode` (calle/número/ciudad/provincia/CP obligatorios para DNI); el ejemplo también incluye `address.locality` (no documentado en la tabla).
200: `{"customerId":"0090000024","createdAt":"2022-04-28 12:08:16.847"}`
402: `{"code":"402","message":"Error..."}` o `{"code":"402","message":"Email existente...."}`

El `customerId` es un string numérico de 10 dígitos con ceros a la izquierda (ej. "0090000025"); conservarlo como string.

## 6. Cotización: `/rates` [POST]
Devuelve cotizaciones de un envío a domicilio o a sucursal.

### Request (JSON)
| Campo | Tipo | Descripción / límites | Req. |
|---|---|---|---|
| `customerId` | string | ID de usuario MiCorreo | sí |
| `postalCodeOrigin` | string | CP de origen (ej. "1757") | sí |
| `postalCodeDestination` | string | CP de destino (ej. "1704") | sí |
| `deliveredType` | string | `"D"` domicilio, `"S"` sucursal. **Opcional**: si se omite, devuelve ambas (la tabla no marca ✔) | no |
| `dimensions.weight` | entero | gramos; **mín. 1 g, máx. 25000 g** | sí |
| `dimensions.height` | entero | cm; **máx. 150** | sí |
| `dimensions.width` | entero | cm; **máx. 150** | sí |
| `dimensions.length` | entero | cm; **máx. 150** | sí |

"All fields of the dimensions object are integer values" (redondear/`ceil` a entero). Ambiguo: el doc no dice si hay un límite combinado (suma de lados / volumen) ni si el mínimo de cada dimensión es 1; en `/shipping/import` los errores citan "El alto debe estar entre 0 y 255", lo que sugiere que el límite real del sistema difiere de 150.

Ejemplo domicilio:
```json
{
  "customerId": "0000550137",
  "postalCodeOrigin": "1757",
  "postalCodeDestination": "1704",
  "deliveredType": "D",
  "dimensions": { "weight": 2500, "height": 10, "width": 20, "length": 30 }
}
```
Con `"deliveredType": "S"` cotiza a sucursal; sin `deliveredType` cotiza ambas en el mismo request.

### Response 200 (ambas)
```json
{
  "customerId": "0000550997",
  "validTo": "2022-06-07T10:31:27.881-03:00",
  "rates": [
    { "deliveredType": "D", "productType": "CP", "productName": "Paq.ar Clásico", "price": 498.06 },
    { "deliveredType": "S", "productType": "CP", "productName": "Paq.ar Clásico", "price": 398.06 }
  ]
}
```
Campos de respuesta:
- `customerId`, `validTo` (ISO-8601 con offset -03:00: vigencia de la cotización), `rates[]`.
- `rates[].deliveredType` ("D"/"S"), `rates[].productType` (código de producto, ej. "CP"), `rates[].productName` (ej. "Paq.ar Clásico"), `rates[].price` (número decimal).
- Error 402: `{"code":"402","message":"Cliente FAP no identificado {customerId}"}`

**Ambiguo / no documentado (preguntar a Correo o probar en QA):**
- **No hay campo de moneda** (se asume ARS).
- **No dice si `price` incluye IVA** ni si incluye servicios adicionales/seguro. Hay que verificar con una cotización real contra MiCorreo.
- **No hay campo de plazo de entrega / días estimados** en la respuesta documentada. `validTo` es la vigencia de la cotización, no el tiempo de entrega.
- Sólo se ve un producto ("CP"/Paq.ar Clásico) por modalidad; no se sabe si pueden aparecer otros (ej. Expreso). Programar `rates` como arreglo genérico.
- No se documenta `rates` vacío ni destino no cubierto.
- No hay parámetro de valor declarado en la cotización (sí en `/shipping/import`).

## 7. Sucursales: `/agencies` [GET]
Query: `customerId` (req.), `provinceCode` (req., ver sección 10), `services` (opcional: `"package_reception"`, `"pickup_availability"`).
```
curl -H "Authorization: Bearer ..." ${BASE_URL}/agencies --data-urlencode "customerId=0090000025" --data-urlencode "provinceCode=B"
```
(Es un GET; los params van en query string, el `curl` del doc usa `--data-urlencode` sin `-G`, lo que en la práctica sería un error del doc: usar `?customerId=...&provinceCode=...`.)

200: arreglo de objetos:
```json
[{
  "code": "B0107", "name": "Monte Grande",
  "manager": "Denardo, Matías Gabriel", "email": "sopoficina@correoargentino.com.ar", "phone": "(03401) 448396",
  "services": { "packageReception": true, "pickupAvailability": true },
  "location": {
    "address": { "streetName": "Vicente Lopez", "streetNumber": "448", "floor": null, "apartment": null,
                 "locality": "Monte Grande", "city": "Esteban Echeverria", "province": "Buenos Aires",
                 "provinceCode": "B", "postalCode": "B1842ZAB" },
    "latitude": "-34.81939997", "longitude": "-58.46747615"
  },
  "hours": { "sunday": null, "monday": {"start":"0930","end":"1800"}, "tuesday": {...}, "wednesday": {...},
             "thursday": {...}, "friday": {...}, "saturday": null, "holidays": null },
  "status": "ACTIVE"
}]
```
402: `{"code":"402","message":"Customer ID no valido"}`
Notas: `code` de sucursal (ej. "B0107") es lo que va en `shipping.agency` de `/shipping/import`. Horas "HHmm" en string. latitud/longitud son strings. No hay filtro por CP/localidad, sólo por provincia: filtrar en el cliente. Los códigos de ejemplo `"E0000"` en import no coinciden con el formato de arriba (ambiguo).

## 8. Importar envío: `/shipping/import` [POST] (resumen)
Crea el envío en MiCorreo (no genera rótulo ni tracking en la respuesta). Campos principales:
- `customerId` (req.), `extOrderId` (req.; ID externo de la orden; reimportar la misma da error "La orden ya fue importada con anterioridad." -> sirve de idempotencia), `orderNumber` (visible en MiCorreo).
- `sender` (opcional; todos los campos nulos en los ejemplos -> usa el remitente registrado en MiCorreo): name, phone, cellPhone, email, originAddress{streetName, streetNumber, floor, apartment, city, provinceCode, postalCode}.
- `recipient` (req.): `name` (req.), `email` (req.), phone, cellPhone.
- `shipping` (req.): `deliveryType` ("D" o "S"), `agency` (código de sucursal; obligatorio sólo si "S"), `address{streetName, streetNumber, city, provinceCode, postalCode}` (obligatorios sólo para domicilio; floor/apartment se truncan a 3 caracteres), `weight` (g), `declaredValue` (decimal, ej. 500.00), `height`, `length`, `width` (cm) — todos req., enteros.
- 200: `{"createdAt":"2022-06-07T16:15:04.996-03:00"}`. 402: `{"code":"402","message":"Error ..."}`.
- Mensajes de error (del WCP): orden ya importada; Peso no valido; Tipo de entrega invalido; Verifique la sucursal de destino; Tipo de encomienda [TENC] no valida; El peso debe ser mayor a 0; El peso excede el maximo permitido para el producto; no se encontro datos de remitente; El codigo Postal del emisor debe tener valor; La provincia del emisor debe tener valor; La provincia es invalida; alto/ancho/largo "deben estar entre 0 y 255".
- **Etiquetas / tracking: la API documentada NO tiene endpoints de rótulo ni de seguimiento ni de número de tracking.** La respuesta del import sólo devuelve `createdAt`. Los rótulos se generan desde la plataforma web MiCorreo ("Generador de rótulos"). Ambiguo: cómo obtener el número de seguimiento programáticamente (quizá otra API/manual de Paq.ar; la página de primeros pasos menciona "PAQ.AR APIs" con otros manuales, no incluidos en este PDF). Pagar el envío también es en MiCorreo.

## 9. Errores y códigos HTTP
Formato: `{"code": "<http>", "message": "<texto>"}` (nótese que `code` es string; los ejemplos del doc tienen comas finales inválidas en JSON, parsear con tolerancia o por status).
- 200 OK; 400 Bad Request (falta parámetro); 401 Unauthorized (token inválido/ausente); 402 Request Failed (parámetros válidos pero falló; **es el código usado para errores de negocio**: customerId inválido, email existente, import fallido); 403 Forbidden; 404 Not Found; 409 Conflict (misma clave idempotente); 429 Too Many Requests (recomiendan backoff exponencial); 50x Server Errors (servicio no disponible).

## 10. Rate limits
**No se documenta ningún límite numérico**; sólo menciona 429 y recomienda retroceso exponencial. Conviene cachear cotizaciones (vigentes hasta `validTo`) y el token.

## 11. Códigos de provincia (`provinceCode`)
A Salta; B Buenos Aires (provincia); C CABA; D San Luis; E Entre Ríos; F La Rioja; G Santiago del Estero; H Chaco; J San Juan; K Catamarca; L La Pampa; M Mendoza; N Misiones; P Formosa; Q Neuquén; R Río Negro; S Santa Fe; T Tucumán; U Chubut; V Tierra del Fuego; W Corrientes; X Córdoba; Y Jujuy; Z Santa Cruz.
Ojo: los CP en los ejemplos mezclan formato viejo ("1704") y CPA ("B1842ZAB"); `/rates` usa ejemplos de 4 dígitos.

## 12. Resumen de ambigüedades a validar en QA
1. Moneda (¿ARS?) e IVA incluido en `price`: no documentado.
2. Plazo de entrega: no aparece en la respuesta de `/rates`.
3. Duración y zona horaria del token (`expires`).
4. Límites reales de dimensiones (150 cm en rates vs 255 en import) y si hay límite combinado.
5. `deliveredType` opcional en rates (no marcado como requerido).
6. `password` en `/register` no figura en la tabla; `address.locality` tampoco.
7. Dónde obtener tracking/rótulo por API (no está en este documento).
8. Rate limits no especificados.
9. Se necesita email+contraseña de MiCorreo del cliente para `/users/validate`; modelo multi-cliente (cada fotógrafo con su `customerId`) no explicado.
10. Doc de 2022: puede estar desactualizado.
