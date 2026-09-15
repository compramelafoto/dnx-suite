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

## Lo que sigue abierto: la regla anti-bypass

El capítulo 12.4 dice que el fotógrafo **no descarga** las fotos de los invitados: esa es
la razón de existir del adicional de descarga. Si pudiera entregar los originales por su
cuenta, el adicional no se vendería nunca.

Hoy el panel de moderación le muestra **el original** con una URL firmada. Puede guardarlo
con el botón derecho. La regla está escrita y no está aplicada.

El arreglo no es un permiso: es no darle nunca los bytes del original. Hace falta generar
una variante reducida al subir y que el panel, la pantalla y el álbum miren esa.
`SubilafotoMediaVariant` existe en el modelo justamente para eso y está vacía.

**Es lo próximo.**
