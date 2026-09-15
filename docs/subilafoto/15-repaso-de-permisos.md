# Repaso de permisos y anti-bypass

*Etapa 4. Auditoría del 2026-09-15 sobre todas las superficies del servidor.*

Se revisaron **15 rutas de API, 2 rutas sueltas, 8 acciones de servidor y 22 páginas**.
Esto es lo que se encontró y lo que se hizo.

## Lo que estaba mal

### `/api/diagnostico` estaba abierta

Cualquiera podía llamarla, y devolvía:

```
"hostBase": "ep-falling-darkness-...aws.neon.tech"
"bucket": "subilafoto-media"
"region": "us-east-1"
"authUrl": "https://subilafoto.com"
"perfiles": 0, "eventos": 0
```

Nada de eso es una credencial, pero es el mapa para buscarlas. Y hay algo peor: **cada
visita escribe y borra un archivo en R2 y llama a Rekognition**. Abierta, es un endpoint
que cualquiera puede poner en un bucle y que se factura.

Sigue siendo la forma más rápida de saber si un despliegue quedó bien, así que **se cerró
con la llave de servicio en vez de borrarla**.

### La guarda de las rutas de servicio estaba copiada cinco veces

Cinco rutas con el mismo bloque pegado. Una regla de seguridad copiada cinco veces es una
regla que en algún momento va a estar bien en cuatro. Ahora vive en
`lib/llave-de-servicio.ts`, con tests, y compara en tiempo constante.

Dos detalles que quedaron probados:

- **Sin secreto configurado no se atiende a nadie** (503, no 401). Dejar pasar cuando falta
  la variable convierte un olvido de configuración en una puerta abierta. Y 503 en vez de
  401 porque el problema no es de quien llama: confundirlos manda a buscar el error al lado
  equivocado.
- El secreto se compara **sin los espacios de los costados**. Pegar una variable en Vercel
  arrastra un salto de línea más veces de las que uno cree.

### La pantalla de "gracias" mostraba el correo entero

Se llega con el identificador de la orden en la dirección. No es adivinable, pero tampoco
es un secreto: viaja en el historial, en una captura compartida y en cualquier registro que
guarde direcciones.

Quien compró tiene que **reconocer** su correo ahí, no leerlo. Ahora dice
`ma***a@estudioluna.com.ar`. Un nombre de menos de cinco letras se tapa entero, porque
"juan" tapado a medias queda `ju***n`, que es el nombre entero.

## Lo que estaba bien

| Superficie | Cómo se protege |
|---|---|
| Las 9 pantallas y 4 acciones del panel | Sesión **y** `sellerProfile: { userId }` en el `where`, no en un `if` |
| Los 5 cron | Llave de servicio |
| Subida del invitado | Ventana horaria, `allowPhotos`, validación de archivo, consentimiento **del lado del servidor** y tope por invitado |
| Enlaces de cliente, proveedor y descarga | Token opaco, vencimiento y revocación, verificados en cada visita |
| Descarga del paquete | Firma corta contra R2, 410 si venció (no 404: existió y ya no está) |

### El webhook de Mercado Pago no verifica firma, y está bien

**No confía en el cuerpo del aviso.** Toma el identificador del pago y le pregunta el
estado a la API de Mercado Pago con nuestro token. Un aviso falso no puede inventar un
pago: la única fuente que vale es la respuesta de la API.

Eso es más fuerte que verificar la firma, no más débil. Lo único que un aviso falso
consigue es que hagamos una consulta de más.

## La regla anti-bypass, aplicada

El capítulo 12.4 dice que el fotógrafo **no descarga** las fotos de los invitados: esa es
la razón de existir del adicional de descarga. Si pudiera entregar los originales por su
cuenta, el adicional no se vendería nunca.

Hasta el 2026-09-15 el panel de moderación le mostraba **el original** con una URL firmada:
botón derecho y listo. La regla estaba escrita y no estaba aplicada.

**Un permiso no arregla eso.** Mientras la pantalla muestre el archivo bueno, no hay
control de acceso que sirva. La única forma es no darle nunca los bytes del original.

### Dos variantes por foto

| Etiqueta | Lado mayor | Calidad | Para qué |
|---|---|---|---|
| `pantalla` | 1920 px | 82 | Televisor del salón, álbum, control |
| `panel` | 640 px | 70 | La grilla de moderación |

1920 porque un televisor de salón es 1920×1080 y una foto vertical entra completa. Más que
eso es regalar resolución que después se vende.

640 en el panel porque moderar es decidir si una foto va o no va, y para eso alcanza con
verla. Bajar treinta fotos grandes para decidir treinta veces "sí" es espera y tráfico que
no hace falta.

Se generan **en el mismo paso que modera**, porque ahí los bytes del original ya están en
memoria: bajarlos otra vez sería pagar el mismo tráfico dos veces. Una sola decodificación
para las dos medidas.

Dos detalles que se notan justo donde duele:

- **`rotate()` sin argumentos** aplica la orientación del EXIF. Sin eso, una foto sacada
  con el teléfono de costado se proyecta acostada en la pared del salón.
- **Sin metadatos.** El EXIF del original lleva el modelo del teléfono y muchas veces las
  coordenadas de dónde se sacó. La variante es lo que se muestra: no tiene por qué
  llevarlo.

### Antes que el original, nada

Si una foto no tiene variante, `varianteParaMirar` devuelve `null`. **Nunca cae al
original.** Cada pantalla decide qué hacer con el hueco:

| Pantalla | Qué hace |
|---|---|
| Panel de moderación | Recuadro que dice que la vista no está lista. Se puede decidir igual |
| Álbum y pantalla del salón | No la muestra. Un recuadro roto en la pared es peor que una foto de menos |
| SSE en vivo | La saltea **y avanza el cursor igual**: frenar en ella dejaría la pantalla clavada para siempre |

### Lo que no se reduce

Una foto **bloqueada** no se reduce: no aparece en ninguna pantalla, así que sería gastar
procesador y espacio en algo que nadie va a abrir. Una **retenida** sí, porque el panel de
revisión tiene que poder mostrarla.

### Si falla, la foto se decide igual

Una foto sin variante se puede volver a intentar; una foto sin decisión queda retenida para
siempre. El orden de importancia es ese.

Y para que ese "se puede volver a intentar" sea cierto, el cron de moderación también
levanta las **rezagadas**: las ya decididas que se quedaron sin variante. Sin eso una foto
sin variante es invisible para siempre, porque nadie vuelve a moderar una foto ya decidida.

### El original sale por un solo lado

Adentro del ZIP que se paga. `lib/paquete/armar.ts` es el único que lee `originalKey` para
entregar algo.
