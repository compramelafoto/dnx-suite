# @repo/design-studio

Diseña, valida y renderiza piezas con datos variables. Devuelve el archivo final.

**No hace:** emitir (a quién y cuándo es del producto), verificar (qué significa "habilitado"
lo sabe la página del QR), ni guardar archivos (eso ya está resuelto en R2).

## Uso

```ts
import { emitDesign } from "@repo/design-studio";

const salida = await emitDesign({
  document: plantillaGuardada,      // el JSON tal como salió de la base
  contract: CONTRATO_DEL_CARNET,
  values: { fullName: "Daniel Cuart", memberNumber: 128, /* … */ },
  formats: ["PDF", "PNG_PER_SIDE"],
  includeBleed: true,
  resources: { read: (ref) => leerDeR2(ref) },
  fileBaseName: `carnet-${numeroDeSocio}`,
});

if (!salida.ok) {
  // Los mensajes están escritos para mostrarlos tal cual.
  return { error: salida.errors.join(" ") };
}
// Guardar cada archivo junto con: salida.rendererVersion, salida.schemaVersion,
// salida.resolvedValues y el checksum de cada uno.
```

## Las reglas que no se negocian

- **Un dato obligatorio ausente detiene la emisión.** No se emite con el campo vacío.
- **Una versión publicada es inmutable.** Editar produce un borrador; publicar mueve el puntero.
- **Cada emisión guarda con qué se hizo**: versión del esquema, valores resueltos, versión del
  renderizador y checksum. Reproducir una pieza de hace dos años es volver a correr lo mismo.
- **El documento no contiene estructuras del editor.** Cambiar `react-rnd` no migra plantillas.
- **Las fechas se formatean en UTC, sin `Intl`.** Si no, el archivo dependería del servidor.
- **El PDF sale reproducible byte a byte.** Hay una prueba que lo verifica.

## Por qué el PDF no pasa por SVG

Convertir SVG a PNG con `sharp` resuelve las tipografías por `fontconfig` del sistema, y en
Vercel no están las de `@fontsource`: la pieza saldría con otra fuente y sin aviso. Por eso el
PDF se dibuja con `pdf-lib` + `fontkit`, que incrusta el WOFF y da texto vectorial, y el PNG se
rasteriza **del propio PDF**. El SVG queda para la vista en el navegador, donde las fuentes las
carga el CSS y donde SVG sí es la herramienta correcta.

Las dos salidas parten del mismo `LayoutPlan` y del mismo medidor de texto, así que el corte de
líneas de la pantalla y el de la imprenta no pueden separarse.

## Requisitos del entorno

Solo servidor. Lee los `.woff` de `@fontsource` en tiempo de ejecución y usa un binario nativo
para rasterizar (`pdf-to-png-converter`). Cualquier aplicación de Next que lo use tiene que
declararlo en `next.config.ts`:

```ts
transpilePackages: ["@repo/design-studio"],
serverExternalPackages: ["pdf-to-png-converter", "@napi-rs/canvas"],
outputFileTracingIncludes: {
  "/**": ["../../node_modules/.pnpm/@fontsource+*/node_modules/@fontsource/*/files/*.woff"],
},
```

Sin la última línea el rastreador de Next no copia las tipografías —la ruta se arma en tiempo
de ejecución y no puede verla—, así que **en local anda y en Vercel falla al emitir**.

## Estado

Este paquete es el **núcleo de render**. Todavía no incluye persistencia de plantillas y
versiones, congelado de recursos al publicar, ni editor visual. Ver
`docs/superpowers/specs/2026-08-26-modulo-de-diseno-design.md`.
